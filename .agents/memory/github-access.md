---
name: GitHub access
description: Distinguishing the source-control connector from the native GitHub CLI in this environment.
---

An attached GitHub source-control integration can return no connections in the
CodeExecution sandbox while the native `gh` CLI is already authorized.

**Why:** This environment exposed GitHub through its secure native CLI proxy,
not through the generic sandbox connection object.

**How to apply:** If the exact connector slug has been confirmed but no sandbox
connection is available, a normal `gh api user --jq .login` call can check the
separately configured CLI access. Use ordinary authenticated GitHub CLI commands
when available. Never inspect, print, or extract authentication tokens.

The GitHub remote can contain unrelated projects and newer changes from other
editors. Preserve those changes when uploading Orvyn updates.

**Why:** A normal push was rejected because other project source folders and a
shared project index had been added remotely while the Orvyn workspace stayed
focused on Orvyn.

**How to apply:** Fetch and inspect remote-only changes before pushing. When the
remote contains unrelated projects, apply only the Orvyn commits onto the latest
remote branch in a temporary isolated Git worktree, resolve any shared README
changes without replacing the project index, then push normally. Never force
push or copy unrelated project trees into the running app just to synchronize.
The local workspace branch may deliberately differ from the shared remote.
