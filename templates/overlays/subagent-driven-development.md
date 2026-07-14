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
  layer (presentation, usecase, repository, data, di in the default pack;
  layer membership always comes from the *current* pack's index, never a
  remembered default list). For every layer-touching task these form a
  REQUIRED block of the implementer prompt, resolved from the task's
  `Conforms to:` artifact line(s) — one per touched layer; see Reference
  files below.

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
- **Reference files (REQUIRED for layer-touching tasks)** — every file named
  across the task's artifact lines (one per touched layer): a
  `Conforms to:` pack path (verbatim from `index.json`) resolves relative
  to the pack root
  `$HOME/.gor-mobile/rules/` (so `examples/data/ExampleDataSource.kt` →
  `$HOME/.gor-mobile/rules/examples/data/ExampleDataSource.kt`); a
  `Conforms to (project precedent): ...` line names repo files directly —
  plus the architecture section from `manifest.json → .sections.architecture`.
  Dispatching a layer-touching implementer prompt without them is a
  **dispatch defect**. A layer whose own line reads `Shape per user: <...>`
  contributes no reference file — quote that line in the prompt for that
  layer instead. A layer-touching task with no artifact line at all is a plan
  defect: stop and fix the plan (run its examples-first gate), do not
  improvise references.
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

> **Red Flag — STOP.** Dispatching an implementer or spec-reviewer prompt for
> a layer-touching task without its `Conforms to:` reference files attached.
> This mandate has already been skipped silently in the field once — the
> code-quality reviewer agents now independently check diff shape against
> canonical examples, so a defect from a skipped dispatch still surfaces
> downstream. Attach the files.

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
  plan **verbatim**. Attach the **same reference files** the implementer
  received (the task's `Conforms to:` files): the spec reviewer checks the
  code against the task spec **and** the cited canonical shape — the plan is
  not the sole yardstick.
- **Code-quality review (per task)** — dispatch the gor-mobile reviewer
  **directly**: `Agent(gor-mobile-code-reviewer)` (or `-deep` on the escalation
  triggers — large diff, security/auth/payments/crypto/IPC, explicit deep-review
  ask). Per-task checkpoints run the gor-mobile reviewer **only — no Codex**.
  Codex reviewing half-built, mid-plan state at every task is low signal and the
  main source of token/time overrun; it is deferred to one pass at the end.

**Final full-implementation review (after ALL tasks) — the one Codex gate.**
When every plan task is implemented and verified, run a single final review over
the complete diff through `Skill(gor-mobile-requesting-code-review)`. That skill
owns the two-pass mandate — gor-mobile reviewer + Codex (when `$CODEX_COMPANION`
resolves) — so Codex runs **exactly once per plan, here, on the finished
implementation**, never per task. This final gate is mandatory: skipping it is
the only way Codex would never run, which is a review failure.

**Definition of done:** a per-task code-quality review is done when the
gor-mobile reviewer approves. The plan is done when the final review (gor-mobile
reviewer + Codex) has returned and its findings are addressed.

**Tool disambiguation** (upstream bug obra/superpowers#1077): `requesting-code-review`
and `writing-plans` are **Skills** (invoke via the `Skill` tool);
`gor-mobile-code-reviewer` / `gor-mobile-code-reviewer-deep` are **Agents**
(dispatch via the `Agent` tool with `subagent_type`). If you see
`{"status":"Agent type not found"}` for a review step, the dispatch went to the
wrong tool — retry via `Skill(gor-mobile-requesting-code-review)`.

### Context compaction — checkpoint every verified task boundary

The orchestrator's context grows across tasks (subagent results, verification
output, review reports) even though each implementer runs in its own fresh
context. Keep the orchestrator rehydratable:

- **On start**, if `.gor-mobile/state/<plan-basename>.progress.md` exists, read
  it FIRST and resume from its `Next action`.
- **After a task's verification passes** (orchestrator-run, not the subagent's
  self-report), rewrite the checkpoint before dispatching the next task,
  preserving its `Spec:`/`Plan:` links: task status (done + one line of what
  changed + any deviation + touched file paths),
  cross-cutting decisions with their reason, open questions, the last green
  verification command, and `Next action` = the next pending task.
- **Compaction gate:** the post-verification, post-review boundary between tasks
  is safe to compact — no subagent is running, nothing is half-applied, the
  checkpoint is fresh. When context has grown heavy, tell the user in one line
  that `/compact` is safe now. NEVER suggest it while a subagent is in flight or
  a review is mid-triage.

This is the same disk-backed safety as `executing-plans`: because the checkpoint
is refreshed at every safe boundary, even an uncontrolled Claude Code
auto-compact is recoverable — worst case one in-flight task is redone; no
completed, verified work is lost. The checkpoint and plan — not the post-compact
summary — are authoritative for task state.

<!-- END gor-mobile overlay -->