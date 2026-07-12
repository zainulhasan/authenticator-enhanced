# Phase 2: Land the accepted PR fixes onto authenticator-enhanced

**Date:** 2026-07-12
**Status:** Approved by user, ready for planning

## Background

Phase 1 (see `docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md`
and `docs/pr-triage/2026-07-12-initial-triage.md`, both already committed to
`zainulhasan/authenticator-enhanced`) produced a triage report covering all
27 PRs open against the unmaintained upstream
`Authenticator-Extension/Authenticator`. 10 of those are directly
actionable:

- **Implement as-is (8):** #1310, #1544, #1497, #1519, #1518, #1554, #1451,
  #1494
- **Implement with changes (2):** #1423, #1547 — the triage report already
  specifies exactly what change each needs

This phase lands all 10 onto `main`.

## Decisions

**Cherry-pick, not reimplement.** For each PR: `git fetch upstream
pull/<N>/head:pr-<N>`, identify its commit(s) via `git log --oneline
main..pr-<N>`, cherry-pick them onto `main` in order. This preserves the
original contributors' authorship and uses code already reviewed in the
triage report, rather than having subagents rewrite it from scratch. Our
`main` is at the exact base commit these PRs were opened against (no drift
since Oct 2024), so conflicts should be rare. The user has authorized
reimplementing instead of cherry-picking on a case-by-case basis if a
cherry-pick turns out to be impractical (e.g. genuine conflicts, or the
commit history is messier than expected) — implementer's judgment, noted in
its report.

**Direct to `main`, subagent-reviewed** — same process as Phase 1: fresh
implementer subagent + independent reviewer subagent per fix, no
GitHub-PR-per-fix round trip.

**Heightened review bar against malicious code.** These are cherry-picks of
commits from unvetted internet contributors onto a repo that will handle
real TOTP/HOTP secrets and OAuth tokens. Every task reviewer must, in
addition to its normal spec/quality review, explicitly verify: the
cherry-picked commit(s) match exactly what the triage report already
described (no surprise extra commits pulled in from the PR branch, no
unexpected file changes beyond what's documented), and the diff contains no
obfuscated code, unexplained network calls, or anything that doesn't serve
the stated bug fix. This is a named, required check in every task's
reviewer dispatch for this phase, not an incidental one.

**Tiered testing policy** (the user approved "add a test per fix" in
general, this tiers it by actual feasibility in the existing harness):

The test harness (`npm test`) runs a real (non-headless) Chrome via
Puppeteer, loading the built extension and running Mocha/Chai/Sinon
in-browser (`src/test.ts`'s `require.context("./test", true, /\.tsx?$/)`
auto-discovers any `.ts` file under `src/test/`). New regression tests are
new files under `src/test/`, following `src/test/gost.test.ts`'s
`describe`/`it`/`expect` style.

- **Pure logic/store fixes** (#1451, #1547, #1497, #1310, #1494):
  straightforward unit-style regression test added, calling the fixed
  function/mutation directly with representative inputs.
- **DOM-heuristic fix** (#1423): tested via a real-DOM fixture (create
  input elements in the test page's DOM, call `pasteCode()` directly,
  assert the correct element is chosen across scenarios).
- **Vue component fixes** (#1519, #1518, #1554): tested via
  `@vue/test-utils` (already a devDependency), scoped to the specific
  computed/method/store-plumbing that was fixed rather than full-component
  snapshot testing.
- **Pure CSS fix** (#1544, a one-line `pointer-events: auto` rule): no
  automated regression test — this codebase has no visual/CSS regression
  infrastructure and there's no logic to unit test. Verified instead by
  build success plus the reviewer visually confirming the CSS rule targets
  the correct selector. This is a documented, approved exception, not a
  silent gap.

## Task order

Simplest first (to validate the cherry-pick mechanics before touching
anything security-sensitive), security-adjacent last (extra reviewer
scrutiny):

1. #1310 — seconds arithmetic (`Accounts.ts`)
2. #1544 — CSS pointer-events fix (no test, per policy above)
3. #1497 — search box visibility flag (`Accounts.ts`)
4. #1519 — HOTP counter edit UI (`EntryComponent.vue`)
5. #1518 — autofill append mode (`PreferencesPage.vue` → store → `content.ts`)
6. #1554 — favicon fix (`EntryComponent.vue`, `PreferencesPage.vue`)
7. #1423 — paste-target heuristics (WITH CHANGES: restore identity-keyword
   pass + password-field exclusion, per triage report)
8. #1451 — storage enum parsing (`src/models/storage.ts`) — security-adjacent
9. #1547 — Base32 secret padding (WITH CHANGES: gate to Base32-only, per
   triage report) — security-adjacent
10. #1494 — OneDrive OAuth token exchange (`src/background.ts`) —
    most security-sensitive (OAuth token exchange body), reviewed last with
    the most scrutiny

## Out of scope for this phase

- The 4 DEFER PRs (#1417, #1352, #441, #1244) — future phase.
- The 13 REJECT PRs — not landed.
- Dependency updates, CI fixes, build-system modernization — Phase 4.
- Any Vue 2 → Vue 3 / Vuex 3 → Vuex 4 migration (explicitly rejected as part
  of #1328's triage entry — out of scope for any near-term phase unless
  separately planned).

## Testing/verification for this phase

- Per-fix: `npm run chrome` and `npm test` both pass after each cherry-pick
  (+ follow-up fix commit + new test file, where applicable).
- Each new regression test actually exercises the specific bug described in
  the triage report (fails against the pre-fix code, passes after) — the
  implementer's report must show this (e.g. by describing what the test
  would have caught, since we're not keeping a literal "run before/after"
  artifact for a cherry-picked fix).
- Final whole-branch review across all 10 fixes once complete, same as
  Phase 1's closing review.
