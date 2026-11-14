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
