import "mocha";
import * as chai from "chai";
import { expect } from "chai";
import CryptoJS from "crypto-js";

mocha.setup("bdd");

import { getOTPAuthPerLineFromOPTAuthMigration } from "../../models/migration";

// Builds a minimal otpauth-migration:// payload for one TOTP entry, using
// the same length-prefixed binary layout getOTPAuthPerLineFromOPTAuthMigration
// parses (see src/models/migration.ts's offset arithmetic). Each field the
// parser reads is preceded by a 1-byte "tag" that the parser never inspects
// (it only skips over it via the offset math), so the layout is:
//   0x0A, lineLength,
//   <secretTag>, secretLength, <secret bytes>,
//   <accountTag>, accountLength, <account bytes, UTF-8>,
//   <issuerTag>, issuerLength, <issuer bytes, UTF-8>,
//   <algorithmTag>, algorithmIndex,
//   <digitsTag>, digitsIndex,
//   <typeTag>, typeIndex
// lineLength must equal the body length (everything after the lineLength
// byte itself), i.e. 12 + secretLength + accountLength + issuerLength.
function buildMigrationPayload(
  secret: string,
  account: string,
  issuer: string
) {
  const secretBytes = Array.from(secret).map((c) => c.charCodeAt(0));
  const accountBytes = Array.from(new TextEncoder().encode(account));
  const issuerBytes = Array.from(new TextEncoder().encode(issuer));

  const body: number[] = [];
  body.push(0); // secret field tag (unused by parser)
  body.push(secretBytes.length);
  body.push(...secretBytes);
  body.push(0); // account field tag (unused by parser)
  body.push(accountBytes.length);
  body.push(...accountBytes);
  body.push(0); // issuer field tag (unused by parser)
  body.push(issuerBytes.length);
  body.push(...issuerBytes);
  body.push(0); // algorithm field tag (unused by parser)
  body.push(1); // algorithm index -> "SHA1"
  body.push(0); // digits field tag (unused by parser)
  body.push(0); // digits index -> 6
  body.push(0); // type field tag (unused by parser)
  body.push(0); // type index -> "totp"

  const line = [0x0a, body.length, ...body];
  // CryptoJS's runtime WordArray.create() accepts a Uint8Array of raw bytes
  // (it packs them 4-per-word and sets sigBytes accordingly), even though
  // @types/crypto-js only declares a number[]-of-words overload. Cast to
  // satisfy the type checker without going through the wrong overload.
  const wordArray = CryptoJS.lib.WordArray.create(
    (new Uint8Array(line) as unknown) as number[]
  );
  const base64 = CryptoJS.enc.Base64.stringify(wordArray);
  return `otpauth-migration://offline?data=${encodeURIComponent(base64)}`;
}

describe("getOTPAuthPerLineFromOPTAuthMigration UTF-8 decoding (#1182)", () => {
  it("correctly decodes a Chinese account name instead of corrupting it", () => {
    const migrationUri = buildMigrationPayload(
      "ABCD2345",
      "测试账户",
      "TestIssuer"
    );
    const lines = getOTPAuthPerLineFromOPTAuthMigration(migrationUri);
    expect(lines.length).to.eq(1);
    const decodedAccount = decodeURIComponent(
      lines[0].split("otpauth://totp/")[1].split("?")[0]
    );
    expect(decodedAccount).to.eq("测试账户");
  });

  it("correctly decodes and round-trips an ASCII account name unchanged", () => {
    const migrationUri = buildMigrationPayload(
      "ABCD2345",
      "user@example.com",
      "TestIssuer"
    );
    const lines = getOTPAuthPerLineFromOPTAuthMigration(migrationUri);
    expect(lines.length).to.eq(1);
    const decodedAccount = decodeURIComponent(
      lines[0].split("otpauth://totp/")[1].split("?")[0]
    );
    expect(decodedAccount).to.eq("user@example.com");
  });
});
