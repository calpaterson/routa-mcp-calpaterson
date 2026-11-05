# Plan: the settings MCP server

Scope: phase 1 only, building the server (`mcp/`). Connecting it to Claude Code and bringing the settings in line with the baseline come after. Mark a step done when its test passes.

- [ ] **1. Server skeleton and token check.** Newline-delimited JSON-RPC over stdio (`initialize`, `tools/list`, `tools/call`), configuration from `ROUTA_URL` and `MCP_TOKEN`, a small client for the admin API, and `whoami` called on every tool call. A missing or invalid token gets a clear refusal.
- [ ] **2. Read tools.** One tool for the access grid (by group, and who reaches an application) and one for the policies, answered in plain words. Works with both token kinds.
- [ ] **3. Preview tools.** One tool to change one group's access to one application, one to change one policy. Each validates the request, stores a preview with an id, and answers in plain words: which group gains or loses which application, or which policy goes from what to what, or "no change". Nothing is sent to the platform. A read-only token is refused here too.
- [ ] **4. Apply tool.** Takes only a preview's id and applies exactly what was shown, as one PATCH. Admin only: the scope is checked before anything is sent. An unknown, used or stale id (the setting has changed since the preview) is refused, and nothing else is applied.
- [ ] **5. Live run over MCP with both tokens.** Run the whole loop against the test environment with the admin and the read-only token, check the end state on the platform, and check that a read-only token cannot change anything. Note how to start the server for Claude Code's later connection in `brain/`.
