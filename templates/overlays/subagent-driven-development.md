<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to (never override) it
when the target is an Android/Kotlin codebase:

### Architecture rules (delta 1)
Before dispatching the implementer subagent, load rules from
`$HOME/.gor-mobile/rules/`:

- `manifest.json` → `.sections` — map of section-name to file path. Always
  load `core` and `architecture`. Additionally load sections relevant to
  the task (testing-*, debug-*, theme-system, base-viewmodel, modification).
- `examples/index.json` → `.layers` — canonical example `.kt` files per
  layer (presentation, usecase, repository, data, di in the default pack).
  Pass 1-3 to the implementer prompt as reference files.

Rules-pack is user-replaceable via `gor-mobile rules use <url>` — read from
manifest, never hardcode filenames.

### Model assignment

The implementer subagent runs on Sonnet via Claude Code's own Task tool —
no external inference, no local model. Dispatch:

    Task(
      subagent_type = "general-purpose",
      model         = "sonnet",
      prompt        = <implementer-prompt>
    )

The `<implementer-prompt>` must contain:
- **Allowed paths** — exact file paths (Create + Modify + Test) the task
  targets. The subagent is instructed to refuse writes outside this list.
- **Reference files** — 1–3 examples from
  `$HOME/.gor-mobile/rules/examples/` matching the layer the task touches
  (presentation / usecase / repository / data / di), plus the architecture
  section from `manifest.json → .sections.architecture`.
- **Verification step** — the exact Gradle command the orchestrator will
  run after the subagent returns (e.g.
  `./gradlew :<module>:test --tests "*<Name>Test*"`).
- **Doc-verified API references** — for every SDK / library / vendor API the
  task calls, the exact signature *and its source* (docs excerpt, `javap`
  output, or source ref) carried down from the plan's docs-first research
  (see the contract in `[[gor-mobile-using-android-cli]]`). The subagent codes
  against these, never against a remembered signature. Do not hand a subagent
  a task that names an external API without its verified shape.
- **Fidelity note** — instruct the subagent to reproduce the task's calls
  exactly: match signatures and **do not simplify modifier chains or drop
  parameters** (e.g. keep `.padding(horizontal = 16.dp)` when the task
  specifies it). Restating code from a paraphrase is where standard widths,
  paddings, and named arguments silently vanish.

**Escalate to Opus** (`model = "opus"`) when any of:
- The task carries a design decision (plan marks it as "design" or
  "human review required").
- The subagent returns blocked/failed twice on the same scope.
- Scope exceeds 6 files or crosses module boundaries unpredictably.

Surface-level checks (lint-like summaries, "does this file compile-look
right") can drop to `model = "haiku"` when explicitly called out.

Always run the verification step yourself (orchestrator) after the
subagent returns — do not trust its self-report. A Sonnet "DONE" without
a passing Gradle run is not DONE.

Tests are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

### TDD step is gated (delta)

Before putting a **Test** path into the implementer prompt's allowed-paths, run
the **TDD applicability gate** (`[[gor-mobile-test-driven-development]]`) for
that task's change. Verdict **not warranted** (UI-flag / wiring / DI /
resources — no behavioral logic) → omit the test from the prompt, record
`TDD skipped: <reason>`, and rely on the verification step instead. A plan that
hardcodes a test step does not override the gate; never instruct a subagent to
fabricate a test — or a new seam to test — for a non-behavioral change.

Doc paths land in the gitignored project-local workspace:
`.gor-mobile/specs/YYYY-MM-DD-<topic>-design.md`
`.gor-mobile/plans/YYYY-MM-DD-<feature>.md`.

### Override: no automatic commits, branches, or worktrees

Never run `git commit`, `git branch`, `git checkout`, or
`git worktree add` between subagent tasks. Implementer-task diffs
accumulate as uncommitted modifications in the working tree across
the entire plan. The user reviews `git diff` and commits / branches /
pushes at their own discretion. If the user explicitly asks for a
worktree or branch, run the requested git command — otherwise do
nothing.

### Review routing — the code-quality stage goes THROUGH requesting-code-review

The process has two review stages per task. They route differently, and the
distinction is load-bearing for the Codex second opinion:

- **Spec-compliance review** (`./spec-reviewer-prompt.md`) — dispatch directly.
  It checks the code against the task spec; no second model family needed. This
  is also the gate that catches dropped modifiers / parameters (see Fidelity
  note above) — have it compare modifier chains and argument lists against the
  plan **verbatim**.
- **Code-quality review** — do **NOT** dispatch `Agent(gor-mobile-code-reviewer)`
  bare from this flow. A bare Agent dispatch reads `code-quality-reviewer-prompt.md`
  and never touches the `requesting-code-review` overlay, so it **silently skips
  the mandatory Codex pass**. Instead invoke
  `Skill(gor-mobile-requesting-code-review)`, which **owns the two-pass mandate**
  (gor-mobile reviewer + Codex when `$CODEX_COMPANION` resolves) and orchestrates
  the `Agent(gor-mobile-code-reviewer)` / `-deep` call itself. The **final
  full-implementation review** (after all tasks) routes the same way.

**Definition of done for a code-quality review:** it is not complete — and its
findings are not reported — until *both* passes have returned: the gor-mobile
reviewer and Codex (when the plugin is present). Reporting quality-review
results from the bare Agent pass alone is a review failure.

**Tool disambiguation** (upstream bug obra/superpowers#1077): `requesting-code-review`
and `writing-plans` are **Skills** (invoke via the `Skill` tool);
`gor-mobile-code-reviewer` / `gor-mobile-code-reviewer-deep` are **Agents**
(dispatch via the `Agent` tool with `subagent_type`). If you see
`{"status":"Agent type not found"}` for a review step, the dispatch went to the
wrong tool — retry via `Skill(gor-mobile-requesting-code-review)`.

<!-- END gor-mobile overlay -->