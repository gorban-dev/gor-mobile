# Android Dev CLI with local-LLM offload

[![release](https://img.shields.io/github/v/release/gorban-dev/gor-mobile?label=release&color=blue)](https://github.com/gorban-dev/gor-mobile/releases)
[![license](https://img.shields.io/github/license/gorban-dev/gor-mobile)](./LICENSE)
[![tests](https://img.shields.io/badge/bats-15%2F15%20passing-brightgreen)](./tests)
[![homebrew](https://img.shields.io/badge/homebrew-gorban--dev%2Fgor--mobile-orange)](https://github.com/gorban-dev/homebrew-gor-mobile)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]()

A bash CLI that wires a superpowers-style Android workflow (`brainstorm → plan → implement → review → verify`) into Claude Code, offloading routine code generation to **local LLMs** via LM Studio. Opus runs only where judgment is needed.

> Status: `v0.1.0` — core CLI, rules-pack loader, local-LLM dispatcher, full wizard. See `CHANGELOG.md`.

## Install

Homebrew (recommended):

```sh
brew install gorban-dev/gor-mobile/gor-mobile
```

Or curl:

```sh
curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash
```

Then run the wizard once:

```sh
gor-mobile init
```

## What the wizard does

`gor-mobile init` runs 12 idempotent steps. Re-run anytime to repair drift — every step checks current state first, and nothing outside the managed sections is ever touched.

Flags: `--dry-run` prints what would change; `--yes` / `-y` assumes yes to every prompt (non-interactive); `--skip-sanity` skips step 12; `--rules <git-url>` overrides the default rules pack URL.

1. **Base dependencies.** Verifies `git`, `curl`, `jq` are on PATH; warns if `brew` is missing. Missing hard deps abort the wizard.
2. **Google Android CLI agent** (https://developer.android.com/tools/agents). Detects the `android` binary. If absent, prints a short explanation of what the CLI is and why `gor-mobile` needs it, then offers to open the install page in your default browser and waits for you to finish the install before re-detecting.
3. **LM Studio + local models.** Installs LM Studio via `brew --cask` if missing. Then snapshots the installed LLMs (`lms ls --json`) and — unless `--yes` — offers an interactive per-role picker: `impl`, `review`, `deep`. Each choice is shown as a numbered menu of installed models with the current default marked, plus an "enter custom model id" option. Non-default picks are saved to `~/.config/gor-mobile/config.json → .models`, expanded into role groups:
    - `impl` → `{impl, tdd-red, routine-debug}`
    - `review` → `{review, analyze}`
    - `deep` → `{review-deep, vision}`

    Any selected or default model that isn't yet installed is offered for `lms get`.
4. **Secrets template.** Creates `~/.config/gor-mobile/secrets.env` with `chmod 600` (skipped if it already exists — never overwrites your keys).
5. **Rules pack.** Clones the default rules pack (or your `--rules <url>`) to `~/.gor-mobile/rules/`. If the directory already has `.git`, runs `git pull --ff-only` instead. Falls back to the minimal bundled `rules-default/` if the clone fails. Records the source URL + ref in `~/.config/gor-mobile/config.json`.
6. **SessionStart hook.** Copies `session-start-hook.sh` + the snippet to `~/.gor-mobile/templates/`, then `jq`-merges a `SessionStart` entry into `~/.claude/settings.json` — your existing `Stop` / `PermissionRequest` / `Notification` / other `SessionStart` matchers are preserved untouched.
7. **Slash commands.** Copies 11 thin wrapper commands into `~/.claude/commands/`: `/brainstorm`, `/plan`, `/worktree`, `/implement`, `/execute`, `/parallel`, `/tdd`, `/review`, `/verify`, `/debug`, `/finishing-branch`. Each wrapper delegates to a superpowers skill installed under `~/.claude/skills/gor-mobile-<skill>/` and adds two overlays: architecture rules + local-LLM delegation.
8. **Skills.** Copies 13 verbatim superpowers skills into `~/.claude/skills/gor-mobile-<skill>/` (brainstorming, writing-plans, using-git-worktrees, subagent-driven-development with its 3 subagent-prompt templates, executing-plans, dispatching-parallel-agents, test-driven-development, requesting-code-review with `code-reviewer.md`, receiving-code-review, verification-before-completion, systematic-debugging, finishing-a-development-branch, using-superpowers). Only the `name:` frontmatter is prefixed `gor-mobile-` to avoid collision with a possible user-installed superpowers.
9. **Agents.** Copies `gor-mobile-advisor` (proactive workflow router) and `code-reviewer` (invoked by `/review`) into `~/.claude/agents/`.
10. **MCP registration.** Adds a `google-dev-knowledge` entry to `~/.claude/mcp.json` via `jq`-merge (idempotent — won't duplicate an existing entry).
11. **CLAUDE.md managed section.** Writes a short "Android Mobile Dev (managed by gor-mobile)" block between `<!-- BEGIN gor-mobile managed section -->` / `<!-- END ... -->` markers in `~/.claude/CLAUDE.md`. Content outside the markers is never modified; re-running replaces only the content between them.
12. **Sanity check.** Skipped under `--skip-sanity`. Otherwise pings LM Studio at `http://127.0.0.1:1234/v1/models`; if reachable, lists up to five loaded models and confirms the round-trip works.

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
[gor-mobile-rules-default](https://github.com/gorban-dev/gor-mobile-rules-default). Fork it
to impose company-specific patterns:

```sh
gor-mobile rules use git@github.com:my-company/gor-mobile-rules-corp.git
```

## Slash-command map

| Command | Skill (verbatim) | Route |
|---------|------------------|-------|
| `/brainstorm` | `brainstorming` | Opus |
| `/plan` | `writing-plans` | Opus |
| `/worktree` | `using-git-worktrees` | Opus |
| `/implement` | `subagent-driven-development` | implementer subagents → local `impl`; reviewer via `/review` |
| `/execute` | `executing-plans` | Opus (inline batch alt to `/implement`) |
| `/parallel` | `dispatching-parallel-agents` | Opus orchestrator; subagents per their skill |
| `/tdd` | `test-driven-development` | local `tdd-red` + `impl`, Opus fallback |
| `/review` | `requesting-code-review` | spec pass: `code-reviewer` agent; architecture pass: local `review` / `review-deep` |
| `/verify` | `verification-before-completion` | Opus |
| `/debug` | `systematic-debugging` | routine legwork: local `routine-debug` + `tdd-red`; hypothesis: Opus |
| `/finishing-branch` | `finishing-a-development-branch` | Opus |

## Uninstall

```sh
gor-mobile uninstall    # removes hooks, commands, skills, agents, managed CLAUDE.md section
brew uninstall gor-mobile
```

Rules pack at `~/.gor-mobile/rules/` and secrets at `~/.config/gor-mobile/secrets.env`
are preserved.

## Development

```sh
git clone https://github.com/gorban-dev/gor-mobile.git
cd gor-mobile
brew install bats-core
bats tests/
```

MIT licensed.
