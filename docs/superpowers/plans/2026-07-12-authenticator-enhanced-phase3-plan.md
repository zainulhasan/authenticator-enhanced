# Authenticator Enhanced — Phase 3 (Issue Mining) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a validated triage report on 54 high-signal open issues from `Authenticator-Extension/Authenticator`'s issue tracker (filtered from 284 total), with every CONFIRMED or ALREADY FIXED verdict backed by cited code/commit evidence — no fix code in this phase.

**Architecture:** Read-only investigation, no code changes to the repo other than the report file itself. Since these are independent, non-code-modifying research tasks (unlike Phase 2's cherry-picks), they can run as parallel subagent dispatches without git-conflict risk — each batch writes to its own file, then a final merge task combines them into one report, commits, and pushes.

**Tech Stack:** `gh` CLI (issue reading), Read/Grep against the local repo clone at `/Users/zain/projects/authenticator-enhanced` (post-Phase-2 source) for validation.

## Global Constraints

- No fix code in this phase — every task produces findings only.
- Every CONFIRMED or ALREADY FIXED verdict must cite file:line or a commit hash — a verdict with no cited evidence is a plan failure, not an acceptable finding.
- If investigation is genuinely inconclusive, the correct verdict is CANNOT REPRODUCE / INSUFFICIENT INFO — do not force a CONFIRMED verdict to seem more useful. A documented "I checked X and Y, neither explains the report" is more valuable than a guess.
- No AI attribution in any commit.
- Report lives at `docs/issue-triage/2026-07-12-issue-mining-report.md`.

## The 54 candidate issues (filtered from 284 open, see design spec for filter criteria)

Split into 6 batches of 9 for parallel investigation:

- **Batch A:** #164, #381, #390, #405, #416, #460, #463, #533, #561
- **Batch B:** #780, #816, #835, #878, #887, #925, #973, #1017, #1083
- **Batch C:** #1089, #1091, #1097, #1098, #1101, #1102, #1105, #1115, #1116
- **Batch D:** #1120, #1149, #1157, #1182, #1194, #1199, #1205, #1220, #1260
- **Batch E:** #1267, #1269, #1284, #1287, #1291, #1292, #1294, #1298, #1302
- **Batch F:** #1317, #1375, #1401, #1426, #1445, #1449, #1450, #1508, #1514

**Known-already-fixed cross-reference** (from Phase 1's triage report, don't re-investigate from scratch — confirm the cross-reference is accurate, then verdict ALREADY FIXED with a one-line citation): #1449, #1450, #1508 appear in Batch F and are already known duplicates of #1451 (fixed Phase 2 Task 8, commits `c86d5b9c`/`b06c96b0`/`9d994e03`/`4d9892b2`). Confirm each one's actual reported symptom genuinely matches the algorithm/type-parsing bug #1451 fixed (don't just trust the number match — read each issue body once) before assigning ALREADY FIXED.

## Worked example (already investigated during planning — reproduce this exact entry verbatim in Batch E's output, it does not need re-investigation)

### #1291 — Backup not working

**Verdict: CANNOT REPRODUCE / INSUFFICIENT INFO**

Reported: unencrypted backup export omits a just-added entry ("added new url and push backup, after open file in editor, new url not exist"), corroborated by 2 other users in comments (one on Firefox). A maintainer (`Sneezry`, MEMBER) commented "We have identified the root cause, and the fix PR is in review" (2024-09-11) — but no such PR exists among the 27 open PRs Phase 1 triaged, and the repo went dormant weeks later (last real commit 2024-10-10), so the promised fix apparently never shipped or was never opened as a PR.

Investigated the obvious hypothesis first: a stale cached export blob (Vuex `accounts/updateExport`, committed inside the `updateEntries` action at `src/store/Accounts.ts:602-608`) being used instead of a fresh read at backup-push time. This turned out to be **false** — `src/models/backup.ts`'s `upload()` method (present for all three providers: Drive, Dropbox, OneDrive, e.g. line 20) calls `EntryStorage.backupGetExport(...)` directly, a fresh async read of `BrowserStorage.get()`, not any cached Vuex state. Also checked `EntryStorage.backupGetExport` (`src/models/storage.ts:375-449`) for a loop-mutation bug (it reassigns `_data[entry.hash]`/deletes `_data[hash]` mid-iteration) — but `Object.keys(_data)` at the loop's start captures a fixed snapshot, so mid-loop mutation doesn't cause keys to be skipped; this doesn't explain the report either.

No other candidate root cause was found via static reading. This bug, if it's real and still present, most likely requires live reproduction (add an entry, immediately trigger a backup push, inspect the actual uploaded/exported file) to pin down — something a static code read can't fully resolve, particularly since the report describes a timing-sensitive interaction ("added new url and push backup" as sequential UI actions) that static analysis can't simulate. Flagging as a good candidate for hands-on QA in a future pass, not for blind implementation based on a guess.

## Batch task template (apply this exact structure to each of the 6 batches)

Each batch is one task. For every issue in the batch:

1. `gh issue view <N> --repo Authenticator-Extension/Authenticator --json title,body,comments,labels` — read the full report and all comments, not just the title.
2. Check the known-already-fixed cross-reference list above first — if it matches, verify the symptom actually matches (read the issue body once) and assign ALREADY FIXED with the citation, skip deeper investigation.
3. Otherwise: identify the relevant subsystem (storage/backup, OTP generation, UI/Vue components, browser-specific behavior, etc.) and read the actual current source in `/Users/zain/projects/authenticator-enhanced` for that subsystem. Reason concretely about whether the described behavior matches an identifiable defect — cite file:line for any claim.
4. Assign a verdict: **CONFIRMED** (root cause + file:line evidence + a sketched fix approach, not implemented), **ALREADY FIXED** (cite commit), **CANNOT REPRODUCE / INSUFFICIENT INFO** (say what was checked and why it's inconclusive — see the #1291 worked example for the expected depth), or **NOT A BUG** (explain why — support request, user error, duplicate, working as designed).
5. Do not spend more than ~10-15 minutes of investigation per issue — if genuinely inconclusive after checking the obvious code paths, that itself is the (valid) CANNOT REPRODUCE / INSUFFICIENT INFO finding; don't chase deeper and deeper without new evidence.

Write findings to the batch's own file (path given per task below) in this format per issue:

```markdown
### #NNNN — <title>

**Verdict:** <CONFIRMED | ALREADY FIXED | CANNOT REPRODUCE / INSUFFICIENT INFO | NOT A BUG>

<2-6 sentences: what was reported, what was checked, the evidence (file:line
or commit hash), and — for CONFIRMED only — a sketched fix approach.>
```

---

### Task 1: Batch A investigation

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-A.md`

**Interfaces:**
- Produces: verdicts for #164, #381, #390, #405, #416, #460, #463, #533, #561, consumed by the final merge task (Task 7).

- [ ] Investigate all 9 issues in Batch A per the batch task template above.
- [ ] Write findings to the file path above, one `### #NNNN` entry per issue, in the given order.
- [ ] Report back: for each issue, the verdict assigned (one line each) plus the full file path.

### Task 2: Batch B investigation

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-B.md`

**Interfaces:**
- Produces: verdicts for #780, #816, #835, #878, #887, #925, #973, #1017, #1083, consumed by Task 7.

- [ ] Investigate all 9 issues in Batch B per the batch task template above.
- [ ] Write findings to the file path above.
- [ ] Report back: verdict summary + file path.

### Task 3: Batch C investigation

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-C.md`

**Interfaces:**
- Produces: verdicts for #1089, #1091, #1097, #1098, #1101, #1102, #1105, #1115, #1116, consumed by Task 7.

- [ ] Investigate all 9 issues in Batch C per the batch task template above.
- [ ] Write findings to the file path above.
- [ ] Report back: verdict summary + file path.

### Task 4: Batch D investigation

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-D.md`

**Interfaces:**
- Produces: verdicts for #1120, #1149, #1157, #1182, #1194, #1199, #1205, #1220, #1260, consumed by Task 7.

- [ ] Investigate all 9 issues in Batch D per the batch task template above.
- [ ] Write findings to the file path above.
- [ ] Report back: verdict summary + file path.

### Task 5: Batch E investigation (includes the pre-solved worked example)

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-E.md`

**Interfaces:**
- Produces: verdicts for #1267, #1269, #1284, #1287, #1291, #1292, #1294, #1298, #1302, consumed by Task 7.

- [ ] For **#1291**, reproduce the "Worked example" entry above VERBATIM — it's already fully investigated, do not re-investigate or second-guess it, just copy it into this batch's file.
- [ ] Investigate the remaining 8 issues in Batch E per the batch task template above. Note: #1292 and #1302 are also P1-labeled with the same "fix PR is in review, never shipped" maintainer comment pattern as #1291 — apply the same rigor (check obvious hypotheses against actual code, don't force a CONFIRMED verdict without evidence).
- [ ] Write findings to the file path above, in order (#1291 first as given, then the rest).
- [ ] Report back: verdict summary + file path.

### Task 6: Batch F investigation (includes cross-reference verification)

**Files:**
- Create: `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-F.md`

**Interfaces:**
- Produces: verdicts for #1317, #1375, #1401, #1426, #1445, #1449, #1450, #1508, #1514, consumed by Task 7.

- [ ] For **#1449, #1450, #1508**: verify against the known-already-fixed cross-reference (they're documented duplicates of #1451, fixed in Phase 2 Task 8). Read each issue body once to confirm the reported symptom is genuinely the algorithm/type-parsing bug (not a different, coincidentally-related report), then assign ALREADY FIXED citing commits `c86d5b9c`/`b06c96b0`/`9d994e03` (`src/models/storage.ts`, landed `4d9892b2`).
- [ ] Investigate the remaining 6 issues (#1317, #1375, #1401, #1426, #1445, #1514) per the batch task template above. Note: #1445 ("Unencrypted backup is incomplete") may be related to #1291's symptom (Batch E) — if so, note the connection but still investigate independently, since it's a separate report that might have different repro details.
- [ ] Write findings to the file path above.
- [ ] Report back: verdict summary + file path.

---

### Task 7: Merge all batches into the final report

**Files:**
- Read: all 6 batch files from Tasks 1-6 (`/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/phase3-batch-{A,B,C,D,E,F}.md`)
- Create: `docs/issue-triage/2026-07-12-issue-mining-report.md`

**Interfaces:**
- Consumes: all 6 batch files' verdicts.
- Produces: the final committed, pushed report.

- [ ] **Step 1: Read all 6 batch files**

- [ ] **Step 2: Write the report header**

```markdown
# Issue Mining Report — 2026-07-12

Validated triage of 54 high-signal issues out of 284 open on
`Authenticator-Extension/Authenticator`'s tracker, as input to a future
implementation phase. Filter criteria: labeled `bug` AND (labeled `P1` or
`good first issue`, OR 3+ comments, OR a maintainer/`MEMBER` reply). The
remaining ~230 issues (one-word titles, zero engagement, pure support
requests) were excluded from full review — noted here for transparency, not
silently dropped.

Verdict values: CONFIRMED, ALREADY FIXED, CANNOT REPRODUCE / INSUFFICIENT
INFO, NOT A BUG. Every CONFIRMED/ALREADY FIXED verdict below cites file:line
or a commit hash — no verdict is asserted from a title/label alone.
```

- [ ] **Step 3: Concatenate all 6 batch files' content in order (A, B, C, D, E, F)** under the header, each batch under its own `## Batch A` / `## Batch B` etc. subheading.

- [ ] **Step 4: Compute and insert summary counts** — count how many issues landed in each verdict bucket across all 54, insert a summary line right after the header (same pattern as the Phase 1 PR triage report): `**Summary: N CONFIRMED, N ALREADY FIXED, N CANNOT REPRODUCE / INSUFFICIENT INFO, N NOT A BUG, out of 54 candidates reviewed (from 284 total open issues).**`

- [ ] **Step 5: Add a "Phase 3b action list"** right after the summary, listing every CONFIRMED issue by number and one-line title, for a future implementation phase to consume directly (same pattern as Phase 2's action list in the PR triage report).

- [ ] **Step 6: Verify the report is complete**

Run: `grep -c '^### #' docs/issue-triage/2026-07-12-issue-mining-report.md`
Expected: `54`

- [ ] **Step 7: Commit and push**

```bash
git -C /Users/zain/projects/authenticator-enhanced add docs/issue-triage/2026-07-12-issue-mining-report.md
git -C /Users/zain/projects/authenticator-enhanced commit -m "docs: issue mining report for Phase 3"
git -C /Users/zain/projects/authenticator-enhanced push origin main
```
Expected: commit and push both succeed.

## Definition of Done for Phase 3

- `docs/issue-triage/2026-07-12-issue-mining-report.md` contains a verdict for all 54 candidate issues, every CONFIRMED/ALREADY FIXED verdict cites evidence.
- No fix code was written this phase.
- Report is committed and pushed to `main`.
