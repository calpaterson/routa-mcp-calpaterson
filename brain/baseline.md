# Security baseline (client/security-baseline.json, agreed 2026-10-20, owner Tuomas)

Per-group allowed apps and 20 policies. Notable: `dept-consulting` has no apps; `ext-contractors` only `timesheets`; every group has MFA on; session 8h; legacy sign-in off; guest access invite-only; password min 14; token lifetime 90 days; audit log 365 days.

## Gap in the seeded test environment (checked with `npm run baseline:check`): 9 settings differ
- dept-analytics reaches hr (must not)
- ext-contractors reaches crm and finance (must not)
- managers reaches it-admin (must not)
- mfa.ext-contractors and mfa.partners are false (must be true)
- session-length-hours 24 (8), legacy-sign-in true (false), guest-access "open" ("invite-only")

Bringing these in line is phase 3, after the server and its Claude Code connection. Do not fix them as part of building.
