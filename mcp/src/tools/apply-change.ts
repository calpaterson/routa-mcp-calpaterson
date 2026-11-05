import type { Tool } from "../tool.ts";
import { getSettings } from "../settings.ts";
import { findPreview, forgetPreview, isExpired } from "../previews.ts";
import type { Preview } from "../previews.ts";

const again = "Ask for a new preview and nothing else will be applied.";

// The setting as it is now, in the same form the preview recorded it.
function currentValue(preview: Preview, settings: Awaited<ReturnType<typeof getSettings>>) {
  const c = preview.change;
  if (c.type === "access") return settings.access.find((a) => a.group === c.group)?.apps.includes(c.app);
  return settings.policies.find((p) => p.id === c.id)?.value;
}

export const applyChange: Tool = {
  name: "apply_change",
  description:
    "Apply a change that was previewed and that the user has said yes to. Takes only the preview id and applies exactly what that preview showed, once. Never call it without the user's yes to that preview.",
  inputSchema: {
    type: "object",
    properties: { preview_id: { type: "string", description: "The id from preview_access_change or preview_policy_change" } },
    required: ["preview_id"],
  },
  access: "admin",
  async run(args, platform) {
    const preview = typeof args.preview_id === "string" ? findPreview(args.preview_id) : undefined;
    if (!preview) throw new Error(`There is no preview with the id ${JSON.stringify(args.preview_id)}. It may be used already, or lost when the server restarted. ${again}`);
    if (isExpired(preview)) {
      forgetPreview(preview.id);
      throw new Error(`Preview ${preview.id} is too old to trust. ${again}`);
    }
    const now = currentValue(preview, await getSettings(platform));
    if (now !== preview.before) {
      forgetPreview(preview.id);
      throw new Error(`The setting changed after preview ${preview.id} was shown, so it is not applied. ${again}`);
    }
    await platform.patch("/admin/v1/settings", { changes: [preview.change] });
    forgetPreview(preview.id);
    return `Applied preview ${preview.id}: ${preview.text}`;
  },
};
