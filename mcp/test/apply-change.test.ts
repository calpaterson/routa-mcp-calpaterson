import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPlatform } from "../src/platform.ts";
import { handleMessage } from "../src/server.ts";
import { tools } from "../src/tools/index.ts";
import { clearPreviews, findPreview } from "../src/previews.ts";

// A stub platform that keeps settings in memory and applies PATCHes like the real one: all or nothing.
async function stub() {
  const state = {
    access: [{ group: "ext-contractors", apps: ["crm", "finance", "timesheets"] }],
    policies: [{ id: "session-length-hours", label: "Session length in hours", value: 24 }],
  };
  const patches: any[] = [];
  const server = createServer((req, res) => {
    const admin = req.headers.authorization === "Bearer test-admin";
    const read = req.headers.authorization === "Bearer test-read";
    res.setHeader("Content-Type", "application/json");
    if (!admin && !read) return void res.writeHead(401).end("{}");
    if (req.url === "/admin/v1/whoami") return void res.writeHead(200).end(JSON.stringify({ scope: admin ? "admin" : "read" }));
    if (req.method === "PATCH") {
      let body = "";
      req.on("data", (d) => (body += d));
      req.on("end", () => {
        const { changes } = JSON.parse(body);
        patches.push(changes);
        for (const c of changes) {
          if (c.type === "access") {
            const g = state.access.find((a) => a.group === c.group)!;
            g.apps = c.allowed ? [...new Set([...g.apps, c.app])] : g.apps.filter((a) => a !== c.app);
          } else state.policies.find((p) => p.id === c.id)!.value = c.value;
        }
        res.writeHead(200).end(JSON.stringify({ applied: changes.length, settings: state }));
      });
      return;
    }
    res.writeHead(200).end(JSON.stringify(state));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://localhost:${(server.address() as { port: number }).port}`;
  async function call(token: string, name: string, args: Record<string, unknown>) {
    const reply: any = await handleMessage(
      { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
      { platform: createPlatform(url, token), tools },
    );
    return { text: reply.result.content[0].text as string, isError: reply.result.isError as boolean };
  }
  return { state, patches, call, close: () => server.close() };
}

const idOf = (text: string) => /Preview ([0-9a-f]{8}):/.exec(text)![1];

test("applying a preview sends exactly the previewed change, once", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_access_change", { group: "ext-contractors", app: "finance", allowed: false });
  assert.deepEqual(s.patches, []);
  const id = idOf(p.text);
  const r = await s.call("test-admin", "apply_change", { preview_id: id });
  assert.equal(r.isError, false);
  assert.match(r.text, /Applied preview .*ext-contractors will lose access to finance/);
  assert.deepEqual(s.patches, [[{ type: "access", group: "ext-contractors", app: "finance", allowed: false }]]);
  assert.deepEqual(s.state.access[0].apps, ["crm", "timesheets"]);
  const again = await s.call("test-admin", "apply_change", { preview_id: id });
  assert.equal(again.isError, true);
  assert.equal(s.patches.length, 1);
  s.close();
});

test("a policy preview is applied as one policy change and nothing else", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  await s.call("test-admin", "apply_change", { preview_id: idOf(p.text) });
  assert.deepEqual(s.patches, [[{ type: "policy", id: "session-length-hours", value: 8 }]]);
  assert.equal(s.state.policies[0].value, 8);
  assert.deepEqual(s.state.access[0].apps, ["crm", "finance", "timesheets"]);
  s.close();
});

test("an unknown, missing or made-up id applies nothing", async () => {
  clearPreviews();
  const s = await stub();
  for (const args of [{ preview_id: "deadbeef" }, {}, { preview_id: 7 }, { preview_id: "" }]) {
    const r = await s.call("test-admin", "apply_change", args);
    assert.equal(r.isError, true);
    assert.match(r.text, /no preview with the id/);
  }
  assert.deepEqual(s.patches, []);
  s.close();
});

test("a setting that changed after the preview is not applied", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  s.state.policies[0].value = 12; // someone else changes it between preview and apply
  const r = await s.call("test-admin", "apply_change", { preview_id: idOf(p.text) });
  assert.equal(r.isError, true);
  assert.match(r.text, /changed after preview/);
  assert.deepEqual(s.patches, []);
  assert.equal(s.state.policies[0].value, 12);
  const q = await s.call("test-admin", "preview_access_change", { group: "ext-contractors", app: "crm", allowed: false });
  s.state.access[0].apps = ["finance"];
  assert.match((await s.call("test-admin", "apply_change", { preview_id: idOf(q.text) })).text, /changed after preview/);
  assert.deepEqual(s.patches, []);
  s.close();
});

test("an old preview is not applied", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  findPreview(idOf(p.text))!.createdAt -= 2 * 60 * 60 * 1000;
  const r = await s.call("test-admin", "apply_change", { preview_id: idOf(p.text) });
  assert.match(r.text, /too old/);
  assert.deepEqual(s.patches, []);
  s.close();
});

test("a read-only token cannot apply even a valid preview, and nothing is sent", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  const r = await s.call("test-read", "apply_change", { preview_id: idOf(p.text) });
  assert.equal(r.isError, true);
  assert.match(r.text, /only read the settings.*Nothing was changed/);
  assert.deepEqual(s.patches, []);
  assert.equal(s.state.policies[0].value, 24);
  assert.ok(findPreview(idOf(p.text)), "the preview is still there for an admin");
  const ok = await s.call("test-admin", "apply_change", { preview_id: idOf(p.text) });
  assert.equal(ok.isError, false);
  s.close();
});

test("an invalid token cannot apply", async () => {
  clearPreviews();
  const s = await stub();
  const p = await s.call("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  const r = await s.call("bad", "apply_change", { preview_id: idOf(p.text) });
  assert.equal(r.isError, true);
  assert.deepEqual(s.patches, []);
  s.close();
});

test("the only tool that sends a PATCH is apply_change, and no tool can reset the grid", () => {
  const changing = tools.filter((t) => t.access === "admin").map((t) => t.name);
  assert.deepEqual(changing, ["preview_access_change", "preview_policy_change", "apply_change"]);
  assert.ok(!tools.some((t) => /reset|all|every/i.test(t.name)));
});
