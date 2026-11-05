// Compares the platform's settings with Routa's security baseline (client/security-baseline.json), in plain words.
import { readFileSync } from "node:fs";
import type { Settings } from "./settings.ts";
import { showValue } from "./settings.ts";

export type Baseline = { access: Record<string, string[]>; policies: Record<string, boolean | number | string> };

export const BASELINE_FILE = new URL("../../client/security-baseline.json", import.meta.url);

export function loadBaseline(file: URL | string = BASELINE_FILE): Baseline {
  const data = JSON.parse(readFileSync(file, "utf8"));
  if (!data || typeof data.access !== "object" || typeof data.policies !== "object") throw new Error("The security baseline file is not in the shape I know.");
  return data;
}

// One plain sentence per difference. An empty list means everything matches.
export function findDifferences(settings: Settings, baseline: Baseline): string[] {
  const found: string[] = [];
  const seen = new Set<string>();
  for (const { group, apps } of settings.access) {
    seen.add(group);
    const allowed = baseline.access[group];
    if (!allowed) {
      found.push(`${group} is not in the baseline at all${apps.length ? ` and can reach ${apps.join(", ")}` : ""}.`);
      continue;
    }
    for (const app of apps) if (!allowed.includes(app)) found.push(`${group} can reach ${app}, but the baseline says it must not.`);
    for (const app of allowed) if (!apps.includes(app)) found.push(`${group} cannot reach ${app}, but the baseline says it should.`);
  }
  for (const group of Object.keys(baseline.access)) {
    if (!seen.has(group)) found.push(`${group} is in the baseline but the platform has no such group.`);
  }
  const seenPolicies = new Set<string>();
  for (const { id, label, value } of settings.policies) {
    seenPolicies.add(id);
    if (!(id in baseline.policies)) found.push(`${label} is ${showValue(value)}, but the baseline has nothing on it.`);
    else if (baseline.policies[id] !== value) found.push(`${label} is ${showValue(value)}, but the baseline says ${showValue(baseline.policies[id])}.`);
  }
  for (const id of Object.keys(baseline.policies)) {
    if (!seenPolicies.has(id)) found.push(`The baseline sets ${id}, but the platform has no such policy.`);
  }
  return found;
}

export function describeDifferences(found: string[]): string {
  if (found.length === 0) return "Every setting matches the security baseline.";
  const head = `${found.length} ${found.length === 1 ? "setting differs" : "settings differ"} from the security baseline:`;
  return [head, ...found.map((line) => `- ${line}`)].join("\n");
}
