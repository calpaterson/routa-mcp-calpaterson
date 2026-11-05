# Project brain: Routa settings MCP server

Read this first. Each file says what it is built from. "Checked" means I ran it against the test environment on 2026-11-05; "client says" means it is from `client/` and not checked.

- [engagement.md](engagement.md): who, what, scope and limits (from `client/brief.md`, `context.md`, `decisions.md`)
- [platform.md](platform.md): what the admin API actually does, checked
- [conventions.md](conventions.md): language, layout, config, style (from `client/conventions.md`)
- [server.md](server.md): the built server, its tools, how to start it, known limits
- [baseline.md](baseline.md): the security baseline and how far the platform is from it, checked

Sources of truth: `client/` is the client's word; `test-environment/` is the platform's behaviour. Where they differ, the difference is written in platform.md. Update the brain when you learn something new.
