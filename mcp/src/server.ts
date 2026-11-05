// MCP over stdio: newline-delimited JSON-RPC.
import { createInterface } from "node:readline";
import type { Platform } from "./platform.ts";
import type { Tool } from "./tool.ts";

const PROTOCOL_VERSION = "2025-06-18";

type Message = { jsonrpc?: string; id?: string | number | null; method?: string; params?: any };
type Reply = Record<string, unknown>;

export type ServerOptions = { platform: Platform; tools: Tool[] };

const textResult = (text: string, isError = false) => ({ content: [{ type: "text", text }], isError });
const rpcError = (id: Message["id"], code: number, message: string): Reply => ({ jsonrpc: "2.0", id: id ?? null, error: { code, message } });

// Checks the token on every call, before the tool does anything.
export async function callTool(tool: Tool, args: Record<string, any>, platform: Platform) {
  let scope;
  try {
    scope = await platform.whoami();
  } catch (err) {
    return textResult(`Nothing was done: ${(err as Error).message}`, true);
  }
  if (scope === "invalid") return textResult("Nothing was done: the platform doesn't accept this token. Check MCP_TOKEN.", true);
  if (tool.access === "admin" && scope !== "admin") {
    return textResult("Refused: this token can only read the settings, and this changes them. Nothing was changed. Use an admin token to make changes.", true);
  }
  try {
    return textResult(await tool.run(args, platform));
  } catch (err) {
    return textResult(`Nothing was done: ${(err as Error).message}`, true);
  }
}

// Answers one message. Notifications (no id) get no answer.
export async function handleMessage(msg: Message, opts: ServerOptions): Promise<Reply | null> {
  const isNotification = msg.id === undefined;
  if (typeof msg.method !== "string") return isNotification ? null : rpcError(msg.id, -32600, "Invalid request");
  if (isNotification) return null;
  const reply = (result: unknown): Reply => ({ jsonrpc: "2.0", id: msg.id, result });

  switch (msg.method) {
    case "initialize":
      return reply({
        protocolVersion: typeof msg.params?.protocolVersion === "string" ? msg.params.protocolVersion : PROTOCOL_VERSION,
        capabilities: { tools: {} },
        serverInfo: { name: "routa-settings", version: "0.1.0" },
      });
    case "ping":
      return reply({});
    case "tools/list":
      return reply({ tools: opts.tools.map(({ name, description, inputSchema }) => ({ name, description, inputSchema })) });
    case "tools/call": {
      const tool = opts.tools.find((t) => t.name === msg.params?.name);
      if (!tool) return rpcError(msg.id, -32602, `Unknown tool ${JSON.stringify(msg.params?.name)}`);
      return reply(await callTool(tool, msg.params?.arguments ?? {}, opts.platform));
    }
    default:
      return rpcError(msg.id, -32601, `Method not found: ${msg.method}`);
  }
}

export function serveStdio(opts: ServerOptions) {
  const rl = createInterface({ input: process.stdin });
  let chain = Promise.resolve();
  rl.on("line", (line) => {
    if (!line.trim()) return;
    chain = chain.then(async () => {
      let msg: Message;
      try {
        msg = JSON.parse(line);
      } catch {
        process.stdout.write(JSON.stringify(rpcError(null, -32700, "Parse error")) + "\n");
        return;
      }
      const out = await handleMessage(msg, opts);
      if (out) process.stdout.write(JSON.stringify(out) + "\n");
    });
  });
}
