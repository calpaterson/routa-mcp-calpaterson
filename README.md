# Routa Advisory: configure the identity platform by asking

Routa's IT wants to configure its identity platform by asking Claude, not by clicking through its long settings page. In this engagement you build an MCP server for the platform's admin API.

Routa's brief and the material they sent are in `client/`. The team's harness is in `toolbox/`.

## Running Routa's platform on your laptop

You run a copy of Routa's identity platform on your laptop. It needs Node 22.18 or later. Start it with:

```
npm run test-environment
```

It listens on http://localhost:4010, and the settings page is at http://localhost:4010/admin/settings. `PORT` and `DATA_DIR` start another copy on another port, from its own data. It keeps two tokens outside this folder: `~/.routa/token` (admin) and `~/.routa/token-readonly`. Your shell has them in `ROUTA_TOKEN` and `ROUTA_READONLY_TOKEN`. Changes are kept when you restart it. To put everything back as it was, run `npm run test-environment:reset`.
