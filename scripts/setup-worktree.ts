// Sets up the worktree it is run in: node scripts/setup-worktree.ts
// - puts the worktree's test environment data back to the seed (removes test-environment/.data and the collect log)
// - finds a free port and writes PORT and ROUTA_URL to .env.worktree (gitignored)
// Safe to run again: it keeps the port from the last run while that port is still free.
import { rmSync, readFileSync, writeFileSync, renameSync } from "node:fs";
import { createServer } from "node:net";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Paths come from this file's place, not the current directory or DATA_DIR, so it only ever touches its own worktree.
const root = fileURLToPath(new URL("..", import.meta.url));
const dataDir = join(root, "test-environment", ".data");
const collectLog = join(root, "test-environment", "collect.log");
const envFile = join(root, ".env.worktree");

// Tries a port (0 means any free one) and gives back the port, or null if it can't be had.
function tryPort(port: number): Promise<number | null> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", () => resolve(null));
    server.listen(port, () => {
      const address = server.address();
      const got = typeof address === "object" && address ? address.port : null;
      server.close(() => resolve(got));
    });
  });
}

function previousPort(): number | null {
  try {
    const match = readFileSync(envFile, "utf8").match(/^PORT=(\d+)$/m);
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}

rmSync(dataDir, { recursive: true, force: true });
rmSync(collectLog, { force: true });

const before = previousPort();
const port = (before && (await tryPort(before))) || (await tryPort(0));
if (!port) throw new Error("Could not find a free port.");

// Write to a temporary file, then rename, so a half-written file is never left behind.
const tmp = envFile + ".tmp";
writeFileSync(tmp, `PORT=${port}\nROUTA_URL=http://localhost:${port}\n`);
renameSync(tmp, envFile);

console.log(`Test environment data reset to the seed (${dataDir} removed).`);
console.log(`Port ${port}${port === before ? " (kept)" : ""}; written to ${envFile}.`);
