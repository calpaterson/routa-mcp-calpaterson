import type { Tool } from "../tool.ts";
import { getSettings, showValue } from "../settings.ts";

export const showPolicies: Tool = {
  name: "show_policies",
  description: "Show the security policies and their values (MFA per group, session length, sign-in, guest access, passwords, token lifetime, audit log). Give a word to show only the policies that mention it, e.g. mfa or contractors.",
  inputSchema: {
    type: "object",
    properties: { match: { type: "string", description: "Only policies whose name contains this" } },
  },
  access: "read",
  async run(args, platform) {
    const { policies } = await getSettings(platform);
    const needle = typeof args.match === "string" ? args.match.toLowerCase() : "";
    const shown = policies.filter((p) => !needle || p.id.toLowerCase().includes(needle) || p.label.toLowerCase().includes(needle));
    if (shown.length === 0) return `No policy matches ${JSON.stringify(args.match)}.`;
    return shown.map((p) => `${p.label}: ${showValue(p.value)}`).join("\n");
  },
};
