# Phase 3b: Implement the 8 confirmed bugs from Phase 3's issue mining report

**Date:** 2026-07-12
**Status:** Approved by user, ready for planning

## Background

Phase 3 (`docs/issue-triage/2026-07-12-issue-mining-report.md`) validated 54
high-signal open issues from `Authenticator-Extension/Authenticator` against
the current (post-Phase-2) source, finding 8 CONFIRMED bugs with cited
root causes and sketched fixes. This phase implements those 8.

Unlike Phase 2 (which cherry-picked existing upstream PRs), none of these
bugs have an existing PR — this phase writes original fix code, under this
repo's own identity, referencing the upstream issue number for provenance.

## Decisions

- **One task per bug**, same subagent-driven process as Phase 2: fresh
  implementer + independent reviewer per task, direct to `main`, no
  per-fix GitHub PR.
- **Order**: simplest/most contained first, the two security-adjacent bugs
  last with extra scrutiny (matching Phase 2's pattern) — #1089 (algorithm
  parsing, touches which crypto constant is selected) and #463 (backup
  restore/decrypt path) get the heightened review bar.
- **Regression test per fix**, following the same tiered testing approach
  established in Phase 2 (direct invocation of the compiled logic where
  possible, real-DOM fixtures for content-script fixes, `sinon`/
  `sinon-chrome` for chrome API mocking) — confirmed feasible for all 8
  during planning, no CSS-only or unreachable-internals exceptions this
  round.
- **Commit message convention**: since there's no upstream commit to
  cherry-pick, each fix commit is authored under the local identity
  (`Zain <hassan9224@gmail.com>`) with a message citing the upstream issue
  number for traceability, e.g. `fix: correctly handle subdomain filtering
  (fixes upstream #164)`.
- No AI attribution in any commit (standing rule).
- The Puppeteer/Chrome CI version mismatch stays deferred to Phase 4, per
  explicit user confirmation — not folded into this phase.

## Order

1. #1426 — QR capture dialog-close race (`src/content.ts`)
2. #533 — blank popup on unhandled init error (`src/popup.ts`)
3. #1182 — UTF-8 corruption in migration import (`src/models/migration.ts`)
4. #816 — broken backup download in Vivaldi/Brave (`src/components/common/ButtonLink.vue`, `src/components/Popup/BackupPage.vue`)
5. #164 — subdomain filtering conflation (`src/utils.ts`)
6. #878 — Firefox autofill silent fallback (`src/components/Popup/EntryComponent.vue`, `src/utils.ts`, `src/store/Menu.ts`)
7. #1089 — case-sensitive algorithm lookup (security-adjacent) (`src/background.ts`, `src/models/storage.ts`)
8. #463 — silent backup-restore entry loss (security-adjacent, most sensitive) (`src/models/storage.ts`, `src/import.ts`, `src/components/Import/FileImport.vue`)

## Out of scope for this phase

- The Puppeteer/Chrome CI version mismatch (Phase 4).
- The 21 CANNOT REPRODUCE / INSUFFICIENT INFO issues (need live repro or
  reporter follow-up, not static-analysis-fixable).
- The 13 NOT A BUG issues and 12 ALREADY FIXED issues (no action needed).
- Any general dependency/build modernization (Phase 4).

## Testing/verification for this phase

- Per-fix: `npm run chrome` and `npm test` both pass after each fix +
  regression test.
- Each new regression test must genuinely exercise the reported bug (would
  fail against the pre-fix code) — verified by the task reviewer, same bar
  as Phase 2.
- Final whole-branch review across all 8 fixes once complete.
