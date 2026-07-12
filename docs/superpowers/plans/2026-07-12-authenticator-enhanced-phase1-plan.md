# Authenticator Enhanced — Phase 1 (Fork, Rebrand, PR Triage) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Stand up an independent, rebranded copy of `Authenticator-Extension/Authenticator` at `zainulhasan/authenticator-enhanced`, and produce a written triage report on the 27 open upstream PRs (accept/reject/defer) for the user to review before any fix code is written.

**Architecture:** Plain `git clone` (not a GitHub-linked fork) of the upstream `dev` branch into a local working copy, renamed branch `main`, rebrand strings touched via targeted edits (not a wholesale rewrite), pushed to a freshly created public GitHub repo. The old `origin` remote is kept as `upstream` so future phases can still pull upstream changes. A markdown triage report is produced by reading each open PR's actual diff against the cloned code, not just its description.

**Tech Stack:** TypeScript, Vue, Webpack, npm scripts (`scripts/build.sh`, `scripts/test-runner.js`), git, GitHub CLI (`gh`).

## Global Constraints

- Local git identity for this repo only (not `--global`): `user.name "Zain"`, `user.email "hassan9224@gmail.com"`.
- New repo: `zainulhasan/authenticator-enhanced`, **public**.
- New extension/package name everywhere: **"Authenticator Enhanced"** (display name), **`authenticator-enhanced`** (package/repo name).
- No AI attribution in any commit message, code, comment, or doc (standing global rule) — every commit in this repo, not just the first.
- Preserve original commit history — no rewriting/squashing.
- MIT `LICENSE` file must be kept byte-for-byte unchanged.
- Only the `en` locale's `extName`/`extShortName` are rebranded; other locale files are left untouched.
- No fix code is written in this phase — PR triage produces verdicts only.

---

### Task 1: Clone upstream repo and verify baseline build

**Files:**
- Create (via clone): `/Users/zain/projects/authenticator-enhanced/` (entire repo)

**Interfaces:**
- Produces: a working local clone at `/Users/zain/projects/authenticator-enhanced` on branch `dev`, with `npm install` completed, that later tasks modify in place.

- [ ] **Step 1: Confirm the target directory doesn't already exist**

Run: `ls /Users/zain/projects/ | grep -x authenticator-enhanced || echo "not present"`
Expected: `not present`

- [ ] **Step 2: Clone the upstream `dev` branch**

Run: `git clone -b dev git@github.com:Authenticator-Extension/Authenticator.git /Users/zain/projects/authenticator-enhanced`
Expected: exits 0, output ends with `Branch 'dev' set up to track remote branch 'dev' from 'origin'.`

- [ ] **Step 3: Install dependencies**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced install`
Expected: exits 0, output ends with `added N packages` (no `npm ERR!` lines)

- [ ] **Step 4: Baseline build verification (Chrome target), before any changes**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0; this confirms the untouched upstream code builds cleanly in our environment before we start editing, so any later build failure is attributable to our changes, not pre-existing breakage.

- [ ] **Step 5: Baseline test verification**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced test`
Expected: exits 0, output includes a passing test count and no failures.

No commit in this task — it only establishes and verifies the starting state.

---

### Task 2: Local git identity, remote rename, and branch rename

**Files:**
- Modify: `.git/config` (local git config only — via `git config`, not by hand-editing)

**Interfaces:**
- Consumes: the clone from Task 1.
- Produces: local-only committer identity `Zain <hassan9224@gmail.com>`; the original `origin` remote renamed to `upstream`; primary branch renamed `dev` → `main`.

- [ ] **Step 1: Set local (repo-scoped) git user name**

Run: `git -C /Users/zain/projects/authenticator-enhanced config user.name "Zain"`
Expected: no output

- [ ] **Step 2: Set local (repo-scoped) git user email**

Run: `git -C /Users/zain/projects/authenticator-enhanced config user.email "hassan9224@gmail.com"`
Expected: no output

- [ ] **Step 3: Verify the identity is local-only, not global**

Run: `git -C /Users/zain/projects/authenticator-enhanced config --local --get user.email`
Expected: `hassan9224@gmail.com`

Run: `git config --global --get user.email`
Expected: whatever the machine's pre-existing global email is (must NOT have been changed by Step 2) — just confirm it did not become `hassan9224@gmail.com` unless it already was.

- [ ] **Step 4: Rename the `origin` remote to `upstream`**

Run: `git -C /Users/zain/projects/authenticator-enhanced remote rename origin upstream`
Expected: no output

- [ ] **Step 5: Verify the remote rename**

Run: `git -C /Users/zain/projects/authenticator-enhanced remote -v`
Expected: two lines, both `upstream  git@github.com:Authenticator-Extension/Authenticator.git (fetch|push)` — no `origin` remote present yet (added in Task 5).

- [ ] **Step 6: Rename the primary branch to `main`**

Run: `git -C /Users/zain/projects/authenticator-enhanced branch -m dev main`
Expected: no output

- [ ] **Step 7: Verify current branch**

Run: `git -C /Users/zain/projects/authenticator-enhanced branch --show-current`
Expected: `main`

No commit in this task — config/remote/branch operations aren't tracked content changes.

---

### Task 3: Rebrand package.json and English locale strings

**Files:**
- Modify: `package.json:2` (`name`), `package.json:13` (`repository.url`), `package.json:17` (`bugs.url`), `package.json:19` (`homepage`)
- Modify: `_locales/en/messages.json:3` (`extName.message`), `_locales/en/messages.json:7` (`extShortName.message`)

**Interfaces:**
- Consumes: rebranded-nothing-yet repo from Task 2.
- Produces: `package.json` name/URLs and the English display name both read `authenticator-enhanced` / "Authenticator Enhanced", verified by a successful build+test.

- [ ] **Step 1: Edit `package.json` — package name**

Old:
```json
  "name": "authenticator-extension",
```
New:
```json
  "name": "authenticator-enhanced",
```

- [ ] **Step 2: Edit `package.json` — repository URL**

Old:
```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/Authenticator-Extension/Authenticator.git"
  },
```
New:
```json
  "repository": {
    "type": "git",
    "url": "git+https://github.com/zainulhasan/authenticator-enhanced.git"
  },
```

- [ ] **Step 3: Edit `package.json` — bugs URL**

Old:
```json
  "bugs": {
    "url": "https://github.com/Authenticator-Extension/Authenticator/issues"
  },
```
New:
```json
  "bugs": {
    "url": "https://github.com/zainulhasan/authenticator-enhanced/issues"
  },
```

- [ ] **Step 4: Edit `package.json` — homepage**

Old:
```json
  "homepage": "https://github.com/Authenticator-Extension/Authenticator#readme",
```
New:
```json
  "homepage": "https://github.com/zainulhasan/authenticator-enhanced#readme",
```

- [ ] **Step 5: Edit `_locales/en/messages.json` — extension display name**

Old:
```json
  "extName": {
    "message": "Authenticator",
    "description": "Extension Name."
  },
```
New:
```json
  "extName": {
    "message": "Authenticator Enhanced",
    "description": "Extension Name."
  },
```

- [ ] **Step 6: Edit `_locales/en/messages.json` — extension short name**

Old:
```json
  "extShortName": {
    "message": "Authenticator",
    "description": "Extension Short Name."
  },
```
New:
```json
  "extShortName": {
    "message": "Authenticator Enhanced",
    "description": "Extension Short Name."
  },
```

- [ ] **Step 7: Verify `package.json` is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('/Users/zain/projects/authenticator-enhanced/package.json'))" && echo VALID`
Expected: `VALID`

- [ ] **Step 8: Verify `_locales/en/messages.json` is still valid JSON**

Run: `node -e "JSON.parse(require('fs').readFileSync('/Users/zain/projects/authenticator-enhanced/_locales/en/messages.json'))" && echo VALID`
Expected: `VALID`

- [ ] **Step 9: Rebuild to confirm the rebrand didn't break anything**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced run chrome`
Expected: exits 0

- [ ] **Step 10: Re-run tests**

Run: `npm --prefix /Users/zain/projects/authenticator-enhanced test`
Expected: exits 0, same passing count as Task 1 Step 5

- [ ] **Step 11: Commit**

```bash
git -C /Users/zain/projects/authenticator-enhanced add package.json _locales/en/messages.json
git -C /Users/zain/projects/authenticator-enhanced commit -m "chore: rebrand as authenticator-enhanced"
```
Expected: commit succeeds, `git log -1 --format=%an` shows `Zain`

---

### Task 4: README cleanup and add Phase 1 design spec

**Files:**
- Modify: `README.md` (full rewrite — see content below)
- Create: `docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md`
- Create: `docs/superpowers/plans/2026-07-12-authenticator-enhanced-phase1-plan.md`

**Interfaces:**
- Consumes: rebranded repo from Task 3.
- Produces: a README that accurately describes this fork (no dead/misleading links to the original project's store listings, CI, or Crowdin project) plus the committed design spec and implementation plan for this phase, for future reference.

- [ ] **Step 1: Replace `README.md` with the following content**

```markdown
# Authenticator Enhanced <img align="right" width="100" height="100" src="images/icon.svg">

> Authenticator generates 2-Step Verification codes in your browser.

This is an actively maintained continuation of [Authenticator-Extension/Authenticator](https://github.com/Authenticator-Extension/Authenticator), which has been unmaintained since October 2024 (280+ open issues, dozens of unreviewed pull requests). This fork picks up outstanding bug fixes and ongoing maintenance. All credit for the original design and implementation goes to the upstream project and its contributors.

Not yet published to any extension store — build from source below.

## Build Setup

``` bash
# install development dependencies
npm install
# compile
npm run [chrome, firefox, prod]
```

To reproduce a build:

``` bash
npm ci
npm run prod
```

## Development (Chrome)

``` bash
# install development dependencies
npm install
# compiles the Chrome extension to the `./test/chrome` directory
npm run dev:chrome
# load the unpacked extension from the `./test/chrome/ directory in Chrome
```

Note that Windows users should download a tool like [Git Bash](https://git-scm.com/download/win) or [Cygwin](http://cygwin.com/) to build.

## Acknowledgment

We would like to extend our heartfelt thanks to Laurent, the Chief Information Security Officer (CISO) of the University of Luxembourg, for the invaluable support and contribution to this project. During the development process, the CISO team provided critical security recommendations that helped us identify and address potential vulnerabilities, significantly enhancing the security and reliability of the project.

We especially want to acknowledge the University of Luxembourg's information security team for their selfless contribution, which not only facilitated the progress of this project but also had a positive impact on the broader open-source community. We recognize that the success of open-source software depends heavily on collaboration and support from various stakeholders, and the involvement of the University of Luxembourg has allowed us to offer a more secure and dependable product to a wider audience.

We understand that while open-source software is free, maintaining and improving these projects requires significant resources. The University of Luxembourg's information security team has demonstrated their strong commitment to the open-source community, contributing not just within their university but to users and developers globally. We hope this acknowledgment will help them continue to secure the support and resources necessary to further advance open-source initiatives.

Once again, we express our sincere gratitude to the University of Luxembourg's CISO team for their valuable advice and assistance.
```

- [ ] **Step 2: Create the specs directory and add the Phase 1 design doc**

Run: `mkdir -p /Users/zain/projects/authenticator-enhanced/docs/superpowers/specs`

Then create `/Users/zain/projects/authenticator-enhanced/docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md` with the exact content of the approved design spec (the file already drafted at `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/2026-07-12-authenticator-enhanced-phase1-design.md` as of this plan's writing, including the `#441` addition to the large/high-risk bucket). Copy it verbatim into the new path.

- [ ] **Step 3: Add the Phase 1 implementation plan (this document)**

Create `/Users/zain/projects/authenticator-enhanced/docs/superpowers/plans/2026-07-12-authenticator-enhanced-phase1-plan.md` with the exact content of this plan document, copied verbatim from `/private/tmp/claude-501/-Users-zain-projects/f4c18975-0dff-4849-b1f7-a7425a53ddc2/scratchpad/2026-07-12-authenticator-enhanced-phase1-plan.md`.

- [ ] **Step 4: Verify all three files exist**

Run: `ls /Users/zain/projects/authenticator-enhanced/README.md /Users/zain/projects/authenticator-enhanced/docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md /Users/zain/projects/authenticator-enhanced/docs/superpowers/plans/2026-07-12-authenticator-enhanced-phase1-plan.md`
Expected: all three paths printed, no "No such file" error

- [ ] **Step 5: Commit**

```bash
git -C /Users/zain/projects/authenticator-enhanced add README.md docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md docs/superpowers/plans/2026-07-12-authenticator-enhanced-phase1-plan.md
git -C /Users/zain/projects/authenticator-enhanced commit -m "docs: update README for authenticator-enhanced fork, add phase 1 design spec and plan"
```
Expected: commit succeeds

---

### Task 5: Create the GitHub repo and push

**Files:** none (remote/GitHub operations only)

**Interfaces:**
- Consumes: the three local commits from Tasks 3–4 on branch `main`.
- Produces: `https://github.com/zainulhasan/authenticator-enhanced`, public, with `main` pushed and tracked, `origin` remote set.

- [ ] **Step 1: Create the GitHub repo from the local source and add it as `origin`**

Run: `gh repo create zainulhasan/authenticator-enhanced --public --source=/Users/zain/projects/authenticator-enhanced --remote=origin --description "Actively maintained continuation of Authenticator-Extension/Authenticator (2FA browser extension)"`
Expected: exits 0, prints the new repo URL `https://github.com/zainulhasan/authenticator-enhanced`

- [ ] **Step 2: Verify `origin` now points at the new repo and `upstream` is untouched**

Run: `git -C /Users/zain/projects/authenticator-enhanced remote -v`
Expected: `origin` → `zainulhasan/authenticator-enhanced` (fetch/push), `upstream` → `Authenticator-Extension/Authenticator` (fetch/push)

- [ ] **Step 3: Push `main` with tracking**

Run: `git -C /Users/zain/projects/authenticator-enhanced push -u origin main`
Expected: exits 0, output includes `Branch 'main' set up to track remote branch 'main' from 'origin'.`

- [ ] **Step 4: Verify the repo on GitHub**

Run: `gh repo view zainulhasan/authenticator-enhanced --json url,visibility,defaultBranchRef --jq '.'`
Expected: JSON with `"url": "https://github.com/zainulhasan/authenticator-enhanced"`, `"visibility": "PUBLIC"`, `"defaultBranchRef": {"name": "main"}`

---

### Task 6: Write and commit the PR triage report

**Files:**
- Create: `docs/pr-triage/2026-07-12-initial-triage.md`

**Interfaces:**
- Consumes: the pushed repo from Task 5; reads PRs directly from `Authenticator-Extension/Authenticator` via `gh pr diff` / `gh pr view` (upstream, not this fork).
- Produces: one committed markdown report with a verdict for every currently-open upstream PR, which Phase 2's plan will consume as its input list of accepted fixes.

**Triage rubric** (apply this to every PR reviewed):
1. Does the diff actually fix the bug it claims to, when read against the current code (not just the PR description)?
2. Any regression risk to adjacent behavior?
3. Does it fit the codebase's existing style/conventions?
4. Is it missing tests where the surrounding code has test coverage for similar logic?
5. Security red flag check — this extension stores TOTP/HOTP secrets and handles OAuth tokens (Google Drive/OneDrive backup): extra scrutiny on anything touching `src/models/storage.ts`, crypto (`argon2-browser`, `crypto-js`), or the backup/OAuth flows.

Verdict is one of: **ACCEPT**, **ACCEPT WITH CHANGES** (state exactly what changes), **REJECT** (state why), or **DEFER** (too large/risky to batch into Phase 2, revisit later).

- [ ] **Step 1: Re-list all currently open upstream PRs to catch any drift since this plan was written**

Run: `gh pr list --repo Authenticator-Extension/Authenticator --state open --limit 50 --json number,title,author,additions,deletions,createdAt,isDraft`
Expected: a JSON array; compare the PR numbers against the list below and note any additions/closures in the report's intro.

- [ ] **Step 2: Start the report file with this header**

Create `/Users/zain/projects/authenticator-enhanced/docs/pr-triage/2026-07-12-initial-triage.md` (run `mkdir -p /Users/zain/projects/authenticator-enhanced/docs/pr-triage` first) starting with:

```markdown
# PR Triage Report — 2026-07-12

Verdicts on every PR open against `Authenticator-Extension/Authenticator` at
the time of writing, as input to Phase 2 (implementing accepted fixes).
Verdict values: ACCEPT, ACCEPT WITH CHANGES, REJECT, DEFER.

Rubric applied to every PR: correctness against current code, regression
risk, style fit, test coverage, and — since this extension handles TOTP/HOTP
secrets and OAuth tokens — extra security scrutiny on anything touching
`src/models/storage.ts`, crypto, or backup/OAuth flows.
```

- [ ] **Step 3: Review PR #1451 and append its entry — worked example, verdict already determined below**

Run: `gh pr diff 1451 --repo Authenticator-Extension/Authenticator` to see the diff yourself (already reviewed once while writing this plan — reproduced here so the report is self-contained).

Append to the report:

```markdown
### #1451 — fix(storage): parse enums properly
**Author:** Caceresenzo
**Verdict:** ACCEPT

4-line diff in `src/models/storage.ts`. The v8.0.0 rewrite of entry
deserialization parses the stored `algorithm` and `type` fields with
`parseInt()`, but they're stored as enum *names* (e.g. `"SHA256"`), not
numbers — `parseInt("SHA256")` is `NaN`, which silently falls back to the
default (`SHA1` / `totp`). This PR switches to reverse enum lookup
(`OTPAlgorithm[rawAlgorithm]`) instead, which is the correct way to parse a
TS string-enum value. Directly fixes the root cause behind duplicate issues
#1442, #1443, #1449, #1450, and is very likely the same root cause reported
again in #1508, #1499, #1492, #1475. No test coverage added; Phase 2 should
add a regression test for round-tripping a non-default algorithm/type
through storage. No security concern — this only affects which algorithm
constant is *selected*, not the crypto implementation itself.
```

- [ ] **Step 4: Review the remaining "likely legitimate" PRs and append one entry each**

For each PR below: run `gh pr diff <number> --repo Authenticator-Extension/Authenticator`, read it against the corresponding file(s) in `/Users/zain/projects/authenticator-enhanced`, apply the rubric, and append an entry in the same format as Step 3 (PR number + title, author, verdict, 2-5 sentence rationale, which issue(s) it resolves if stated in the PR body).

| PR | Title | Note to weigh in the review |
|----|-------|------|
| #1547 | Fix: normalize Base32 secret from QR import before TOTP generation | Touches TOTP secret handling — apply extra security scrutiny per the rubric. |
| #1544 | fix: ensure QR scan overlay receives pointer events on modal pages | 1-line diff. |
| #1519 | feat: allow editing HOTP counter in entry edit UI (#1517) | Same author as #1518; check both for shared context. |
| #1518 | feat: add autofill mode to append OTP to focused field (#1516) | Same author as #1519. |
| #1497 | fix The search box is not displayed #1496 | Small diff (7 additions). |
| #1494 | Fix OneDrive oauth | Touches the OAuth flow — apply extra security scrutiny per the rubric. |
| #1423 | fix code auto-pasting by using better heuristics to find the input box | Larger diff (19/59) — check it doesn't regress the existing heuristic's working cases. |
| #1410 | Update popup.html | Check what this actually changes — title alone doesn't say. |
| #1357 | Bump nanoid and mocha | Dependabot PR from 2024-12-15 — check whether it's still mergeable/current, or superseded by doing a fresh dependency bump in Phase 4 instead. |
| #1328 | Bump vue, vuex and @vue/test-utils | Same dependabot-staleness question as #1357. |
| #1320 | [FIX] OTP type is ignored | Compare against #1283 below — two different PRs claim to fix OTP type; check if they overlap/conflict and only one should be accepted. |
| #1310 | [FIX] Seconds not properly prevented from being negative | Small diff (8/3). |
| #1283 | Fix OTP type | Compare against #1320 above. |
| #1244 | Disallow unencrypted cloud backups | Largest of this batch (589/661) and security-relevant (backup encryption) — apply extra scrutiny per the rubric; consider ACCEPT WITH CHANGES if it needs rebasing against current storage code. |
| #1118 | add favicon support | Base PR for #1554 below — review together. |
| #1554 | Fix favicon PR #1118: guarded computed + browser.ts constants | Depends on #1118 — if #1118 is REJECT/DEFER, this one can't stand alone; note that dependency explicitly in its verdict. |
| #1543 | add image in readme | Doc-only change — irrelevant now since Task 4 already rewrote the README from scratch; verdict should be REJECT (superseded), not evaluated as a code fix. |

- [ ] **Step 5: Append entries for the known spam/vandalism PRs — REJECT, documented not silently skipped**

Append one short entry per PR, e.g.:

```markdown
### #1512 — Rename README.md to 3542 JRIA MJQV J3KY
**Author:** axeltorres2006
**Verdict:** REJECT — vandalism/spam, not a real change (renames README.md to a nonsense string; 0 additions/0 deletions of actual content).
```

Repeat the same pattern for `#1509` (title `AZQYXWZ3IXRGOF6P`, author luanbinh225-droid), `#1502` (`Create lola 2`), `#1501` (`Create lola`), `#1500` (`Create discord`), `#1439` (`Create faceface`) — all zero/near-zero-content diffs from accounts with no other legitimate contribution history.

- [ ] **Step 6: Append entries for the large/high-risk PRs — DEFER**

```markdown
### #1417 — fix: improve hostname parsing logic in getSiteName function
**Verdict:** DEFER
~16,484 additions / 8,648 deletions — far too large to review and land safely
as part of a small batch of targeted fixes. Revisit in a later phase with
dedicated review time.

### #1352 — Refactor search functionality to support AND-based keyword matching
**Verdict:** DEFER
234 additions / 261 deletions — a behavioral refactor of search, not a
narrow bug fix. Worth evaluating on its own once Phase 2's smaller fixes are
settled, so a regression in search isn't bundled in with unrelated fixes.

### #441 — New Crowdin translations
**Verdict:** DEFER (likely REJECT on closer look)
~26,444 additions / 220 deletions, opened 2020-03-06 by the Crowdin
translation bot — six years stale at the time of this review, almost
certainly conflicts with the current codebase. Recommend closing and letting
Crowdin (or an equivalent) regenerate a fresh translations PR against `main`
in a later phase, rather than attempting to land this one.
```

- [ ] **Step 7: Add a one-paragraph summary at the top of the report, right after the header**

Count how many entries landed in each verdict bucket and insert a short summary sentence, e.g. "X ACCEPT, Y ACCEPT WITH CHANGES, Z REJECT, W DEFER, out of N total open PRs reviewed."

- [ ] **Step 8: Verify the report file is well-formed and complete**

Run: `grep -c '^### #' /Users/zain/projects/authenticator-enhanced/docs/pr-triage/2026-07-12-initial-triage.md`
Expected: `27` (one entry per currently-open PR — adjust if Step 1 found the count had drifted)

- [ ] **Step 9: Commit and push**

```bash
git -C /Users/zain/projects/authenticator-enhanced add docs/pr-triage/2026-07-12-initial-triage.md
git -C /Users/zain/projects/authenticator-enhanced commit -m "docs: initial PR triage report"
git -C /Users/zain/projects/authenticator-enhanced push origin main
```
Expected: commit and push both succeed

---

## Definition of Done for Phase 1

- `zainulhasan/authenticator-enhanced` exists on GitHub, public, with `main` as default branch.
- `upstream` remote still points at `Authenticator-Extension/Authenticator` for future syncing.
- Build (`npm run chrome`) and tests (`npm test`) pass on the rebranded code.
- README accurately describes the fork with no dead/misleading links to the original project's infra.
- `docs/pr-triage/2026-07-12-initial-triage.md` contains a verdict for all 27 currently-open upstream PRs.
- No fix code has been written — that's Phase 2, planned separately after the user reviews this report.
