# The platform (checked against the running test environment, 2026-11-05)

Start: `npm run test-environment` (port 4010). Tokens live in `~/.routa/` and in `ROUTA_TOKEN` / `ROUTA_READONLY_TOKEN`; never read the files, never print or commit a value. `npm run baseline:check` compares settings to the baseline. `npm run test-environment:reset` restores the seed, so use it only when the user asks; it is not a verify step.

## Admin API (all with `Authorization: Bearer <token>`)
- `GET /admin/v1/whoami` -> `{"scope":"admin"|"read"}`. Checked with both tokens. Anything not the admin token reports `read`. A missing/invalid token gives 401 `{"status":"401","detail":...}`.
- `GET /admin/v1/settings` -> `{access:[{group,apps[]}], policies:[{id,label,value}]}`. Checked: 14 groups, 20 policies (14 `mfa.<group>` booleans plus `session-length-hours` number, `legacy-sign-in` boolean, `guest-access` string, `password-min-length`, `token-lifetime-days`, `audit-log-days` numbers). The read-only token can read it.
- `PATCH /admin/v1/settings` body `{changes:[{type:"access",group,app,allowed}|{type:"policy",id,value}]}`. Applies at once, all or nothing. Answers `{applied, settings}`. Errors are 400 `{"status":"400","detail"}`; `status` is a string.
- **Checked: a read-only token's PATCH is applied (200).** The server must refuse before it reaches the API. (My test used a no-op value, so nothing changed.)

## Behaviours worth knowing
- `group` is the group's display name (e.g. `ext-contractors`), same as the baseline keys.
- `apps` lists only granted apps, sorted; a group with none has `[]`. The 11 application ids come from `test-environment/seed/apps.json` (bi, crm, documents, finance, hiidenkivi-portal, hr, it-admin, lumivaara-portal, merivirta-portal, tammiranta-portal, timesheets; checked, 11) and are not listed by any admin endpoint: to know the valid ids the server must carry them or learn them from the grid.
- Policy values are type-checked only against the current value's type (a string for a number gives 400 "takes a number"). `guest-access` accepts any string at the platform; "invite-only" and "open" are the values seen. Validation of values beyond type is ours to do.
- Granting an app a group already has, or removing one it lacks, succeeds silently; so the preview should say "no change".
- Unknown group, app or policy: 400 with a plain detail.
- The platform's HR and SCIM endpoints reject the read-only token (401); out of scope anyway.
- `/admin/settings` (the HTML page) needs no token and plays the console IT uses today; page clicks write through the same state, so the page is a way to see the end state.
- State persists across restarts in `test-environment/.data/` (gitignored).
