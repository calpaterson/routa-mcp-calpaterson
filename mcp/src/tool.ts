import type { Platform } from "./platform.ts";

// "read" tools run with any valid token. "admin" tools change settings and need an admin token.
export type Tool = {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  access: "read" | "admin";
  run: (args: Record<string, any>, platform: Platform) => Promise<string>;
};
