import type { Tool } from "../tool.ts";
import { describeDifferences, findDifferences, loadBaseline } from "../baseline.ts";
import { getSettings } from "../settings.ts";

export const showBaselineDifferences: Tool = {
  name: "show_baseline_differences",
  description: "List every setting that differs from Routa's agreed security baseline, in plain words: groups that reach applications they must not (or miss ones they should), and policies with another value. Only reads; changes nothing.",
  inputSchema: { type: "object", properties: {} },
  access: "read",
  async run(_args, platform) {
    const settings = await getSettings(platform);
    return describeDifferences(findDifferences(settings, loadBaseline()));
  },
};
