# Changelog

## 0.2.9 — 2026-07-08

- feat: **Examples-first is now a throughline, not a habit.** Field failure
  (mirror of the 0.2.7 docs-first saga, but for *internal* conventions): a
  plan session read `core.md`/`architecture.md` but only the *index* of the
  canonical examples — never `ExampleDataSource.kt` itself — and designed a
  datasource around a backend retry-protocol instruction instead of the
  pack's one-line datasource shape. The review loop could not catch it:
  reviewers verified against the plan, and the existing
  `subagent-driven-development` mandate to pass layer examples to
  implementers was skipped silently (mandate with no verifiable artifact and
  no receiving-side check). This release threads an **examples-first
  ground-truth contract** — the internal twin of docs-first (docs-first owns
  external API signatures; examples-first owns internal placement and shape)
  — through the whole pipeline:
  - `brainstorming` and `writing-plans` overlays gain MANDATORY
    examples-first gates: read the example `.kt` files themselves (not the
    index) for every touched layer; every layer-touching plan task carries a
    verifiable artifact line per touched layer, its path taken verbatim
    from the pack's `index.json` (`Conforms to:
    examples/<layer>/<File>.kt` in the default pack).
  - **Precedence rule** everywhere: external requirements (backend contract,
    ticket, vendor doc) define *behavior*; pack conventions define
    *placement and shape*. Retry logic ships — in the UseCase; the
    datasource stays canonical. Genuine incompatibility → STOP and ask the
    user, never a silent layer redesign.
  - **Absence ladder** (packs are user-replaceable; examples are optional):
    no matching pack example → ground in project precedent
    (`Conforms to (project precedent): <repo paths>` via ast-index) → no
    precedent either → ask the user (`Shape per user: <summary>`). Never
    fabricate a canonical shape from memory of the default pack.
  - `subagent-driven-development`: reference files become a REQUIRED block
    of layer-touching implementer prompts (resolved from the artifact lines
    against the pack root); the spec-compliance reviewer gets the same files
    and checks canonical shape, not just plan fidelity.
  - `requesting-code-review`: layer examples matching the diff (1–3 per
    layer) are loaded into the gor-mobile reviewer's `<review-prompt>`; the
    Codex pass documents its real channel — example paths fold into the
    `adversarial-review` focus phrase, and plain `review` relies on union
    coverage with the gor-mobile pass (its CLI accepts no custom prompt).
    Absence-ladder references (project-precedent files, `Shape per user:`
    lines) travel into the review context too.
  - Reviewer agents (`gor-mobile-code-reviewer{,-deep}` + Codex TOML
    mirrors) gain a **canonical-examples tripwire**: the reviewer runs its
    own `examples/index.json` check; matching examples missing from the
    review context → review-context defect (Important), flagged first among
    the Important findings, then self-repaired by reading the examples
    directly — and a
    false `Canonical examples: none for this diff` claim is part of the
    defect, not a waiver. Absence-ladder references
    (project precedent / `Shape per user:`) get the same receiving-side
    check. A skipped orchestrator mandate is now visible and
    self-correcting.
  - `executing-plans`: the sibling dispatch flow carries the same
    reference-files contract as `subagent-driven-development` — and the
    `test-driven-development` GREEN dispatch resolves its reference files
    from the same artifact lines: all three execution routes are armed.
  - Spec- and plan-document reviewer prompts gain an **Examples grounding**
    checklist row (mirroring 0.2.7's Docs grounding), so a missing artifact
    line is caught at the producing stage, not first at dispatch.
- feat: **ast-index guard — the grep-bypass leak is closed mechanically.**
  Field failure: usages of extension functions were counted with `grep`
  "по инерции" despite six preference-framed ast-index mandates — grep
  found 14 usages where `ast-index usages` finds 24, and `.toPriceFormat()`
  was missed entirely; an undercount carries no marker of wrongness, so no
  prose reviewer can catch it. Unlike previous leaks this one is
  mechanically interceptable, so the fix is a hook, not a seventh mandate:
  a new managed **PreToolUse** hook (`ast-index-guard-hook.sh`; matcher
  `Grep|Bash` on Claude, `Bash` on Codex — Codex ships stable PreToolUse
  with the same exit-2 deny contract but has no Grep tool and intercepts
  only simple shell commands, so the prose contour stays as its backstop)
  **denies** bare-identifier greps in
  ast-index-initialized repos (`.claude/rules/ast-index.md` marker) and
  prints the substitute `ast-index usages/symbol/implementations` command.
  Strictly fail-open where denying would be wrong: literals and resource
  searches (`R\.string\.foo`, globs into `res/`), quoted phrases,
  pattern-less modes (`rg --files`), repos whose ast-index binary is
  missing, and compound commands whose leading segment isn't itself a
  bare-identifier grep — while a structural grep piped to `head`/`wc -l`
  still denies; any parse issue passes. Prose contour hardened to MANDATORY
  (ast-index overlay, CLAUDE.md snippet) and
  `verification-before-completion` gains the counting anchor: "N usages"
  claims are valid only from ast-index. Covered by
  `test/ast-index-guard.test.sh` (deny/allow/fail-open fixtures) in
  `npm test`.
- fix: **Codex reviewer sessions no longer deadlock on — or recurse into —
  the managed `AGENTS.md` section.** Two field failures from one root: the
  section body installed into `~/.codex/AGENTS.md` was a verbatim copy of
  the Claude one, addressed to every Codex session without distinction.
  (1) `adversarial-review` read "Use the `Skill` tool for all workflow
  steps", found no Skill tool in the Codex harness, and refused to review
  at all (`[high] Review blocked by unavailable required workflow tool`,
  zero diff lines read) — exactly on the deep/security passes that escalate
  to adversarial. (2) Plain `review` obeyed the two-pass mandate it found in
  the installed `requesting-code-review` skill and attempted to launch
  codex-companion *from inside* the Codex reviewer session — a recursion
  vector stopped only by an accidental sandbox exit 1, not by design. The
  Codex target now gets its own section body
  (`templates/agents-md-snippet-codex.md`, selected via
  `TargetSpec.instructionsSnippet`): the Skill-tool imperative becomes
  "follow the skills; no skill tool → read the `SKILL.md` directly", and a
  subordinate-session carve-out tells dispatched reviewer/executor sessions
  to do the dispatched job directly and NEVER invoke codex-companion from
  inside a Codex session. Section markers are unchanged — `repair`/
  `uninstall` still locate old installations.

Existing users: run `gor-mobile repair` to refresh the skill overlays,
reviewer agents, the Codex `AGENTS.md` managed section, and install the new
PreToolUse guard hook.

## 0.2.8 — 2026-07-02

- fix: **Greenfield "new app" sessions no longer let a co-installed plugin
  hijack the workflow.** When a user starts a brand-new project in an empty
  directory and describes the app without naming a platform (e.g. "начинаю
  делать приложение для изучения слов… составь план"), `detect-mobile-context`
  returned *not-mobile* (no gradle/xcode markers yet, no `android`/`kotlin`
  keyword in the prompt), so both gor-mobile hooks stayed silent. With the
  upstream `superpowers` plugin also installed, its ungated SessionStart
  injection was then the only skill-steering present and the model invoked
  `superpowers:brainstorming` — bypassing the entire gor-mobile overlay layer
  (docs-first gate, android-cli mapping, no-auto-commit, `.gor-mobile/specs`).
  The detector now has a **third verdict** for exactly this case: build intent
  in a greenfield dir with **no** platform word of any kind (neither mobile nor
  clearly non-mobile) → *ambiguous* (exit 2). The `UserPromptSubmit` hook then
  injects a **platform-check directive** instead of staying silent: it tells the
  model to ASK the user which platform, then route Android/iOS/mobile →
  gor-mobile-\* skills (and drop a `.gor-mobile.json` marker so later turns are
  deterministic), anything else → the user's general workflow (e.g. superpowers).
  Detection is also broadened with safe mobile keywords the old regex missed —
  Cyrillic `андроид`/`котлин`/`свифт`, plus `apk`, `flutter`, `xcode`, `мобильн`,
  `play store` / `app store`. Non-mobile and established projects stay silent as
  before (guarded by an `is_greenfield` check). New `detect-mobile-context`
  tests cover the flashcards scenario and the guards.
- feat: **Debug workflow is docs-first too.** Extends the 0.2.7 docs-first
  throughline into `systematic-debugging`: before forming a hypothesis or
  proposing a fix for anything touching a framework/library/vendor component,
  the overlay now requires reading how it is *supposed* to behave from
  authoritative sources (official docs via `android docs` → resolved artifact →
  source for behavior, per the ground-truth contract in `using-android-cli`) —
  not from training memory. The Phase 3 hypothesis becomes "the docs say X must
  be Y; the code does Z" instead of a remembered guess, with a Red Flag against
  fixing a library symptom from memory.

Existing users: run `gor-mobile repair` to refresh the hooks and skill overlays.

## 0.2.7 — 2026-07-01

Acts on field recommendations from an ARU-8929 session (media3 Compose video
block). Two structural fixes plus three smaller ones — all additive overlay /
prompt prose, no mechanism change.

- feat: **Docs-first is now a throughline, not a habit.** The recurring failure
  was designing/planning/coding against an SDK API from training memory —
  a knowledge-cutoff library (media3 1.10.1) drifts ahead of memory, so the
  first design proposed an XML `PlayerView` and missed a ready-made
  `media3-ui-compose` composable already on the classpath. There was no gate
  forcing real documentation before describing *how* to build a feature. This
  release threads a single **Docs-first ground-truth contract** through the
  whole pipeline:
  - `using-android-cli` gains the contract as the **single source of truth** —
    a ground-truth ladder (official SDK/vendor docs → resolved-artifact
    signatures via `~/.gradle/caches` + `javap -p` when docs lag the pinned
    version → source/decompiled read for *behavior*, since prose like "handles
    aspect ratio" ≠ runtime behavior) plus a Red-Flag table. `android docs` is
    promoted from a Research option to a mandatory precondition.
  - The `brainstorming` (spec) and `writing-plans` (plan) overlays gate on that
    contract per phase: the spec must **cite the source** for every external API
    it commits to; every plan step coding against an SDK API must carry the
    verified signature *and* its source. Designing/planning from memory is
    forbidden.
  - The `subagent-driven-development` overlay propagates the doc-verified
    signatures into the implementer prompt, so the subagent codes against cited
    shapes rather than re-deriving them from memory.
  - Enforcement is anchored deterministically at the review gates: the
    **spec-** and **plan-document reviewer** prompts now check "Docs grounding"
    and flag any external API used without a cited source — so the principle
    can't quietly evaporate as prose between phases.
- fix: **Complete the Codex second-opinion wiring across every review entry
  point.** 0.2.5 made the Codex pass fire reliably — but only for reviews driven
  *through* `requesting-code-review`, where the Codex mandate overlay lives. The
  per-task review in `subagent-driven-development` dispatches
  `Agent(gor-mobile-code-reviewer)` straight from `code-quality-reviewer-prompt.md`,
  never touching that overlay, so the Codex pass was silently skipped whenever
  review was driven from the subagent-driven / executing-plans flow (exactly
  what the 06-25 session hit, post-0.2.5). Now: the `requesting-code-review`
  overlay is marked the single source of truth for Codex and states the
  two-pass Definition of Done applies to **every** entry point; the
  `subagent-driven-development` and `executing-plans` overlays route their
  code-quality review **through** `Skill(gor-mobile-requesting-code-review)`
  instead of a bare Agent dispatch; and `code-quality-reviewer-prompt.md` carries
  a point-of-use MANDATORY header telling the model to detect `$CODEX_COMPANION`
  first and run the pass in the same step. (A deterministic Stop-hook backstop
  is deliberately deferred — it needs its own design.)
- fix: **Plan decomposition respects compile-coupling.** Adding a variant to a
  `sealed`/`enum` read by an exhaustive `when` breaks compilation of every such
  `when` immediately, so the type producer and its mandatory branches are
  compile-coupled and must live in one task (or be sequenced so each task still
  compiles). The `writing-plans` overlay states the rule; the plan reviewer
  watches for the split. Closes the case where an executor was forced outside
  its allowed-paths to keep the build green.
- fix: **Implementer fidelity.** The `subagent-driven-development` overlay now
  instructs the implementer prompt to reproduce calls exactly — matching
  signatures and **not** simplifying modifier chains or dropping parameters
  (e.g. keeping `.padding(horizontal = 16.dp)`), and the spec reviewer compares
  modifier chains / argument lists against the plan verbatim.
- fix: **Figma reads stay narrow.** The `brainstorming` overlay notes to request
  a specific screen/block **node-id** rather than a root node — `get_metadata`
  on a root can overflow context and a root screenshot returns dozens of mockups
  with little signal.

Existing users: run `gor-mobile repair` to refresh the skill overlays and
prompt templates.

## 0.2.6 — 2026-06-22

- fix: **Make the TDD applicability gate actually govern every entry point.**
  The gate that decides whether a change needs a test (UI-flag / wiring →
  *not warranted*) lived only inside the `test-driven-development` overlay, so
  it ran **only if** an agent voluntarily invoked that skill. Meanwhile
  `systematic-debugging` Phase 4 ("Create Failing Test Case — MUST have before
  fixing") and `writing-plans` ("Step 1: Write the failing test") mandate a
  test **unconditionally**. Asymmetry → leak: under load an agent reads the
  hard "MUST", writes a failing test inline, and never opens the door where the
  gate would have said *skip it* — even reshaping a pure-UI bug into a new
  shared seam just to have something unit-testable. This closes the leak at
  every entry point: `systematic-debugging` Phase 4 now makes running the gate
  **MANDATORY before any failing test** (with a Red Flag against the
  "the skill said MUST" bypass and against fabricating a seam); a new
  `writing-plans` overlay bakes the gate's *verdict* into each task instead of a
  blanket test step (and drops baked-in `git commit` steps, per the
  no-automatic-git policy); `executing-plans` and `subagent-driven-development`
  now treat a plan's hardcoded test step as subordinate to the gate; and the
  `test-driven-development` overlay is marked the single source of truth those
  skills route through, with an explicit "gate the minimal fix, not a reshaped
  one" clause. No mechanism changed — the gate already existed; this is a
  prominence/routing fix so it fires without a user nudge. Existing users: run
  `gor-mobile repair` to refresh the skill overlays.

## 0.2.5 — 2026-06-17

- fix: **Make the Codex second-opinion pass actually fire.** The Codex
  review step added in 0.2.4 was worded as an optional, parenthetically
  conditional appendix buried at the end of the `requesting-code-review`
  overlay, so under load an agent would dispatch the gor-mobile reviewer,
  *announce* it would "also check Codex," and then drift off without running
  it. The overlay now: states up front that a complete review is **two
  passes** (gor-mobile reviewer **and**, when the `codex` plugin is present,
  an independent Codex pass — both, every time); reframes the Codex section
  header and opening as **MANDATORY when `$CODEX_COMPANION` resolves** (the
  only opt-out is the plugin being absent); makes companion detection the
  **first** action of the review rather than a deferred "in parallel later"
  side-quest; and adds a Codex-pass Red Flags block forbidding
  announce-then-skip and reporting findings before the Codex pass returns.
  No mechanism changed — detection and dispatch already worked; this is a
  framing/prominence fix so the step fires without a user nudge. Existing
  users: run `gor-mobile repair` to refresh the skill overlays.

## 0.2.4 — 2026-06-16

- add: **Codex second opinion in code review.** When the OpenAI Codex
  *plugin* (`codex@openai-codex`, distinct from the Codex CLI target) is
  installed, the `requesting-code-review` overlay now runs a second,
  independent review pass through it **in addition to** the gor-mobile
  reviewer — normal changes via `codex review`, deep / security-sensitive
  changes via `codex adversarial-review`, mirroring the Sonnet → Opus
  escalation. It detects the plugin's `codex-companion.mjs` (the `review`
  slash commands are `disable-model-invocation: true`, so the script is
  called directly), picks the working-tree vs branch scope to match
  gor-mobile's no-commit-between-tasks model, merges both reports under the
  existing severity policy, and silently no-ops when the plugin is absent or
  the `codex` CLI is not ready. The Codex pass never replaces the gor-mobile
  reviewer. Existing users: run `gor-mobile repair` to refresh the skill
  overlays.

## 0.2.3 — 2026-06-14

- add: **OpenAI Codex CLI support.** gor-mobile now installs the same
  Android workflow into `~/.codex/` (honoring `$CODEX_HOME`) in addition to
  Claude Code's `~/.claude/`. A new **target** abstraction (`claude` | `codex`)
  threads through `init` / `repair` / `uninstall` / `doctor`. Per target the
  installer writes: hooks into the agent's hook file (`settings.json` for
  Claude, a dedicated `hooks.json` for Codex — identical JSON schema), the
  shared `gor-mobile-*` skills into its `skills/` folder, the two reviewer
  agents in the agent-native format (`agents/*.md` for Claude,
  `agents-codex/*.toml` for Codex), and the managed instructions section into
  `CLAUDE.md` / `AGENTS.md`. MCP-prune is a no-op for Codex (no managed
  servers). The shared hook scripts are target-neutral; only
  `session-start-hook.sh` reads the skills folder, now via a new
  `GORM_SKILLS_DIR` env (full backward compatibility for existing Claude
  installs). Existing users: run `gor-mobile repair` to refresh the hook
  scripts and managed sections.
- add: `--target <claude,codex>` flag on `init`, `doctor`, `repair`, and
  `uninstall`. Without it, `init` auto-detects installed agent homes (interactive
  runs show a multiselect pre-checking the detected ones; `--yes` / non-interactive
  defaults to the detected set, or `claude` when none are found). `repair` /
  `doctor` default to targets carrying a gor-mobile footprint, `uninstall` to all
  detected homes. The wizard is now structured as global steps (deps, Android
  CLI, ast-index, rules) followed by one integration section per target.
- add: **Codex status line.** The wizard now offers a recommended Codex TUI
  status line, written into `~/.codex/config.toml` as
  `[tui].status_line = ["model-with-reasoning", "context-used",
  "five-hour-limit", "weekly-limit", "task-progress"]` plus
  `status_line_use_colors = true`. The two lines are merged surgically (the rest
  of `config.toml` is preserved) and tagged `# gor-mobile`, so `repair`
  refreshes them, `uninstall` removes only ours, and `doctor` reports them; a
  status_line you configured yourself is never overwritten without confirmation.
  Offered interactively, skipped under `--yes` (mirrors the Claude status-line
  step).
- note: `android init` is run bare (it provisions the stock `android-cli`
  skill for **all** detected agents — `--agent` is only valid on
  `android skills install`, not `init`), so Codex picks up the stock skill
  automatically when its home exists.

- change: the `gor-mobile-test-driven-development` gate now classifies
  **on-device-only UI-interaction wiring** as non-behavioral (Q1 = NO → *TDD
  not warranted*): swapping / tuning a pre-built Compose `Modifier` (e.g.
  `debounceClickable` ⇄ `clickable`, ripple, click plumbing, padding,
  arrangement), theming, and `@Composable` layout assembly with no logic of
  its own. A difference you can see only by tapping the running app is not a
  JVM input→output, so a unit test is the wrong tool — these route to
  on-device verification instead of a deferred test-debt note. A boundary
  clause keeps real logic inside a handler (computation, branching,
  validation, a state reducer) behavioral (Q1 = YES). Existing users: run
  `gor-mobile repair` to copy the updated overlay into `~/.claude/`.

## 0.2.2 — 2026-06-03

- change: gor-mobile now proactively keeps the Android CLI current. `init` and
  `repair` run an install-method-aware upgrade (`brew upgrade android-cli` for
  brew casks, `android update` for standalone `~/.local/bin` installs), then
  re-validate the capability contract. Best-effort and non-fatal: skipped on
  `--dry-run`, when offline, or via `--skip-android-update` /
  `GOR_MOBILE_SKIP_ANDROID_UPDATE=1`. `doctor`'s below-floor hint now points at
  `gor-mobile repair`. Existing users: `brew upgrade gor-mobile`, then
  `gor-mobile repair`.

## 0.2.1 — 2026-06-03

- change: hooks now inject into the system prompt **only** in a mobile
  (Android/iOS) context, when an opt-in `.gor-mobile.json` marker is present at
  the repo root, or on explicit request (a prompt mentioning `gor-mobile`, or a
  mobile platform word plus a create/build verb). Non-mobile sessions stay clean
  — the `SessionStart` block and the `UserPromptSubmit` turn-reminder are
  suppressed (the hook emits `{}`). Activation is **sticky** for the rest of a
  session once triggered (per-`session_id` flag under `$TMPDIR`). Gating lives
  in a new shared detector `templates/detect-mobile-context.sh` that both hooks
  call; if it is absent (an old install not yet repaired) the hooks fall through
  and inject as before. Skill/agent visibility is unchanged. Existing users: run
  `gor-mobile repair` to copy the detector and the gated hook scripts into
  `~/.gor-mobile/templates/`.

- add: `gor-mobile enable` — writes an opt-in `.gor-mobile.json` marker at the
  current repo root so gor-mobile activates there deterministically (commit it
  to share with the team). `doctor` now also verifies the detector is installed,
  and `doctor --verbose` forces the detector on so it still dumps the hook
  payload.

- change: the `gor-mobile-test-driven-development` skill now applies a **TDD
  applicability gate** before the RED-GREEN-REFACTOR cycle. TDD engages only
  when the change carries behavioral logic **and** the target module has a test
  harness; otherwise it defers (no harness → surface test-debt instead of
  fabricating one) or skips (non-behavioral wiring / config / resources →
  one-line reason), then still routes to `verification-before-completion`. The
  gate keys on the *category* of change, never its size. Lives in the overlay
  (`templates/overlays/test-driven-development.md`); the upstream SKILL.md body
  is untouched. Existing users: run `gor-mobile repair` to pick it up.

## 0.2.0 — 2026-06-01

- fix: hook deduplication no longer leaves duplicate `SessionStart` /
  `UserPromptSubmit` entries. Identity of a managed hook entry was keyed
  solely on the `_managed_by` tag, so any entry written without it (the
  old bash CLI, a manual edit, a format migration, or a broken merge)
  was never collapsed — `init`/`repair` stacked a fresh tagged entry on
  top of the untagged ones, and every extra entry re-injected the full
  hook payload into context on each event. `upsertHook` (and `removeHook`)
  now recognize an entry as managed when it is tagged **or** its command
  points at our `templates/<hook>.sh` (path-independent match), so the
  duplicates self-heal to a single entry on the next `repair`. `doctor`
  stops giving false "NOT registered" advice for untagged hooks and now
  also warns when it finds `N` duplicate managed entries; `repair` logs
  `collapsed N → 1` when it folds duplicates. Existing users: run
  `gor-mobile repair` once to normalize an already-polluted
  `~/.claude/settings.json`. Covered by a new regression test
  (`npm test` → `test/hooks-idempotency.sh`).

- add: optional **Status line** step in `gor-mobile init` (step 9 of 10).
  Offers two Claude Code status lines with inline previews — `Classic`
  (3-line colored bars) and `Cat` (ASCII cat that reacts to context usage) —
  or `Skip`. The chosen variant is written as a managed `statusLine` in
  `~/.claude/settings.json`; both scripts ship in `~/.gor-mobile/templates/`.
  Non-interactive / `--yes` runs skip it, and an existing non-gor-mobile
  `statusLine` is never overwritten without confirmation. `jq` is required to
  render (a missing `jq` warns but does not block). `doctor` reports the
  status line, `repair` re-points a managed one, `uninstall` removes it.
  Existing users: run `gor-mobile repair` after upgrade to copy the new
  template scripts, then re-run `gor-mobile init` to pick a status line.

- add: `ast-index` integration. `gor-mobile init` gains a new step 3 of 10
  (soft check: `which ast-index`) — a missing CLI prints a `warn` and
  the install hint, init continues. A bundled skill
  `gor-mobile-ast-index` ships at
  `~/.claude/skills/gor-mobile-ast-index/SKILL.md` (verbatim upstream
  body v3.29.1 + Android-scoped tail overlay; `references/` carries
  only `android-commands.md` and `module-commands.md`). The three
  process overlays `brainstorming`, `executing-plans`, and
  `systematic-debugging` now instruct Claude to reach for `ast-index`
  before `Grep`/`Read`. Project-level setup (`.claude/rules/ast-index.md`,
  initial `ast-index rebuild`) stays the upstream plugin's job —
  `gor-mobile` does NOT write into any project's `.claude/`. Install the
  CLI separately: `brew tap defendend/ast-index && brew install ast-index`
  (see https://github.com/defendend/Claude-ast-index-search). Existing
  users: run `gor-mobile repair` after upgrade to pick up the new skill
  and refreshed overlays.
- add: `doctor` now reports `ast-index` CLI presence (in Environment,
  status `optional`) and `gor-mobile-ast-index` skill presence (in
  Claude Code integration); both fall back to `warn` with the standard
  `run 'gor-mobile repair'` / brew-tap hint when missing.
- add: the global `~/.claude/CLAUDE.md` managed snippet gains a new
  "Code search (managed by gor-mobile)" rule pointing at
  `[[gor-mobile-ast-index]]` and the `ast-index` CLI. The block is
  inside the existing managed-section markers and is removed cleanly
  by `gor-mobile uninstall`.

- change: Google Android CLI install is now **hard-mandatory** in
  `gor-mobile init` step 2. Declining the install, an install failure,
  or running on an unsupported platform (anything outside
  `darwin/arm64`, `darwin/x64`, `linux/x64`, `win32/x64`) now fails the
  wizard with a clear error. Auto-install now covers Mac Intel and
  Windows in addition to Mac ARM and Linux x64. `doctor` reports a
  missing `android` binary as `(required)` (was `optional`). Existing
  users: run `gor-mobile init` (or `gor-mobile repair`) after upgrade.
- add: new bridge skill `gor-mobile-using-android-cli` ships at
  `~/.claude/skills/gor-mobile-using-android-cli/SKILL.md`. It maps
  workflow phases (brainstorm/plan/execute/debug/verify) to specific
  `android` CLI commands (`docs search`, `describe`, `run`,
  `screen capture --annotate`, `layout --diff`, journeys, etc.) and is
  authoritative for Android device ops — replacing direct `adb` /
  `./gradlew` invocations for Android targets.
  The 5 phase overlays (`brainstorming`, `executing-plans`,
  `systematic-debugging`, `test-driven-development`,
  `verification-before-completion`) point at it. The SessionStart
  addendum and `~/.claude/CLAUDE.md` managed snippet also reference it.
  Existing users: run `gor-mobile repair` to install the bridge skill
  and refresh the overlays.
- add: new `gor-mobile android-skills` command — interactive
  multi-select that lists Google's upstream catalog
  (`android skills list`) and installs/removes entries via
  `android skills add --agent=claude-code --skill=<name>` /
  `android skills remove …`. Initial selection reflects currently
  installed skills (detected via `~/.claude/skills/<name>/SKILL.md`).
  The wizard now prints a hint at this command after `android init`
  completes.
- add: `doctor` now checks for the
  `gor-mobile-using-android-cli` bridge skill at
  `~/.claude/skills/gor-mobile-using-android-cli/SKILL.md`; reports
  `[warn] gor-mobile-using-android-cli skill missing — run 'gor-mobile repair'`
  if absent.
- add: the global `~/.claude/CLAUDE.md` managed snippet now carries an
  "Android device ops (managed by gor-mobile)" rule pinning Android
  device ops to the `android` CLI / bridge skill. The block is wrapped
  by the existing managed-section markers and is removed cleanly by
  `gor-mobile uninstall`.

- change: Android CLI integration redesigned around a **capability contract** (command
  names + `>= 1.0.0` floor) instead of version pinning — Google ships android CLI
  as always-latest, so a pin is neither possible nor aligned with their model.
- change: Install now uses the official Homebrew tap (`brew tap android/tap`) on macOS.
- change: Bridge skill `using-android-cli` rewritten as a thin orchestrator: no
  duplicated flags, no hardcoded skill catalog, no deep-links into the stock skill.
- change: `doctor` now validates the contract (floor + command existence + skill↔contract lint).

**Requires `gor-mobile repair`** to pick up the rewritten bridge skill.

## 0.1.1 — 2026-05-18

- fix: UserPromptSubmit hook template no longer breaks on an embedded
  apostrophe in `user's`. Bash was closing the single-quoted reminder
  string mid-content, which surfaced as `behalf.: command not found`
  warnings on every prompt submission (non-blocking, but noisy). The
  phrasing is now `on behalf of the user`, which carries the same
  meaning without the quoting hazard. Existing users: run
  `gor-mobile repair` to pick up the fix.
- fix: `scripts/release.sh` now bumps `package.json`, `src/constants.ts`,
  and `README.md` and rebuilds `dist/` before tagging. The previous
  script referenced a non-existent `lib/constants.sh` path left over from
  the original bash prototype, and silently failed (`sed: lib/...: No
  such file or directory`) without bumping anything.

## 0.1.0 — 2026-05-14

First tagged release.

- change: code-reviewer dispatch now compares the working tree against
  the base branch (`git diff <BASE_REF>`) instead of the upstream
  `BASE_SHA..HEAD_SHA` commit range. Since gor-mobile cycles never
  auto-commit, the SHA range was usually empty; the working-tree diff
  shows every change the user has accumulated (committed on the branch
  + uncommitted). The overlay also skips dispatch entirely when the
  diff is empty, so reviewer subagents aren't burned on no-op tasks.
  The reviewer agents themselves are unchanged. Existing users: run
  `gor-mobile repair`.
- remove: all automatic git operations (`commit`, `branch`, `checkout`,
  `worktree add`) from skill overlays and the UserPromptSubmit reminder.
  Spec, plan, tests, and implementation code now accumulate as
  uncommitted modifications in the working tree across the full
  `brainstorming → writing-plans → executing-plans → TDD →
  finishing-a-development-branch` cycle. The user reviews `git diff`
  and commits at their own discretion, on whichever branch they want.
  The `gor-mobile-using-git-worktrees` and
  `gor-mobile-finishing-a-development-branch` skills remain installed
  and can be invoked explicitly when the user wants them. Existing
  users: run `gor-mobile repair` to refresh the overlays and the
  UserPromptSubmit hook.
- add: wizard step 2 and `gor-mobile repair` now run `android init` when
  the `android` binary is on `PATH`. This drops the official Google
  `android-cli` skill into `~/.claude/skills/android-cli/SKILL.md`, so
  Claude gets the full command reference in-session instead of only the
  binary being detected. `gor-mobile doctor` now surfaces a warning when
  the skill is missing but the CLI is installed. Existing users: run
  `gor-mobile repair`.
- add: when the `android` binary is absent, wizard step 2 now offers to
  run Google's official installer
  (`curl -fsSL https://dl.google.com/android/cli/latest/darwin_arm64/install.sh | bash`)
  instead of just opening the install page in a browser. The installer
  drops a ~5 MB launcher into `/usr/local/bin/android` (may prompt for
  sudo) and the launcher lazily fetches the full CLI on first run. Under
  `--yes` install proceeds without prompt; under `--dry-run` the command
  is printed but not executed. Auto-install is supported on ARM macOS and
  x86_64 Linux; other platforms get a manual-install note pointing to
  https://developer.android.com/tools/agents. The "Android CLI missing"
  note now includes a `Learn more:` link so users know what they're
  installing before they accept.
- add: `gor-mobile update` now also runs `android update` when the CLI
  is on `PATH`, so a single `gor-mobile update` keeps the rules pack, the
  Android CLI launcher, and gor-mobile's managed files (skills, agents,
  hooks, CLAUDE.md section) in sync.
- add: `gor-mobile uninstall` now prompts at the end whether to also
  remove the Android CLI. If confirmed, it removes the launcher
  (`/usr/local/bin/android`, sudo-escalates if needed), the cached full
  CLI (`~/.android/bin/android-cli`), the CLI cache
  (`~/.android/cli/`), and the `android-cli` skill
  (`~/.claude/skills/android-cli/`). Shared Android SDK state in
  `~/.android/` (avd, adbkey, cache, …) is intentionally left untouched.
  Under `--yes` the Android CLI is **not** removed (no implicit sudo).
- remove: google-dev-knowledge MCP registration step from the wizard. Docs
  lookup now relies on the `android` CLI + `gor-mobile docs`. Existing
  users: run `gor-mobile repair` — it will prune the managed entry from
  `~/.claude/mcp.json`.