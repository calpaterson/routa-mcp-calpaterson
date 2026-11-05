# The team's toolbox

Our default harness. Bring it to a new engagement and adapt it: copy what you need into the project's `.claude/`, then fix what is specific to the work. Nothing about a client lives here.

- `skills/plan`, `skills/build`, `skills/verify`: the loop.
- `hooks/worktree-create.ts`: a WorktreeCreate hook that creates a worktree, then runs the project's setup script in it.
