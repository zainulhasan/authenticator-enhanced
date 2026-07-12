import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";
import chrome from "sinon-chrome";

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

describe("EntryComponent favicon feature (#1554)", () => {
  const originalGetURL = global.chrome.runtime.getURL;

  before(() => {
    global.chrome.runtime.getURL = chrome.runtime.getURL;
  });

  after(() => {
    // Restore the real chrome.runtime.getURL: MenuPage's tests (which run
    // right after this file in the bundled test page) call it indirectly via
    // loadI18nMessages(), and leaving the sinon-chrome stub in place breaks
    // that fetch with a JSON parse error.
    global.chrome.runtime.getURL = originalGetURL;
  });

  afterEach(() => {
    chrome.runtime.getURL.reset();
  });

  it("shouldShowFavicon reflects the menu store's showFavicon flag", () => {
    const shouldShowFavicon = (EntryComponent as any).options.computed
      .shouldShowFavicon;
    const fakeThisOn = { $store: { state: { menu: { showFavicon: true } } } };
    const fakeThisOff = {
      $store: { state: { menu: { showFavicon: false } } },
    };
    // isFirefox/isSafari are both false in the real Chrome environment this
    // test suite runs in (Puppeteer-driven Chrome), so this exercises the
    // showFavicon-gated branch directly.
    expect(shouldShowFavicon.call(fakeThisOn)).to.eq(true);
    expect(shouldShowFavicon.call(fakeThisOff)).to.eq(false);
  });

  it("getFaviconUrl builds a same-origin _favicon URL with the target page URL and a 16px size", () => {
    chrome.runtime.getURL
      .withArgs("/_favicon/")
      .returns("chrome-extension://fakeid/_favicon/");
    const getFaviconUrl = (EntryComponent as any).options.methods.getFaviconUrl;
    const url = getFaviconUrl("example.com");
    expect(url).to.include("chrome-extension://fakeid/_favicon/");
    expect(url).to.include("pageUrl=https%3A%2F%2Fexample.com");
    expect(url).to.include("size=16");
  });
});
