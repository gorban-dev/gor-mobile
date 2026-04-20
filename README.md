# Android Dev CLI with local-LLM offload

[![release](https://img.shields.io/github/v/release/gorban-dev/gor-mobile?label=release&color=blue)](https://github.com/gorban-dev/gor-mobile/releases)
[![license](https://img.shields.io/github/license/gorban-dev/gor-mobile)](./LICENSE)
[![tests](https://img.shields.io/badge/bats-45%20passing-brightgreen)](./tests)
[![homebrew](https://img.shields.io/badge/homebrew-gorban--dev%2Fgor--mobile-orange)](https://github.com/gorban-dev/homebrew-gor-mobile)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]()

A bash CLI that wires a superpowers-style Android workflow (`brainstorm → plan → implement → review → verify`) into Claude Code, offloading routine code generation to **local LLMs** via LM Studio. Opus runs only where judgment is needed.

> Status: `v0.3.2` — gum-backed TUI wizard (falls back to plain prompts without a TTY or with `--no-tui`); superpowers verbatim (14 skills, 1 agent, SessionStart + UserPromptSubmit hooks); craft-skills-ported local-LLM delegation scripts; preemptive fixes for 5 open upstream bugs (obra/superpowers#1002, #1058, #1077, #1080, #1091). See `CHANGELOG.md`.

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

Flags: `--dry-run` prints what would change; `--yes` / `-y` assumes yes to every prompt (non-interactive); `--skip-sanity` skips step 12; `--no-tui` (or `NO_TUI=1`) forces plain-text prompts even when the gum TUI is available; `--rules <git-url>` overrides the default rules pack URL.

1. **Base dependencies.** Verifies `git`, `curl`, `jq` are on PATH; warns if `brew` is missing. Missing hard deps abort the wizard.
2. **Google Android CLI agent** (https://developer.android.com/tools/agents). Detects the `android` binary. If absent, prints a short explanation of what the CLI is and why `gor-mobile` needs it, then offers to open the install page in your default browser and waits for you to finish the install before re-detecting.
3. **LM Studio + local models.** Installs LM Studio via `brew --cask` if missing. Then snapshots the installed LLMs (`lms ls --json`) and — unless `--yes` — offers an interactive per-role picker: `impl`, `review`, `deep`. Each choice is shown as a numbered menu of installed models with the current default marked, plus an "enter custom model id" option. Non-default picks are saved to `~/.config/gor-mobile/config.json → .models`, expanded into role groups:
    - `impl` → `{impl, tdd-red, routine-debug}`
    - `review` → `{review, analyze}`
    - `deep` → `{review-deep, vision}`

    Any selected or default model that isn't yet installed is offered for `lms get`.
4. **Secrets template.** Creates `~/.config/gor-mobile/secrets.env` with `chmod 600` (skipped if it already exists — never overwrites your keys).
5. **Rules pack.** Clones the default rules pack (or your `--rules <url>`) to `~/.gor-mobile/rules/`. If the directory already has `.git`, runs `git pull --ff-only` instead. Falls back to the minimal bundled `rules-default/` if the clone fails. Records the source URL + ref in `~/.config/gor-mobile/config.json`.
6. **SessionStart + UserPromptSubmit hooks.** Copies `session-start-hook.sh` and `user-prompt-submit-hook.sh` to `~/.gor-mobile/templates/`, then `jq`-merges matching entries into `~/.claude/settings.json` — your existing `Stop` / `PermissionRequest` / `Notification` / other matchers are preserved untouched. The SessionStart hook mirrors the superpowers hook shape: it reads `gor-mobile-using-superpowers/SKILL.md` on every session start and injects it as `additionalContext` (no Android project gate). The closing `</EXTREMELY_IMPORTANT>` tag sits directly after the skills-discipline rules; Android rules-pack/scripts context lives in a sibling `<gor-mobile-android-addendum>` block so it doesn't dilute the skills signal. The UserPromptSubmit hook fires on every user prompt and injects a short (~50-word) reminder — counters skills-discipline drift on long conversations where the single SessionStart injection fades.
7. **Skills.** Copies 14 verbatim superpowers skills into `~/.claude/skills/gor-mobile-<skill>/`. Install-time transforms: `sed 's/superpowers:/gor-mobile-/g'` on cross-references, `sed 's/^name: /name: gor-mobile-/'` on the frontmatter id, and an optional overlay block appended from `templates/overlays/<skill>.md` for the 6 skills where Android rules, local-LLM delegation, or a fix to a known upstream bug applies (`brainstorming`, `subagent-driven-development`, `test-driven-development`, `executing-plans`, `systematic-debugging`, `requesting-code-review`).
8. **LLM scripts.** Installs 7 craft-skills-ported scripts to `~/.gor-mobile/scripts/`: `llm-config`, `llm-agent`, `llm-implement`, `llm-review`, `llm-analyze`, `llm-check`, `llm-unload`. Overlay sections inside each `SKILL.md` direct main Claude to call these directly — they carry a rich JSON contract, a pre-check LOC-routing hint, and a scope-restricted `write_file` tool for the local model.
9. **Agents.** Installs `gor-mobile-code-reviewer.md` (superpowers `code-reviewer` verbatim, name prefixed) into `~/.claude/agents/`.
10. **MCP registration.** Adds a `google-dev-knowledge` entry to `~/.claude/mcp.json` via `jq`-merge (idempotent — won't duplicate an existing entry).
11. **CLAUDE.md managed section.** Writes a short "Android Mobile Dev (managed by gor-mobile)" block between `<!-- BEGIN gor-mobile managed section -->` / `<!-- END ... -->` markers in `~/.claude/CLAUDE.md`. Content outside the markers is never modified; re-running replaces only the content between them.
12. **Sanity check.** Skipped under `--skip-sanity`. Otherwise pings LM Studio at `http://127.0.0.1:1234/v1/models`; if reachable, lists up to five loaded models and confirms the round-trip works.

## Commands

Setup & maintenance:

```
gor-mobile init              # wizard
gor-mobile doctor            # environment check (add --verbose for hook payload dump)
gor-mobile repair            # restore managed files
gor-mobile update            # pull rules + repair
gor-mobile self-update       # update the CLI (curl-installer path)
gor-mobile uninstall         # clean removal of all artifacts
```

Rules pack:

```
gor-mobile rules list
gor-mobile rules use <url|path>
gor-mobile rules update
gor-mobile rules diff
gor-mobile rules validate
```

Local LLM (primary path — craft-skills scripts):

```
$HOME/.gor-mobile/scripts/llm-check.sh                  # availability probe
$HOME/.gor-mobile/scripts/llm-implement.sh <task-file> \
    <working-dir> "<allowed-paths>" [ref-files...]     # scope-restricted writes
$HOME/.gor-mobile/scripts/llm-agent.sh <prompt> <cwd>   # read-only evidence agent
$HOME/.gor-mobile/scripts/llm-review.sh  ...            # pre-screen large diffs
$HOME/.gor-mobile/scripts/llm-analyze.sh ...            # pre-analysis pass
$HOME/.gor-mobile/scripts/llm-unload.sh                 # free VRAM
```

Legacy (kept for backwards compat with user scripts):

```
gor-mobile llm <role> --input <file>   # role ∈ {impl, tdd-red, routine-debug,
                                       #         review, review-deep, vision, analyze}
gor-mobile llm status
gor-mobile llm routing
gor-mobile llm preset <aggressive-local|balanced|cloud-only>
```

## How delegation works

Skill overlays (e.g. `gor-mobile-subagent-driven-development/SKILL.md`) direct
main Claude to call `$HOME/.gor-mobile/scripts/llm-implement.sh` with a task
file, working directory, comma-separated allowlist of paths the local model
may write to, and optional reference files to pre-load. The script returns
JSON to stdout:

```json
{
  "status":        "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
  "severity":      "none | minor | major",
  "files_changed": ["…"],
  "exports_added": ["…"],
  "concerns":      "…",
  "notes":         "…",
  "deviations":    "…",
  "routing_hint":  "" | "consider-sonnet",
  "routing_hint_reasons": "…"
}
```

Main Claude reads `status` and `routing_hint` to decide: accept, ask for more
context, re-dispatch with a correction, or take over directly. Scope is
hard-enforced — the local model's `write_file` tool refuses anything outside
the allowlist. If LM Studio is unreachable, the script emits
`{"status":"BLOCKED"}` within 2 s and main Claude takes over.

## Rules packs

A rules pack is a git repo with `manifest.json` + `rules/*.md` + `examples/<layer>/*.kt`.
The default pack lives at
[gor-mobile-rules-default](https://github.com/gorban-dev/gor-mobile-rules-default). Fork it
to impose company-specific patterns:

```sh
gor-mobile rules use git@github.com:my-company/gor-mobile-rules-corp.git
```

## Skill registry

Invoke via the `Skill` tool — no slash-commands. Overlay column indicates
which skills carry an Android-rules / local-LLM appendix.

| Skill (name: `gor-mobile-<id>`) | Source | Overlay |
|-|-|-|
| `brainstorming` | superpowers | rules-pack pointer |
| `writing-plans` | superpowers | — |
| `using-git-worktrees` | superpowers | — |
| `subagent-driven-development` | superpowers | rules + `llm-implement.sh` |
| `test-driven-development` | superpowers | rules + `llm-implement.sh` (GREEN stage) |
| `executing-plans` | superpowers | — |
| `dispatching-parallel-agents` | superpowers | — |
| `requesting-code-review` | superpowers | rules + `llm-review.sh` pre-screen |
| `receiving-code-review` | superpowers | — |
| `verification-before-completion` | superpowers | — |
| `systematic-debugging` | superpowers | rules + `llm-agent.sh` (Phase 2) |
| `finishing-a-development-branch` | superpowers | — |
| `using-superpowers` | superpowers | — |
| `writing-skills` | superpowers | — |

Agent: `gor-mobile-code-reviewer` (dispatched via `requesting-code-review`).

## Uninstall

```sh
gor-mobile uninstall    # removes hooks, skills, agents, scripts, managed CLAUDE.md section
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
