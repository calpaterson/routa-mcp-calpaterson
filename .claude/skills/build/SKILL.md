---
name: build
description: Build the next step of the Routa MCP server. Use after the plan skill has said what to build.
---

Build the step the plan skill chose, with a test for it, following `brain/conventions.md`: TypeScript run directly by Node (strippable syntax only, `.ts` imports), standard library only, code in `mcp/src/` (one file per tool in `mcp/src/tools/`), tests in `mcp/test/<module>.test.ts`, two-space indent, double quotes, semicolons.

- The server reads `ROUTA_URL` and `MCP_TOKEN`. Never write a token into code, a test, a log or a commit. Tests that need the platform start their own copy with `PORT` and `DATA_DIR` set, so they never change the developer's data.
- Every tool checks the token with `whoami` before it does anything; a tool that changes settings refuses a read-only token before any PATCH is sent.
- Run `node --test "mcp/test/*.test.ts"`. Mark the step done in `plan.md` when its test passes, and commit with a one-line message saying what and why.
