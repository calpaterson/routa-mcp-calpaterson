# The server (built; phase 1)

Start: `MCP_TOKEN=<token> [ROUTA_URL=http://localhost:4010] node mcp/src/main.ts`. It speaks newline-delimited JSON-RPC on stdio, and writes nothing else to stdout. A missing `MCP_TOKEN` exits with code 2. For the later Claude Code connection, run that command as a stdio MCP server with `MCP_TOKEN` taken from the environment; never write the token into a config file that is committed.

Tools (one file each in `mcp/src/tools/`):
- `show_access` (read): all groups, one group, or who reaches an application.
- `show_policies` (read): all policies or those matching a word.
- `show_baseline_differences` (read): lists every setting that differs from `client/security-baseline.json`, one plain sentence each (group reaches an app it must not / misses one it should; policy is X but the baseline says Y; group or policy missing on either side), or says everything matches. Only GETs, so it works with a read-only token. Comparison is in `mcp/src/baseline.ts`. Against the seed it should list the 9 differences in [baseline.md](baseline.md) (live test written 2026-11-05, not yet run: no tokens were in the shell).
- `preview_access_change` / `preview_policy_change` (admin): validate, then store a preview in memory and answer in plain words with its id. Changes nothing. A request that changes nothing gets no id.
- `apply_change` (admin): takes only a preview id. Refuses an unknown, used or old (over 1 hour) id, or a setting that changed since the preview. Sends one PATCH holding exactly the previewed change, then forgets the preview.

Token check: `callTool` in `mcp/src/server.ts` calls `whoami` before every tool call. Invalid token: refused. Read-only token on an admin tool: refused with "can only read the settings... Nothing was changed", before the tool runs, so no PATCH can be sent. The platform client (`mcp/src/platform.ts`) refuses any path outside `/admin/v1/`.

Known limits: previews live in memory, so a restart forgets them. Application ids are carried in `mcp/src/apps.ts` (the API doesn't list them); update it if the platform gains one. Policy values are checked for type, positive numbers and non-empty text only; the platform accepts any string for `guest-access`.

Tests: `node --test "mcp/test/*.test.ts"`. `live.test.ts` starts its own platform copy on a free port with a temporary data directory and needs `ROUTA_TOKEN` and `ROUTA_READONLY_TOKEN` in the environment.

Worktrees: `.claude/hooks/worktree-create.ts` (the WorktreeCreate hook, copied from `toolbox/hooks/`) creates the worktree, then runs `scripts/setup-worktree.ts` in it. That script removes the worktree's `test-environment/.data` and collect log (so it starts from the seed), picks a free port (keeping the last one while it is still free) and writes `PORT` and `ROUTA_URL` to `.env.worktree` (gitignored). Not yet run (written 2026-11-05, unchecked).
