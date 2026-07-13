import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";
import chrome from "sinon-chrome";

chai.use(sinonChai);
mocha.setup("bdd");

import { downloadOrOpen } from "../../../models/downloadOrOpen";

describe("downloadOrOpen (#816)", () => {
  let windowOpenStub: sinon.SinonStub;

  before(() => {
    global.chrome.downloads.download = chrome.downloads.download;
  });

  beforeEach(() => {
    windowOpenStub = sinon.stub(window, "open");
  });

  afterEach(() => {
    windowOpenStub.restore();
    chrome.downloads.download.reset();
  });

  it("uses chrome.downloads.download when available, not window.open", () => {
    downloadOrOpen("blob:fake-url", "authenticator.json");
    expect(chrome.downloads.download).to.have.been.calledWith({
      url: "blob:fake-url",
      filename: "authenticator.json",
    });
    expect(windowOpenStub).to.not.have.been.called;
  });
});
