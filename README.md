# gor-mobile

**Android dev CLI** — superpowers-style workflow (`brainstorm → plan → implement → review → verify`) with routine code generation delegated to **local LLMs** via LM Studio. Opus only where judgment is needed.

> Status: `v0.1.0` — core CLI, rules-pack loader, local-LLM dispatcher, full wizard. See `CHANGELOG.md`.

## Install

Homebrew (recommended):

```sh
brew install gorban/gor-mobile/gor-mobile
```

Or curl:

```sh
curl -fsSL https://raw.githubusercontent.com/gorban/gor-mobile/main/install.sh | bash
```

Then run the wizard once:

```sh
gor-mobile init
```

## What the wizard does

11 idempotent steps (re-run anytime to repair drift):

1. Checks `git / curl / jq / brew`
2. Installs Android platform tools (optional)
3. Installs LM Studio + pulls default models: Qwen3-Coder-30B-A3B, Gemma-4-26B-A4B
4. Creates `~/.config/gor-mobile/secrets.env` (chmod 600)
5. Clones the rules pack to `~/.gor-mobile/rules/` (default or your fork)
6. Merges a SessionStart hook into `~/.claude/settings.json` (preserves existing hooks)
7. Copies `/brainstorm /plan /implement /tdd /review /test-ui /verify /debug /finishing-branch` into `~/.claude/commands/`
8. Copies `gor-mobile-advisor` + `code-reviewer` agents
9. Registers `google-dev-knowledge` in `~/.claude/mcp.json`
10. Adds a managed section to `~/.claude/CLAUDE.md` (between markers — nothing else touched)
11. Sanity check: round-trip to LM Studio

## Commands

Setup & maintenance:

```
gor-mobile init            # wizard
gor-mobile doctor          # environment check
gor-mobile repair          # restore managed files
gor-mobile update          # pull rules + repair
gor-mobile self-update     # update the CLI (curl-installer path)
gor-mobile uninstall       # clean removal of all artifacts
```

Rules pack:

```
gor-mobile rules list
gor-mobile rules use <url|path>
gor-mobile rules update
gor-mobile rules diff
gor-mobile rules validate
```

Local LLM:

```
gor-mobile llm <role> --input <file>   # role ∈ {impl, tdd-red, routine-debug,
                                       #         review, review-deep, vision, analyze}
gor-mobile llm status
gor-mobile llm routing
gor-mobile llm preset <aggressive-local|balanced|cloud-only>
```

## How delegation works

Slash-commands in Claude Code invoke `gor-mobile llm <role> --input <prompt>`. The CLI
routes per preset: e.g. in `balanced` mode, `impl` → local Qwen-Coder-30B, `review` →
local Gemma-4-26B-A4B, `brainstorm`/`plan`/`verify` → cloud (Opus).

Response JSON:

```json
{ "status": "OK|BLOCKED|ERROR", "model": "...", "content": "...",
  "tokens": {"input": 0, "output": 0}, "elapsed_ms": 0 }
```

On `BLOCKED`/`ERROR` the agent falls back to Opus. Presets change which roles route where.

## Rules packs

A rules pack is a git repo with `manifest.json` + `rules/*.md` + `examples/<layer>/*.kt`.
The default pack lives at
[gor-mobile-rules-default](https://github.com/gorban/gor-mobile-rules-default). Fork it
to impose company-specific patterns:

```sh
gor-mobile rules use git@github.com:my-company/gor-mobile-rules-corp.git
```

## Uninstall

```sh
gor-mobile uninstall    # removes hooks, commands, agents, managed CLAUDE.md section
brew uninstall gor-mobile
```

Rules pack at `~/.gor-mobile/rules/` and secrets at `~/.config/gor-mobile/secrets.env`
are preserved.

## Development

```sh
git clone https://github.com/gorban/gor-mobile.git
cd gor-mobile
brew install bats-core
bats tests/
```

MIT licensed.
