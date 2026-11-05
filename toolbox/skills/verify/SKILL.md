---
name: verify
description: Check whether the work is done. Use after each build step, and before saying the work is done.
---

Run the checks below. Report each failing check with its error, or say that every check passed. Don't fix anything here, and don't reset anything: setting up the environment isn't this skill's job.

## The checks

What "done" means for this work. Each one must be able to fail. Adapt these to the project.

1. **The tests pass.** Every test file runs at least one test.
2. **A live run, as the user would.** Use the work against the running test environment, the way the client would, and check the end state in the real system.
3. **The client's limits hold.** One check for each limit in the client's files.
4. **No secrets.** Scan every file in the folder, logs included, for tokens and for `Authorization` headers that carry a real value.
