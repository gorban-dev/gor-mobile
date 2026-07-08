<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Task-loop (delta — classify before executing)

For every task in the plan, in order:

1. Mark the TodoWrite entry `in_progress`.
2. **Classify the task:**
    - Pure code change on an enumerated set of files (create / modify known
      paths, tests, wiring) with ≤ 6 files total → delegate to Sonnet:

            Task(
              subagent_type = "general-purpose",
              model         = "sonnet",
              prompt        = <task-prompt-with-allowed-paths-and-refs>
            )

    - Cross-module refactor, scope > 6 files, or the plan marks the task
      as "design decision" / "human review required" → do it yourself
      (Opus).
3. Run the task's verification step yourself (Gradle, compile check). A
   subagent "DONE" without a passing verification is not done.
4. Mark TodoWrite `completed`, advance.

**A baked-in "write the failing test" step is gated.** If a task prescribes
writing a failing test, that step is subordinate to the **TDD applicability
gate** in `[[gor-mobile-test-driven-development]]` — run the gate for the
task's change before executing the step. Verdict **not warranted** (UI-flag /
wiring / no behavioral logic) → skip the test step, record
`TDD skipped: <reason>`, and keep the task's verification step. Do not write a
test merely because the plan listed one, and never fabricate a new seam to test.

### What NOT to delegate
- Build config (`gradle`, CI, release machinery).
- Tasks the plan flags "design decision" or "human review required".
- Anything where the allowed-paths list would balloon past ~6 files —
  those go to Opus directly.

### Rules-pack usage
Read section paths from `$HOME/.gor-mobile/rules/manifest.json → .sections`
and layer examples from `examples/index.json → .layers`. Never hardcode
filenames — the user may have swapped the pack via
`gor-mobile rules use <url>`.

For every layer-touching task, the
`<task-prompt-with-allowed-paths-and-refs>` above MUST carry the reference
files named by the task's artifact lines (one per touched layer): a
`Conforms to:` pack path (verbatim from `index.json`) resolves relative to
the pack root
`$HOME/.gor-mobile/rules/`; a `Conforms to (project precedent): ...` line
names repo files directly. A layer whose line reads `Shape per user: <...>`
contributes no reference file — quote that line in the prompt instead.
Dispatching a layer-touching prompt without its reference files is a
**dispatch defect**. Executing a layer-touching task yourself (Opus path)
obeys the same
contract: read the referenced files before writing code. A layer-touching
task with no artifact line is a plan defect — stop and fix the plan (run
its examples-first gate), do not improvise references.

> **Red Flag — STOP.** Dispatching or self-executing a layer-touching task
> without reading its `Conforms to:` reference files. The code-quality
> reviewer agents independently check diff shape against canonical
> examples, so a skipped reference still surfaces downstream — attach and
> read the files up front instead.

### Override: no checkpoint commits

The upstream skill body suggests committing at phase boundaries
(review checkpoints between tasks). The gor-mobile overlay
**overrides this**: never run `git commit` between tasks or phases,
and never create branches / worktrees. All changes accumulate as
uncommitted modifications in the working tree until the user decides
to commit. Verification (`./gradlew :<module>:test ...`) still runs
after every task — that's correctness gating, not git state.

### Review routing — through requesting-code-review (owns the Codex mandate)

When you request code review at a checkpoint, route it through
`Skill(gor-mobile-requesting-code-review)`, **not** a bare
`Agent(gor-mobile-code-reviewer)`. That skill owns the two-pass mandate
(gor-mobile reviewer + Codex when `$CODEX_COMPANION` resolves); a bare Agent
dispatch reads only the reviewer prompt and silently skips the Codex second
opinion. The review is not done — and findings are not reported — until both
passes return (or Codex is confirmed absent because the plugin is not
installed).

### Android CLI — phase command mapping

For Android/Kotlin targets, the `android` CLI is the primary tool for
this phase. Invoke `[[gor-mobile-using-android-cli]]` to get the
phase→command map. That bridge skill is authoritative for Android
device ops, replacing direct `adb` / `./gradlew` invocations.

### Entry-point lookup — ast-index first

Before editing code for a task, locate the entry points via
`[[gor-mobile-ast-index]]`:

- `ast-index symbol "<Name>"` — exact class/function lookup.
- `ast-index class "<Name>"` — class definition + supertype chain.
- `ast-index usages "<Symbol>"` — every caller, for impact analysis.
- `ast-index implementations "<Interface>"` — concrete classes for an
  interface (useful before adding a new variant).

Run this BEFORE `Grep`. The structured output narrows the file set you
need to read.

<!-- END gor-mobile overlay -->
