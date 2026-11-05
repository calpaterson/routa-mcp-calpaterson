import type { Tool } from "../tool.ts";
import { getSettings } from "../settings.ts";

const list = (apps: string[]) => (apps.length === 0 ? "no applications" : apps.join(", "));

export const showAccess: Tool = {
  name: "show_access",
  description:
    "Show which groups can reach which applications. With no arguments, shows every group. Give a group to see one group, or an application to see which groups reach it.",
  inputSchema: {
    type: "object",
    properties: {
      group: { type: "string", description: "A group name, e.g. ext-contractors" },
      app: { type: "string", description: "An application, e.g. finance" },
    },
  },
  access: "read",
  async run(args, platform) {
    const { access } = await getSettings(platform);
    const { group, app } = args;
    if (group !== undefined && app !== undefined) {
      const found = access.find((a) => a.group === group);
      if (!found) throw new Error(`There is no group called ${JSON.stringify(group)}. The groups are: ${access.map((a) => a.group).join(", ")}.`);
      return `${group} ${found.apps.includes(app) ? "can" : "cannot"} reach ${app}.`;
    }
    if (group !== undefined) {
      const found = access.find((a) => a.group === group);
      if (!found) throw new Error(`There is no group called ${JSON.stringify(group)}. The groups are: ${access.map((a) => a.group).join(", ")}.`);
      return `${group} can reach: ${list(found.apps)}.`;
    }
    if (app !== undefined) {
      const groups = access.filter((a) => a.apps.includes(app)).map((a) => a.group);
      const known = access.some((a) => a.apps.includes(app));
      if (!known) return `No group can reach ${app}. (If ${app} is not an application Routa has, it is not shown anywhere.)`;
      return `${app} can be reached by: ${groups.join(", ")}.`;
    }
    return access.map((a) => `${a.group}: ${list(a.apps)}`).join("\n");
  },
};
