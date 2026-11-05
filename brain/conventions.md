# Conventions (from client/conventions.md)

- TypeScript on Node >= 22.18, run directly (no build). Only strippable syntax: no `enum`, `namespace`, parameter properties. ES modules; import local files with `.ts`.
- Standard library only, in the server and the tests. MCP stdio is newline-delimited JSON-RPC. Tests use `node:test` and `node:assert/strict`.
- Layout: `mcp/src/` (one file per tool in `mcp/src/tools/`), `mcp/test/<module>.test.ts`. Run: `node --test "mcp/test/*.test.ts"`.
- Env: `ROUTA_URL` (default `http://localhost:4010`), `MCP_TOKEN` (the user's token). Developer laptop: admin in `ROUTA_TOKEN`, read-only in `ROUTA_READONLY_TOKEN`. No token in code, tests, logs or commits.
- Style: two-space indent, double quotes, semicolons, small plainly named functions, functions over classes.
