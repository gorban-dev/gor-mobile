# Changelog

## 0.1.0 — Unreleased

Pre-release scaffolding. Under active development on `develop` branch.

- remove: google-dev-knowledge MCP registration step from the wizard. Docs
  lookup now relies on the `android` CLI + `gor-mobile docs`. Existing
  users: run `gor-mobile repair` — it will prune the managed entry from
  `~/.claude/mcp.json`.
