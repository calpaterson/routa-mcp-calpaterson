import type { Tool } from "../tool.ts";
import { getSettings } from "../settings.ts";
import { knownApps } from "../apps.ts";
import { askToApply, savePreview } from "../previews.ts";

export const previewAccessChange: Tool = {
  name: "preview_access_change",
  description:
    "Preview giving one group access to one application, or taking it away. Changes nothing: it shows what would happen and gives a preview id. Use apply_change with that id after the user says yes.",
  inputSchema: {
    type: "object",
    properties: {
      group: { type: "string", description: "The group, e.g. ext-contractors" },
      app: { type: "string", description: "The application, e.g. finance" },
      allowed: { type: "boolean", description: "true to give access, false to take it away" },
    },
    required: ["group", "app", "allowed"],
  },
  access: "admin",
  async run(args, platform) {
    const { group, app, allowed } = args;
    if (typeof allowed !== "boolean") throw new Error("Say whether the group should get access (true) or lose it (false).");
    const { access } = await getSettings(platform);
    const found = access.find((a) => a.group === group);
    if (!found) throw new Error(`There is no group called ${JSON.stringify(group)}. The groups are: ${access.map((a) => a.group).join(", ")}.`);
    const apps = new Set([...knownApps, ...access.flatMap((a) => a.apps)]);
    if (typeof app !== "string" || !apps.has(app)) throw new Error(`There is no application called ${JSON.stringify(app)}. The applications are: ${[...apps].sort().join(", ")}.`);
    const has = found.apps.includes(app);
    if (has === allowed) return `No change: ${group} ${has ? "can already" : "already cannot"} reach ${app}. Nothing to apply.`;
    const now = found.apps.length === 0 ? "no applications" : found.apps.join(", ");
    const after = (allowed ? [...found.apps, app] : found.apps.filter((a) => a !== app)).sort();
    const text = `${group} will ${allowed ? "gain" : "lose"} access to ${app}. Now it reaches: ${now}. After: ${after.length === 0 ? "no applications" : after.join(", ")}.`;
    return askToApply(savePreview({ type: "access", group, app, allowed }, has, text));
  },
};
