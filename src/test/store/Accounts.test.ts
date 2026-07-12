import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { UserSettings } from "../../models/settings";

// Minimal AccountsState shape sufficient to exercise updateCodes' seconds
// calculation without needing real OTPEntry/encryption setup.
function makeState() {
  return {
    entries: [],
    sectorStart: false,
    sectorOffset: 0,
    second: 0,
  };
}

// updateCodes is a plain Vuex mutation function of shape (state) => void that
// reads UserSettings.items.offset module-globally and only touches
// state.second / state.sectorStart / state.sectorOffset when state.entries
// is empty (both loops in the mutation body no-op on an empty array), so it
// can be invoked directly without constructing a full Vuex store.
import { Accounts } from "../../store/Accounts";

describe("Accounts.updateCodes seconds arithmetic (#1310)", () => {
  let clock: sinon.SinonFakeTimers;

  afterEach(() => {
    if (clock) {
      clock.restore();
    }
    delete UserSettings.items.offset;
  });

  it("keeps second non-negative for a large negative offset (old code: (10 + -75 + 60) % 60 = -5, a negative value)", async () => {
    // 2024-01-01T00:00:10Z -> getSeconds() === 10
    // Only Date is faked: getModule() awaits UserSettings.updateItems() and
    // other chrome.storage-backed calls internally, some of which race
    // against a real setTimeout fallback (see ManagedStorage.get); faking
    // setTimeout/global timers here would freeze that fallback and hang
    // the test instead of letting it resolve.
    clock = sinon.useFakeTimers({
      now: new Date("2024-01-01T00:00:10Z").getTime(),
      toFake: ["Date"],
    });
    const state = makeState();
    const module = await new Accounts().getModule();
    // Must be set after getModule() resolves: getModule() internally awaits
    // UserSettings.updateItems(), which reassigns UserSettings.items wholesale
    // from storage, clobbering any properties set before the call.
    UserSettings.items.offset = -75; // new code: 10 + -75 = -65 -> 60 - (65 % 60) = 55
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(55);
    expect(state.second).to.be.at.least(0);
    expect(state.second).to.be.below(60);
  });

  it("matches plain modulo behavior for a small positive offset", async () => {
    clock = sinon.useFakeTimers({
      now: new Date("2024-01-01T00:00:10Z").getTime(),
      toFake: ["Date"],
    });
    const state = makeState();
    const module = await new Accounts().getModule();
    UserSettings.items.offset = 5;
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(15);
  });

  it("wraps correctly for an offset that pushes seconds negative by a non-multiple of 60", async () => {
    // 2024-01-01T00:00:05Z -> getSeconds() === 5
    clock = sinon.useFakeTimers({
      now: new Date("2024-01-01T00:00:05Z").getTime(),
      toFake: ["Date"],
    });
    const state = makeState();
    const module = await new Accounts().getModule();
    UserSettings.items.offset = -20; // 5 - 20 = -15 -> expected: 60 - 15 = 45
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(45);
  });
});
