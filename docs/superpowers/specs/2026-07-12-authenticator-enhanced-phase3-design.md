# Phase 3: Mine open upstream issues for validated bugs

**Date:** 2026-07-12
**Status:** Approved by user, ready for planning

## Background

Phase 1 triaged the 27 open PRs against `Authenticator-Extension/Authenticator`.
Phase 2 landed the 10 accepted fixes. What's left unaddressed: 284 open
issues on the upstream tracker, the vast majority spam or one-line support
requests ("Totp", "Habiba"), but a real minority are genuine, often
maintainer-acknowledged bugs that never got a PR at all.

A quick survey found real signal: issues labeled `P1` (#1291 "Backup not
working", #1292 "HOTP codes not importing correctly", #1302 "Export QR Code
not rendering correctly") all carry a September 2024 maintainer comment
("We have identified the root cause, and the fix PR is in review") — the fix
apparently never shipped. High-comment-count `bug`-labeled issues in general
are far more likely to be real than one-word titles.

The user's explicit instruction for this phase: **validate before treating
an issue as real** — read the current source and reason concretely about
whether the described bug still exists, rather than trusting the issue
report at face value.

## Scope: Phase 3 is triage/validation only

Mirrors the Phase 1 → Phase 2 split: this phase produces a validated report,
no fix code. Implementation of confirmed bugs is a later phase, planned
separately after the user reviews this report — same reasoning as before
(don't commit to fixing something before an independent read of the actual
bug and its scope).

## Filtering: 284 issues → a manageable candidate list

Fetch all open issues with full metadata (title, labels, comment count,
comment bodies, author association). Prioritize for full review:

- Labeled `bug` AND (labeled `P1` or `good first issue`, OR 3+ comments, OR
  a `MEMBER`-association reply) — this is expected to cut ~284 down to
  roughly 30-50 real candidates based on the initial survey.
- Explicitly include the 3 `P1` issues regardless of other criteria (highest
  confidence signal: maintainer-confirmed root cause, never shipped).

Everything else (one-word titles, zero engagement, no bug label, pure
support/"how do I" questions) is excluded from full review, but the report
notes the exclusion criteria and count so the exclusion is visible, not
silent.

**Cross-reference with Phase 1/2 first, before spending review effort**: several
candidate issues are already known duplicates of PRs Phase 2 already fixed
(from Phase 1's triage report, which explicitly named the duplicates each
accepted PR resolves):
- #1442, #1443, #1449, #1450, #1508, #1499, #1492, #1475 → fixed by #1451
  (storage enum parsing, landed Phase 2 Task 8)
- #1496 → fixed by #1497 (search box, landed Phase 2 Task 3)
- #1517 → fixed by #1519 (HOTP counter edit, landed Phase 2 Task 4)
- #1516 → fixed by #1518 (autofill append mode, landed Phase 2 Task 5)
- #1546 → fixed by #1547 (Base32 padding, landed Phase 2 Task 9)

These get a fast **ALREADY FIXED** verdict (cite the Phase 2 commit) without
full re-investigation, unless the issue's actual comments describe a
materially different symptom than what the linked PR fixed — checked, not
assumed.

## Validation methodology (the core requirement)

For each candidate issue, in order:
1. Read the full issue body and all comments — the real reported symptom,
   any repro steps, any environment details (browser, extension version).
2. Check whether it's already covered by the cross-reference list above.
3. If not: read the actual current source code (post-Phase-2) for the
   relevant subsystem and reason concretely — does the described behavior
   match a real, identifiable defect in the current code? Cite file:line.
4. Assign a verdict:
   - **CONFIRMED** — real bug, root cause identified with file:line
     evidence, a fix approach sketched (not implemented).
   - **ALREADY FIXED** — cite the specific commit/PR that resolved it.
   - **CANNOT REPRODUCE / INSUFFICIENT INFO** — the report lacks enough
     detail (browser version, repro steps) to validate one way or the
     other, or requires live browser interaction to confirm.
   - **NOT A BUG** — user error, support request, duplicate of another
     candidate, or behavior working as designed.

No verdict is assigned from the title/label alone — every CONFIRMED or
ALREADY FIXED verdict must cite actual code or commit evidence.

## Report structure

`docs/issue-triage/2026-07-12-issue-mining-report.md`, mirroring the PR
triage report's format: header + methodology + summary counts, then one
section per reviewed issue with verdict + evidence. A "Phase 3b action list"
at the top listing CONFIRMED issues, for a future implementation phase to
consume directly (same pattern as the PR triage report's action list, which
already proved useful for Phase 2).

## Out of scope for this phase

- Any fix code.
- The excluded low-signal issues (noted with exclusion criteria, not
  individually triaged).
- Closing/commenting on upstream issues (this fork has no write access to,
  and no standing to act on, `Authenticator-Extension/Authenticator`'s
  issue tracker — the report is for our own use).
- The 4 DEFER PRs from Phase 1 (unrelated track).

## Testing/verification for this phase

- No code changes to verify. Verification here means: every CONFIRMED/
  ALREADY FIXED verdict has cited, checkable evidence (file:line or commit
  hash), not just assertion — spot-checked during self-review and again by
  a task reviewer.
