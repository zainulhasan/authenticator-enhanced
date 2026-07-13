import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { isMatchedEntry, ensureContentScriptHostPermission } from "../utils";

function makeEntry(issuer: string) {
  return { issuer } as any;
}

describe("isMatchedEntry Issuer::domain scoping (#164)", () => {
  it("does not match a different subdomain scoped to the same base domain", () => {
    const siteName = [null, null, "sub1.domain.com"];
    const entry = makeEntry("MyService::sub2.domain.com");
    expect(isMatchedEntry(siteName, entry)).to.eq(false);
  });

  it("matches the exact subdomain it's scoped to", () => {
    const siteName = [null, null, "sub1.domain.com"];
    const entry = makeEntry("MyService::sub1.domain.com");
    expect(isMatchedEntry(siteName, entry)).to.eq(true);
  });

  it("matches any subdomain when scoped to the bare base domain", () => {
    const siteName = [null, null, "sub1.domain.com"];
    const entry = makeEntry("MyService::domain.com");
    expect(isMatchedEntry(siteName, entry)).to.eq(true);
  });

  it("does not match an unrelated domain that happens to contain the same substring", () => {
    const siteName = [null, null, "notdomain.com.evil.com"];
    const entry = makeEntry("MyService::domain.com");
    expect(isMatchedEntry(siteName, entry)).to.eq(false);
  });
});

describe("ensureContentScriptHostPermission (#878)", () => {
  afterEach(() => {
    sinon.restore();
  });

  it("returns true without prompting when permission is already granted", async () => {
    const containsStub = sinon
      .stub(chrome.permissions, "contains")
      .resolves(true);
    const requestStub = sinon.stub(chrome.permissions, "request");
    const result = await ensureContentScriptHostPermission({
      id: 1,
      url: "https://example.com/login",
    } as any);
    expect(result).to.eq(true);
    expect(requestStub).to.not.have.been.called;
    containsStub.restore();
  });

  it("requests permission when not already granted, and returns the grant result", async () => {
    sinon.stub(chrome.permissions, "contains").resolves(false);
    const requestStub = sinon
      .stub(chrome.permissions, "request")
      .resolves(true);
    const result = await ensureContentScriptHostPermission({
      id: 1,
      url: "https://example.com/login",
    } as any);
    expect(result).to.eq(true);
    expect(requestStub).to.have.been.calledWith({
      origins: ["https://example.com/*"],
    });
  });

  it("returns false for a non-injectable URL without checking permissions", async () => {
    const containsStub = sinon.stub(chrome.permissions, "contains");
    const result = await ensureContentScriptHostPermission({
      id: 1,
      url: "chrome://extensions",
    } as any);
    expect(result).to.eq(false);
    expect(containsStub).to.not.have.been.called;
    containsStub.restore();
  });
});
