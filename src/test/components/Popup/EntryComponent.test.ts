import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

// Vue.extend({...}) returns a constructor whose .options exposes the merged
// methods/computed, callable directly without mounting — see plan notes.
import EntryComponent from "../../../components/Popup/EntryComponent.vue";

describe("EntryComponent onCounterChange (#1519)", () => {
  it("regenerates the code and persists the entry when the counter changes", () => {
    const fakeEntry = {
      generate: sinon.fake(),
      update: sinon.fake(),
      counter: 5,
    };
    (EntryComponent as any).options.methods.onCounterChange(fakeEntry);
    expect(fakeEntry.generate).to.have.been.calledOnce;
    expect(fakeEntry.update).to.have.been.calledOnce;
  });
});
