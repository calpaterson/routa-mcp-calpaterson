import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPlatform } from "../src/platform.ts";
import { handleMessage } from "../src/server.ts";
import { tools } from "../src/tools/index.ts";
import { findPreview, clearPreviews } from "../src/previews.ts";

const settings = {
  access: [
    { group: "dept-consulting", apps: [] },
    { group: "ext-contractors", apps: ["crm", "finance", "timesheets"] },
  ],
  policies: [
    { id: "mfa.partners", label: "Require MFA for partners", value: false },
    { id: "session-length-hours", label: "Session length in hours", value: 24 },
    { id: "guest-access", label: "Guest access", value: "open" },
  ],
};

async function run(token: string, name: string, args: Record<string, unknown>) {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const admin = req.headers.authorization === "Bearer test-admin";
    const read = req.headers.authorization === "Bearer test-read";
    res.setHeader("Content-Type", "application/json");
    if (!admin && !read) return void res.writeHead(401).end("{}");
    if (req.url === "/admin/v1/whoami") return void res.writeHead(200).end(JSON.stringify({ scope: admin ? "admin" : "read" }));
    res.writeHead(200).end(JSON.stringify(settings));
  });
  await new Promise<void>((r) => server.listen(0, r));
  const url = `http://localhost:${(server.address() as { port: number }).port}`;
  const reply: any = await handleMessage(
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name, arguments: args } },
    { platform: createPlatform(url, token), tools },
  );
  server.close();
  return { text: reply.result.content[0].text as string, isError: reply.result.isError as boolean, requests };
}

const idOf = (text: string) => /Preview ([0-9a-f]{8}):/.exec(text)![1];

test("the preview tools are admin tools", () => {
  for (const name of ["preview_access_change", "preview_policy_change"]) assert.equal(tools.find((t) => t.name === name)?.access, "admin");
});

test("a preview of losing access says in plain words who loses what, and stores the exact change", async () => {
  clearPreviews();
  const r = await run("test-admin", "preview_access_change", { group: "ext-contractors", app: "finance", allowed: false });
  assert.equal(r.isError, false);
  assert.match(r.text, /ext-contractors will lose access to finance\. Now it reaches: crm, finance, timesheets\. After: crm, timesheets\./);
  assert.match(r.text, /Nothing has been changed yet/);
  const p = findPreview(idOf(r.text))!;
  assert.deepEqual(p.change, { type: "access", group: "ext-contractors", app: "finance", allowed: false });
  assert.deepEqual(r.requests.filter((q) => !q.startsWith("GET ")), []);
});

test("a preview of gaining access, and of a no-op, which gets no id", async () => {
  clearPreviews();
  const gain = await run("test-admin", "preview_access_change", { group: "dept-consulting", app: "crm", allowed: true });
  assert.match(gain.text, /dept-consulting will gain access to crm\. Now it reaches: no applications\. After: crm\./);
  const noop = await run("test-admin", "preview_access_change", { group: "ext-contractors", app: "crm", allowed: true });
  assert.match(noop.text, /No change: ext-contractors can already reach crm/);
  assert.doesNotMatch(noop.text, /Preview [0-9a-f]{8}/);
});

test("unknown groups, applications and missing flags are refused with what is valid", async () => {
  clearPreviews();
  const g = await run("test-admin", "preview_access_change", { group: "contractors", app: "crm", allowed: true });
  assert.equal(g.isError, true);
  assert.match(g.text, /no group called "contractors".*ext-contractors/);
  const a = await run("test-admin", "preview_access_change", { group: "ext-contractors", app: "payroll", allowed: true });
  assert.match(a.text, /no application called "payroll".*finance/);
  const f = await run("test-admin", "preview_access_change", { group: "ext-contractors", app: "crm" });
  assert.equal(f.isError, true);
});

test("a policy preview says from what to what, in words", async () => {
  clearPreviews();
  const a = await run("test-admin", "preview_policy_change", { id: "session-length-hours", value: 8 });
  assert.match(a.text, /Session length in hours will go from 24 to 8\./);
  assert.deepEqual(findPreview(idOf(a.text))!.change, { type: "policy", id: "session-length-hours", value: 8 });
  const b = await run("test-admin", "preview_policy_change", { id: "mfa.partners", value: true });
  assert.match(b.text, /Require MFA for partners will go from off to on\./);
  const c = await run("test-admin", "preview_policy_change", { id: "guest-access", value: "invite-only" });
  assert.match(c.text, /Guest access will go from open to invite-only\./);
});

test("bad policy requests are refused: unknown id, wrong type, bad number, no change", async () => {
  clearPreviews();
  assert.match((await run("test-admin", "preview_policy_change", { id: "nope", value: 1 })).text, /no policy called "nope".*mfa\.partners/);
  assert.match((await run("test-admin", "preview_policy_change", { id: "session-length-hours", value: "8" })).text, /takes a number/);
  assert.match((await run("test-admin", "preview_policy_change", { id: "mfa.partners", value: "yes" })).text, /on or off/);
  assert.match((await run("test-admin", "preview_policy_change", { id: "session-length-hours", value: -1 })).text, /above zero/);
  const same = await run("test-admin", "preview_policy_change", { id: "session-length-hours", value: 24 });
  assert.match(same.text, /No change/);
  assert.doesNotMatch(same.text, /Preview [0-9a-f]{8}/);
});

test("a read-only token is refused by both preview tools, saves nothing and sends no request but whoami", async () => {
  clearPreviews();
  for (const [name, args] of [
    ["preview_access_change", { group: "ext-contractors", app: "finance", allowed: false }],
    ["preview_policy_change", { id: "session-length-hours", value: 8 }],
  ] as const) {
    const r = await run("test-read", name, args);
    assert.equal(r.isError, true);
    assert.match(r.text, /only read the settings/);
    assert.deepEqual(r.requests, ["GET /admin/v1/whoami"]);
  }
});
