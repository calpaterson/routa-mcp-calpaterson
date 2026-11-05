import type { Platform } from "./platform.ts";

export type Access = { group: string; apps: string[] };
export type Policy = { id: string; label: string; value: boolean | number | string };
export type Settings = { access: Access[]; policies: Policy[] };

export async function getSettings(platform: Platform): Promise<Settings> {
  const data = (await platform.get("/admin/v1/settings")) as Settings;
  if (!data || !Array.isArray(data.access) || !Array.isArray(data.policies)) throw new Error("The platform's settings came back in a shape I don't know.");
  return data;
}

export function showValue(value: Policy["value"]): string {
  if (typeof value === "boolean") return value ? "on" : "off";
  return String(value);
}
