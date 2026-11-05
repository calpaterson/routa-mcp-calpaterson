import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPlatform } from "../src/platform.ts";
import { handleMessage } from "../src/server.ts";
import { tools } from "../src/tools/index.ts";

const settings = {
  access: [
    { group: "dept-consulting", apps: [] },
    { group: "ext-contractors", apps: ["crm", "timesheets"] },
    { group: "partners", apps: ["crm", "finance"] },
  ],
  policies: [
    { id: "mfa.partners", label: "Require MFA for partners", value: false },
    { id: "mfa.managers", label: "Require MFA for managers", value: true },
    { id: "session-length-hours", label: "Session length in hours", value: 24 },
    { id: "guest-access", label: "Guest access", value: "open" },
  ],
};

async function run(token: string, name: string, args: Record<string, unknown> = {}) {
  const requests: string[] = [];
  const server = createServer((req, res) => {
    requests.push(`${req.method} ${req.url}`);
    const read = req.headers.authorization === "Bearer test-read";
    const admin = req.headers.authorization === "Bearer test-admin";
    res.setHeader("Content-Type", "application/json");
    if (!read && !admin) return void res.writeHead(401).end("{}");
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

test("the read tools are listed and are read-only tools", () => {
  const readTools = tools.filter((t) => t.access === "read").map((t) => t.name);
  assert.deepEqual(readTools, ["show_access", "show_policies", "show_baseline_differences"]);
});

test("show_access lists every group, with none for an empty group", async () => {
  const r = await run("test-read", "show_access");
  assert.equal(r.isError, false);
  assert.equal(r.text, "dept-consulting: no applications\next-contractors: crm, timesheets\npartners: crm, finance");
});

test("show_access answers for one group, one application, or both", async () => {
  assert.equal((await run("test-read", "show_access", { group: "ext-contractors" })).text, "ext-contractors can reach: crm, timesheets.");
  assert.equal((await run("test-read", "show_access", { app: "crm" })).text, "crm can be reached by: ext-contractors, partners.");
  assert.equal((await run("test-read", "show_access", { group: "partners", app: "timesheets" })).text, "partners cannot reach timesheets.");
  assert.equal((await run("test-read", "show_access", { group: "partners", app: "finance" })).text, "partners can reach finance.");
});

test("show_access says plainly when a group is unknown", async () => {
  const r = await run("test-read", "show_access", { group: "contractors" });
  assert.equal(r.isError, true);
  assert.match(r.text, /no group called "contractors".*ext-contractors/);
});

test("show_policies shows labels and on/off in plain words, and can filter", async () => {
  const all = await run("test-read", "show_policies");
  assert.match(all.text, /Require MFA for partners: off/);
  assert.match(all.text, /Require MFA for managers: on/);
  assert.match(all.text, /Session length in hours: 24/);
  assert.equal((await run("test-read", "show_policies", { match: "guest" })).text, "Guest access: open");
  assert.match((await run("test-read", "show_policies", { match: "zzz" })).text, /No policy matches/);
});

test("the read tools work with an admin token and only ever GET", async () => {
  const r = await run("test-admin", "show_access");
  assert.equal(r.isError, false);
  assert.ok(r.requests.every((q) => q.startsWith("GET ")));
});

test("the read tools refuse an invalid token", async () => {
  const r = await run("bad", "show_policies");
  assert.equal(r.isError, true);
  assert.match(r.text, /doesn't accept this token/);
});
