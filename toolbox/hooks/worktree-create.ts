// A WorktreeCreate hook. Claude Code passes JSON on stdin and takes the new worktree's path from stdout.
// It replaces Claude Code's own worktree creation, so it creates the worktree, then runs the project's setup script in it.
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { basename, dirname, join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const name = JSON.parse(readFileSync(0, "utf8")).name;
const path = join(dirname(root), `${basename(root)}-worktrees`, name);

// Everything goes to stderr except the path.
execFileSync("git", ["worktree", "add", "-b", `worktree/${name}`, path], { cwd: root, stdio: ["ignore", 2, 2] });
const setup = join(path, "scripts", "setup-worktree.ts");
if (existsSync(setup)) execFileSync("node", [setup], { cwd: path, stdio: ["ignore", 2, 2] });
console.log(path);
