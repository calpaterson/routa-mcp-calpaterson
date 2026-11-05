// Starts the server: ROUTA_URL (default http://localhost:4010) and MCP_TOKEN. Nothing is logged to stdout but protocol messages.
import { createPlatform } from "./platform.ts";
import { serveStdio } from "./server.ts";
import { tools } from "./tools/index.ts";

const token = process.env.MCP_TOKEN;
if (!token) {
  console.error("Set MCP_TOKEN to your Routa token first.");
  process.exit(2);
}
const platform = createPlatform(process.env.ROUTA_URL || "http://localhost:4010", token);
serveStdio({ platform, tools });
