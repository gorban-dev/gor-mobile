# gor-mobile — Android-aware overlay installer for Claude Code and Codex

[![release](https://img.shields.io/github/v/release/gorban-dev/gor-mobile?label=release&color=blue)](https://github.com/gorban-dev/gor-mobile/releases)
[![license](https://img.shields.io/github/license/gorban-dev/gor-mobile)](./LICENSE)
[![homebrew](https://img.shields.io/badge/homebrew-gorban--dev%2Fgor--mobile-orange)](https://github.com/gorban-dev/homebrew-gor-mobile)
[![platform](https://img.shields.io/badge/platform-macOS%20%7C%20Linux-lightgrey)]()

A Node/TypeScript CLI that installs an Android/Kotlin-aware overlay on top of Claude Code **and OpenAI Codex CLI**: a superpowers-style workflow (`brainstorm → plan → implement → review → verify`), a swappable rules pack, and two reviewer agents (Sonnet + a deep one on the session's main model). Everything runs on the host agent itself — no external inference, no local model runtime.

Two-level install (since v0.3.0): `gor-mobile setup` provisions the machine once (`~/.gor-mobile/` rules + hook scripts, the Android CLI, and the user-level Codex workflow under `~/.codex/`, honoring `$CODEX_HOME`); `gor-mobile init` installs the Claude workflow **per repo** under `<repo>/.claude/`. Skills are shared (cross-compatible `SKILL.md`); hooks, reviewer agents, and the global-instructions handling adapt to each agent's format. See [Targets](#targets-claude--codex).

> Status: `v0.3.2` — pre-release scaffolding, under active development on `main`. See `CHANGELOG.md`.

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

Then set the machine up once, and initialize each mobile repo:

```sh
gor-mobile setup            # once per machine
cd ~/code/my-android-app
gor-mobile init             # once per repo
```

## Two levels: `setup` (machine) and `init` (repo)

Since v0.3.0 the Claude workflow installs **per-project**. Global installs put
14 skills + 2 agents + 3 hooks into *every* Claude session — mobile or not.
The split confines the payload to repos that opted in with `gor-mobile init`;
non-mobile sessions load nothing. Codex has no project scope, so its install
stays user-level under `~/.codex/` and is provisioned by `setup`.

### `gor-mobile setup` — once per machine

Machine-wide prerequisites, nothing per-repo:

1. **Base dependencies.** Verifies `git`, `curl`, `node` on `PATH`; warns if `jq` is missing (needed by the status line and the ast-index guard).
2. **Google Android CLI** (https://developer.android.com/tools/agents) — **hard-mandatory**. Detects the `android` binary; if absent, installs it (macOS: `brew tap android/tap && brew install android-cli`; other platforms: Google's curl installer). Unsupported platforms fail with a clear error. Once present, validates a **capability contract** (required command names + a `>= 1.0.0` floor) against whatever version is installed — Google ships android CLI as always-latest, so no version is pinned.
3. **ast-index CLI** — **soft check**. Detects `ast-index` on `PATH`; if missing, prints the install hint (`brew tap defendend/ast-index && brew install ast-index`) and continues. `setup` never fails on it.
4. **Rules pack + hook scripts.** Clones the default pack (or `--rules <url>`) into `~/.gor-mobile/rules/` (`git pull --ff-only` if already cloned), records the source in `~/.config/gor-mobile/config.json`, and copies the shared hook scripts + the workflow-pointers snippet into `~/.gor-mobile/templates/`.
5. **Claude status line (optional).** Classic (colored usage bars) or Cat (ASCII cat) or skip — a managed `statusLine` in `~/.claude/settings.json`. Never overwrites an existing one without asking.
6. **Codex integration (user-level).** If `~/.codex/` exists (or `--target codex`): hooks → `hooks.json`, skills, TOML agents, the `AGENTS.md` managed section, `android init`, and the Codex status line — the full workflow, since Codex can't scope to a project.

Flags: `--dry-run`, `--yes`/`-y`, `--no-tui`, `--advanced` (per-step confirm + editable rules URL), `--rules <url>`, `--skip-android-update`, `--target codex`.

### `gor-mobile init` — once per repo, from its root

Installs the workflow into the current repository, locally (nothing committed):

```
<repo>/
  .claude/skills/gor-mobile-*/     # 14 skills (superpowers transforms + overlays)
  .claude/skills/android-cli/      # stock Google skill (from `android init`)
  .claude/agents/gor-mobile-code-reviewer{,-deep}.md
  .claude/settings.local.json      # SessionStart + UserPromptSubmit + PreToolUse hooks
                                   # + enabledPlugins: superpowers disabled for this repo
                                   # + showClearContextOnPlanAccept: plan-approval clear-context option
  .gor-mobile.json                 # marker: platform, version, install date
```

- Hooks reference `~/.gor-mobile/templates/*.sh` by absolute path; `settings.local.json` is never committed by Claude Code, so no foreign-path problem. The **PreToolUse ast-index guard** denies bare-identifier `grep`/`rg` in ast-indexed repos (`.claude/rules/ast-index.md` present) and fails open otherwise.
- No `CLAUDE.md` managed section: the former workflow pointers are injected by the SessionStart hook, keyed on the `.gor-mobile.json` marker (walk up from cwd). A repo with no marker injects nothing.
- `superpowers@claude-plugins-official` is disabled in `settings.local.json` so the bundled upstream skills don't duplicate the `gor-mobile-*` copies. `--plugins figma,swagger-android,…` additionally enables named plugins for the repo.
- `showClearContextOnPlanAccept` is enabled in `settings.local.json`: the writing-plans handoff exits through the plan-approval dialog, whose first option ("Yes, clear context") clears the planning context exactly once; the SessionStart hook then rehydrates execution from the `.gor-mobile/state/*.progress.md` checkpoint. Tracked in `.gor-mobile.json` `managed_settings`, removed on `uninstall --project` unless it was already on. Without plan-mode tools the skill falls back to a two-option dialog + manual `/clear` (Codex: `/compact`).
- `.claude/`, `.gor-mobile/`, and `.gor-mobile.json` are added to `.git/info/exclude` (local ignore — no repo diff). If the folder is not a git repo, `init` offers `git init`; declining falls back to a committed `.gitignore` with a warning.
- **Greenfield**: in an empty folder with no build markers, `init` asks the platform (Android / iOS) instead of guessing, then points you at `claude` to scaffold the project.
- Idempotent: re-running refreshes copies and bumps the marker version.

Flags: `--dry-run`, `--yes`/`-y`, `--no-tui`, `--platform android|ios`, `--plugins <list>`.

## Commands

Setup & maintenance:

```
gor-mobile setup             # machine setup (once): android CLI, rules, hooks, Codex
gor-mobile init              # install the workflow into the current repo (--platform, --plugins)
gor-mobile doctor            # check machine + this project + Codex (--verbose: hook payload)
gor-mobile repair            # refresh machine hook scripts, this project, and Codex
gor-mobile migrate           # remove a legacy v0.2.x global install (keeps the rules pack)
gor-mobile android-skills    # browse + install/remove optional Google skills (multi-select)
gor-mobile update            # pull rules + `android update` + repair
gor-mobile self-update       # update the CLI (curl-installer path)
gor-mobile uninstall         # --project (this repo) or --machine (user homes + ~/.gor-mobile)
```

`doctor` and `repair` are two-mode: they always cover the machine
(`~/.gor-mobile`) and Codex (if `~/.codex/` exists), plus the project in the
current directory when it carries a `.gor-mobile.json` marker. `init`/`doctor`/
`repair`/`update` refuse to run on top of a legacy v0.2.x global install until
`gor-mobile migrate` clears it.

## Migrating from 0.2.x

v0.2.x installed globally into `~/.claude`. v0.3.0 is per-project. Migrate once:

```sh
brew upgrade gor-mobile        # or: npm i -g gor-mobile / self-update
gor-mobile migrate             # remove the old global footprint (keeps ~/.gor-mobile)
gor-mobile setup               # refresh machine-level prerequisites
cd ~/code/my-android-app
gor-mobile init                # per repo — repeat in each mobile project
```

`migrate` clears `~/.claude` (skills, agents, hooks, managed `CLAUDE.md`
section, managed MCP) and any co-installed `~/.codex` footprint, then asks
before removing a status line. It keeps `~/.gor-mobile` (the rules pack the new
model reads) and the CLI itself. It is idempotent — on a clean machine it prints
"nothing to migrate".

Rules pack:

```
gor-mobile rules list
gor-mobile rules use <url|path>
gor-mobile rules update
gor-mobile rules diff
gor-mobile rules validate
```

## Targets (`claude` | `codex`)

gor-mobile installs the same Android workflow into Claude Code and OpenAI Codex
CLI. Claude installs **per repo** (`<repo>/.claude/`, via `gor-mobile init`);
Codex installs **user-level** (`~/.codex/`, honoring `$CODEX_HOME`, via
`gor-mobile setup`) because it has no project scope. What differs per agent is
only the on-disk format — the skills themselves are identical (cross-compatible
`SKILL.md`):

| Concern | Claude Code (`<repo>/.claude/`) | Codex (`~/.codex/`) |
|---------|----------------------------------|----------------------|
| Hooks | `settings.local.json` → `hooks` | `hooks.json` (identical JSON schema) |
| Skills | `skills/gor-mobile-*/SKILL.md` | `skills/gor-mobile-*/SKILL.md` |
| Reviewer agents | `agents/*.md` (Markdown + YAML) | `agents/*.toml` (`developer_instructions`) |
| Global instructions | injected by SessionStart hook (no file written) | `AGENTS.md` managed section |
| Status line | — (user-level, set by `setup`) | `config.toml` `[tui].status_line` (built-in items) |
| Plugin overrides | `settings.local.json` `enabledPlugins` (superpowers off) | — |

The Codex status line is a built-in component list rather than a command-backed
script: gor-mobile writes a recommended default into `~/.codex/config.toml` —
`tui.status_line = ["model-with-reasoning", "context-used", "five-hour-limit",
"weekly-limit", "task-progress"]` plus `status_line_use_colors = true` — merged
in surgically (everything else in `config.toml` is preserved) and tagged with a
`# gor-mobile` marker so `repair` refreshes it and `uninstall` removes only our
lines. A status_line you already configured yourself is never overwritten
without confirmation. Offered interactively in the wizard, skipped under
`--yes`.

The shared hook scripts live once in `~/.gor-mobile/templates/` and are
target-neutral; the SessionStart hook reads its skills folder from
`GORM_SKILLS_DIR` when set (the Codex hook command sets it → always-on,
user-level). A bare command (Claude) is the per-project signal: the hook walks
up from the cwd to a `.gor-mobile.json` marker and injects from
`<repo>/.claude/skills`, staying silent when there is no marker. The Google
Android CLI is installed once by `setup`; for Claude, `init` copies the stock
`android-cli` skill into the repo's `.claude/skills/` and drops the home copy,
while Codex keeps its user-level copy from `setup`.

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
direct the main orchestrator (the session's main model) to dispatch routine
coding work to Sonnet via Claude Code's own `Task` tool:

```
Task(
  subagent_type = "general-purpose",
  model         = "sonnet",
  prompt        = <task-prompt-with-allowed-paths-and-references>
)
```

The prompt carries an explicit allowed-paths list, 1–3 reference files from
the rules pack, and the exact verification step the orchestrator will run
afterwards. The orchestrator stays in control of design decisions,
verification, and anything the plan marks as "human review required". Each
task gets one combined review (spec compliance + code quality in a single
pass): the Sonnet reviewer (`gor-mobile-code-reviewer`) handles routine
reviews, with a `haiku` downgrade for non-behavioral tasks; the deep reviewer
(`gor-mobile-code-reviewer-deep`, `model: inherit` — the session's main
model) takes large / security-sensitive diffs, explicit deep-review asks,
and the cross-task-focused final review of a plan. When the OpenAI Codex plugin
(`codex@openai-codex`) is installed, `requesting-code-review` adds a second,
independent pass through Codex (standard `review`, or `adversarial-review`
on the same escalation trigger) and merges its findings — a cross-model
second opinion, never a replacement for the gor-mobile reviewer.

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
| `executing-plans` | superpowers | task-loop classification (Sonnet / session model) |
| `dispatching-parallel-agents` | superpowers | — |
| `requesting-code-review` | superpowers | Sonnet reviewer default, deep reviewer (session model) on escalation and for the final plan review; optional Codex second opinion when `codex@openai-codex` is installed |
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
- `gor-mobile-code-reviewer-deep` — session model (`model: inherit`),
  escalation path for large / security-sensitive diffs and the final
  full-implementation review of a plan.

## Uninstall

```sh
gor-mobile uninstall --project   # this repo: .claude footprint + .gor-mobile.json + exclude lines
gor-mobile uninstall --machine   # user homes (~/.claude, ~/.codex) + ~/.gor-mobile + config
gor-mobile uninstall             # no flag: asks which (defaults to --machine under --yes)
# --machine prompts at the end whether to also remove the Android CLI:
#   /usr/local/bin/android (launcher, sudo may be required),
#   ~/.android/bin/android-cli + ~/.android/cli (CLI cache),
#   skills/android-cli/ (skill from `android init`).
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
