import { test } from "node:test";
import assert from "node:assert/strict";
import { createServer } from "node:http";
import { createPlatform } from "../src/platform.ts";
import { handleMessage } from "../src/server.ts";
import { tools } from "../src/tools/index.ts";
import { describeDifferences, findDifferences, loadBaseline } from "../src/baseline.ts";

const baseline = loadBaseline();

// The platform as the baseline wants it, built from the baseline file itself.
function matching() {
  return {
    access: Object.entries(baseline.access).map(([group, apps]) => ({ group, apps: [...apps].sort() })),
    policies: Object.entries(baseline.policies).map(([id, value]) => ({ id, label: `Label of ${id}`, value })),
  };
}

test("settings equal to the baseline have no differences", () => {
  assert.deepEqual(findDifferences(matching(), baseline), []);
  assert.equal(describeDifferences([]), "Every setting matches the security baseline.");
});

test("an extra application, a missing application and a changed policy are each reported in words", () => {
  const s = matching();
  s.access.find((a) => a.group === "ext-contractors")!.apps.push("crm");
  s.access.find((a) => a.group === "dept-people")!.apps = [];
  const mfa = s.policies.find((p) => p.id === "mfa.partners")!;
  mfa.value = false;
  const session = s.policies.find((p) => p.id === "session-length-hours")!;
  session.value = 24;
  const found = findDifferences(s, baseline);
  assert.equal(found.length, 4);
  assert.ok(found.includes("dept-people cannot reach hr, but the baseline says it should."));
  assert.ok(found.includes("ext-contractors can reach crm, but the baseline says it must not."));
  assert.ok(found.includes("Label of mfa.partners is off, but the baseline says on."));
  assert.ok(found.includes("Label of session-length-hours is 24, but the baseline says 8."));
  assert.match(describeDifferences(found), /^4 settings differ from the security baseline:\n- /);
});

test("a group or policy missing on either side is reported", () => {
  const s = matching();
  s.access = s.access.filter((a) => a.group !== "partners");
  s.access.push({ group: "newcomers", apps: ["crm"] });
  s.policies = s.policies.filter((p) => p.id !== "audit-log-days");
  s.policies.push({ id: "new-rule", label: "New rule", value: true });
  const found = findDifferences(s, baseline);
  assert.ok(found.includes("newcomers is not in the baseline at all and can reach crm."));
  assert.ok(found.includes("partners is in the baseline but the platform has no such group."));
  assert.ok(found.includes("New rule is on, but the baseline has nothing on it."));
  assert.ok(found.includes("The baseline sets audit-log-days, but the platform has no such policy."));
});

async function callTool(token: string, settings: unknown) {
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
    { jsonrpc: "2.0", id: 1, method: "tools/call", params: { name: "show_baseline_differences", arguments: {} } },
    { platform: createPlatform(url, token), tools },
  );
  server.close();
  return { text: reply.result.content[0].text as string, isError: reply.result.isError as boolean, requests };
}

test("show_baseline_differences is a read tool and works with a read-only token, sending only GETs", async () => {
  assert.equal(tools.find((t) => t.name === "show_baseline_differences")?.access, "read");
  const s = matching();
  s.policies.find((p) => p.id === "legacy-sign-in")!.value = true;
  const r = await callTool("test-read", s);
  assert.equal(r.isError, false);
  assert.equal(r.text, "1 setting differs from the security baseline:\n- Label of legacy-sign-in is on, but the baseline says off.");
  assert.deepEqual(r.requests, ["GET /admin/v1/whoami", "GET /admin/v1/settings"]);
});

test("show_baseline_differences says so when everything matches, and refuses an invalid token", async () => {
  assert.equal((await callTool("test-admin", matching())).text, "Every setting matches the security baseline.");
  const bad = await callTool("wrong", matching());
  assert.equal(bad.isError, true);
  assert.deepEqual(bad.requests, ["GET /admin/v1/whoami"]);
});
