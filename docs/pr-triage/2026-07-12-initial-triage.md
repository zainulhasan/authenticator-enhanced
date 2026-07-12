# PR Triage Report — 2026-07-12

Verdicts on every PR open against `Authenticator-Extension/Authenticator` at
the time of writing, as input to Phase 2 (implementing accepted fixes).
Verdict values: ACCEPT, ACCEPT WITH CHANGES, REJECT, DEFER.

Rubric applied to every PR: correctness against current code, regression
risk, style fit, test coverage, and — since this extension handles TOTP/HOTP
secrets and OAuth tokens — extra security scrutiny on anything touching
`src/models/storage.ts`, crypto, or backup/OAuth flows.

Re-listed open upstream PRs immediately before writing this report
(`gh pr list --repo Authenticator-Extension/Authenticator --state open
--limit 50 ...`): 27 PRs open, matching the plan's list exactly. No drift —
no PRs opened or closed since the plan was written.

**Summary: 8 ACCEPT, 2 ACCEPT WITH CHANGES, 13 REJECT, 4 DEFER, out of 27
total open PRs reviewed.**

## Phase 2 action list

Directly actionable set for Phase 2, pulled from the verdicts below:

- **Implement as-is:** #1451, #1544, #1519, #1518, #1497, #1494, #1310, #1554
- **Implement with changes** (see each entry for what to change): #1547, #1423

Everything else is REJECT (including documented spam) or DEFER — see entries
below for the reasoning behind each.

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

### #1547 — Fix: normalize Base32 secret from QR import before TOTP generation
**Author:** MallardsAreCool
**Verdict:** ACCEPT WITH CHANGES

Adds `=`-padding to make imported secrets a multiple of 8 characters
(required for valid Base32) in `src/background.ts` and `src/import.ts`,
fixing QR imports of unpadded Base32 secrets (#1546). The bug is real and
the padding logic itself is correct for Base32 — **but** it's inserted
*after* the code already classifies the secret as hex/hhex vs. totp/hotp
(the block above checks `/^[0-9a-f]+$/i.test(secret)` and sets
`type = "hex"` / `"hhex"` for secrets that are valid hex but not valid
Base32). The new padding is applied unconditionally to `secret` regardless
of that classification, so a hex-type secret whose length isn't a multiple
of 8 (e.g. a 20-character hex secret, `20 % 8 === 4`) gets `"="` characters
appended — which are not valid hex digits — corrupting the secret for hex
TOTP/HOTP entries and breaking code generation for them. **Change needed:**
gate the padding so it only applies when the secret is being treated as
Base32 (i.e. skip it when `type` resolves to `"hex"`/`"hhex"`, or run the
check before/independent of the hex-vs-base32 branch). Security-relevant
since it touches secret parsing directly, but the risk is corruption/breakage
of existing hex-type entries, not exposure. No test coverage added.

### #1544 — fix: ensure QR scan overlay receives pointer events on modal pages
**Author:** ug23
**Verdict:** ACCEPT

1-line diff adding `pointer-events: auto !important;` to `.grayLayout` in
`sass/content.scss`, the full-page overlay shown while capturing a QR code
from the screen. On pages that set `pointer-events: none` on ancestor
elements (common on modal/dialog-heavy sites), the overlay would inherit
that and become unclickable, breaking the "click to select QR area" flow.
Purely cosmetic/CSS, no logic change, no regression risk to anything else on
the page since it only affects the extension's own injected overlay
element. No tests exist for this UI interaction elsewhere in the codebase,
so the lack of new tests here is consistent with existing coverage.

### #1519 — feat: allow editing HOTP counter in entry edit UI (#1517)
**Author:** ddjain
**Verdict:** ACCEPT

Adds an editable `counter` input to `EntryComponent.vue`, shown only for
HOTP/HHEX entries (`v-if="entry.type === OTPType.hotp || entry.type ===
OTPType.hhex"`), following the exact same pattern already used for the
issuer/account edit fields (`.issuerEdit` class, CSS-gated visibility tied
to the existing edit-mode toggle in `sass/popup.scss`). On change it calls
`entry.generate()` then `entry.update()`, both existing methods on
`OTPEntry` — `generate()` reads `this.counter` directly and `update()`
persists via `EntryStorage.update(this)`, so the wiring is correct and
matches the codebase's existing update pattern. Resolves the discussion in
#1517 (letting users manually correct a HOTP counter after migrating from
another app, a real and common pain point). No new tests, consistent with
the surrounding Vue components having no dedicated test coverage. No
security concern — counter is not secret material.

### #1518 — feat: add autofill mode to append OTP to focused field (#1516)
**Author:** ddjain
**Verdict:** ACCEPT

Adds a "Replace" vs. "Append" autofill mode setting, threaded consistently
through `PreferencesPage.vue` → Vuex `Menu` store → `settings.ts` →
`module-interface.d.ts` → the `pastecode` message → `content.ts`'s
`pasteCode()`. Default behavior (`"replace"`) is unchanged — the new
`"append"` branch is additive and short-circuits before touching the
existing `pasteCode` logic at all, so there's no regression risk to the
existing autofill heuristic. Addresses a real use case (FreeIPA/Duo-style
single combined password+OTP fields, per #1516). Style matches existing
settings additions in the same files (same getter/setter/mutation
structure as `useAutofill`, `smartFilter`, etc.). No new tests, consistent
with existing coverage of this area. No security concern — it only changes
*how* an already-generated OTP code is inserted into a page-controlled
input, not how secrets are stored or transmitted.

### #1497 — fix The search box is not displayed #1496
**Author:** opsxjacky
**Verdict:** ACCEPT

7-line diff in `src/store/Accounts.ts`. Currently, `showSearch` (the flag
that reveals the search UI) is only committed from the `clearFilter` action
— it's never set during the initial `updateEntries` load path, so on first
popup open with 10+ accounts the search box doesn't appear until the user
does something that happens to trigger `clearFilter`. This PR adds the same
`entries.length >= 10` check to `updateEntries`, guarded by
`!(state.getters.shouldFilter && state.state.filter)` so it doesn't
force the search bar on while a smart-filter site-match view is still
active. This mirrors the existing (unconditioned) check in `clearFilter`
and only adds a stricter guard, so it's a narrowing, low-risk change. No
test coverage added; the store has no existing tests for this behavior
either. No security concern.

### #1494 — Fix OneDrive oauth
**Author:** tigeryu8900
**Verdict:** ACCEPT

Confirmed against current `src/background.ts`: the OneDrive OAuth
code-exchange `fetch()` call (line ~374, the `Content-Type:
application/x-www-form-urlencoded` POST to
`https://login.microsoftonline.com/common/oauth2/v2.0/token`) currently has
**no request body at all** — no `client_id`, `client_secret`, `code`, or
`grant_type`. The sibling Google Drive branch a few lines above puts these
same parameters in the URL query string, but the OneDrive branch has
neither query params nor a body, meaning the token exchange is currently
guaranteed to fail server-side and OneDrive backup cannot work at all today.
This PR adds the missing `body` with the four required parameters. Extra
scrutiny applied since this is the OAuth token-exchange path: the fix sends
`client_secret` in the POST body over HTTPS to Microsoft's official token
endpoint, which is standard confidential-client OAuth practice and is
actually *more* conservative than the existing Google Drive branch's
approach of putting the secret in the URL query string (query strings are
more likely to be logged). No regression risk — the code path is currently
non-functional, so this can only make it work. No tests added, consistent
with the rest of the backup/OAuth code having no test coverage.

### #1423 — fix code auto-pasting by using better heuristics to find the input box
**Author:** mikelei8291
**Verdict:** ACCEPT WITH CHANGES

Rewrites `pasteCode()` in `src/content.ts`. The stated motivation is real —
the PR author found sites (Steam) where the existing "active element"
check matches a hidden input and returns early without trying anything
else — and the new `checkVisibility()` filter is a genuine improvement.
However, comparing against current `content.ts`, the rewrite **drops two
pieces of existing behavior with no replacement**: (1) the identity-keyword
pass (matching `name`/`id` against `"2fa"`, `"otp"`, `"authenticator"`,
`"code"`, etc.) that prioritizes an actual-looking OTP field over an
arbitrary first-empty-input on pages with multiple candidate fields — the
PR author's own description acknowledges this is "a completely different
heuristic" and "might break on certain websites"; (2) the exclusion of
`input[type=password]` from the final fallback match — the current code
explicitly excludes password fields from the last-resort loop, but the
rewritten selector (`input[type=password]` included, no fallback
exclusion) can now select a password field as the paste target if it's
empty and visible. **Changes needed:** keep the identity-keyword match as
the first-priority pass (fixes nothing to remove it) and add the new
visibility-based check as an additional filter/fallback rather than a full
replacement, and preserve the password-field exclusion in whichever branch
ends up being the least-specific fallback. No test coverage added or
existing for this function.

### #1410 — Update popup.html
**Author:** AEZRT
**Verdict:** REJECT

Adds a raw `<input id="search" oninput="filterAccounts()">` directly into
`view/popup.html`, outside the Vue app root. This doesn't work: (1) there
is no `filterAccounts()` function anywhere in the codebase — it would throw
`ReferenceError` on every keystroke; (2) `id="search"` collides with the
`id="search"` already used by `MainBody.vue`'s Vue-rendered search
container; (3) the extension's own CSP
(`manifests/manifest-chrome.json`, `script-src 'self'`, no
`'unsafe-inline'`) blocks inline event-handler attributes like `oninput=`,
so even if `filterAccounts` existed, the handler would never fire. The
title alone ("Update popup.html") gives no indication this is a broken,
non-functional, duplicate implementation of search that bypasses the
existing Vue/Vuex-driven search feature entirely (the same feature #1497
above fixes the visibility of). Not salvageable as-is; a real search-box
fix belongs in the existing Vue component, not raw HTML with inline JS.

### #1357 — Bump nanoid and mocha
**Author:** app/dependabot
**Verdict:** REJECT

Dependabot PR from 2024-12-15, dev-dependency-only (`mocha` 10.2.0→10.8.2,
`nanoid` as mocha's transitive dependency 3.3.7→3.3.8). Confirmed current
`package.json` is still pinned at `mocha: ^10.2.0`, so the PR isn't
literally superseded by a later merge — but it's over a year stale, touches
only `package.json`/`package-lock.json`, and Dependabot hasn't rebased it
since. Recommend closing and letting Phase 4's dependency-update pass pick
up current `mocha`/`nanoid` versions (and everything else that's drifted
since) in one coordinated bump with a full lockfile regeneration, rather
than landing a year-old partial bump now.

### #1328 — Bump vue, vuex and @vue/test-utils
**Author:** app/dependabot
**Verdict:** REJECT

This is not a routine dependency bump — it's Vue **2.7.16 → 3.5.12** and
Vuex **3.4.0 → 4.1.0**, a major-version framework migration, and the diff
touches *only* `package.json`/`package-lock.json` with zero corresponding
source changes. The codebase uses Vue 2 Options-API patterns throughout
(`Vue.extend({...})` in every `.vue` file, Vuex 3's `mapState`/`commit`
patterns, filters, etc.) that are not source-compatible with Vue 3/Vuex 4
without a real migration effort. Merging this as-is would break the build
immediately. A Vue 3 migration may be worth doing eventually, but it needs
to be planned and executed as an actual migration with source changes, not
accepted as an automated dependency bump. REJECT this PR; if a Vue 3
migration is wanted, scope it as dedicated future work, not part of Phase 2
or 4.

### #1320 — [FIX] OTP type is ignored
**Author:** olfek
**Verdict:** REJECT (superseded by #1451; also contains an active bug)

Explicitly marked by its own author as "Alternative proposal to #1283" — see
#1283's entry below for the head-to-head comparison. Independent of that:
this PR's `src/models/storage.ts` change to the `getAll()` switch-statement
has a real bug. It changes:
```
case OTPType[OTPType.totp]:
case OTPType[OTPType.hotp]:
case OTPType[OTPType.battle]:
case OTPType[OTPType.steam]:
case OTPType[OTPType.hex]:
case OTPType[OTPType.hhex]:
  type = OTPType.hhex;
```
i.e. **every** matched case — totp, hotp, battle, steam, hex — assigns
`type = OTPType.hhex` instead of the type that was actually matched. Any
entry loaded through this path would be silently recast as HHEX
(hex-encoded HOTP), breaking code generation for effectively every existing
entry. This alone is disqualifying regardless of the #1283 comparison.
REJECT.

### #1310 — [FIX] Seconds not properly prevented from being negative
**Author:** olfek
**Verdict:** ACCEPT

8/3-line diff in `src/store/Accounts.ts`'s `updateCodes` mutation. Current
code does `second += Number(UserSettings.items.offset) + 60; second =
second % 60;` — the `+ 60` is meant to keep the value non-negative before
the modulo, but for offsets more negative than -60 (allowed range isn't
clamped elsewhere) the result can still go negative, and the comment even
says "prevent second from negative" while not actually guaranteeing it for
all offset values. The PR replaces this with an explicit branch: compute
`second % 60` normally, and if the intermediate result is negative,
`second = 60 - ((second * -1) % 60)`, which correctly handles arbitrary
negative offsets. Also adds a `.prettierignore` for `*.disabled` files
(minor, unrelated but harmless repo-hygiene addition). Small, self-contained
arithmetic fix, matches the existing code style, no regression risk to
anything else, no security relevance (clock-offset display only). No test
coverage added or existing for this function.

### #1283 — Fix OTP type
**Author:** Sneezry
**Verdict:** REJECT (superseded by #1451)

Also fixes the "OTP type is ignored"/period-ignored bug (issue #1271), but
via a much larger architectural change: it converts `OTPType` from a
numeric enum (`totp = 1, hotp, ...`) to a **string enum**
(`totp = "totp", hotp = "hotp", ...`) and updates every comparison site
(`background.ts`, `import.ts`, `migration.ts`, `BackupPage.vue`,
`EntryComponent.vue`, `storage.ts`, `otp.d.ts`, `module-interface.d.ts`)
plus adds explicit legacy-numeric-value migration (`entry.type === 1` →
`OTPType.totp`, etc.) in both the constructor and `applyEncryption` paths.
It's well-reasoned and more thorough than #1320 — no bugs found in it on
inspection — but it directly overlaps with **#1451 (already ACCEPTed
above)**: both PRs touch the exact same line in `storage.ts`
(`type: (parseInt(data[hash].type) as OTPType) || OTPType[OTPType.totp]`)
to fix the same root cause, but with incompatible approaches — #1451 keeps
`OTPType` numeric and fixes the parsing via reverse enum lookup (a 4-line,
surgical, already-accepted fix), while #1283 would convert the enum's
underlying representation entirely. Landing both is impossible (direct
conflict), and re-deriving #1283's broader string-enum refactor on top of
#1451 is out of scope for a batched Phase 2 fix — it's a legitimate
larger refactor, not a small bug fix, at that point. REJECT as superseded;
the narrower #1451 fix already resolves the reported symptom.

### #1244 — Disallow unencrypted cloud backups
**Author:** mymindstorm
**Verdict:** DEFER

Largest of this batch (589 additions / 661 deletions) — much of that is a
`_locales/en/messages.json` reformat (2-space→4-space reindent) that
inflates the diff size without changing content, but the substantive change
is real: it removes the per-service "backup unencrypted anyway" toggle from
`DrivePage.vue`/`DropboxPage.vue`/`OneDrivePage.vue` and instead gates the
upload/sign-in buttons on a new `allEntriesEncrypted` getter, so cloud
backup is only usable once all entries are actually encrypted. This is a
genuine security hardening (removes a user-facing option to knowingly
upload plaintext secrets to Dropbox/Drive/OneDrive) and the mechanism
(computed `needEncryption` flag replacing the old `isEncrypted`
select-input, consistently applied across all three backup pages) is
structurally sound on inspection. However: the author states "I haven't
tested this too thoroughly," it's from July 2024 (two years stale as of
this review) touching cross-cutting backup/storage state
(`Backup.ts`, `Accounts.ts`, `backup.ts`, `settings.ts`), and the JSON
reformat will need conflict resolution against any locale-string changes
made since. Confirmed against current code that
`driveEncrypted`/`dropboxEncrypted`/`oneDriveEncrypted` settings still
exist in their pre-PR shape, so the diff still conceptually applies, but
this needs a dedicated rebase-and-verify pass with real testing of all
three backup providers before landing — too large/risky to batch into
Phase 2's smaller fixes. Recommend prioritizing this in a follow-up
security-focused phase given the severity of what it fixes (silent
plaintext cloud backups).

### #1118 — add favicon support
**Author:** Sneezry
**Verdict:** REJECT (superseded by #1554)

Adds an opt-in favicon display next to each entry's issuer name, correctly
scoped behind `optional_permissions` (`favicon`, `chrome://favicon/`) that
are only requested when the user enables the setting — no bundled or
pre-fetched icons, no CSP over-relaxation beyond what's needed. However,
`EntryComponent.vue`'s `shouldShowFavicon` computed has a real bug:
```
let computed: {} = {
  shouldShowFavicon:
    !isFirefox && !isSafari && mapState("menu", ["showFavicon"]).showFavicon,
};
```
`mapState("menu", ["showFavicon"]).showFavicon` returns the **computed
getter function itself** (Vuex's `mapState` returns an object of function
definitions meant to be spread into a component's `computed` block, not an
evaluated value when accessed inline like this), so this expression
evaluates once at module load to a function reference, which is always
truthy — the entire browser-guard is defeated and `shouldShowFavicon` is
never reactive to the actual `showFavicon` store value. Also, the
`PreferencesPage.vue` toggle uses a fresh `navigator.userAgent.indexOf
("Firefox") === -1` check that doesn't account for Safari, unlike the
existing `isSupported` computed already used elsewhere in the same file.
See #1554 below, which fixes both of these on top of the same feature.
REJECT #1118 standalone; its corrected/complete successor is #1554.

### #1554 — Fix favicon PR #1118: guarded computed + browser.ts constants
**Author:** indigokarasu
**Verdict:** ACCEPT

Confirmed self-contained: this PR's diff (against `main`) already includes
the entire favicon feature from #1118 (manifests, permissions, Vuex `Menu`
store, `settings.ts`, `EntryComponent.vue`, `PreferencesPage.vue`, SCSS,
`medal.svg`) plus the fixes — it does not require #1118 to be merged first,
despite the title's framing as a follow-up. It fixes the two issues
identified in #1118 above: `shouldShowFavicon` is now a real Vue computed
(`shouldShowFavicon(this: any) { return !isFirefox && !isSafari &&
this.$store.state.menu.showFavicon; }`) instead of an eagerly-evaluated
function reference, and the Firefox check in `PreferencesPage.vue` reuses
the existing `isSupported` computed (Firefox-and-Safari-aware) instead of a
new ad hoc `navigator.userAgent` check. It also uses the MV3-native
`chrome.runtime.getURL("/_favicon/")` API (requiring only the `favicon`
optional permission) rather than #1118's `chrome://favicon/` CSP-relaxation
approach, which is both more forward-compatible and requires a smaller
permission/CSP footprint (no `img-src` change needed since
`chrome-extension://<id>/_favicon/...` is same-origin, already covered by
`'self'`). No new tests, consistent with the rest of the Vue component
layer having no test coverage. No security concern beyond the
already-reviewed optional-permission favicon fetch itself.

### #1543 — add image in readme
**Author:** kenjiew
**Verdict:** REJECT — superseded, not evaluated as a code fix

Doc-only change to `README.md` plus new binary image assets, pointing the
store badge images at a different fork's (`kenjiew/Authenticator-otp`)
GitHub raw URLs. Irrelevant now since Task 4 already rewrote this fork's
README from scratch with its own branding and links; accepting this would
reintroduce dead/foreign links the rebrand specifically removed.

### #1512 — Rename README.md to 3542 JRIA MJQV J3KY
**Author:** axeltorres2006
**Verdict:** REJECT — vandalism/spam, not a real change (renames README.md to a nonsense string; 0 additions/0 deletions of actual content).

### #1509 — AZQYXWZ3IXRGOF6P
**Author:** luanbinh225-droid
**Verdict:** REJECT — vandalism/spam, not a real change (0 additions/0 deletions; nonsense filename/rename with no content, account has no other legitimate contribution history).

### #1502 — Create lola 2
**Author:** yasmen-boop
**Verdict:** REJECT — spam (1-line file addition with no relation to the codebase; account has no other legitimate contribution history).

### #1501 — Create lola
**Author:** yasmen-boop
**Verdict:** REJECT — spam (1-line file addition with no relation to the codebase; same author/pattern as #1502 and #1500).

### #1500 — Create discord
**Author:** yasmen-boop
**Verdict:** REJECT — spam (1-line file addition with no relation to the codebase; same author/pattern as #1501 and #1502).

### #1439 — Create faceface
**Author:** kurtcosta
**Verdict:** REJECT — spam (1-line file addition with no relation to the codebase; account has no other legitimate contribution history).

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
