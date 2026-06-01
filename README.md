# gor-mobile — Android-aware overlay installer for Claude Code

[![release](https://img.shields.io/github/v/release/gorban-dev/gor-mobile?label=release&color=blue)](https://github.com/gorban-dev/gor-mobile/releases)
[![license](https://img.shields.io/github/license/gorban-dev/gor-mobile)](./LICENSE)
[![homebrew](https://img.shields.io/badge/homebrew-gorban--dev%2Fgor--mobile-orange)](https://github.com/gorban-dev/homebrew-gor-mobile)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]()

A Node/TypeScript CLI that installs an Android/Kotlin-aware overlay on top of Claude Code: a superpowers-style workflow (`brainstorm → plan → implement → review → verify`), a swappable rules pack, and two reviewer agents (Sonnet + Opus). Everything runs on Claude Code itself — no external inference, no local model runtime.

> Status: `v0.2.0` — pre-release scaffolding, under active development on the `develop` branch. See `CHANGELOG.md`.

## Requirements

- Node.js 20+ (`brew install node` on macOS)
- `git`, `curl` on `PATH`
- Supported platforms: `darwin/arm64`, `darwin/x64`, `linux/x64`,
  `win32/x64`. The Google Android CLI is hard-mandatory and Google
  ships installers only for these four.

## Install

Homebrew (recommended on macOS):

```sh
brew install gorban-dev/gor-mobile/gor-mobile
```

npm (global or one-shot):

```sh
npm install -g gor-mobile
# or without installing
npx gor-mobile init
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

`gor-mobile init` drives a 10-step interactive install with `@clack/prompts`:

- **Banner + welcome.** ASCII banner, a 7-bullet summary of what will
  happen, and an Enter-to-start confirmation.
- **Mode select.** `QuickStart` (defaults) or `Advanced` (confirm each step
  and override the rules pack URL).
- **Live progress.** A `●▸○` progress strip and per-item `(i/N)` rows make
  bulk work (14 skills, 2 agents) legible; the rules-pack clone uses a
  single spinner with `Cloning → Resolving → Cloned v1.0.0` phase updates.
- **Outro.** A summary line (skills / agents / hooks / rules-pack
  version) followed by `Next steps` commands.

Everything is idempotent — re-run any time to repair drift; every step
checks current state first and nothing outside the managed sections is
touched.

Flags:
- `--dry-run` prints planned filesystem ops without running them.
- `--yes` / `-y` assumes yes to every prompt (skips welcome + mode-select).
- `--skip-sanity` skips the final summary step.
- `--no-tui` (or `NO_TUI=1`) forces plain-text output even on a TTY.
- `--advanced` forces Advanced mode (per-step confirm, editable rules URL).
- `--rules <git-url>` overrides the default rules pack URL.

The 9 steps:

1. **Base dependencies.** Verifies `git`, `curl`, `node` are on `PATH`. Missing hard deps abort the wizard.
2. **Google Android CLI** (https://developer.android.com/tools/agents) — **hard-mandatory** after v0.1.0. Detects the `android` binary; if absent, installs it: on macOS via the official Homebrew tap (`brew tap android/tap && brew install android-cli`); on other platforms via Google's curl installer. **Unsupported platforms (Linux ARM, FreeBSD, …) cause `init` to fail** with a clear error and a developer.android.com link. Declining the install or a failed install also fails the wizard. Once present, gor-mobile validates a **capability contract** (a set of required command names + a `>= 1.0.0` floor) against whatever version is installed — Google ships android CLI as always-latest/self-updating, so no version is pinned. Then runs `android init` to drop the official `android-cli` skill into `~/.claude/skills/android-cli/`, and prints a hint pointing at `gor-mobile android-skills` to browse the optional skill catalog at runtime.
3. **ast-index CLI (code search)** — **soft check**. Detects the `ast-index` binary in `PATH`. If missing, prints a `warn` row with the install hint (`brew tap defendend/ast-index && brew install ast-index`, see https://github.com/defendend/Claude-ast-index-search) and continues — `init` does NOT fail. The bundled `gor-mobile-ast-index` skill is still installed regardless; the CLI is what makes its commands actually run.
4. **Rules pack.** Clones the default rules pack (or your `--rules <url>`) into `~/.gor-mobile/rules/`. If the directory already has `.git`, runs `git pull --ff-only` instead. Falls back to the minimal bundled `rules-default/` if the clone fails. Records the source URL + ref in `~/.config/gor-mobile/config.json`.
5. **SessionStart + UserPromptSubmit hooks.** Copies `session-start-hook.sh` and `user-prompt-submit-hook.sh` to `~/.gor-mobile/templates/`, then merges matching entries into `~/.claude/settings.json` via pure-JS `JSON.parse` / `JSON.stringify` — your existing `Stop` / `PermissionRequest` / `Notification` / other matchers are preserved untouched. The SessionStart hook injects `gor-mobile-using-superpowers/SKILL.md` as `additionalContext` on each session start. The UserPromptSubmit hook fires on every user prompt and injects a short (~50-word) reminder — counters skills-discipline drift on long conversations.
6. **Skills.** Copies the bundled superpowers skills (plus `gor-mobile-using-android-cli` and `gor-mobile-ast-index`) into `~/.claude/skills/gor-mobile-<skill>/`. Install-time transforms: cross-refs `superpowers:` → `gor-mobile-`, frontmatter id prefix `name: ` → `name: gor-mobile-`, and an optional overlay block appended from `templates/overlays/<skill>.md` for the skills where Android rules, Task(model=...) routing, ast-index guidance, or a fix to a known upstream bug applies (`brainstorming`, `subagent-driven-development`, `test-driven-development`, `executing-plans`, `systematic-debugging`, `requesting-code-review`, `ast-index`).
7. **Agents.** Copies every `templates/agents/*.md` into `~/.claude/agents/` — currently `gor-mobile-code-reviewer.md` (Sonnet, default review path) and `gor-mobile-code-reviewer-deep.md` (Opus, used for large / security-sensitive diffs).
8. **CLAUDE.md managed section.** Writes the "Android Mobile Dev / Android device ops / Code search (managed by gor-mobile)" blocks between `<!-- BEGIN gor-mobile managed section -->` / `<!-- END ... -->` markers in `~/.claude/CLAUDE.md`. Content outside the markers is never modified.
9. **Status line (optional):** choose a Claude Code status line — **Classic**
  (3-line colored usage bars) or **Cat** (ASCII cat that reacts to context
  usage) — or skip. Writes a managed `statusLine` into `~/.claude/settings.json`
  pointing at `~/.gor-mobile/templates/statusline-*.sh`. Needs `jq`. Never
  overwrites a status line you already have without asking.
10. **Summary.** Skipped under `--skip-sanity`. Otherwise reports counts for skills / agents / hooks and the rules-pack version.

## Commands

Setup & maintenance:

```
gor-mobile init              # wizard
gor-mobile doctor            # environment check (--verbose: hook payload; android CLI is required)
gor-mobile repair            # restore managed files; re-runs `android init` if the CLI is installed
gor-mobile android-skills    # browse + install/remove optional Google skills (multi-select)
gor-mobile update            # pull rules + `android update` + repair
gor-mobile self-update       # update the CLI (curl-installer path)
gor-mobile uninstall         # clean removal of gor-mobile; optionally the Android CLI too
```

Rules pack:

```
gor-mobile rules list
gor-mobile rules use <url|path>
gor-mobile rules update
gor-mobile rules diff
gor-mobile rules validate
```

## No automatic git

gor-mobile skills never run `git commit`, `git branch`, `git checkout`,
or `git worktree add` on your behalf. Spec, plan, tests, and
implementation code all accumulate as uncommitted modifications in your
working tree. You review `git status` / `git diff` at your own pace and
commit when you're ready — on whichever branch you want.

If you want a feature branch or an isolated worktree, just say so
and gor-mobile runs the exact git command you asked for — nothing
more. There's no built-in worktree workflow that fires
automatically.

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
| `subagent-driven-development` | superpowers | rules + implementer → Sonnet |
| `test-driven-development` | superpowers | rules + GREEN → Sonnet |
| `executing-plans` | superpowers | task-loop classification (Sonnet / Opus) |
| `dispatching-parallel-agents` | superpowers | — |
| `requesting-code-review` | superpowers | Sonnet reviewer default, Opus reviewer on escalation |
| `receiving-code-review` | superpowers | — |
| `verification-before-completion` | superpowers | — |
| `systematic-debugging` | superpowers | rules + Phase 2 evidence → Sonnet (read-only) |
| `using-superpowers` | superpowers | — |
| `using-android-cli` | gor-mobile (new) | thin orchestrator: delegates to `android` CLI via contract-validated commands; authoritative for Android device ops |
| `ast-index` | upstream `defendend/Claude-ast-index-search` v3.29.1 | Android-only scope, slash-command pointer (`/ast-index:initialize-android`), brew install hint |
| `writing-skills` | superpowers | — |

The 5 phase overlays (`brainstorming`, `executing-plans`,
`systematic-debugging`, `test-driven-development`,
`verification-before-completion`) each carry a one-line pointer at
`[[gor-mobile-using-android-cli]]`, which holds the canonical
phase→command mapping in one place.

Agents:
- `gor-mobile-code-reviewer` — Sonnet, dispatched via `requesting-code-review`.
- `gor-mobile-code-reviewer-deep` — Opus, escalation path for large /
  security-sensitive diffs.

## Uninstall

```sh
gor-mobile uninstall    # removes hooks, skills, agents, rules, config, managed CLAUDE.md section
# Prompts at the end whether to also remove the Android CLI:
#   /usr/local/bin/android (launcher, sudo may be required),
#   ~/.android/bin/android-cli + ~/.android/cli (CLI cache),
#   ~/.claude/skills/android-cli/ (skill from `android init`).
# Your Android SDK / emulator state in ~/.android/ (avd, adbkey, cache, ...)
# is shared with Android Studio and is NOT touched.
brew uninstall gor-mobile
# or
npm uninstall -g gor-mobile
```

## Development

```sh
git clone https://github.com/gorban-dev/gor-mobile.git
cd gor-mobile
npm install
npm run build          # tsup -> dist/cli.js
npm run dev            # tsup --watch
npx tsc --noEmit       # typecheck
./bin/gor-mobile version
```

`dist/` is committed so a plain `git clone` + symlink works without running
`npm run build` first (the install.sh / brew formula both do rebuild, but
the checked-in bundle keeps `brew install` from failing when `npm` is
temporarily offline).

MIT licensed.
