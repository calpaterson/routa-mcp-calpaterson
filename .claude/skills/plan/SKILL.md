---
name: plan
description: Plan the Routa MCP server work. In the loop, decide what to build next. For a new feature, plan it with the user first.
---

## In the loop

Read `plan.md` and `brain/README.md` (and the files it points to). Pick the first step that isn't done. If all are done and the verify skill reported a problem, pick the step that fixes it. Say in a few lines what to build next and which files under `mcp/` it touches. Don't write code.

## A new feature

Check the running test environment (`npm run test-environment`, http://localhost:4010) for what the feature touches, using the tokens from `ROUTA_TOKEN` / `ROUTA_READONLY_TOKEN` in the environment only, and write what it actually does into `brain/platform.md`. Where it differs from `client/settings-api.md`, say so. Draft the steps from the client's files, and keep to the brief and `client/decisions.md`: previews before changes, one thing per tool, admin API only, no HR/SCIM, no session revocation. Suggest the three ideas that would make it much better, then walk the draft for the three open decisions that matter most. Ask each question with the AskUserQuestion tool, a line of background first, your recommendation first. Then write the steps into `plan.md`: at most five. Don't write code.
