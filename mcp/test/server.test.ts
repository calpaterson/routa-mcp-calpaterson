import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import type { Server } from "node:http";
import { spawn } from "node:child_process";
import { createPlatform } from "../src/platform.ts";
import { handleMessage } from "../src/server.ts";
import type { Tool } from "../src/tool.ts";

// A stub platform with made-up tokens: it counts what reaches it.
async function stubPlatform() {
  const seen: string[] = [];
  const server: Server = createServer((req, res) => {
    seen.push(`${req.method} ${req.url}`);
    const auth = req.headers.authorization;
    res.setHeader("Content-Type", "application/json");
    if (auth !== "Bearer test-admin" && auth !== "Bearer test-read") {
      res.writeHead(401).end(JSON.stringify({ status: "401", detail: "Missing or invalid token." }));
    } else if (req.url === "/admin/v1/whoami") {
      res.writeHead(200).end(JSON.stringify({ scope: auth === "Bearer test-admin" ? "admin" : "read" }));
    } else {
      res.writeHead(200).end("{}");
    }
  });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://localhost:${(server.address() as { port: number }).port}`;
  return { url, seen, close: () => server.close() };
}

function toolSet() {
  const ran: string[] = [];
  const tools: Tool[] = [
    { name: "look", description: "reads", inputSchema: { type: "object" }, access: "read", run: async () => (ran.push("look"), "seen") },
    { name: "change", description: "changes", inputSchema: { type: "object" }, access: "admin", run: async () => (ran.push("change"), "changed") },
  ];
  return { tools, ran };
}

const call = (name: string, id = 1) => ({ jsonrpc: "2.0", id, method: "tools/call", params: { name, arguments: {} } });

test("initialize, tools/list and ping answer; notifications get no answer", async () => {
  const stub = await stubPlatform();
  const { tools } = toolSet();
  const opts = { platform: createPlatform(stub.url, "test-admin"), tools };
  const init: any = await handleMessage({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }, opts);
  assert.equal(init.result.protocolVersion, "2025-03-26");
  assert.deepEqual(init.result.capabilities, { tools: {} });
  const list: any = await handleMessage({ jsonrpc: "2.0", id: 2, method: "tools/list" }, opts);
  assert.deepEqual(list.result.tools.map((t: any) => t.name), ["look", "change"]);
  assert.equal(list.result.tools[0].run, undefined);
  assert.deepEqual(((await handleMessage({ jsonrpc: "2.0", id: 3, method: "ping" }, opts)) as any).result, {});
  assert.equal(await handleMessage({ jsonrpc: "2.0", method: "notifications/initialized" }, opts), null);
  const unknown: any = await handleMessage({ jsonrpc: "2.0", id: 4, method: "nope" }, opts);
  assert.equal(unknown.error.code, -32601);
  stub.close();
});

test("an admin token runs read and admin tools", async () => {
  const stub = await stubPlatform();
  const { tools, ran } = toolSet();
  const opts = { platform: createPlatform(stub.url, "test-admin"), tools };
  const a: any = await handleMessage(call("look"), opts);
  const b: any = await handleMessage(call("change"), opts);
  assert.equal(a.result.isError, false);
  assert.equal(b.result.content[0].text, "changed");
  assert.deepEqual(ran, ["look", "change"]);
  stub.close();
});

test("a read-only token runs read tools but is refused by changing tools, which never run", async () => {
  const stub = await stubPlatform();
  const { tools, ran } = toolSet();
  const opts = { platform: createPlatform(stub.url, "test-read"), tools };
  const a: any = await handleMessage(call("look"), opts);
  assert.equal(a.result.content[0].text, "seen");
  const b: any = await handleMessage(call("change"), opts);
  assert.equal(b.result.isError, true);
  assert.match(b.result.content[0].text, /only read.*Nothing was changed/);
  assert.deepEqual(ran, ["look"]);
  assert.ok(stub.seen.every((s) => s === "GET /admin/v1/whoami"));
  stub.close();
});

test("the token is checked on every call, not once", async () => {
  const stub = await stubPlatform();
  const { tools } = toolSet();
  const opts = { platform: createPlatform(stub.url, "test-admin"), tools };
  await handleMessage(call("look", 1), opts);
  await handleMessage(call("look", 2), opts);
  await handleMessage(call("change", 3), opts);
  assert.equal(stub.seen.filter((s) => s === "GET /admin/v1/whoami").length, 3);
  stub.close();
});

test("an invalid token is refused for every tool and nothing runs", async () => {
  const stub = await stubPlatform();
  const { tools, ran } = toolSet();
  const opts = { platform: createPlatform(stub.url, "wrong"), tools };
  for (const name of ["look", "change"]) {
    const r: any = await handleMessage(call(name), opts);
    assert.equal(r.result.isError, true);
    assert.match(r.result.content[0].text, /doesn't accept this token/);
  }
  assert.deepEqual(ran, []);
  stub.close();
});

test("an unreachable platform is a clear refusal, and the tool doesn't run", async () => {
  const { tools, ran } = toolSet();
  const opts = { platform: createPlatform("http://localhost:1", "test-admin"), tools };
  const r: any = await handleMessage(call("change"), opts);
  assert.equal(r.result.isError, true);
  assert.match(r.result.content[0].text, /Could not reach the platform/);
  assert.deepEqual(ran, []);
});

test("the platform client only calls /admin/v1", async () => {
  const stub = await stubPlatform();
  const platform = createPlatform(stub.url, "test-admin");
  await assert.rejects(platform.get("/hr/v1/employees"), /only \/admin\/v1/);
  await assert.rejects(platform.patch("/scim/v2/Users", {}), /only \/admin\/v1/);
  assert.deepEqual(stub.seen, []);
  stub.close();
});

test("over stdio: initialize and tools/list, one JSON message per line; no MCP_TOKEN is an error", async () => {
  const stub = await stubPlatform();
  const child = spawn("node", ["mcp/src/main.ts"], { env: { ...process.env, ROUTA_URL: stub.url, MCP_TOKEN: "test-admin" } });
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }) + "\n");
  child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id: 2, method: "tools/list" }) + "\n");
  let out = "";
  await new Promise<void>((resolve) => {
    child.stdout.on("data", (d) => {
      out += d;
      if (out.split("\n").filter(Boolean).length >= 2) resolve();
    });
  });
  child.kill();
  const lines = out.split("\n").filter(Boolean).map((l) => JSON.parse(l));
  assert.deepEqual(lines.map((l) => l.id), [1, 2]);
  assert.deepEqual(lines[1].result.tools.map((t: any) => t.name), ["show_access", "show_policies", "preview_access_change", "preview_policy_change"]);

  const env = { ...process.env };
  delete env.MCP_TOKEN;
  const noToken = spawn("node", ["mcp/src/main.ts"], { env });
  const code = await new Promise((r) => noToken.on("exit", r));
  assert.equal(code, 2);
  stub.close();
});
