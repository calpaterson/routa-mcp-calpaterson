# Engagement

Client: Routa Advisory Oy. IT lead Tuomas Hirvikoski; two administrators use it too. Everyone else at Routa reads only, with a read-only token, to answer "who can reach what?".

Goal: configure the identity platform by asking Claude ("contractors shouldn't reach finance") instead of the 14 x 11 grid (154 boxes) and ~20 policies on the settings page. We build an MCP server (stdio) for the platform's admin API, used from Claude Code.

Phases: (1) build the server, (2) connect it to Claude Code, (3) bring settings in line with the baseline by asking. Only phase 1 is requested now. "Keep it to what's above."

## Requirements
- Read the access grid and the policies.
- Change settings; every change is shown in plain words first (which group gains or loses which application; which policy goes from what to what). Applying takes the preview's id and applies exactly what was shown.
- Check the token on every call (`whoami`). Read-only token: clear refusal, nothing changes. A read-only token that can change settings is the one unaffordable mistake.
- Users shouldn't need API field names.
- Try it from Claude Code over MCP with both token kinds.

## Decisions (client/decisions.md)
- 2026-10-20: every change goes through a preview; apply takes the preview id.
- 2026-10-20: tools change one thing asked for. No tool resets the whole grid.
- 2026-10-22: talk only to the admin API. No HR, no SCIM (the connector owns those).
- 2026-10-22: no session revocation (platform has none).

`client/messages/` exists and is empty.
