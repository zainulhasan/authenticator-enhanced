# Phase 1: Fork, rebrand, and PR triage for authenticator-enhanced

**Date:** 2026-07-12
**Status:** Approved by user, ready for planning

## Background

`Authenticator-Extension/Authenticator` (MIT, TypeScript/Vue, Manifest V3, 4.5k
stars, 1.1k forks) is a browser extension that generates TOTP/HOTP 2FA codes.
The last real code commit was 2024-10-10 — the project is effectively
unmaintained. It has 284 open issues (mostly spam/support noise) and 27 open
PRs, several of which are legitimate, reviewable bug fixes the absent
maintainer never merged, and a few of which are outright spam/vandalism
(e.g. PRs renaming the README to garbage strings).

Community members have already started their own continuations
(`VastBlast/authenticator-2fa`, `WSL0809/Authenticator`), confirming there's
real demand for a maintained fork.

The user (Zain, GitHub: `zainulhasan`) wants to:
1. Stand up an independent (non-GitHub-fork-linked) copy under their own
   account, rebranded, cleaned up.
2. Review the existing open PRs for legitimacy before writing any fix code —
   accept the good ones, reject the spam/risky ones.
3. Later (separate phases, not part of this spec): implement the accepted
   fixes, mine the remaining issues for additional un-PR'd bugs, and make
   general improvements (deps, security, CI, docs).

This spec covers **only** phase 1: repo setup/rebrand + a written PR triage
report. No fix code is written in this phase.

## Roadmap (for context — only Phase 1 is planned/executed now)

1. **Phase 1 (this spec):** clone → rebrand → push as new repo, then produce
   a written PR triage report.
2. **Phase 2:** implement the accepted fixes from the triage report, verified
   against tests/build. Planned only after the user reviews Phase 1's triage
   report.
3. **Phase 3:** mine the remaining 284 issues for real, un-PR'd bugs.
4. **Phase 4:** general improvements (dependency/security updates, CI, docs).

## Section A — Repo setup & rebrand

1. Clone `Authenticator-Extension/Authenticator` branch `dev` (the active
   branch) to `/Users/zain/projects/authenticator-enhanced`. Keep full
   original commit history — do not rewrite/squash it (attribution +
   blame stay intact).
2. Set **local, repo-scoped** git config (not `--global`):
   `user.name "Zain"`, `user.email "hassan9224@gmail.com"`.
3. Rename the primary branch to `main`.
4. Create `zainulhasan/authenticator-enhanced` on GitHub via `gh repo create`
   (public), add as `origin`, push `main`.
5. Rebrand strings:
   - `package.json`: `name`, `repository.url`, `bugs.url`, `homepage`.
   - `_locales/en/messages.json`: `extName`/`extShortName` →
     "Authenticator Enhanced". Other language locale files are left
     untouched (auto-retranslating a name change into ~30 languages is out
     of scope — call this out as a known follow-up, not silently dropped).
6. README cleanup:
   - Add a short note at the top: this is a maintained continuation of
     `Authenticator-Extension/Authenticator` (unmaintained since Oct 2024),
     with a link back to the original for attribution.
   - Strip badges/links only meaningful for the original repo: its CI
     status, Crowdin translation project, Chrome/Firefox store listings,
     funding/sponsor links.
   - Update self-referential URLs (issue tracker, homepage) to point at the
     new repo.
   - Keep the MIT `LICENSE` file byte-for-byte as-is — the original
     copyright notice must be preserved under the MIT license. Original
     README content (features, usage docs, screenshots) is kept unless it
     specifically references the old repo/infra.
7. First commit: rebrand + setup, plain message, no AI attribution (per
   user's standing global rule — this applies to every commit in this repo
   going forward, not just the first).
8. Commit this design doc itself into the new repo at
   `docs/superpowers/specs/2026-07-12-authenticator-enhanced-phase1-design.md`
   as part of the initial setup commit (the repo didn't exist yet when this
   doc was drafted, so it's authored in the scratchpad and moved in at
   clone time).

## Section B — PR triage report

Candidate PRs identified so far (subject to a final full pass over all 27
open PRs to catch anything missed):

**Likely legitimate — full review + verdict:**
`#1451`, `#1547`, `#1544`, `#1519`, `#1518`, `#1497`, `#1494`, `#1423`,
`#1410`, `#1357`, `#1328`, `#1320`, `#1310`, `#1283`, `#1244`, `#1118`,
`#1554`, `#1543` (doc-only, quick check).

**Already-identified spam/vandalism — REJECT, documented not silently
skipped:**
`#1512`, `#1509`, `#1502`, `#1501`, `#1500`, `#1439`.

**Large/high-risk — flag for deferral rather than accept-in-batch:**
`#1417` (~16k+ line diff, hostname parsing), `#1352` (search refactor,
234/261 diff), `#441` (Crowdin translations bot, ~26k+ line diff from 2020 —
almost certainly stale/conflicted at this point).

For each PR in the "likely legitimate" and "large/high-risk" buckets:
- Pull the actual diff (`gh pr diff`) and read it against the current code
  in the cloned repo — not just the PR title/description.
- Evaluate: does it correctly fix the claimed bug? Any regression risk?
  Code-quality/style fit with the rest of the codebase? Missing tests where
  tests would normally be expected? Any security red flag — this extension
  handles TOTP/HOTP secrets and OAuth tokens (Google Drive/OneDrive backup),
  so anything touching storage, crypto (`argon2-browser`, `crypto-js`), or
  the OAuth flows gets extra scrutiny.
- Record a verdict: **ACCEPT** / **ACCEPT WITH CHANGES** (what changes) /
  **REJECT** (why), plus which issue number(s) it resolves.

Deliverable: `docs/pr-triage/2026-07-12-initial-triage.md`, committed to the
new repo. The user reviews this report; nothing from it is implemented until
that review happens (Phase 2, separate spec).

## Out of scope for this phase

- Writing or merging any actual bug-fix code.
- Migrating locale translations beyond `en`.
- Publishing to the Chrome Web Store / Firefox Add-ons / Edge Add-ons.
- Mining the 284 open issues for additional bugs not already covered by an
  open PR.
- Any dependency bumps, CI setup, or other general improvements.

## Testing/verification for this phase

- `npm install`, `npm test` (runs `scripts/test-runner.js` via the
  `pretest` build step), and `npm run chrome` (builds via
  `scripts/build.sh chrome`) all succeed on the freshly cloned+rebranded
  repo before pushing, to confirm rebranding didn't break the build.
- Triage verdicts are a written report only — no runtime verification
  needed in this phase since no fix code changes.
