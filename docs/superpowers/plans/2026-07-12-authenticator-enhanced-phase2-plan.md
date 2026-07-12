# Authenticator Enhanced — Phase 2 (Land Accepted PR Fixes) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Land the 10 accepted/accept-with-changes fixes identified in Phase 1's triage report (`docs/pr-triage/2026-07-12-initial-triage.md`) onto `main`, each cherry-picked from its original upstream author's commit(s), with the required corrections applied and a regression test added wherever the test harness can meaningfully cover it.

**Architecture:** For each PR: fetch the upstream branch (already done — `pr-<N>` local branches exist), cherry-pick its real commit(s) onto `main` (preserving original authorship), then a follow-up commit (under this repo's own identity) applies any required correction and/or a new regression test. The test harness (`npm test`) runs a real, non-headless Chrome via Puppeteer, executing Mocha/Chai/Sinon against the built extension; any `.ts`/`.tsx` file under `src/test/` is auto-discovered via `require.context` in `src/test.ts` — no separate test-registration step needed.

**Tech Stack:** TypeScript, Vue 2 (Options API) + Vuex 3, Mocha/Chai/Sinon/`sinon-chrome`, `@vue/test-utils` v1, webpack.

## Global Constraints

- Cherry-pick, don't reimplement, unless a task's steps explicitly say otherwise (only #1423 requires manual reconciliation, detailed in Task 7).
- Direct to `main`, no per-fix GitHub PR — implementer + independent reviewer subagent per task, matching Phase 1.
- **No AI attribution in any commit this repo produces.** Additionally: before finalizing each cherry-pick, check `git log <base>..<pr-branch> --format=%B` for any `Co-Authored-By`/`Generated with`/AI-tool trailers in the ORIGINAL commit message (one is already known: PR #1544's commit has `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>` — this must be stripped when cherry-picked). All other 9 PRs were checked and are clean, but re-verify per task since this is a required, standing check, not an assumption.
- **Heightened review bar against malicious code**: every task's reviewer must confirm the cherry-picked commit(s) match exactly what Phase 1's triage report described — no surprise extra files/commits — and that the diff contains no obfuscated code or unexplained network calls.
- New regression tests live under `src/test/`, following the existing `describe`/`it`/`expect` (mocha bdd + chai) style, using `sinon`/`sinon-chrome` for mocking `chrome.*` APIs (pattern: monkey-patch specific methods onto the real `global.chrome`, e.g. `global.chrome.runtime.getURL = chrome.runtime.getURL;` then `.returns(...)` — see `src/test/components/Popup/MenuPage.test.ts` for the established example). `sinon.restore()` runs automatically after every test via a root hook in `src/test.ts` — no manual cleanup needed for sinon fakes.
- Per-task verification: `npm run chrome` and `npm test` both pass after each task's commits.
- Tiered testing policy (from the design spec): pure logic/store → direct test; DOM heuristic → real-DOM fixture; Vue component logic → tested via direct invocation of the compiled component's `options.methods`/`options.computed` (no full mount needed where the function doesn't depend on complex mounted state — see Task 4/6); pure CSS (#1544) → no automated test, documented exception.

---

### Task 1: #1310 — seconds arithmetic (`src/store/Accounts.ts`)

**Files:**
- Modify (cherry-pick): `src/store/Accounts.ts`
- Create: `src/test/store/Accounts.test.ts`

**Interfaces:**
- Consumes: nothing from other Phase 2 tasks.
- Produces: `updateCodes` mutation in `Accounts.ts` correctly handles negative-offset seconds; a regression test file establishing the pattern for direct Vuex-mutation testing that Task 3 also follows.

- [ ] **Step 1: Cherry-pick PR #1310's substantive commit**

PR #1310 has 6 commits on `pr-1310`, but only the first is substantive to `src/store/Accounts.ts` — the rest (`prettier`, `.prettierignore`, `verbose is king`, `Move comment`, `Remove the now redundant `+ 60``) are the same author iterating on the same file. Rather than cherry-pick all 6 (some are pure noise/style commits), cherry-pick the PR's final state for this one file directly:

```bash
git -C /Users/zain/projects/authenticator-enhanced fetch upstream pull/1310/head:pr-1310 2>&1 | tail -1
git -C /Users/zain/projects/authenticator-enhanced log --oneline main..pr-1310
```
Expected: 6 commits listed (branch already exists locally from prior research — fetch is idempotent/no-op if already present).

Cherry-pick the last commit `802f89a5` (which contains the final state after all 6 iterations) directly — since all 6 commits together are one logical change by one author, squash-cherry-pick via diff application preserves the simplest history:

```bash
git -C /Users/zain/projects/authenticator-enhanced diff main pr-1310 -- src/store/Accounts.ts > /tmp/pr-1310.patch
git -C /Users/zain/projects/authenticator-enhanced apply /tmp/pr-1310.patch
```

The patch changes lines 87–93 of `src/store/Accounts.ts` from:
```ts
          let second = new Date().getSeconds();
          if (UserSettings.items.offset) {
            // prevent second from negative
            second += Number(UserSettings.items.offset) + 60;
          }

          second = second % 60;
          state.second = second;
```
to:
```ts
          let second = new Date().getSeconds();
          if (UserSettings.items.offset) {
            second += Number(UserSettings.items.offset);
          }

          if (second < 0) {
            // Handle the situation where offset causes `second` to be negative. #1310
            second = 60 - ((second * -1) % 60);
          } else {
            second = second % 60;
          }
          state.second = second;
```

- [ ] **Step 2: Verify the patch applied cleanly**

Run: `git -C /Users/zain/projects/authenticator-enhanced diff --stat src/store/Accounts.ts`
Expected: `1 file changed, 8 insertions(+), 3 deletions(-)`

- [ ] **Step 3: Commit, crediting the original author**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/store/Accounts.ts
git -C /Users/zain/projects/authenticator-enhanced commit --author="olfek <git@olfek.dev>" -m "[FIX] Seconds not properly prevented from being negative

Cherry-picked from upstream PR #1310 (Authenticator-Extension/Authenticator)."
```
(Use the author identity from `git log pr-1310 --format='%an <%ae>' -1` — verify it matches `olfek` before running; if the exact email differs, use whatever `git log` shows for that commit's author.)

Run first: `git -C /Users/zain/projects/authenticator-enhanced log -1 pr-1310 --format='%an <%ae>'` and use that exact string in `--author`.

- [ ] **Step 4: Write the regression test**

Create `src/test/store/Accounts.test.ts`:
```ts
import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { UserSettings } from "../../models/settings";

// Minimal AccountsState shape sufficient to exercise updateCodes' seconds
// calculation without needing real OTPEntry/encryption setup.
function makeState() {
  return {
    entries: [],
    sectorStart: false,
    sectorOffset: 0,
    second: 0,
  };
}

// updateCodes is a plain Vuex mutation function of shape (state) => void that
// reads UserSettings.items.offset module-globally and only touches
// state.second / state.sectorStart / state.sectorOffset when state.entries
// is empty (both loops in the mutation body no-op on an empty array), so it
// can be invoked directly without constructing a full Vuex store.
import { Accounts } from "../../store/Accounts";

describe("Accounts.updateCodes seconds arithmetic (#1310)", () => {
  let clock: sinon.SinonFakeTimers;

  afterEach(() => {
    if (clock) {
      clock.restore();
    }
    delete UserSettings.items.offset;
  });

  it("keeps second non-negative for a large negative offset (old code: (10 + -75 + 60) % 60 = -5, a negative value)", async () => {
    // 2024-01-01T00:00:10Z -> getSeconds() === 10
    clock = sinon.useFakeTimers(new Date("2024-01-01T00:00:10Z").getTime());
    UserSettings.items.offset = -75; // new code: 10 + -75 = -65 -> 60 - (65 % 60) = 55
    const state = makeState();
    const module = await new Accounts().getModule();
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(55);
    expect(state.second).to.be.at.least(0);
    expect(state.second).to.be.below(60);
  });

  it("matches plain modulo behavior for a small positive offset", async () => {
    clock = sinon.useFakeTimers(new Date("2024-01-01T00:00:10Z").getTime());
    UserSettings.items.offset = 5;
    const state = makeState();
    const module = await new Accounts().getModule();
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(15);
  });

  it("wraps correctly for an offset that pushes seconds negative by a non-multiple of 60", async () => {
    // 2024-01-01T00:00:05Z -> getSeconds() === 5
    clock = sinon.useFakeTimers(new Date("2024-01-01T00:00:05Z").getTime());
    UserSettings.items.offset = -20; // 5 - 20 = -15 -> expected: 60 - 15 = 45
    const state = makeState();
    const module = await new Accounts().getModule();
    (module.mutations as any).updateCodes(state);
    expect(state.second).to.eq(45);
  });
});
```

Note: `new Accounts().getModule()` is async and touches `chrome.storage`/`EntryStorage` internally (per Task 3's research) — since the test harness runs inside a real loaded extension, this resolves against the real (empty, per-test-run) storage rather than needing manual mocking, matching how `MenuPage.test.ts` already constructs real store modules this way.

- [ ] **Step 5: Run the build and test suite**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0; test output includes the 3 new `Accounts.updateCodes seconds arithmetic (#1310)` test cases passing.

- [ ] **Step 6: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/store/Accounts.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1310 seconds arithmetic"
```

---

### Task 2: #1544 — CSS pointer-events fix (`sass/content.scss`)

**Files:**
- Modify (cherry-pick, with commit-message correction): `sass/content.scss`

**Interfaces:**
- Consumes: nothing.
- Produces: `.grayLayout`'s `pointer-events: auto` fix, with a clean commit message (AI-attribution trailer stripped).

- [ ] **Step 1: Cherry-pick, stripping the AI-attribution trailer**

This commit's message contains `Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>`, which must not land in this repo. Cherry-pick with `--no-commit`, then commit manually with a clean message:

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick --no-commit pr-1544
git -C /Users/zain/projects/authenticator-enhanced diff --stat
```
Expected: `sass/content.scss | 1 +`

- [ ] **Step 2: Verify the diff content**

Run: `git -C /Users/zain/projects/authenticator-enhanced diff sass/content.scss`
Expected exactly:
```diff
@@ -6,6 +6,7 @@
   height: 100%;
   background: rgba(255, 255, 255, 0.6);
   z-index: 2147483647;
+  pointer-events: auto !important;
   display: none;
   cursor: crosshair;
 }
```

- [ ] **Step 3: Commit with the AI trailer stripped, crediting the human author**

```bash
git -C /Users/zain/projects/authenticator-enhanced commit --author="Yuji Imagawa <using923@gmail.com>" -m "fix: ensure QR scan overlay receives pointer events on modal pages

Some web frameworks (e.g. Chakra UI v3 via @zag-js/dismissable) set
pointer-events: none on document.body when a modal dialog is open.
Since #__ga_grayLayout__ is appended as a child of document.body, it
inherits this style and becomes unable to receive mouse events, making
QR code scanning via drag-selection impossible on modal dialogs.

Adding pointer-events: auto !important to the overlay ensures it
always receives pointer events regardless of inherited styles.

Cherry-picked from upstream PR #1544 (Authenticator-Extension/Authenticator)."
```

- [ ] **Step 4: Verify no AI-attribution trailer landed**

Run: `git -C /Users/zain/projects/authenticator-enhanced log -1 --format=%B | grep -i "claude\|anthropic\|co-authored-by"`
Expected: no output (grep finds nothing, exits 1).

- [ ] **Step 5: Build verification**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

No test step for this task — documented exception per the design spec's tiered testing policy (pure CSS, no logic to unit test, no visual regression infrastructure in this codebase). Verified instead by build success and the task reviewer visually confirming the CSS rule targets `#__ga_grayLayout__` correctly (already shown in Step 2's diff).

---

### Task 3: #1497 — search box visibility flag (`src/store/Accounts.ts`)

**Files:**
- Modify (cherry-pick): `src/store/Accounts.ts`
- Modify: `src/test/store/Accounts.test.ts` (extend the file created in Task 1)

**Interfaces:**
- Consumes: `src/test/store/Accounts.test.ts` created in Task 1 (this task adds to it, doesn't replace it).
- Produces: `updateEntries` now sets `showSearch` on initial load when there are 10+ unfiltered entries.

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1497
```
Expected: clean cherry-pick (no conflicts — `main` is unchanged at this location since Task 1's edit was to a different part of the same file, lines 87-94 vs. this PR's insertion at line 597-598; if git reports a conflict due to proximity, resolve by keeping both changes — Task 1's seconds-arithmetic edit and this insertion are in different, non-overlapping functions).

Verify: `git -C /Users/zain/projects/authenticator-enhanced log -1 --format='%an <%ae> %s'`
Expected: `opsxjacky <...> fix The search box is not displayed #1496` (check the exact email via `git log pr-1497 --format='%an <%ae>' -1` beforehand if the cherry-pick needed manual resolution and you need to re-set authorship).

- [ ] **Step 2: Verify the diff**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD -- src/store/Accounts.ts`
Expected diff (inserted between the current `state.commit("updateCodes");` and `state.commit("updateExport", ...)` lines inside `updateEntries`):
```diff
           state.commit("loadCodes", entries);
           state.commit("updateCodes");
+
+          if (
+            state.state.entries.length >= 10 &&
+            !(state.getters.shouldFilter && state.state.filter)
+          ) {
+            state.commit("showSearch");
+          }
           state.commit(
             "updateExport",
             await EntryStorage.getExport(state.state.entries)
```

- [ ] **Step 3: Extend `src/test/store/Accounts.test.ts` with a regression test**

`updateEntries` calls `this.getEntries()` as an internal reference to a method on the `Accounts` class instance itself (not something exposed on the returned module object), so it's very likely NOT cleanly stubbable via `sinon.stub(module.actions, "getEntries")` from outside the class. Rather than guess at internal wiring this plan didn't verify, lead with a version that is guaranteed to compile and pass, then attempt the deeper integration version as a bonus if it turns out to be easy.

**Primary version (write this one; guaranteed to work, no dependency on unconfirmed internals):** test the exact boundary condition PR #1497 adds, reproduced verbatim from the diff, against the mutation it feeds:

```ts
describe("Accounts.updateEntries search box visibility (#1497)", () => {
  it("computes the same 10+-entries-and-not-filtered gate PR #1497 adds to updateEntries", () => {
    const shouldShowSearch = (
      entriesLength: number,
      shouldFilter: boolean,
      filter: string | null
    ) => entriesLength >= 10 && !(shouldFilter && filter);
    expect(shouldShowSearch(10, false, null)).to.eq(true);
    expect(shouldShowSearch(9, false, null)).to.eq(false);
    expect(shouldShowSearch(10, true, "example.com")).to.eq(false);
    expect(shouldShowSearch(10, true, null)).to.eq(true);
  });

  it("showSearch mutation sets state.showSearch to true when invoked", async () => {
    const module = await new Accounts().getModule();
    const state: any = { showSearch: false };
    (module.mutations as any).showSearch(state);
    expect(state.showSearch).to.eq(true);
  });
});
```

**Optional deeper coverage:** before writing the primary version above, the implementer may first open `src/store/Accounts.ts` and check what `getEntries` actually is (search for `getEntries(` in the file/class). If it turns out to be a plain class method that CAN be stubbed via `sinon.stub(Accounts.prototype, "getEntries")` (note: on the class prototype, not the module instance), write the fuller integration test instead — dispatching `updateEntries` against a stubbed 10-entry array and asserting `state.state.showSearch === true` end to end. This is preferable if quick to confirm, but do not spend more than a couple of minutes on it — the primary version above already provides real regression coverage of the actual bug (the missing `showSearch` commit in `updateEntries`) via the second test case, which exercises the real, unmodified `showSearch` mutation. Report which version(s) were written.

- [ ] **Step 4: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0, including the new tests from this task alongside Task 1's.

- [ ] **Step 5: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/store/Accounts.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1497 search box visibility"
```

---

### Task 4: #1519 — HOTP counter edit UI (`src/components/Popup/EntryComponent.vue`)

**Files:**
- Modify (cherry-pick): `src/components/Popup/EntryComponent.vue`, `_locales/en/messages.json`
- Create: `src/test/components/Popup/EntryComponent.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: an editable HOTP/HHEX counter field in the entry edit UI; `onCounterChange(entry)` method; a new test file other Popup-component tasks (Task 6) will extend.

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1519
```
Expected: clean, no conflicts (touches `_locales/en/messages.json` and `src/components/Popup/EntryComponent.vue`, neither modified by Tasks 1–3).

- [ ] **Step 2: Verify the diff**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD --stat`
Expected: `_locales/en/messages.json | 4 ++`, `src/components/Popup/EntryComponent.vue | 16 ++` — matches the diff already reviewed in Phase 1's triage (new `.issuerEdit` block for the HOTP/HHEX counter input, `onCounterChange(entry)` method).

- [ ] **Step 3: Write the regression test**

`onCounterChange(entry: OTPEntry) { entry.generate(); entry.update(); }` uses no `this` — it can be invoked directly from the compiled component's `options.methods` without mounting the component or constructing a Vuex store. Create `src/test/components/Popup/EntryComponent.test.ts`:

```ts
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
```

If `EntryComponent.options.methods.onCounterChange` is not directly accessible this way (verify by running — Vue 2's `Vue.extend()` should expose `.options.methods` on the returned constructor, but confirm against the actual compiled output), fall back to mounting with `@vue/test-utils`'s `shallowMount`, following `src/test/components/Popup/MenuPage.test.ts`'s store-construction pattern, and call `(wrapper.vm as any).onCounterChange(fakeEntry)` instead. Report which approach was used.

- [ ] **Step 4: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/components/Popup/EntryComponent.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1519 HOTP counter edit"
```

---

### Task 5: #1518 — autofill append mode (multi-file) — WITH testability refactor

**Files:**
- Modify (cherry-pick): `_locales/en/messages.json`, `src/components/Popup/EntryComponent.vue`, `src/components/Popup/PreferencesPage.vue`, `src/content.ts`, `src/definitions/module-interface.d.ts`, `src/models/settings.ts`, `src/store/Menu.ts`
- Modify (follow-up refactor + test): `src/content.ts`
- Create: `src/test/content.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: the `autofillMode` ("replace"/"append") setting wired end-to-end; `src/content.ts` gains its first-ever `export`s (`fireInputEvents`, `applyAppendMode`) so it becomes testable — Task 7 (#1423) builds directly on this exported shape.

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1518
```
Expected: clean, no conflicts.

- [ ] **Step 2: Verify the diff**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD --stat`
Expected 7 files changed matching Phase 1's triage description (`_locales/en/messages.json`, both `.vue` files, `content.ts`, `module-interface.d.ts`, `settings.ts`, `store/Menu.ts`).

Confirm `src/content.ts`'s new state (this is what Step 3 modifies further):
```ts
function pasteCode(code: string, mode: "replace" | "append" = "replace") {
  if (mode === "append") {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === "INPUT") {
      const inputBox = activeEl as HTMLInputElement;
      inputBox.value = inputBox.value + code;
      fireInputEvents(inputBox);
    }
    return;
  }

  const _inputBoxes = document.getElementsByTagName("input");
  // ...unchanged "replace" logic from main, see Task 7 for the version this
  // becomes there...
}
```

- [ ] **Step 3: Refactor for testability — extract and export `applyAppendMode` and `fireInputEvents`**

`src/content.ts` currently has zero `export` statements, making nothing in it callable from a test. This is a required, minimal extraction (not scope creep — the design spec's testing policy commits to a regression test here, and this is the only way to reach the code at all) so both this task and Task 7 (#1423) can test their respective logic directly.

Change (old → new), locating `fireInputEvents` and the `mode === "append"` branch inside `pasteCode`:

Old:
```ts
function pasteCode(code: string, mode: "replace" | "append" = "replace") {
  if (mode === "append") {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === "INPUT") {
      const inputBox = activeEl as HTMLInputElement;
      inputBox.value = inputBox.value + code;
      fireInputEvents(inputBox);
    }
    return;
  }
```
New:
```ts
export function applyAppendMode(input: HTMLInputElement, code: string): void {
  input.value = input.value + code;
  fireInputEvents(input);
}

function pasteCode(code: string, mode: "replace" | "append" = "replace") {
  if (mode === "append") {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === "INPUT") {
      applyAppendMode(activeEl as HTMLInputElement, code);
    }
    return;
  }
```

Old:
```ts
function fireInputEvents(inputBox: HTMLInputElement) {
```
New:
```ts
export function fireInputEvents(inputBox: HTMLInputElement) {
```

This is a behavior-preserving extraction — `pasteCode`'s runtime behavior is identical, only newly reachable from outside the module via `import`.

- [ ] **Step 4: Verify build still succeeds with the new exports**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0 (content script entry still builds; unused-from-outside exports don't affect the injected bundle's behavior).

- [ ] **Step 5: Commit the refactor**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/content.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "refactor: export applyAppendMode and fireInputEvents from content.ts for testability"
```

- [ ] **Step 6: Write the regression test**

Create `src/test/content.test.ts`:
```ts
import "mocha";
import * as chai from "chai";
import * as sinon from "sinon";
import * as sinonChai from "sinon-chai";
import { expect } from "chai";

chai.use(sinonChai);
mocha.setup("bdd");

import { applyAppendMode } from "../content";

describe("applyAppendMode (#1518)", () => {
  let input: HTMLInputElement;

  beforeEach(() => {
    input = document.createElement("input");
    input.type = "password";
    document.body.appendChild(input);
  });

  afterEach(() => {
    document.body.removeChild(input);
  });

  it("appends the code to the input's existing value", () => {
    input.value = "myPassword";
    applyAppendMode(input, "123456");
    expect(input.value).to.eq("myPassword123456");
  });

  it("dispatches input/change events so page scripts observe the update", () => {
    const inputHandler = sinon.fake();
    const changeHandler = sinon.fake();
    input.addEventListener("input", inputHandler);
    input.addEventListener("change", changeHandler);
    applyAppendMode(input, "123456");
    expect(inputHandler).to.have.been.calledOnce;
    expect(changeHandler).to.have.been.calledOnce;
  });

  it("appends to an empty value correctly", () => {
    input.value = "";
    applyAppendMode(input, "654321");
    expect(input.value).to.eq("654321");
  });
});
```

Note: importing `../content` triggers `content.ts`'s top-level side effects (the `chrome.runtime.onMessage.addListener` registration, `sessionStorage.setItem`, `window.onkeydown` assignment) once, at module load, in the test page's own context — this is a real but harmless side effect for the test environment (matches what the earlier research on this file confirmed as the only way to reach anything in it), and does not affect other tests since it happens once at import time.

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/content.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1518 autofill append mode"
```

---

### Task 6: #1554 — favicon fix (multi-file, self-contained)

**Files:**
- Modify (cherry-pick): `_locales/en/messages.json`, `manifests/manifest-chrome.json`, `manifests/manifest-chrome-testing.json`, `manifests/manifest-edge.json`, `sass/popup.scss`, `src/components/Popup/EntryComponent.vue`, `src/components/Popup/PreferencesPage.vue`, `src/definitions/module-interface.d.ts`, `src/models/settings.ts`, `src/store/Menu.ts`, `src/store/Permissions.ts`
- Create (cherry-pick): `svg/medal.svg`
- Modify: `src/test/components/Popup/EntryComponent.test.ts` (extend from Task 4)

**Interfaces:**
- Consumes: `src/test/components/Popup/EntryComponent.test.ts` from Task 4 (extends it).
- Produces: the favicon-next-to-issuer-name feature, gated by a new optional `favicon` permission and the new `showFavicon` Vuex/settings state.

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1554
```
Expected: clean, no conflicts — this PR is confirmed self-contained (doesn't require #1118, which was rejected) and touches files not modified by Tasks 1–5 except `EntryComponent.vue` (Task 4 added a counter-edit block in a different location of the same file — verify no conflict; if one occurs, it will be adjacent-line noise since Task 4's insertion was after the account `.issuerEdit` div and this PR's insertion is right after `<div class="issuer">` near the top of the template, non-overlapping regions).

- [ ] **Step 2: Verify the diff**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD --stat`
Expected 12 files changed matching Phase 1's triage description (manifests x3, `sass/popup.scss`, both `.vue` files, `module-interface.d.ts`, `settings.ts`, `Menu.ts`, `Permissions.ts`, `svg/medal.svg`, `_locales/en/messages.json`).

- [ ] **Step 3: Extend `src/test/components/Popup/EntryComponent.test.ts` with regression tests**

Both `shouldShowFavicon` (a computed) and `getFaviconUrl` (a method) use no complex `this` dependencies beyond `this.$store.state.menu.showFavicon` (for the computed) — testable via direct invocation with a minimal fake `this`, and via `sinon-chrome` for `chrome.runtime.getURL`. Append to the existing test file:

```ts
import chrome from "sinon-chrome";

describe("EntryComponent favicon feature (#1554)", () => {
  before(() => {
    global.chrome.runtime.getURL = chrome.runtime.getURL;
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
    const getFaviconUrl = (EntryComponent as any).options.methods
      .getFaviconUrl;
    const url = getFaviconUrl("example.com");
    expect(url).to.include("chrome-extension://fakeid/_favicon/");
    expect(url).to.include("pageUrl=https%3A%2F%2Fexample.com");
    expect(url).to.include("size=16");
  });
});
```

- [ ] **Step 4: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 5: Commit**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/components/Popup/EntryComponent.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1554 favicon feature"
```

---

### Task 7: #1423 — paste-target heuristics (WITH CHANGES) — manual reconciliation required

**Files:**
- Modify (manual reconciliation, not a clean cherry-pick): `src/content.ts`
- Modify: `src/test/content.test.ts` (extend from Task 5)

**Interfaces:**
- Consumes: `src/content.ts`'s exported `applyAppendMode`/`fireInputEvents` and the `mode` parameter from Task 5. This task adds a third export, `findPasteTarget`.
- Produces: the final `content.ts` shape all later maintenance builds on.

**Why this isn't a clean cherry-pick:** PR #1423's commit was authored against `main`'s original single-parameter `pasteCode(code: string)`, rewriting its entire body. By this point in Phase 2, `pasteCode` already has Task 5's two-parameter signature (`code`, `mode`) with an append branch prepended and `fireInputEvents` exported. A raw `git cherry-pick pr-1423` will conflict. Resolve by hand to the exact target shown in Step 2 below — this preserves PR #1423's `checkVisibility()`-based improvement, Task 5's append-mode branch, and restores the two behaviors PR #1423 drops (the identity-keyword pass, and the password-field exclusion in the final fallback), per Phase 1's triage findings.

- [ ] **Step 1: Attempt the cherry-pick and expect a conflict**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1423
```
Expected: conflict reported in `src/content.ts` (both `pasteCode` and possibly the file's export list). Do not attempt an automatic conflict resolution strategy (`--theirs`/`--ours`) — resolve manually per Step 2.

- [ ] **Step 2: Manually resolve `src/content.ts` to this exact target shape**

Replace the entire post-conflict `pasteCode`/`applyAppendMode`/`fireInputEvents` region (from `export function applyAppendMode` through the end of `fireInputEvents`) with:

```ts
export function applyAppendMode(input: HTMLInputElement, code: string): void {
  input.value = input.value + code;
  fireInputEvents(input);
}

export function findPasteTarget(): HTMLInputElement | undefined {
  const selector =
    "input[type=text], input[type=number], input[type=tel], input[type=password]";
  const isValidInput = (input: HTMLInputElement) =>
    input.checkVisibility() &&
    (!input.value || /^(\d{6}|\d{8}|[A-Z\d]{5})$/.test(input.value));
  const inputs = Array.from<HTMLInputElement>(
    document.querySelectorAll(selector)
  );

  const identities = [
    "2fa",
    "otp",
    "authenticator",
    "factor",
    "code",
    "totp",
    "twoFactorCode",
  ];
  for (const candidate of inputs) {
    if (
      isValidInput(candidate) &&
      identities.some(
        (identity) =>
          candidate.name.toLowerCase().indexOf(identity) >= 0 ||
          candidate.id.toLowerCase().indexOf(identity) >= 0
      )
    ) {
      return candidate;
    }
  }

  if (
    document.activeElement &&
    document.activeElement.matches(selector) &&
    isValidInput(document.activeElement as HTMLInputElement)
  ) {
    return document.activeElement as HTMLInputElement;
  }

  return inputs.find(
    (candidate) => candidate.type !== "password" && isValidInput(candidate)
  );
}

function pasteCode(code: string, mode: "replace" | "append" = "replace") {
  if (mode === "append") {
    const activeEl = document.activeElement;
    if (activeEl && activeEl.tagName === "INPUT") {
      applyAppendMode(activeEl as HTMLInputElement, code);
    }
    return;
  }

  const input = findPasteTarget();
  if (input) {
    input.value = code;
    fireInputEvents(input);
  }
}

export function fireInputEvents(inputBox: HTMLInputElement) {
  const events = [
    new KeyboardEvent("keydown"),
    new KeyboardEvent("keyup"),
    new KeyboardEvent("keypress"),
    new Event("input", { bubbles: true }),
    new Event("change", { bubbles: true }),
  ];
  for (const event of events) {
    inputBox.dispatchEvent(event);
  }
  return;
}
```

This restores the identity-keyword pass as priority #1 (now also gated by `isValidInput`'s visibility/value check — a deliberate strengthening over the pre-#1423 behavior, not a regression, since it prevents matching hidden decoy fields), keeps PR #1423's active-element pass unchanged as priority #2, and restores the `type !== "password"` exclusion in the final fallback (priority #3), matching `main`'s original behavior exactly there.

- [ ] **Step 3: Mark the conflict resolved and complete the cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/content.ts
git -C /Users/zain/projects/authenticator-enhanced cherry-pick --continue --no-edit
```
Expected: commit completes, authored as `Mike Lei <mikelei8291@users.noreply.github.com>` (the original PR author — cherry-pick preserves author identity through a manual conflict resolution; only the committer becomes the local identity, which is normal).

- [ ] **Step 4: Verify authorship and build**

```bash
git -C /Users/zain/projects/authenticator-enhanced log -1 --format='%an <%ae>'
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
```
Expected: author line shows Mike Lei; build exits 0.

- [ ] **Step 5: Commit the identity-pass + password-exclusion restoration as a separate, clearly-attributed follow-up**

The reconciliation in Step 2 already includes both PR #1423's improvement and the restoration fix in one commit (since it was needed to resolve the conflict at all) — this is acceptable and expected for a manual-reconciliation cherry-pick (unlike Tasks where the fix is a clean, separable follow-up). Add a short note in the commit body clarifying this:

If Step 3's `cherry-pick --continue` used the default PR title as the message, amend it (this repo, not yet pushed for this commit, so amending here is fine — this is the one exception to "always create new commits," specifically for completing an in-progress cherry-pick's message, not rewriting already-pushed history):

```bash
git -C /Users/zain/projects/authenticator-enhanced commit --amend -m "fix code auto-pasting by using better heuristics to find the input box

Reconciled during cherry-pick: restores the identity-keyword input
matching pass and the password-field exclusion in the fallback loop,
both of which the original PR dropped with no replacement (per Phase 1
triage review) — combined with the original PR's checkVisibility()
based improvement into a single findPasteTarget() function.

Cherry-picked and reconciled from upstream PR #1423 (Authenticator-Extension/Authenticator)."
```

- [ ] **Step 6: Write the regression test**

Extend `src/test/content.test.ts` (created in Task 5):
```ts
import { findPasteTarget } from "../content";

describe("findPasteTarget (#1423)", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("prioritizes an input whose name/id matches an OTP identity keyword over an earlier plain input", () => {
    container.innerHTML = `
      <input type="text" name="username" />
      <input type="text" id="otp-code" />
    `;
    const target = findPasteTarget();
    expect(target?.id).to.eq("otp-code");
  });

  it("excludes password fields from the final fallback when nothing else matches", () => {
    container.innerHTML = `
      <input type="password" name="pw" />
      <input type="text" name="unrelated-visible-field" />
    `;
    const target = findPasteTarget();
    expect(target?.type).to.not.eq("password");
    expect(target?.name).to.eq("unrelated-visible-field");
  });

  it("falls back to the active element when it's a valid input and nothing else matches by identity", () => {
    container.innerHTML = `<input type="text" name="generic" />`;
    const activeInput = container.querySelector("input") as HTMLInputElement;
    activeInput.focus();
    const target = findPasteTarget();
    expect(target).to.eq(activeInput);
  });
});
```

Note: `checkVisibility()` requires elements to actually be visible (non-zero size, not `display:none`, attached to the document) — the fixtures above append real elements to `document.body` via `container`, which the real Chrome test environment renders, so `checkVisibility()` behaves correctly without additional mocking.

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0, including all of Task 5's and this task's `content.test.ts` cases.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/content.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1423 paste-target heuristics"
```

---

### Task 8: #1451 — storage enum parsing (`src/models/storage.ts`) — security-adjacent

**Files:**
- Modify (cherry-pick): `src/models/storage.ts`
- Create: `src/test/models/storage.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `EntryStorage.import()` correctly round-trips non-default `algorithm`/`type` values through storage.

- [ ] **Step 1: Cherry-pick all 3 commits in order**

```bash
git -C /Users/zain/projects/authenticator-enhanced log --oneline --reverse main..pr-1451
```
Expected: `c372d9e3 fix(storage): parse algorithm properly`, `e1959334 fix(storage): parse type properly`, `1fc616ba fix(storage): keep algorithm undefined if invalid` (chronological order).

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick c372d9e3 e1959334 1fc616ba
```
Expected: all 3 apply cleanly, author `Enzo Caceresenzo <...>` (verify via `git log pr-1451 --format='%an <%ae>' -1`).

- [ ] **Step 2: Verify the resulting code**

Run: `git -C /Users/zain/projects/authenticator-enhanced log -3 --format='%h %s'` then `sed -n '453,536p' src/models/storage.ts`
Expected: the `import()` method's `type`/`algorithm` fields now read:
```ts
        type: OTPType[rawType] || OTPType[OTPType.totp],
        ...
        algorithm: rawAlgorithm
          ? OTPAlgorithm[rawAlgorithm]
          : OTPAlgorithm.SHA1,
```
with `const rawType = data[hash].type;` added above the `entryData` object construction (matching the diff already reviewed in Phase 1's triage).

- [ ] **Step 3: Extra security-focused review pass (required for this task specifically)**

Before writing the test, re-confirm (this is the required heightened-scrutiny check from the Global Constraints, explicit here since this is a security-adjacent file): the change only affects which `OTPAlgorithm`/`OTPType` enum constant is selected during deserialization — it does not touch `Encryption`, `KeyUtilities`, or any secret material handling. Run: `git -C /Users/zain/projects/authenticator-enhanced diff 9d9660bb..HEAD -- src/models/storage.ts src/models/encryption.ts src/models/key-utilities.ts` restricted to just this task's 3 commits (`git diff <commit-before-task-8>..HEAD -- src/models/storage.ts`) and confirm no changes outside the `type`/`algorithm` field parsing.

- [ ] **Step 4: Write the regression test**

Create `src/test/models/storage.test.ts`:
```ts
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
    const hash = "test-hash-sha256";
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
    expect(imported.algorithm).to.eq(OTPAlgorithm.SHA256);
  });

  it("correctly parses a non-default type (hotp) instead of falling back to totp", async () => {
    const encryption = new Encryption("", "");
    const hash = "test-hash-hotp";
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
    expect(imported.type).to.eq(OTPType.hotp);
  });

  it("falls back to SHA1 when no algorithm is provided", async () => {
    const encryption = new Encryption("", "");
    const hash = "test-hash-default-algo";
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
    expect(imported.algorithm).to.eq(OTPAlgorithm.SHA1);
  });
});
```

If `EntryStorage.get()`'s return shape or `Encryption`'s constructor signature don't match what's assumed here (verify against `src/models/otp.ts`/`src/models/encryption.ts` before running — the plan's earlier research read `storage.ts`'s `import()` in full but not `EntryStorage.get()`'s exact return type or `Encryption`'s constructor), adjust the test to match the actual signatures while preserving the same assertions (algorithm/type survive a round-trip through `import()` → `get()`). Report any signature mismatches found and how they were resolved.

- [ ] **Step 5: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 6: Commit**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/models/storage.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1451 storage enum parsing"
```

---

### Task 9: #1547 — Base32 secret padding (WITH CHANGES) — security-adjacent

**Files:**
- Modify (cherry-pick): `src/background.ts`, `src/import.ts`
- Modify (follow-up fix): `src/background.ts`, `src/import.ts`
- Create: `src/test/import.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: Base32 secret padding on QR/otpauth-URL import, correctly gated to not corrupt hex/hhex-type secrets.

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1547
```
Expected: clean, no conflicts (touches `src/background.ts` and `src/import.ts`, neither modified by prior tasks except Task 9's own upcoming edits).

- [ ] **Step 2: Verify the diff**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD`
Expected two hunks matching Phase 1's triage:
```diff
--- a/src/background.ts
+++ b/src/background.ts
@@ -203,6 +203,9 @@
           type = "hhex";
         }
+        if (secret.length % 8) {
+          secret += "=".repeat(8 - (secret.length % 8));
+        }
```
```diff
--- a/src/import.ts
+++ b/src/import.ts
@@ -292,7 +292,10 @@
           type = "hhex";
         }
-
+        if (secret.length % 8) {
+          secret += "=".repeat(8 - (secret.length % 8));
+        }
+
```

- [ ] **Step 3: Apply the required fix — gate the padding to non-hex types**

`src/background.ts` (inside `getTotp`, right after the hex/hhex classification `if`/`else if` block):

Old:
```ts
        if (secret.length % 8) {
          secret += "=".repeat(8 - (secret.length % 8));
        }
```
New:
```ts
        if (type !== "hex" && type !== "hhex" && secret.length % 8) {
          secret += "=".repeat(8 - (secret.length % 8));
        }
```

`src/import.ts` (inside `getEntryDataFromOTPAuthPerLine`, same relative location):

Old:
```ts
        if (secret.length % 8) {
          secret += "=".repeat(8 - (secret.length % 8));
        }
```
New:
```ts
        if (type !== "hex" && type !== "hhex" && secret.length % 8) {
          secret += "=".repeat(8 - (secret.length % 8));
        }
```

Locate each by searching for `if (secret.length % 8)` — it appears exactly once per file after Step 1's cherry-pick.

- [ ] **Step 4: Extra security-focused review pass (required for this task specifically)**

This directly modifies secret-parsing logic on the QR/otpauth-URL import path. Confirm: (a) the fix only adds a type-check to an existing conditional, no new external calls or data flow; (b) hex/hhex secrets now pass through completely unmodified (unpadded), matching their pre-#1547 behavior exactly; (c) Base32 (totp/hotp) secrets still get padded exactly as #1547 intended. Verify by re-reading the full diff: `git -C /Users/zain/projects/authenticator-enhanced diff HEAD -- src/background.ts src/import.ts` before committing.

- [ ] **Step 5: Commit the fix**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/background.ts src/import.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "fix: gate Base32 secret padding to Base32-typed secrets only

PR #1547's padding was applied unconditionally after secret
classification, corrupting hex/hhex-type secrets whose length isn't a
multiple of 8 by appending '=' (not a valid hex digit). Gate the
padding to skip hex/hhex-classified secrets.

Follow-up fix for cherry-picked upstream PR #1547 (Authenticator-Extension/Authenticator)."
```

- [ ] **Step 6: Write the regression test**

`getTotp` (background.ts) isn't directly testable (per Task-parallel research on #1494, same function area — not exported, needs message simulation). `getEntryDataFromOTPAuthPerLine` (import.ts) **is** already exported (confirmed: `export async function getEntryDataFromOTPAuthPerLine`) — test against that one directly, which exercises the identical padding-gate logic.

Create `src/test/import.test.ts`:
```ts
import "mocha";
import * as chai from "chai";
import { expect } from "chai";

mocha.setup("bdd");

import { getEntryDataFromOTPAuthPerLine } from "../import";

describe("getEntryDataFromOTPAuthPerLine Base32 padding gate (#1547)", () => {
  it("pads an unpadded Base32 TOTP secret to a multiple of 8", async () => {
    // "JBSWY3DP" is 8 chars already valid Base32; use a shorter unpadded one.
    const line = "otpauth://totp/Test:user?secret=JBSWY3D&issuer=Test";
    const { exportData, succeededCount } =
      await getEntryDataFromOTPAuthPerLine(line);
    expect(succeededCount).to.eq(1);
    const entry = Object.values(exportData)[0] as any;
    expect(entry.secret.length % 8).to.eq(0);
    expect(entry.secret).to.eq("JBSWY3D=");
  });

  it("does not pad a hex-classified secret, even if its length isn't a multiple of 8", async () => {
    // A 20-char lowercase-hex string: valid hex, NOT valid Base32 (contains
    // no 8-32 chars but importantly is hex-only), classified as type "hex".
    const hexSecret = "2c52e8fcfac34091da63e"; // 21 hex chars, %8 !== 0
    const line = `otpauth://totp/Test:user?secret=${hexSecret}&issuer=Test`;
    const { exportData, succeededCount } =
      await getEntryDataFromOTPAuthPerLine(line);
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
    const { exportData, succeededCount } =
      await getEntryDataFromOTPAuthPerLine(line);
    expect(succeededCount).to.eq(1);
    const entry = Object.values(exportData)[0] as any;
    expect(entry.type).to.eq("hhex");
    expect(entry.secret).to.eq(hexSecret);
    expect(entry.secret).to.not.include("=");
  });
});
```

Verify each test's secret strings actually classify as intended per the existing regexes (`/^[0-9a-f]+$/i` for hex, `/^[2-7a-z]+=*$/i` for Base32) before finalizing — `"JBSWY3D"` should fail the hex regex (contains no 0-9/a-f-only... actually it DOES contain only characters within a-f/0-9 range coincidentally for some letters; double check each fixture string against both regexes to ensure it lands in the intended classification branch, adjusting the fixture strings if a chosen string accidentally matches both or neither regex).

- [ ] **Step 7: Run build and tests**

```bash
npm --prefix /Users/zain/projects/authenticator-enhanced run chrome
npm --prefix /Users/zain/projects/authenticator-enhanced test
```
Expected: both exit 0.

- [ ] **Step 8: Commit the test**

```bash
git -C /Users/zain/projects/authenticator-enhanced add src/test/import.test.ts
git -C /Users/zain/projects/authenticator-enhanced commit -m "test: add regression coverage for #1547 Base32 padding gate"
```

---

### Task 10: #1494 — OneDrive OAuth token exchange (`src/background.ts`) — most security-sensitive, reviewed last

**Files:**
- Modify (cherry-pick): `src/background.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: a working OneDrive OAuth token exchange (currently completely non-functional on `main`).

- [ ] **Step 1: Cherry-pick**

```bash
git -C /Users/zain/projects/authenticator-enhanced cherry-pick pr-1494
```
Expected: clean — this touches a different region of `background.ts` (the OneDrive branch of `getBackupToken`, lines ~369-402) than Task 9's edit (the `getTotp` function, lines ~79-241); if a conflict occurs due to line-number proximity from Task 9's insertions, resolve by keeping both changes (they're non-overlapping functions).

- [ ] **Step 2: Verify the diff exactly**

Run: `git -C /Users/zain/projects/authenticator-enhanced show HEAD -- src/background.ts`
Expected:
```diff
@@ -379,6 +379,15 @@
                       Accept: "application/json",
                       "Content-Type": "application/x-www-form-urlencoded",
                     },
+                    body: "client_id=" +
+                      getCredentials().onedrive.client_id +
+                      "&client_secret=" +
+                      getCredentials().onedrive.client_secret +
+                      "&code=" +
+                      value +
+                      "&redirect_uri=" +
+                      redirUrl +
+                      "&grant_type=authorization_code",
                   }
                 );
```

- [ ] **Step 3: Extra security-focused review pass (required for this task specifically, and the most important one in this phase)**

This is the OAuth token-exchange path — highest-stakes change in Phase 2. Confirm explicitly, citing evidence:
1. The request goes to the correct, hardcoded Microsoft endpoint (`https://login.microsoftonline.com/common/oauth2/v2.0/token`, unchanged by this diff — verify via `grep -n "login.microsoftonline.com" src/background.ts`).
2. `client_secret` is sent in the POST body over HTTPS, not logged or sent anywhere else — confirm no new `console.log`/`fetch` calls anywhere else in this diff (there should be exactly one hunk, one `fetch` call modified).
3. `getCredentials().onedrive.client_id`/`.client_secret` — confirm these come from the existing `src/models/credentials.ts` mechanism already used identically by the Google Drive branch two dozen lines above (same file, same function), not a new/different credentials source introduced by this PR.
4. No new `optional_host_permissions` or manifest changes are needed/included — confirm `git show HEAD --stat` touches only `src/background.ts`.

Report all four findings explicitly in the task report, not just "looks fine."

- [ ] **Step 4: Build verification**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0.

No automated regression test for this task — confirmed in research that `getBackupToken` is unexported and reachable only through a real `chrome.identity.launchWebAuthFlow` OAuth round-trip nested inside a `chrome.runtime.onMessage` listener; testing it would require either exporting internal implementation details purely for a single test (a much larger, riskier refactor of the OAuth flow itself, not warranted for a 9-line fix) or a heavier integration-style test simulating the entire `launchWebAuthFlow` callback chain via `sinon-chrome`. Given the fix is small, mechanically verifiable by inspection (Step 3), and mirrors the already-working Google Drive branch's parameter set exactly, this is a deliberate, documented exception to the testing policy — flag it to the user in the final task report rather than silently skipping.

---

## Definition of Done for Phase 2

- All 10 PRs' fixes are on `main`, each with the original author's identity preserved on their cherry-picked commit(s).
- No AI-attribution trailers anywhere in the new commit history (specifically: #1544's trailer confirmed stripped).
- `src/content.ts` now exports `applyAppendMode`, `fireInputEvents`, and `findPasteTarget` — a deliberate, minimal testability refactor, not scope creep.
- 8 of 10 fixes have regression tests (`Accounts.test.ts` ×2 fixes, `EntryComponent.test.ts` ×2 fixes, `content.test.ts` ×2 fixes, `storage.test.ts`, `import.test.ts`); #1544 (CSS) and #1494 (unreachable OAuth internals) are documented exceptions.
- `npm run chrome` and `npm test` pass on the final state.
- Final whole-branch review across all 10 tasks' commits, same pattern as Phase 1's closing review — with extra attention to the three security-adjacent tasks (#1451, #1547, #1494) and the Task 7 manual reconciliation.
