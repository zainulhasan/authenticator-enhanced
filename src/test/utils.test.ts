import "mocha";
import * as chai from "chai";
import { expect } from "chai";

mocha.setup("bdd");

import { isMatchedEntry } from "../utils";

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
