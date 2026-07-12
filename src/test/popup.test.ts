import "mocha";
import * as sinon from "sinon";
import { expect } from "chai";
import { UserSettings } from "../models/settings";

mocha.setup("bdd");

describe("popup init error handling (#533)", () => {
  // The shared mocha test page (view/test.html) has no #authenticator
  // element -- only view/popup.html (the real popup page) has it. Create
  // one here, before requiring "../popup" below, since its real
  // init().catch() handler looks up "#authenticator" the moment init()
  // rejects.
  const root = document.createElement("div");
  root.id = "authenticator";
  document.body.appendChild(root);

  // Force init()'s very first meaningful await (UserSettings.updateItems())
  // to reject. This MUST be installed before "../popup" is required below:
  // requiring it synchronously runs its real, unmodified top-level
  // `init().catch(...)` call -- the exact wiring this task added at the
  // bottom of src/popup.ts, the same call production makes when the popup
  // page loads.
  const updateItemsStub = sinon
    .stub(UserSettings, "updateItems")
    .rejects(new Error("simulated init failure (#533 regression test)"));

  // "../popup" isn't imported anywhere else in the test bundle, so this is
  // its first (and only) load in this run. describe() callback bodies run
  // synchronously at module-evaluation time, before mocha.run() executes
  // any it() -- but a real ES `import` declaration is always hoisted above
  // this point regardless of where it's textually written, which would
  // evaluate "../popup" (and thus call the real UserSettings.updateItems())
  // before the stub above could be installed. A webpack `require()` call,
  // by contrast, runs exactly where it's written, giving the ordering
  // guarantee this test depends on: stub first, then load the real module.
  const popupModule = require("../popup");

  after(() => {
    document.body.removeChild(root);
  });

  it("real init() rejection renders fallback content in #authenticator instead of leaving it blank", async () => {
    expect(
      typeof popupModule.init,
      "init should be exported as a function"
    ).to.eq("function");

    // The require() above already kicked off the real init().catch(...)
    // chain as a side effect. The stubbed rejection resolves on a
    // microtask, but poll with a real timeout margin rather than assume a
    // fixed number of ticks.
    const deadline = Date.now() + 2000;
    while (root.textContent === "" && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 10));
    }

    expect(
      updateItemsStub.called,
      "stub should have been invoked by the real init()"
    ).to.eq(true);
    expect(root.textContent).to.include("failed to load");
  });
});
