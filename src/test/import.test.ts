import "mocha";
import * as chai from "chai";
import { expect } from "chai";

mocha.setup("bdd");

import { getEntryDataFromOTPAuthPerLine } from "../import";

describe("getEntryDataFromOTPAuthPerLine Base32 padding gate (#1547)", () => {
  it("pads an unpadded Base32 TOTP secret to a multiple of 8", async () => {
    // "JBSWY3DP" is 8 chars already valid Base32; use a shorter unpadded one.
    const line = "otpauth://totp/Test:user?secret=JBSWY3D&issuer=Test";
    const { exportData, succeededCount } = await getEntryDataFromOTPAuthPerLine(
      line
    );
    expect(succeededCount).to.eq(1);
    const entry = Object.values(exportData)[0] as any;
    expect(entry.secret.length % 8).to.eq(0);
    expect(entry.secret).to.eq("JBSWY3D=");
  });

  it("does not pad a hex-classified secret, even if its length isn't a multiple of 8", async () => {
    // A 21-char lowercase-hex string: valid hex, NOT valid Base32 (contains
    // digits outside the 2-7 range), classified as type "hex".
    const hexSecret = "2c52e8fcfac34091da63e"; // 21 hex chars, %8 !== 0
    const line = `otpauth://totp/Test:user?secret=${hexSecret}&issuer=Test`;
    const { exportData, succeededCount } = await getEntryDataFromOTPAuthPerLine(
      line
    );
    expect(succeededCount).to.eq(1);
    const entry = Object.values(exportData)[0] as any;
    expect(entry.type).to.eq("hex");
    expect(entry.secret).to.eq(hexSecret);
    expect(entry.secret).to.not.include("=");
  });

  it("does not pad a hhex-classified secret (HOTP + hex)", async () => {
    // 23 chars, deliberately NOT a multiple of 8, so this actually
    // exercises the padding gate (a length that's already a multiple of 8
    // would pass even without the fix, since the length%8 guard alone would
    // skip it).
    const hexSecret = "2c52e8fcfac34091da63ef7";
    const line = `otpauth://hotp/Test:user?secret=${hexSecret}&issuer=Test&counter=0`;
    const { exportData, succeededCount } = await getEntryDataFromOTPAuthPerLine(
      line
    );
    expect(succeededCount).to.eq(1);
    const entry = Object.values(exportData)[0] as any;
    expect(entry.type).to.eq("hhex");
    expect(entry.secret).to.eq(hexSecret);
    expect(entry.secret).to.not.include("=");
  });
});
