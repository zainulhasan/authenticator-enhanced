import "mocha";
import * as chai from "chai";
import { expect } from "chai";

mocha.setup("bdd");

import { EntryStorage } from "../../models/storage";
import { Encryption } from "../../models/encryption";
import { OTPAlgorithm, OTPType } from "../../models/otp";

describe("EntryStorage.import algorithm/type parsing (#1451)", () => {
  it("correctly parses a non-default algorithm (SHA256) instead of falling back to SHA1", async () => {
    const encryption = new Encryption("", "");
    // EntryStorage.import() overwrites any hash that isn't a valid UUID with
    // a freshly generated crypto.randomUUID() (see the "not a valid / old
    // hash" check in storage.ts), so a plain string here would never be
    // found again via EntryStorage.get() below.
    const hash = crypto.randomUUID();
    await EntryStorage.import(encryption, {
      [hash]: {
        account: "test",
        counter: 0,
        encrypted: false,
        hash,
        index: 0,
        issuer: "",
        secret: "abcd2345",
        type: "totp",
        algorithm: "SHA256",
      } as any,
    });
    const entries = await EntryStorage.get();
    const imported = entries.find((e: any) => e.hash === hash);
    expect(imported).to.not.be.undefined;
    expect(imported!.algorithm).to.eq(OTPAlgorithm.SHA256);
  });

  it("correctly parses a non-default type (hotp) instead of falling back to totp", async () => {
    const encryption = new Encryption("", "");
    const hash = crypto.randomUUID();
    await EntryStorage.import(encryption, {
      [hash]: {
        account: "test",
        counter: 0,
        encrypted: false,
        hash,
        index: 0,
        issuer: "",
        secret: "abcd2345",
        type: "hotp",
      } as any,
    });
    const entries = await EntryStorage.get();
    const imported = entries.find((e: any) => e.hash === hash);
    expect(imported).to.not.be.undefined;
    expect(imported!.type).to.eq(OTPType.hotp);
  });

  it("falls back to SHA1 when no algorithm is provided", async () => {
    const encryption = new Encryption("", "");
    const hash = crypto.randomUUID();
    await EntryStorage.import(encryption, {
      [hash]: {
        account: "test",
        counter: 0,
        encrypted: false,
        hash,
        index: 0,
        issuer: "",
        secret: "abcd2345",
        type: "totp",
      } as any,
    });
    const entries = await EntryStorage.get();
    const imported = entries.find((e: any) => e.hash === hash);
    expect(imported).to.not.be.undefined;
    expect(imported!.algorithm).to.eq(OTPAlgorithm.SHA1);
  });
});
