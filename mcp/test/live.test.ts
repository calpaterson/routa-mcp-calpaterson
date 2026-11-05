// The whole loop over stdio, as Claude Code would use it, against its own copy of the platform on a free port with a temporary data directory.
// Uses the developer's tokens from ROUTA_TOKEN and ROUTA_READONLY_TOKEN; it never prints them.
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import type { ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createInterface } from "node:readline";

const adminToken = process.env.ROUTA_TOKEN;
const readToken = process.env.ROUTA_READONLY_TOKEN;
assert.ok(adminToken && readToken, "Set ROUTA_TOKEN and ROUTA_READONLY_TOKEN (the developer's tokens) to run the live test.");

let platform: ChildProcessWithoutNullStreams;
let url = "";
let dataDir = "";

const freePort = () =>
  new Promise<number>((resolve) => {
    const s = createServer().listen(0, () => {
      const { port } = s.address() as { port: number };
      s.close(() => resolve(port));
    });
  });

before(async () => {
  const port = await freePort();
  dataDir = mkdtempSync(join(tmpdir(), "routa-live-"));
  platform = spawn("node", ["test-environment/start.ts"], { env: { ...process.env, PORT: String(port), DATA_DIR: dataDir } });
  url = `http://localhost:${port}`;
  await new Promise<void>((resolve, reject) => {
    platform.stdout.on("data", (d) => String(d).includes("Settings page") && resolve());
    platform.on("exit", () => reject(new Error("The platform copy exited before it started.")));
  });
});

after(() => {
  platform?.kill();
  if (dataDir) rmSync(dataDir, { recursive: true, force: true });
});

// A running server, driven one request at a time.
function startServer(token: string) {
  const child = spawn("node", ["mcp/src/main.ts"], { env: { ...process.env, ROUTA_URL: url, MCP_TOKEN: token } });
  const lines = createInterface({ input: child.stdout })[Symbol.asyncIterator]();
  let id = 0;
  async function request(method: string, params: unknown = {}): Promise<any> {
    id++;
    child.stdin.write(JSON.stringify({ jsonrpc: "2.0", id, method, params }) + "\n");
    const { value } = await lines.next();
    const reply = JSON.parse(value);
    assert.equal(reply.id, id);
    return reply.result;
  }
  const tool = async (name: string, args: Record<string, unknown> = {}) => {
    const r = await request("tools/call", { name, arguments: args });
    return { text: r.content[0].text as string, isError: r.isError as boolean };
  };
  return { request, tool, stop: () => child.kill() };
}

async function platformSettings(token = adminToken!) {
  const res = await fetch(`${url}/admin/v1/settings`, { headers: { Authorization: `Bearer ${token}` } });
  return JSON.stringify(await res.json());
}
const appsOf = async (group: string) => (JSON.parse(await platformSettings()).access as any[]).find((a) => a.group === group).apps as string[];
const policy = async (id: string) => (JSON.parse(await platformSettings()).policies as any[]).find((p) => p.id === id).value;
const idOf = (text: string) => /Preview ([0-9a-f]{8}):/.exec(text)![1];

test("an admin token: read, preview, apply, check the platform, and undo by asking again", async () => {
  const s = startServer(adminToken!);
  try {
    const init = await s.request("initialize", { protocolVersion: "2025-06-18" });
    assert.equal(init.serverInfo.name, "routa-settings");
    const names = (await s.request("tools/list")).tools.map((t: any) => t.name);
    assert.deepEqual(names, ["show_access", "show_policies", "preview_access_change", "preview_policy_change", "apply_change"]);

    assert.equal(await appsOf("ext-contractors").then((a) => a.includes("finance")), true);
    const seen = await s.tool("show_access", { group: "ext-contractors" });
    assert.match(seen.text, /finance/);

    const before = await platformSettings();
    const preview = await s.tool("preview_access_change", { group: "ext-contractors", app: "finance", allowed: false });
    assert.match(preview.text, /ext-contractors will lose access to finance/);
    assert.equal(await platformSettings(), before, "a preview changes nothing");

    const applied = await s.tool("apply_change", { preview_id: idOf(preview.text) });
    assert.equal(applied.isError, false);
    const after = await appsOf("ext-contractors");
    assert.ok(!after.includes("finance") && after.includes("crm") && after.includes("timesheets"));

    const undo = await s.tool("preview_access_change", { group: "ext-contractors", app: "finance", allowed: true });
    await s.tool("apply_change", { preview_id: idOf(undo.text) });
    assert.equal(await platformSettings(), before, "asking again puts it back");

    const p = await s.tool("preview_policy_change", { id: "session-length-hours", value: 8 });
    assert.match(p.text, /Session length in hours will go from 24 to 8/);
    await s.tool("apply_change", { preview_id: idOf(p.text) });
    assert.equal(await policy("session-length-hours"), 8);
    const back = await s.tool("preview_policy_change", { id: "session-length-hours", value: 24 });
    await s.tool("apply_change", { preview_id: idOf(back.text) });
    assert.equal(await platformSettings(), before);

    const gone = await s.tool("apply_change", { preview_id: idOf(p.text) });
    assert.equal(gone.isError, true, "a used preview can't be applied again");
  } finally {
    s.stop();
  }
});

test("a read-only token can read, and every changing tool refuses it; nothing changes", async () => {
  const admin = startServer(adminToken!);
  const s = startServer(readToken!);
  try {
    const before = await platformSettings();
    const read = await s.tool("show_policies", { match: "session" });
    assert.equal(read.isError, false);
    assert.match(read.text, /Session length in hours/);
    assert.equal((await s.tool("show_access")).isError, false);

    // A real preview, made by an admin server, can't be applied through the read-only one.
    const real = await admin.tool("preview_policy_change", { id: "session-length-hours", value: 8 });
    const attempts: [string, Record<string, unknown>][] = [
      ["preview_access_change", { group: "ext-contractors", app: "finance", allowed: false }],
      ["preview_policy_change", { id: "session-length-hours", value: 8 }],
      ["apply_change", { preview_id: idOf(real.text) }],
      ["apply_change", { preview_id: "deadbeef" }],
    ];
    for (const [name, args] of attempts) {
      const r = await s.tool(name, args);
      assert.equal(r.isError, true);
      assert.match(r.text, /can only read the settings.*Nothing was changed/);
    }
    assert.equal(await platformSettings(), before);
  } finally {
    s.stop();
    admin.stop();
  }
});

test("an invalid token is refused on every tool, and the platform really would let a read-only token PATCH", async () => {
  const s = startServer("not-a-token");
  try {
    const names = (await s.request("tools/list")).tools.map((t: any) => t.name);
    for (const name of names) {
      const r = await s.tool(name, {});
      assert.equal(r.isError, true);
      assert.match(r.text, /doesn't accept this token/);
    }
  } finally {
    s.stop();
  }
  // The reason the server must check: the platform itself does not. A no-op value, so nothing changes.
  const res = await fetch(`${url}/admin/v1/settings`, {
    method: "PATCH",
    headers: { Authorization: `Bearer ${readToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({ changes: [{ type: "policy", id: "password-min-length", value: await policy("password-min-length") }] }),
  });
  assert.equal(res.status, 200);
});
