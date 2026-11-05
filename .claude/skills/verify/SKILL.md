---
name: verify
description: Check whether the Routa MCP server work is done. Use after each build step, and before saying the work is done.
---

Run the checks below. Report each failing check with its error, or say that every check passed. Don't fix anything here, and don't reset anything: setting up the environment isn't this skill's job. Run live checks only against steps that exist; say which checks you skipped because their step isn't built yet.

## The checks

Each one must be able to fail.

1. **The tests pass.** `node --test "mcp/test/*.test.ts"`. Every test file runs at least one test, and none is skipped.
2. **A live run, over MCP, as the user would.** Start the server over stdio with `MCP_TOKEN` set from `ROUTA_TOKEN` and drive it with JSON-RPC (`initialize`, `tools/list`, `tools/call`) against the running test environment (`npm run test-environment`, http://localhost:4010). Read the settings; preview a change and apply it with the preview's id; then check the end state with `GET /admin/v1/settings`. Use a change that is easy to undo and undo it by asking again, not by resetting.
3. **The client's limits hold.**
   - A read-only token (`ROUTA_READONLY_TOKEN`) can read, and every changing tool refuses it with a clear message; read the settings afterwards and check nothing changed. Try preview and apply both.
   - The token is checked on every call: start with an admin token, then a read-only one, and an invalid one, and check each answer.
   - Applying takes the preview's id and applies exactly what was shown: change the settings between preview and apply, or apply an unknown id, and check that nothing unshown is applied.
   - Previews are in plain words (group gains or loses application; policy goes from X to Y), without API field names.
   - No tool resets the whole grid; one tool changes one thing asked for.
   - The server calls only `/admin/v1/*`: no `/hr`, no `/scim`, no session revocation.
   - Only the standard library: no `node_modules`, no `dependencies` in any package.json.
4. **No secrets.** Scan every file in the folder, logs included, for token values (compare against the values of `ROUTA_TOKEN` and `ROUTA_READONLY_TOKEN` without printing them) and for `Authorization` headers that carry a real value. Don't read `~/.routa`.
