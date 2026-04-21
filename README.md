# gor-mobile — Android-aware overlay installer for Claude Code

[![release](https://img.shields.io/github/v/release/gorban-dev/gor-mobile?label=release&color=blue)](https://github.com/gorban-dev/gor-mobile/releases)
[![license](https://img.shields.io/github/license/gorban-dev/gor-mobile)](./LICENSE)
[![homebrew](https://img.shields.io/badge/homebrew-gorban--dev%2Fgor--mobile-orange)](https://github.com/gorban-dev/homebrew-gor-mobile)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]()

A bash CLI that installs an Android/Kotlin-aware overlay on top of Claude Code: a superpowers-style workflow (`brainstorm → plan → implement → review → verify`), a swappable rules pack, and two reviewer agents (Sonnet + Opus). Everything runs on Claude Code itself — no external inference, no local model runtime.

> Status: `v0.1.0` — pre-release scaffolding, under active development on the `develop` branch. See `CHANGELOG.md`.

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

`gor-mobile init` runs 9 idempotent steps. Re-run anytime to repair drift — every step checks current state first, and nothing outside the managed sections is ever touched.

Flags: `--dry-run` prints what would change; `--yes` / `-y` assumes yes to every prompt (non-interactive); `--skip-sanity` skips the final summary step; `--no-tui` (or `NO_TUI=1`) forces plain-text prompts even when the gum TUI is available; `--rules <git-url>` overrides the default rules pack URL.

1. **Base dependencies.** Verifies `git`, `curl`, `jq` are on PATH; warns if `brew` is missing. Missing hard deps abort the wizard.
2. **Google Android CLI agent** (https://developer.android.com/tools/agents). Detects the `android` binary. If absent, prints a short explanation of what the CLI is and why `gor-mobile` needs it, then offers to open the install page in your default browser and waits for you to finish the install before re-detecting.
3. **Rules pack.** Clones the default rules pack (or your `--rules <url>`) to `~/.gor-mobile/rules/`. If the directory already has `.git`, runs `git pull --ff-only` instead. Falls back to the minimal bundled `rules-default/` if the clone fails. Records the source URL + ref in `~/.config/gor-mobile/config.json`.
4. **SessionStart + UserPromptSubmit hooks.** Copies `session-start-hook.sh` and `user-prompt-submit-hook.sh` to `~/.gor-mobile/templates/`, then `jq`-merges matching entries into `~/.claude/settings.json` — your existing `Stop` / `PermissionRequest` / `Notification` / other matchers are preserved untouched. The SessionStart hook mirrors the superpowers hook shape: it reads `gor-mobile-using-superpowers/SKILL.md` on every session start and injects it as `additionalContext` (no Android project gate). The closing `</EXTREMELY_IMPORTANT>` tag sits directly after the skills-discipline rules; Android rules-pack context lives in a sibling `<gor-mobile-android-addendum>` block so it doesn't dilute the skills signal. The UserPromptSubmit hook fires on every user prompt and injects a short (~50-word) reminder — counters skills-discipline drift on long conversations where the single SessionStart injection fades.
5. **Skills.** Copies 14 verbatim superpowers skills into `~/.claude/skills/gor-mobile-<skill>/`. Install-time transforms: `sed 's/superpowers:/gor-mobile-/g'` on cross-references, `sed 's/^name: /name: gor-mobile-/'` on the frontmatter id, and an optional overlay block appended from `templates/overlays/<skill>.md` for the 6 skills where Android rules, Task(model=...) routing, or a fix to a known upstream bug applies (`brainstorming`, `subagent-driven-development`, `test-driven-development`, `executing-plans`, `systematic-debugging`, `requesting-code-review`).
6. **Agents.** Copies every `templates/agents/*.md` file into `~/.claude/agents/` — currently `gor-mobile-code-reviewer.md` (Sonnet, default review path) and `gor-mobile-code-reviewer-deep.md` (Opus, used for large / security-sensitive diffs).
7. **MCP registration.** Adds a `google-dev-knowledge` entry to `~/.claude/mcp.json` via `jq`-merge (idempotent — won't duplicate an existing entry).
8. **CLAUDE.md managed section.** Writes a short "Android Mobile Dev (managed by gor-mobile)" block between `<!-- BEGIN gor-mobile managed section -->` / `<!-- END ... -->` markers in `~/.claude/CLAUDE.md`. Content outside the markers is never modified; re-running replaces only the content between them.
9. **Summary.** Skipped under `--skip-sanity`. Otherwise reports installed skills count, agents count, and the rules-pack version.

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

## How delegation works

Skill overlays (e.g. `gor-mobile-subagent-driven-development/SKILL.md`)
direct the main orchestrator (Opus) to dispatch routine coding work to
Sonnet via Claude Code's own `Task` tool:

```
Task(
  subagent_type = "general-purpose",
  model         = "sonnet",
  prompt        = <task-prompt-with-allowed-paths-and-references>
)
```

The prompt carries an explicit allowed-paths list, 1–3 reference files from
the rules pack, and the exact verification step the orchestrator will run
afterwards. Opus stays in control of design decisions, verification, and
anything the plan marks as "human review required". The Sonnet reviewer
(`gor-mobile-code-reviewer`) handles routine reviews; the Opus reviewer
(`gor-mobile-code-reviewer-deep`) takes large / security-sensitive diffs
and explicit deep-review asks.

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
which skills carry an Android-rules / Task(model=...) appendix.

| Skill (name: `gor-mobile-<id>`) | Source | Overlay |
|-|-|-|
| `brainstorming` | superpowers | rules-pack pointer |
| `writing-plans` | superpowers | — |
| `using-git-worktrees` | superpowers | — |
| `subagent-driven-development` | superpowers | rules + implementer → Sonnet |
| `test-driven-development` | superpowers | rules + GREEN → Sonnet |
| `executing-plans` | superpowers | task-loop classification (Sonnet / Opus) |
| `dispatching-parallel-agents` | superpowers | — |
| `requesting-code-review` | superpowers | Sonnet reviewer default, Opus reviewer on escalation |
| `receiving-code-review` | superpowers | — |
| `verification-before-completion` | superpowers | — |
| `systematic-debugging` | superpowers | rules + Phase 2 evidence → Sonnet (read-only) |
| `finishing-a-development-branch` | superpowers | merge-mode sub-choice (full / squash-to-working-tree / squash-to-commit) |
| `using-superpowers` | superpowers | — |
| `writing-skills` | superpowers | — |

Agents:
- `gor-mobile-code-reviewer` — Sonnet, dispatched via `requesting-code-review`.
- `gor-mobile-code-reviewer-deep` — Opus, escalation path for large /
  security-sensitive diffs.

## Uninstall

```sh
gor-mobile uninstall    # removes hooks, skills, agents, rules, config, managed CLAUDE.md section
brew uninstall gor-mobile
```

## Development

```sh
git clone https://github.com/gorban-dev/gor-mobile.git
cd gor-mobile
```

MIT licensed.
