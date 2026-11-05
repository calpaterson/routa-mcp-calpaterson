import type { Tool } from "../tool.ts";
import { getSettings, showValue } from "../settings.ts";
import { askToApply, savePreview } from "../previews.ts";

export const previewPolicyChange: Tool = {
  name: "preview_policy_change",
  description:
    "Preview changing one security policy, e.g. session length or whether a group needs MFA. Changes nothing: it shows from what to what, and gives a preview id. Use apply_change with that id after the user says yes. Use show_policies to see the policy ids.",
  inputSchema: {
    type: "object",
    properties: {
      id: { type: "string", description: "The policy, e.g. session-length-hours or mfa.partners" },
      value: { type: ["boolean", "number", "string"], description: "The new value" },
    },
    required: ["id", "value"],
  },
  access: "admin",
  async run(args, platform) {
    const { id, value } = args;
    const { policies } = await getSettings(platform);
    const policy = policies.find((p) => p.id === id);
    if (!policy) throw new Error(`There is no policy called ${JSON.stringify(id)}. The policies are: ${policies.map((p) => p.id).join(", ")}.`);
    const kind = typeof policy.value === "boolean" ? "on or off (true or false)" : typeof policy.value === "number" ? "a number" : "text";
    if (typeof value !== typeof policy.value) throw new Error(`${policy.label} takes ${kind}.`);
    if (typeof value === "number" && (!Number.isFinite(value) || value <= 0)) throw new Error(`${policy.label} takes a number above zero.`);
    if (typeof value === "string" && value.trim() === "") throw new Error(`${policy.label} can't be empty.`);
    if (value === policy.value) return `No change: ${policy.label} is already ${showValue(value)}. Nothing to apply.`;
    const text = `${policy.label} will go from ${showValue(policy.value)} to ${showValue(value)}.`;
    return askToApply(savePreview({ type: "policy", id: policy.id, value }, policy.value, text));
  },
};
