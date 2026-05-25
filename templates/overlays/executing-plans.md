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

### Override: no checkpoint commits

The upstream skill body suggests committing at phase boundaries
(review checkpoints between tasks). The gor-mobile overlay
**overrides this**: never run `git commit` between tasks or phases,
and never create branches / worktrees. All changes accumulate as
uncommitted modifications in the working tree until the user decides
to commit. Verification (`./gradlew :<module>:test ...`) still runs
after every task — that's correctness gating, not git state.

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
