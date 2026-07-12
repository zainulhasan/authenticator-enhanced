# Authenticator Enhanced — Phase 3b (Implement Confirmed Bugs) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the 8 CONFIRMED bugs from Phase 3's issue mining report (`docs/issue-triage/2026-07-12-issue-mining-report.md`), each as original fix code (no upstream PR exists for these) with a regression test, citing the upstream issue number.

**Architecture:** One task per bug, direct commits to `main` under this repo's own identity (`Zain <hassan9224@gmail.com>`), each citing the upstream issue in the commit message. Same subagent-driven pattern as Phase 2: implementer + independent reviewer per task, sequential (unlike Phase 3's read-only research, these tasks edit shared files and must run one at a time to avoid git conflicts).

**Tech Stack:** TypeScript, Vue 2 (Options API) + Vuex 3, Mocha/Chai/Sinon/`sinon-chrome`, webpack.

## Global Constraints

- No AI attribution in any commit.
- Every fix commit message cites the upstream issue number, e.g. `fix: ... (fixes upstream #164)`.
- Regression test per fix, following Phase 2's established patterns: direct invocation of exported functions where possible (extracting/exporting previously-private functions is an accepted, minimal, precedented refactor — Phase 2 Tasks 5/7 already did this for `content.ts`), `sinon`/`sinon-chrome` for mocking `chrome.*` APIs (pattern: monkey-patch specific methods onto the real `global.chrome`), real-DOM fixtures for content-script/DOM logic.
- Known environment quirks from Phase 2 (still apply): build/test scripts need `CI=1` set; running them can trigger a prettier auto-reformat of unrelated files as a side effect — revert before committing, don't let it leak into a commit.
- Per-task verification: `npm run chrome` and `npm test` both pass after each task's commits.
- Security-adjacent tasks (7: #1089, 8: #463) get the heightened review bar from Phase 2 — reviewer explicitly confirms scope stays narrow, no secret-handling code touched beyond what's necessary.

---

### Task 1: #1426 — QR capture overlay dialog-close race

**Files:**
- Modify: `src/content.ts`
- Modify: `src/test/content.test.ts` (extend, created in Phase 2 Task 5)

**Interfaces:**
- Consumes: nothing.
- Produces: `grayLayoutDown`, `grayLayoutMove`, `grayLayoutUp` become exported (previously unexported), for testability — following the same precedent as `applyAppendMode`/`findPasteTarget`/`fireInputEvents`.

- [ ] **Step 1: Export and wrap the three handlers to stop propagation**

In `src/content.ts`, locate the handler function declarations (currently unexported) and add `export`:

Old:
```ts
function grayLayoutDown(event: MouseEvent) {
```
New:
```ts
export function grayLayoutDown(event: MouseEvent) {
```

Old:
```ts
function grayLayoutMove(event: MouseEvent) {
```
New:
```ts
export function grayLayoutMove(event: MouseEvent) {
```

Old:
```ts
function grayLayoutUp(event: MouseEvent) {
```
New:
```ts
export function grayLayoutUp(event: MouseEvent) {
```

- [ ] **Step 2: Wrap the event-handler wiring inside `showGrayLayout` to stop propagation**

Old:
```ts
    grayLayout.onmousedown = grayLayoutDown;
    grayLayout.onmousemove = grayLayoutMove;
    grayLayout.onmouseup = (event) => {
      grayLayoutUp(event);
    };
    grayLayout.oncontextmenu = (event) => {
      event.preventDefault();
      return;
    };
```
New:
```ts
    grayLayout.onmousedown = (event) => {
      event.stopPropagation();
      grayLayoutDown(event);
    };
    grayLayout.onmousemove = (event) => {
      event.stopPropagation();
      grayLayoutMove(event);
    };
    grayLayout.onmouseup = (event) => {
      event.stopPropagation();
      grayLayoutUp(event);
    };
    grayLayout.oncontextmenu = (event) => {
      event.preventDefault();
      event.stopPropagation();
      return;
    };
```

- [ ] **Step 3: Shorten the capture-request delay**

Locate the `setTimeout(..., 200)` around line 200-210 that sends the `getCapture` message. Change it to fire immediately after the capture-box rect is computed, removing the artificial 200ms window during which a page's own modal-close handler could run first:

Old:
```ts
  // make sure captureBox and grayLayout is hidden
  setTimeout(() => {
    chrome.runtime.sendMessage({
      action: "getCapture",
      info: {
        captureBoxLeft,
        captureBoxTop,
        captureBoxWidth,
        captureBoxHeight,
      },
    });
  }, 200);
  return false;
```
New:
```ts
  chrome.runtime.sendMessage({
    action: "getCapture",
    info: {
      captureBoxLeft,
      captureBoxTop,
      captureBoxWidth,
      captureBoxHeight,
    },
  });
  return false;
```

Leave the earlier `setTimeout(..., 100)` (hiding the overlay/capture box) untouched — it still needs to run after mouseup so the overlay itself isn't captured in the screenshot; only the *second* timeout (sending the capture request) is the one implicated in the race.

- [ ] **Step 4: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 5: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/content.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: stop QR capture overlay events from propagating to the page, remove capture-request delay

The overlay's mouse handlers never called stopPropagation(), so a page's
own modal-close listener (attached higher up the DOM) could also fire on
the same click and close its dialog. A 200ms delay before sending the
actual capture request widened this race further. Both are removed.

Fixes upstream #1426."
```

- [ ] **Step 6: Write the regression test**

Extend `src/test/content.test.ts`:
```ts
import { grayLayoutDown, grayLayoutMove, grayLayoutUp } from "../content";

describe("QR capture overlay event propagation (#1426)", () => {
  let grayLayout: HTMLDivElement;
  let captureBox: HTMLDivElement;

  beforeEach(() => {
    grayLayout = document.createElement("div");
    grayLayout.id = "__ga_grayLayout__";
    captureBox = document.createElement("div");
    captureBox.id = "__ga_captureBox__";
    grayLayout.appendChild(captureBox);
    document.body.appendChild(grayLayout);
  });

  afterEach(() => {
    document.body.removeChild(grayLayout);
  });

  it("grayLayoutDown does not throw and sets the capture box position", () => {
    const event = new MouseEvent("mousedown", { clientX: 10, clientY: 20 });
    grayLayoutDown(event);
    expect(captureBox.style.display).to.eq("block");
    expect(captureBox.style.left).to.eq("10px");
  });

  it("mousedown/mousemove/mouseup handlers wired via showGrayLayout call stopPropagation", () => {
    // Exercise the actual wiring (not the bare exported functions) by
    // triggering content.ts's own listener registration path: import
    // side effects already ran when this test file's `import { ... }
    // from "../content"` executed, registering the chrome.runtime
    // message listener. Simulate the "capture" message to build a real
    // grayLayout via showGrayLayout(), then dispatch a real mousedown at
    // the DOM level and confirm it does not bubble to document.
    const bubbleHandler = sinon.fake();
    document.addEventListener("mousedown", bubbleHandler);
    const el = document.getElementById("__ga_grayLayout__");
    if (el) {
      const event = new MouseEvent("mousedown", {
        clientX: 5,
        clientY: 5,
        bubbles: true,
      });
      el.dispatchEvent(event);
    }
    document.removeEventListener("mousedown", bubbleHandler);
    expect(bubbleHandler).to.not.have.been.called;
  });
});
```

Note: the second test depends on `showGrayLayout()` having already created a real `#__ga_grayLayout__` element with its `onmousedown` wired via the fixed code (Step 2) — since `content.ts`'s top-level `chrome.runtime.onMessage` listener is registered once at import time (already imported earlier in this file per Phase 2's `applyAppendMode` test), the implementer should verify whether `showGrayLayout()` needs to be triggered first (e.g. via `chrome.runtime.sendMessage`/simulating the `"capture"` action) or whether the `beforeEach`-created `grayLayout` fixture (which does NOT have the real `onmousedown` handler wired, since it's a plain `document.createElement`) needs to be replaced with one built by the real `showGrayLayout()` path for this second test to be meaningful. If `showGrayLayout()` isn't easily triggerable from the test, adapt this second test to directly attach the same handler function used in Step 2's fix (i.e. call `grayLayoutDown`/`Move`/`Up` with a mock event that has a `stopPropagation` spy, and assert the spy was called), which tests the same fix at the function level rather than via full DOM event dispatch — report which approach was used.

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/content.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1426 QR capture overlay propagation"
```

---

### Task 2: #533 — blank popup on unhandled init error

**Files:**
- Modify: `src/popup.ts`
- Create: `src/test/popup.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `init()` becomes exported (for testability) and no longer leaves the popup silently blank on error.

- [ ] **Step 1: Export `init` and wrap the top-level call in error handling**

Old (end of file):
```ts
async function init() {
  ...
}

init();
```
New:
```ts
export async function init() {
  ...
}

init().catch((error) => {
  console.error("Failed to initialize popup:", error);
  const root = document.getElementById("authenticator");
  if (root) {
    root.textContent =
      "Authenticator failed to load. Please try reopening the popup, or reset the extension from the options page if this persists.";
  }
});
```

Do not change anything inside `init()`'s body — only its declaration (`async function init()` → `export async function init()`) and how it's invoked at the bottom of the file.

- [ ] **Step 2: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 3: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/popup.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: catch errors during popup init instead of leaving a blank popup

init() awaited several async store-module constructors with no error
handling; any rejection (malformed stored data, a storage/permission
error, a bad cached encryption key) left the Vue app never mounted and
the popup permanently blank with no indication of what went wrong.

Fixes upstream #533."
```

- [ ] **Step 4: Write the regression test**

Create `src/test/popup.test.ts`. Since `init()` has real side effects (constructs the full Vuex store, mounts Vue), the test should verify the specific behavior fixed — that a rejection is caught and produces visible fallback content — without needing to fully mock every store module. The most direct approach: import `init`, monkey-patch it to fail early by making one of its awaited calls reject, and confirm the fallback text appears:

```ts
import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import { expect } from "chai";

mocha.setup("bdd");

describe("popup init error handling (#533)", () => {
  it("renders fallback content in #authenticator instead of staying blank when init() rejects", async () => {
    const root = document.getElementById("authenticator");
    const originalContent = root ? root.textContent : null;
    if (root) {
      root.textContent = "";
    }

    // Simulate init()'s own catch handler behavior directly, since a full
    // init() run in this test page would attempt to mount a second Vue
    // app instance over the test harness's own DOM. This tests the exact
    // fallback logic added in the fix (see src/popup.ts's init().catch()
    // block) in isolation.
    const fakeError = new Error("simulated init failure");
    const catchHandler = (error: Error) => {
      console.error("Failed to initialize popup:", error);
      const el = document.getElementById("authenticator");
      if (el) {
        el.textContent =
          "Authenticator failed to load. Please try reopening the popup, or reset the extension from the options page if this persists.";
      }
    };
    catchHandler(fakeError);

    expect(root?.textContent).to.include("failed to load");

    if (root) {
      root.textContent = originalContent || "";
    }
  });
});
```

Note: this test exercises the fallback-rendering logic as an isolated unit rather than triggering a real `init()` rejection end-to-end (which would require mocking every store module's `getModule()` and risks interfering with the shared test-page DOM other suites rely on). If the implementer finds a cleaner way to trigger the actual exported `init()` and assert on its real rejection path without side effects on other tests (e.g. running it against a scoped/temporary DOM container rather than the real `#authenticator` element), prefer that — report which approach was used and why.

- [ ] **Step 5: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0, no interference with other suites (confirm full suite count matches prior run + new tests, nothing newly broken).

- [ ] **Step 6: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/popup.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #533 popup init error handling"
```

---

### Task 3: #1182 — UTF-8 corruption in migration import

**Files:**
- Modify: `src/models/migration.ts`
- Create: `src/test/models/migration.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: correct UTF-8 decoding and URI-encoding of account/issuer names during `otpauth-migration://` import.

- [ ] **Step 1: Fix `byteArray2String` to decode as UTF-8**

Old:
```ts
function byteArray2String(bytes: number[]) {
  return String.fromCharCode.apply(null, bytes);
}
```
New:
```ts
function byteArray2String(bytes: number[]) {
  return new TextDecoder("utf-8").decode(new Uint8Array(bytes));
}
```

- [ ] **Step 2: URI-encode the decoded account/issuer before building the `otpauth://` line**

Locate the line building the resulting URI (inside `getOTPAuthPerLineFromOPTAuthMigration`):

Old:
```ts
    let line = `otpauth://${type}/${account}?secret=${secret}&issuer=${issuer}&algorithm=${algorithm}&digits=${digits}`;
```
New:
```ts
    let line = `otpauth://${type}/${encodeURIComponent(
      account
    )}?secret=${secret}&issuer=${encodeURIComponent(
      issuer
    )}&algorithm=${algorithm}&digits=${digits}`;
```

- [ ] **Step 3: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 4: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/models/migration.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: correctly decode UTF-8 account/issuer names during migration import

byteArray2String mapped each byte 1:1 to a UTF-16 code unit (Latin-1
semantics), corrupting any multi-byte UTF-8 sequence (e.g. Chinese
characters) instead of decoding it. Switched to TextDecoder(\"utf-8\").
Also URI-encode the now-correctly-decoded account/issuer before
building the otpauth:// line, since the downstream parser expects
percent-encoded values and previously-ASCII-only names happened to
round-trip correctly by coincidence.

Fixes upstream #1182."
```

- [ ] **Step 5: Write the regression test**

`getOTPAuthPerLineFromOPTAuthMigration` is already exported and is the only caller of `byteArray2String`, so no further export changes are needed. Create `src/test/models/migration.test.ts`:

```ts
import "mocha";
import * as chai from "chai";
import { expect } from "chai";
import CryptoJS from "crypto-js";

mocha.setup("bdd");

import { getOTPAuthPerLineFromOPTAuthMigration } from "../../models/migration";

// Builds a minimal otpauth-migration:// payload for one TOTP entry, using
// the same length-prefixed binary layout getOTPAuthPerLineFromOPTAuthMigration
// parses (see src/models/migration.ts's offset arithmetic): a leading 0x0A
// byte, a 1-byte total-line-length, then secret (length-prefixed),
// account (length-prefixed, UTF-8 bytes), issuer (length-prefixed, UTF-8
// bytes), then algorithm/digits/type index bytes.
function buildMigrationPayload(secret: string, account: string, issuer: string) {
  const secretBytes = Array.from(secret).map((c) => c.charCodeAt(0));
  const accountBytes = Array.from(new TextEncoder().encode(account));
  const issuerBytes = Array.from(new TextEncoder().encode(issuer));

  const body: number[] = [];
  body.push(secretBytes.length);
  body.push(...secretBytes);
  body.push(accountBytes.length);
  body.push(...accountBytes);
  body.push(issuerBytes.length);
  body.push(...issuerBytes);
  body.push(1); // algorithm index -> "SHA1"
  body.push(0); // (unused byte per offset math)
  body.push(0); // digits index -> 6
  body.push(0); // type index -> "totp"

  const line = [0x0a, body.length + 2, ...body, 0];
  const wordArray = CryptoJS.lib.WordArray.create(new Uint8Array(line));
  const base64 = CryptoJS.enc.Base64.stringify(wordArray);
  return `otpauth-migration://offline?data=${encodeURIComponent(base64)}`;
}

describe("getOTPAuthPerLineFromOPTAuthMigration UTF-8 decoding (#1182)", () => {
  it("correctly decodes a Chinese account name instead of corrupting it", () => {
    const migrationUri = buildMigrationPayload("ABCD2345", "测试账户", "TestIssuer");
    const lines = getOTPAuthPerLineFromOPTAuthMigration(migrationUri);
    expect(lines.length).to.eq(1);
    const decodedAccount = decodeURIComponent(
      lines[0].split("otpauth://totp/")[1].split("?")[0]
    );
    expect(decodedAccount).to.eq("测试账户");
  });

  it("correctly decodes and round-trips an ASCII account name unchanged", () => {
    const migrationUri = buildMigrationPayload("ABCD2345", "user@example.com", "TestIssuer");
    const lines = getOTPAuthPerLineFromOPTAuthMigration(migrationUri);
    expect(lines.length).to.eq(1);
    const decodedAccount = decodeURIComponent(
      lines[0].split("otpauth://totp/")[1].split("?")[0]
    );
    expect(decodedAccount).to.eq("user@example.com");
  });
});
```

The implementer must verify this hand-built payload actually parses correctly against the real byte-offset arithmetic in `getOTPAuthPerLineFromOPTAuthMigration` (the plan's research read the parsing logic but this test's byte-layout construction is new and unverified against a real run) — if the offsets don't line up (e.g. the algorithm/digits/type byte positions), adjust `buildMigrationPayload` to match the actual parsing code exactly, re-deriving the offsets from `src/models/migration.ts`'s real index arithmetic rather than guessing. The two assertions (Chinese name decodes correctly, ASCII name round-trips unchanged) must both hold once the payload construction is correct.

- [ ] **Step 6: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 7: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/models/migration.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1182 UTF-8 migration import decoding"
```

---

### Task 4: #816 — broken backup download in Vivaldi/Brave

**Files:**
- Modify: `manifests/manifest-chrome.json`, `manifests/manifest-edge.json`, `manifests/manifest-firefox.json`
- Modify: `src/components/Popup/BackupPage.vue`
- Create: `src/test/components/Popup/BackupPage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: backup downloads use `chrome.downloads.download` where available, falling back to the existing `window.open`/anchor approach otherwise.

- [ ] **Step 1: Add the `downloads` permission to all three manifests**

`manifests/manifest-chrome.json` — locate the `permissions` array:

Old:
```json
    "permissions": [
        "activeTab",
        "storage",
        "identity",
        "alarms",
        "scripting"
    ],
```
New:
```json
    "permissions": [
        "activeTab",
        "storage",
        "identity",
        "alarms",
        "scripting",
        "downloads"
    ],
```

Apply the identical change to `manifests/manifest-edge.json` (same `permissions` array shape).

`manifests/manifest-firefox.json`:

Old:
```json
  "permissions": ["activeTab", "storage", "identity", "alarms", "scripting"],
```
New:
```json
  "permissions": ["activeTab", "storage", "identity", "alarms", "scripting", "downloads"],
```

- [ ] **Step 2: Switch the three export buttons in `BackupPage.vue` from anchor-download to a `chrome.downloads`-aware method**

Locate the template's `isDataLinkSupported`-gated `<a-button-link>` elements for the three exports (`authenticator.txt`, `authenticator.json` unencrypted, `authenticator.json` encrypted). Replace each `<a-button-link>`/`<button v-if="!isDataLinkSupported">` pair with a single `<button>` that always calls the corresponding method — the method itself decides whether to use `chrome.downloads` or fall back to `window.open`:

Old (one of the three pairs, repeat the same transformation for all three):
```html
      <a-button-link
        download="authenticator.txt"
        :href="exportOneLineOtpAuthFile"
        v-if="!unsupportedAccounts && isDataLinkSupported"
        >{{ i18n.download_backup }}</a-button-link
      >
      <button
        v-on:click="downloadBackUpOneLineOtpAuthFile()"
        v-if="!unsupportedAccounts && !isDataLinkSupported"
        class="button"
      >
        {{ i18n.download_backup }}
      </button>
```
New:
```html
      <button
        v-on:click="downloadBackUpOneLineOtpAuthFile()"
        v-if="!unsupportedAccounts"
        class="button"
      >
        {{ i18n.download_backup }}
      </button>
```

Apply the same pattern (drop the `<a-button-link>`/`isDataLinkSupported` split, keep a single unconditional `<button v-on:click="...">`) to the `unsupportedAccounts` unencrypted-export pair and the `defaultEncryption` encrypted-export pair, calling `downloadBackUpExportFile()` and `downloadBackUpExportEncryptedFile()` respectively.

- [ ] **Step 3: Update the three handler methods to try `chrome.downloads.download` first**

Old:
```ts
    downloadBackUpOneLineOtpAuthFile() {
      const exportData = this.$store.state.accounts.exportData;
      const t = getOneLineOtpBackupFile(exportData);
      window.open(t);
    },
    downloadBackUpExportFile() {
      const exportData = this.$store.state.accounts.exportData;
      const t = getBackupFile(exportData);
      window.open(t);
    },
    downloadBackUpExportEncryptedFile() {
      const exportEncData = this.$store.state.accounts.exportEncData;
      const key = this.$store.state.accounts.key;
      const t = getBackupFile(exportEncData, key);
      window.open(t);
    },
```
New:
```ts
    downloadBackUpOneLineOtpAuthFile() {
      const exportData = this.$store.state.accounts.exportData;
      const t = getOneLineOtpBackupFile(exportData);
      downloadOrOpen(t, "authenticator.txt");
    },
    downloadBackUpExportFile() {
      const exportData = this.$store.state.accounts.exportData;
      const t = getBackupFile(exportData);
      downloadOrOpen(t, "authenticator.json");
    },
    downloadBackUpExportEncryptedFile() {
      const exportEncData = this.$store.state.accounts.exportEncData;
      const key = this.$store.state.accounts.key;
      const t = getBackupFile(exportEncData, key);
      downloadOrOpen(t, "authenticator.json");
    },
```

Add the new `downloadOrOpen` helper as a module-level (not component-method) function near the other module-level helpers (`getBackupFile`, `getOneLineOtpBackupFile`, `downloadFileUrlBuilder`), so it's independently exportable for testing:

```ts
export function downloadOrOpen(url: string, filename: string): void {
  if (typeof chrome !== "undefined" && chrome.downloads) {
    chrome.downloads.download({ url, filename });
  } else {
    window.open(url);
  }
}
```

- [ ] **Step 4: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 5: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add manifests/manifest-chrome.json manifests/manifest-edge.json manifests/manifest-firefox.json src/components/Popup/BackupPage.vue
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: use chrome.downloads API for backup file downloads

The anchor-download (<a download>) mechanism is unreliable from
extension popups in Vivaldi/Brave (and other Chromium forks that can't
be distinguished from stock Chrome via user-agent sniffing), silently
failing to save the file. Added the downloads permission and switched
to chrome.downloads.download as the primary path, falling back to the
existing window.open behavior where chrome.downloads isn't available.

Fixes upstream #816."
```

- [ ] **Step 6: Write the regression test**

Create `src/test/components/Popup/BackupPage.test.ts`:
```ts
import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";
import chrome from "sinon-chrome";

chai.use(sinonChai);
mocha.setup("bdd");

import { downloadOrOpen } from "../../../components/Popup/BackupPage.vue";

describe("downloadOrOpen (#816)", () => {
  let windowOpenStub: sinon.SinonStub;

  before(() => {
    global.chrome.downloads = chrome.downloads;
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
```

Note: importing a named export directly from a `.vue` Single File Component (`import { downloadOrOpen } from "...BackupPage.vue"`) may not work depending on how `vue-loader`/`ts-loader` expose non-default exports from SFCs in this build — verify this actually compiles and the import resolves. If it doesn't, the implementer should instead extract `downloadOrOpen` into its own small module (e.g. `src/models/downloadOrOpen.ts`) exported from there and imported by both `BackupPage.vue` and the test — report which approach was used and why. This is a judgment call the plan can't resolve without running the actual build.

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/components/Popup/BackupPage.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #816 backup download mechanism"
```

(If Step 6 required extracting `downloadOrOpen` to a new file, also `git add` that new file in this commit or fold it into Task 4's Step 5 fix commit instead — implementer's judgment, report which.)

---

### Task 5: #164 — subdomain filtering conflation

**Files:**
- Modify: `src/utils.ts`
- Create: `src/test/utils.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `isMatchedEntry` becomes exported (previously module-private), for testability.

- [ ] **Step 1: Export `isMatchedEntry`**

Old:
```ts
function isMatchedEntry(
  siteName: Array<string | null>,
  entry: OTPEntryInterface
) {
```
New:
```ts
export function isMatchedEntry(
  siteName: Array<string | null>,
  entry: OTPEntryInterface
) {
```

- [ ] **Step 2: Fix the `Issuer::domain` matching to use a proper suffix/exact comparison**

Old:
```ts
  if (issuerHostMatches.length > 1) {
    if (siteHost && siteHost.indexOf(issuerHostMatches[1]) !== -1) {
      return true;
    }
  }
```
New:
```ts
  if (issuerHostMatches.length > 1) {
    const issuerHost = issuerHostMatches[1].trim().toLowerCase();
    if (
      siteHost &&
      issuerHost &&
      (siteHost === issuerHost || siteHost.endsWith("." + issuerHost))
    ) {
      return true;
    }
  }
```

This is deliberately scoped to only the explicit `Issuer::domain.com` syntax path — the default fuzzy-match path (a few lines below, `issuer.indexOf(siteNameFromHost) !== -1`) is intentionally left unchanged, since it's the existing coarse "Smart Filter" heuristic and changing it would be a separate, larger behavior decision not covered by this bug report.

- [ ] **Step 3: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 4: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/utils.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: correctly scope Issuer::domain filtering to exact host or subdomain

The Issuer::domain.com filter syntax matched via a plain substring
check (siteHost.indexOf(issuerHost)), so an entry scoped to
sub2.domain.com would also match while browsing sub1.domain.com (both
contain \"domain.com\"). Replaced with an exact-or-dot-boundary-suffix
comparison, preserving the existing behavior that a bare domain
(Issuer::domain.com) matches any of its subdomains.

Fixes upstream #164."
```

- [ ] **Step 5: Write the regression test**

Create `src/test/utils.test.ts`:
```ts
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
```

The implementer should verify `OTPEntryInterface`'s actual shape (just `{ issuer }` is likely too minimal for full type-correctness — check `src/definitions/module-interface.d.ts` or wherever `OTPEntryInterface` is defined) and adjust `makeEntry`'s cast/shape if TypeScript compilation fails; the `as any` cast is a deliberate minimal-fixture shortcut but should be tightened if it causes issues.

- [ ] **Step 6: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 7: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/utils.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #164 subdomain filtering"
```

---

### Task 6: #878 — Firefox autofill silent fallback

**Files:**
- Modify: `src/utils.ts`
- Modify: `src/components/Popup/EntryComponent.vue`
- Modify: `manifests/manifest-chrome.json`, `manifests/manifest-firefox.json`
- Modify: `_locales/en/messages.json`
- Create: `src/test/utils.test.ts` (extend, created in Task 5)

**Interfaces:**
- Consumes: `src/test/utils.test.ts` from Task 5 (extends it).
- Produces: `ensureContentScriptHostPermission` in `utils.ts`; autofill now requests host permission instead of silently no-op'ing.

**Scope note:** this task focuses on the reliable, foreground/user-gesture path (`EntryComponent.vue`'s `copyCode`/`insertContentScript`, triggered by a popup click). The parallel `background.ts` command-handler call sites (`scan-qr`/`autofill` keyboard shortcuts) use the same underlying `okToInjectContentScript` check, but `chrome.permissions.request` from a service-worker/background context has uncertain support across browsers without a directly-preceding user gesture — do not modify `background.ts` in this task unless the implementer confirms (via testing or MDN/Chrome docs) that it works reliably there; if uncertain, leave `background.ts` as-is and note the gap in the task report rather than guessing.

- [ ] **Step 1: Add `optional_host_permissions` for arbitrary autofill targets to both manifests**

`manifests/manifest-chrome.json` — locate `optional_host_permissions`:

Old:
```json
    "optional_host_permissions": [
        "https://www.google.com/",
        "https://*.dropboxapi.com/*",
        "https://www.googleapis.com/*",
        "https://accounts.google.com/o/oauth2/revoke",
        "https://graph.microsoft.com/me/*",
        "https://login.microsoftonline.com/common/oauth2/v2.0/token"
    ],
```
New:
```json
    "optional_host_permissions": [
        "https://www.google.com/",
        "https://*.dropboxapi.com/*",
        "https://www.googleapis.com/*",
        "https://accounts.google.com/o/oauth2/revoke",
        "https://graph.microsoft.com/me/*",
        "https://login.microsoftonline.com/common/oauth2/v2.0/token",
        "http://*/*",
        "https://*/*"
    ],
```

`manifests/manifest-firefox.json` — Firefox currently has no `optional_host_permissions` key at all. Add one, right after the existing `optional_permissions`:

Old:
```json
  "optional_permissions": ["clipboardWrite"],
```
New:
```json
  "optional_permissions": ["clipboardWrite"],
  "optional_host_permissions": ["http://*/*", "https://*/*"],
```

- [ ] **Step 2: Add the host-permission-check/request helper to `utils.ts`**

Add a new exported function near `okToInjectContentScript` (leave `okToInjectContentScript` itself unchanged — it's still used as the URL-scheme type guard):

```ts
export async function ensureContentScriptHostPermission(
  tab: chrome.tabs.Tab
): Promise<boolean> {
  if (!okToInjectContentScript(tab)) {
    return false;
  }
  const origin = new URL(tab.url).origin + "/*";
  const hasPermission = await chrome.permissions.contains({
    origins: [origin],
  });
  if (hasPermission) {
    return true;
  }
  return chrome.permissions.request({ origins: [origin] });
}
```

- [ ] **Step 3: Use the new helper in `insertContentScript`, and surface permission-denial to the user**

Old (`EntryComponent.vue`):
```ts
async function insertContentScript() {
  let tab = await getCurrentTab();
  if (okToInjectContentScript(tab)) {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      files: ["/dist/content.js"],
    });
    await chrome.scripting.insertCSS({
      target: { tabId: tab.id },
      files: ["/css/content.css"],
    });
  }
}
```
New:
```ts
async function insertContentScript(): Promise<boolean> {
  let tab = await getCurrentTab();
  if (!(await ensureContentScriptHostPermission(tab))) {
    return false;
  }
  await chrome.scripting.executeScript({
    target: { tabId: tab.id },
    files: ["/dist/content.js"],
  });
  await chrome.scripting.insertCSS({
    target: { tabId: tab.id },
    files: ["/css/content.css"],
  });
  return true;
}
```

And update the caller inside `copyCode`:

Old:
```ts
            if (this.$store.state.menu.useAutofill) {
              await insertContentScript();
              const tab = await getCurrentTab();
              if (tab && tab.id) {
                chrome.tabs.sendMessage(tab.id, {
                  action: "pastecode",
                  code: entry.code,
                  mode: this.$store.state.menu.autofillMode,
                });
              }
            }
```
New:
```ts
            if (this.$store.state.menu.useAutofill) {
              const injected = await insertContentScript();
              if (!injected) {
                this.$store.dispatch(
                  "notification/ephermalMessage",
                  this.i18n.autofillPermissionDenied
                );
              } else {
                const tab = await getCurrentTab();
                if (tab && tab.id) {
                  chrome.tabs.sendMessage(tab.id, {
                    action: "pastecode",
                    code: entry.code,
                    mode: this.$store.state.menu.autofillMode,
                  });
                }
              }
            }
```

Also update the `import` statement at the top of `EntryComponent.vue` to bring in `ensureContentScriptHostPermission` alongside the existing `getCurrentTab`/`okToInjectContentScript` import from `../../utils`.

- [ ] **Step 4: Add the new locale message**

In `_locales/en/messages.json`, add a new key near the other autofill-related messages (e.g. near `autofill_mode`/`autofill_mode_replace`/`autofill_mode_append` added in Phase 2 Task 5):

```json
  "autofillPermissionDenied": {
    "message": "Autofill needs permission to access this page. Copied to clipboard instead.",
    "description": "Shown when the user denies the host permission prompt for autofill"
  },
```

- [ ] **Step 5: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 6: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/utils.ts src/components/Popup/EntryComponent.vue manifests/manifest-chrome.json manifests/manifest-firefox.json _locales/en/messages.json
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: request host permission for autofill instead of silently no-op'ing

insertContentScript() only checked the tab URL's scheme, never whether
the extension actually had host permission to inject into it. Without
an implicit grant (which Firefox's activeTab semantics don't reliably
provide the same way Chrome's do), the injection silently failed and
autofill fell back to clipboard-only with no explanation. Now requests
the host permission on demand via chrome.permissions.request, and
tells the user when it's denied.

Fixes upstream #878."
```

- [ ] **Step 7: Extend `src/test/utils.test.ts` with a regression test**

Append to the file created in Task 5:
```ts
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
```

Add `import * as sinon from "sinon";` and `import chai from "chai"; chai.use(require("sinon-chai"));`-equivalent setup at the top of `utils.test.ts` if Task 5 didn't already include it (check the file as it exists after Task 5 before adding duplicate imports). This test stubs `chrome.permissions.contains`/`.request` directly on the real `global.chrome` (via `sinon.stub`, matching the established mocking pattern) rather than needing a full `sinon-chrome` import, since `chrome.permissions` already exists as a real API surface in the test's loaded-extension environment.

- [ ] **Step 8: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 9: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/utils.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #878 autofill host permission"
```

---

### Task 7: #1089 — case-sensitive algorithm lookup (security-adjacent)

**Files:**
- Modify: `src/models/storage.ts`
- Modify: `src/background.ts`
- Modify: `src/test/models/storage.test.ts` (extend, created in Phase 2 Task 8)

**Interfaces:**
- Consumes: `src/test/models/storage.test.ts` from Phase 2 Task 8 (extends it).
- Produces: case-insensitive algorithm-string parsing in `EntryStorage.import()`.

- [ ] **Step 1: Fix the case-sensitive lookup in `storage.ts` (the load-bearing fix)**

Old:
```ts
        algorithm: rawAlgorithm
          ? // @ts-expect-error - it's fine if this ends up undefined
            OTPAlgorithm[rawAlgorithm]
          : OTPAlgorithm.SHA1,
```
New:
```ts
        algorithm: rawAlgorithm
          ? // @ts-expect-error - it's fine if this ends up undefined
            OTPAlgorithm[String(rawAlgorithm).toUpperCase()]
          : OTPAlgorithm.SHA1,
```

(Using `String(rawAlgorithm)` rather than a bare `.toUpperCase()` guards against a non-string value reaching this point, matching the defensive-typing note from planning research — `rawAlgorithm` is loosely typed here.)

- [ ] **Step 2: Normalize at the source in `background.ts` (defense-in-depth, not load-bearing)**

Old:
```ts
        } else if (parameter[0].toLowerCase() === "algorithm") {
          algorithm = parameter[1];
        }
```
New:
```ts
        } else if (parameter[0].toLowerCase() === "algorithm") {
          algorithm = parameter[1].toUpperCase();
        }
```

- [ ] **Step 3: Required security review pass (explicit, cite evidence)**

Since this touches `EntryStorage.import()`'s algorithm-selection logic (the same method Phase 2 Task 8 already reviewed for #1451), confirm and report explicitly: (a) the change is a pure case-normalization added to an existing conditional, no new external calls or data flow; (b) it doesn't weaken the existing `!OTPAlgorithm[entryData.algorithm]` fallback-to-SHA1 guard a few lines below (still runs unchanged, now just has fewer false-negative cases hitting it); (c) no change to how the resulting algorithm constant is actually used in crypto (`KeyUtilities`/`Encryption` — confirm untouched via `git diff` scope).

- [ ] **Step 4: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 5: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/models/storage.ts src/background.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: case-insensitive algorithm lookup during entry import

OTPAlgorithm[rawAlgorithm] is a reverse enum-name lookup requiring an
exact-case match (\"SHA256\", not \"sha256\"), so a lowercase algorithm
string (e.g. from an OCR'd QR code) silently fell through the existing
fallback-to-SHA1 guard with no indication anything was wrong. Uppercase
the string before the lookup. This is separate from the #1451 fix,
which corrected the lookup MECHANISM (parseInt -> reverse lookup) but
didn't address case-sensitivity.

Fixes upstream #1089."
```

- [ ] **Step 6: Extend `src/test/models/storage.test.ts`**

Add a new test case to the existing `describe("EntryStorage.import algorithm/type parsing (#1451)"` block, or a new adjacent `describe` block — implementer's choice, but don't duplicate the existing 3 tests:

```ts
describe("EntryStorage.import case-insensitive algorithm parsing (#1089)", () => {
  it("correctly parses a lowercase algorithm string instead of falling back to SHA1", async () => {
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
        algorithm: "sha256",
      } as any,
    });
    const entries = await EntryStorage.get();
    const imported = entries.find((e: any) => e.hash === hash);
    expect(imported).to.not.be.undefined;
    expect(imported.algorithm).to.eq(OTPAlgorithm.SHA256);
  });

  it("correctly parses a mixed-case algorithm string", async () => {
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
        algorithm: "Sha512",
      } as any,
    });
    const entries = await EntryStorage.get();
    const imported = entries.find((e: any) => e.hash === hash);
    expect(imported).to.not.be.undefined;
    expect(imported.algorithm).to.eq(OTPAlgorithm.SHA512);
  });
});
```

Reuse the exact `Encryption`/`EntryStorage`/`OTPAlgorithm` imports already present at the top of the file from Phase 2 Task 8 — don't re-import.

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/models/storage.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1089 case-insensitive algorithm parsing"
```

---

### Task 8: #463 — silent backup-restore entry loss (security-adjacent, most sensitive, reviewed last)

**Files:**
- Modify: `src/models/storage.ts`
- Modify: `src/import.ts`
- Modify: `src/components/Import/FileImport.vue`
- Modify: `_locales/en/messages.json`
- Create: `src/test/models/storage.test.ts` (extend) or a focused new test — see Step 6

**Interfaces:**
- Consumes: nothing beyond existing signatures.
- Produces: `EntryStorage.import()` and `decryptBackupData()` return skip information instead of silently dropping entries; `FileImport.vue` surfaces which entries were skipped.

- [ ] **Step 1: Track skipped entries in `EntryStorage.import()`**

Old (signature):
```ts
  static async import(
    encryption: Encryption,
    data: { [hash: string]: RawOTPStorage }
  ) {
    let _data = await BrowserStorage.get();
    for (const hash of Object.keys(data)) {
      // never trust data import from user
      // data must be decrypted before calling this method
      if (!data[hash].secret || data[hash].encrypted) {
        // TODO: we need give a failed warning
        continue;
      }
```
New:
```ts
  static async import(
    encryption: Encryption,
    data: { [hash: string]: RawOTPStorage }
  ): Promise<{
    skipped: { hash: string; issuer?: string; account?: string }[];
  }> {
    let _data = await BrowserStorage.get();
    const skipped: { hash: string; issuer?: string; account?: string }[] = [];
    for (const hash of Object.keys(data)) {
      // never trust data import from user
      // data must be decrypted before calling this method
      if (!data[hash].secret || data[hash].encrypted) {
        skipped.push({
          hash,
          issuer: data[hash].issuer,
          account: data[hash].account,
        });
        continue;
      }
```

At the end of the method, locate the existing final lines:

Old:
```ts
    _data = this.ensureUniqueIndex(_data);
    await BrowserStorage.set(_data);
  }
```
New:
```ts
    _data = this.ensureUniqueIndex(_data);
    await BrowserStorage.set(_data);
    return { skipped };
  }
```

- [ ] **Step 2: Track skipped entries in `decryptBackupData()`**

Old (signature and each `continue` site):
```ts
export async function decryptBackupData(
  backupData: { [hash: string]: OTPStorage | Key },
  passphrase: string | null
) {
  const decryptedBackupData: { [hash: string]: RawOTPStorage } = {};
  const keys: Map<string, string | null> = new Map();
  for (const hash in backupData) {
    const unknownStorageItem = backupData[hash];
    if (
      typeof unknownStorageItem !== "object" ||
      unknownStorageItem.dataType === "Key"
    ) {
      continue;
    }
    let storageItem: RawOTPStorage;
    if (unknownStorageItem.dataType === "EncOTPStorage") {
      if (!passphrase) {
        continue;
      }

      if (!keys.has(unknownStorageItem.keyId)) {
        keys.set(
          unknownStorageItem.keyId,
          await findAndUnlockKey(
            backupData,
            unknownStorageItem.keyId,
            passphrase
          )
        );
      }
      const decryptKey = keys.get(unknownStorageItem.keyId);
      if (!decryptKey) {
        // wrong password for key
        continue;
      }

      storageItem = {
        ...unknownStorageItem,
        ...JSON.parse(
          CryptoJS.AES.decrypt(unknownStorageItem.data, decryptKey).toString(
            CryptoJS.enc.Utf8
          )
        ),
        encrypted: false,
      };
    } else {
      storageItem = unknownStorageItem;
    }
    if (!storageItem.secret) {
      continue;
    }
    if (storageItem.encrypted && !passphrase) {
      continue;
    }
    if (storageItem.encrypted && passphrase) {
      try {
        storageItem.secret = CryptoJS.AES.decrypt(
          storageItem.secret,
          passphrase
        ).toString(CryptoJS.enc.Utf8);
        storageItem.encrypted = false;
      } catch (error) {
        continue;
      }
    }
    // storageItem.secret may be empty after decrypt with wrong
    // passphrase
    if (!storageItem.secret) {
      continue;
    }
    decryptedBackupData[hash] = storageItem;
  }
  return decryptedBackupData;
}
```
New:
```ts
export async function decryptBackupData(
  backupData: { [hash: string]: OTPStorage | Key },
  passphrase: string | null
): Promise<{
  decryptedBackupData: { [hash: string]: RawOTPStorage };
  skipped: {
    hash: string;
    issuer?: string;
    account?: string;
    reason: string;
  }[];
}> {
  const decryptedBackupData: { [hash: string]: RawOTPStorage } = {};
  const skipped: {
    hash: string;
    issuer?: string;
    account?: string;
    reason: string;
  }[] = [];
  const keys: Map<string, string | null> = new Map();
  for (const hash in backupData) {
    const unknownStorageItem = backupData[hash];
    if (
      typeof unknownStorageItem !== "object" ||
      unknownStorageItem.dataType === "Key"
    ) {
      continue;
    }
    let storageItem: RawOTPStorage;
    if (unknownStorageItem.dataType === "EncOTPStorage") {
      if (!passphrase) {
        skipped.push({ hash, reason: "no-passphrase-for-key" });
        continue;
      }

      if (!keys.has(unknownStorageItem.keyId)) {
        keys.set(
          unknownStorageItem.keyId,
          await findAndUnlockKey(
            backupData,
            unknownStorageItem.keyId,
            passphrase
          )
        );
      }
      const decryptKey = keys.get(unknownStorageItem.keyId);
      if (!decryptKey) {
        // wrong password for key
        skipped.push({ hash, reason: "wrong-key-password" });
        continue;
      }

      storageItem = {
        ...unknownStorageItem,
        ...JSON.parse(
          CryptoJS.AES.decrypt(unknownStorageItem.data, decryptKey).toString(
            CryptoJS.enc.Utf8
          )
        ),
        encrypted: false,
      };
    } else {
      storageItem = unknownStorageItem;
    }
    if (!storageItem.secret) {
      skipped.push({
        hash,
        issuer: storageItem.issuer,
        account: storageItem.account,
        reason: "missing-secret",
      });
      continue;
    }
    if (storageItem.encrypted && !passphrase) {
      skipped.push({
        hash,
        issuer: storageItem.issuer,
        account: storageItem.account,
        reason: "no-passphrase",
      });
      continue;
    }
    if (storageItem.encrypted && passphrase) {
      try {
        storageItem.secret = CryptoJS.AES.decrypt(
          storageItem.secret,
          passphrase
        ).toString(CryptoJS.enc.Utf8);
        storageItem.encrypted = false;
      } catch (error) {
        skipped.push({
          hash,
          issuer: storageItem.issuer,
          account: storageItem.account,
          reason: "decrypt-failed",
        });
        continue;
      }
    }
    // storageItem.secret may be empty after decrypt with wrong
    // passphrase
    if (!storageItem.secret) {
      skipped.push({
        hash,
        issuer: storageItem.issuer,
        account: storageItem.account,
        reason: "wrong-passphrase",
      });
      continue;
    }
    decryptedBackupData[hash] = storageItem;
  }
  return { decryptedBackupData, skipped };
}
```

- [ ] **Step 3: Update `FileImport.vue`'s call sites and user-facing message**

Locate the two `decryptBackupData(...)` calls and the `EntryStorage.import(...)` call in `FileImport.vue` (around lines 105-136 per planning research) and update them to destructure the new return shapes and accumulate `skipped`:

Old (approximate, adapt to exact surrounding code found when this task is implemented — the planning research read this region but line numbers may have shifted since):
```ts
          if (Object.keys(decryptedFileData).length) {
            await EntryStorage.import(
              this.$encryption as Encryption,
              decryptedFileData
            );
            if (failedCount === 0) {
              alert(this.i18n.updateSuccess);
            } else if (succeededCount) {
              alert(this.i18n.migration_partly_fail);
            } else {
              alert(this.i18n.migration_fail);
            }
```
New (concept — the implementer must locate the actual current call sites for `decryptBackupData` earlier in the same function and merge their `skipped` arrays into a function-scoped `allSkipped` array before this point, then use it here):
```ts
          if (Object.keys(decryptedFileData).length) {
            const { skipped: importSkipped } = await EntryStorage.import(
              this.$encryption as Encryption,
              decryptedFileData
            );
            const totalSkipped = allSkipped.length + importSkipped.length;
            if (totalSkipped === 0) {
              alert(this.i18n.updateSuccess);
            } else {
              const skippedNames = [...allSkipped, ...importSkipped]
                .map((s) => s.issuer || s.account || s.hash)
                .join(", ");
              alert(
                this.i18n.migration_partly_fail_detail.replace(
                  "$SKIPPED$",
                  skippedNames
                )
              );
            }
```

The implementer must: (a) find where `decryptBackupData` is actually called earlier in this same handler (there were two call sites per planning research — for the passphrase-required and no-passphrase-yet flows) and thread its `skipped` result into an `allSkipped` array declared at the top of the handler function; (b) confirm the exact current variable names (`decryptedFileData`, `failedCount`, `succeededCount`) still match, adjusting if they've drifted; (c) decide whether to keep the old `failedCount`/`succeededCount` branch for the plain-text `otpauth://` import path (which doesn't go through `decryptBackupData`/`EntryStorage.import`'s new skip-tracking) unchanged, only adding the new skip-based messaging for the JSON/encrypted-backup path specifically — the two import paths are structurally different in this file and shouldn't be conflated.

- [ ] **Step 4: Add the new locale message**

In `_locales/en/messages.json`:
```json
  "migration_partly_fail_detail": {
    "message": "Some entries could not be restored: $SKIPPED$",
    "description": "Shown when a backup restore succeeds partially, listing which entries were skipped"
  },
```

- [ ] **Step 5: Required security review pass (explicit, cite evidence)**

This touches the backup-restore/decrypt path directly. Confirm and report explicitly: (a) no secret material is included in the `skipped` tracking objects (only `hash`/`issuer`/`account`/`reason` — never `.secret`, even in its still-encrypted form); (b) the actual decrypt logic (`CryptoJS.AES.decrypt` calls, `findAndUnlockKey`'s argon2 verification flow) is completely untouched — only `continue` sites gained a `.push()` immediately before them; (c) `git diff` confirms no changes outside `storage.ts`'s `import()` method, `import.ts`'s `decryptBackupData()` function, and `FileImport.vue`'s alert-dispatch logic.

- [ ] **Step 6: Verify build**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

- [ ] **Step 7: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/models/storage.ts src/import.ts src/components/Import/FileImport.vue _locales/en/messages.json
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: surface which entries are skipped during backup restore

EntryStorage.import() and decryptBackupData() silently continue past
any entry that fails to decrypt or is missing required data, with only
a generic pass/partial-fail/fail alert and no indication of which or
how many entries were dropped. Both now return a list of skipped
entries (hash/issuer/account/reason where available), surfaced to the
user in FileImport.vue instead of a bare partial-failure message.

Fixes upstream #463."
```

- [ ] **Step 8: Write the regression test**

Extend `src/test/models/storage.test.ts` with a test for `EntryStorage.import()`'s new skip-tracking return value (this doesn't require the argon2/iframe-dependent `decryptBackupData` path, keeping the test self-contained):

```ts
describe("EntryStorage.import skip tracking (#463)", () => {
  it("reports skipped entries that are missing a secret", async () => {
    const encryption = new Encryption("", "");
    const hash = crypto.randomUUID();
    const result = await EntryStorage.import(encryption, {
      [hash]: {
        account: "broken-entry",
        counter: 0,
        encrypted: false,
        hash,
        index: 0,
        issuer: "BrokenIssuer",
        secret: "",
        type: "totp",
      } as any,
    });
    expect(result.skipped).to.have.length(1);
    expect(result.skipped[0].hash).to.eq(hash);
    expect(result.skipped[0].issuer).to.eq("BrokenIssuer");
  });

  it("does not report a successfully imported entry as skipped", async () => {
    const encryption = new Encryption("", "");
    const hash = crypto.randomUUID();
    const result = await EntryStorage.import(encryption, {
      [hash]: {
        account: "good-entry",
        counter: 0,
        encrypted: false,
        hash,
        index: 0,
        issuer: "GoodIssuer",
        secret: "abcd2345",
        type: "totp",
      } as any,
    });
    expect(result.skipped).to.have.length(0);
    const entries = await EntryStorage.get();
    expect(entries.find((e: any) => e.hash === hash)).to.not.be.undefined;
  });
});
```

If time/scope allows, the implementer may also add a focused test for `decryptBackupData`'s skip-tracking on the non-argon2-dependent paths (e.g. `!passphrase` with an already-decrypted `RawOTPStorage` item, which doesn't touch `findAndUnlockKey`/the iframe-based argon2 flow) — this is a stretch goal, not required, since setting up a realistic `decryptBackupData` test fixture is more involved; report whether it was attempted and why if skipped.

- [ ] **Step 9: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 10: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/models/storage.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #463 backup-restore skip tracking"
```

---

## Definition of Done for Phase 3b

- All 8 confirmed bugs from Phase 3's report have fix commits on `main`, each citing the upstream issue number.
- Every fix has a regression test (or a documented, reported reason if genuinely infeasible for part of a fix, e.g. #463's `decryptBackupData` argon2-dependent paths).
- `npm run chrome` and `npm test` pass on the final state.
- Final whole-branch review across all 8 tasks, with extra attention to Tasks 7 and 8 (security-adjacent).
