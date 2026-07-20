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
      (session model).
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
  the orchestrator handles those itself (session model).

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
**dispatch defect**. Executing a layer-touching task yourself (session-model path)
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

### Review routing — one combined review per checkpoint, Codex once at the end

Per-checkpoint review is **one** dispatch of `Agent(gor-mobile-code-reviewer)`
with both checklists in a single prompt, as two report sections: spec
compliance (code vs the plan text **verbatim**, including modifier chains and
argument lists) and code quality (correctness, conventions, diff shape vs the
task's `Conforms to:` reference files — attach them once, they serve both
sections). **No Codex per checkpoint** — Codex reviewing mid-plan, half-built
state at every checkpoint is low signal and the main source of token/time
overrun. Tier by task category: TDD-gate **not warranted** tasks (wiring / DI /
resources — no behavioral logic) downgrade to `model = "haiku"` (Codex: effort
`low`) with a reduced checklist (allowed-paths respected, compiles, diff
shape); escalation triggers (large diff, security/auth/payments/crypto/IPC, an
explicit deep-review ask) go to `Agent(gor-mobile-code-reviewer-deep)`, which
runs on the session model.

**One Codex gate, at the end.** After the last plan task is implemented and
verified — during Complete Development, before you present completion options —
run a single final review over the whole change through
`Skill(gor-mobile-requesting-code-review)`. That skill owns the two-pass mandate
— the **deep** reviewer (session model) focused on cross-task properties
(consistency between tasks, architecture drift, duplication, dead leftovers —
not a re-check of what per-checkpoint reviews approved) plus Codex when
`$CODEX_COMPANION` resolves — so Codex runs **exactly once per plan, here, on
the finished implementation**. This final gate is mandatory: skipping it is the
only way Codex never runs.

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
- `ast-index usages "<Symbol>" --limit 1000` — every caller, for impact
  analysis (the default `--limit 50` clips the headline count).
- `ast-index implementations "<Interface>"` — concrete classes for an
  interface (useful before adding a new variant).

Run this BEFORE `Grep`. The structured output narrows the file set you
need to read.

### Context compaction — checkpoint every verified task boundary

Long plans grow the orchestrator's context (accumulated diffs, test output,
subagent results). Keep the session rehydratable:

- **On start**, if `.gor-mobile/state/<plan-basename>.progress.md` exists, read
  it FIRST and resume from its `Next action` — the plan may have been partly
  executed before a compaction.
- **After each task's verification passes** (task-loop step 3 above), rewrite the
  checkpoint before advancing, preserving its `Spec:`/`Plan:` links: task status
  (done + one line of what changed + any
  deviation from the plan + touched file paths), cross-cutting decisions with
  their reason, open questions, the last green verification command, and
  `Next action` = the next pending task.
- **Compaction gate:** this post-verification boundary is a safe point to
  compact — nothing is in flight and the checkpoint is fresh. When the session
  has grown heavy (the planning-seam compaction is far behind, several tasks
  closed, or a task pulled large content into context), tell the user in one line
  that `/compact` is safe now. NEVER suggest it mid-task.

Because the checkpoint is refreshed at every safe boundary, an uncontrolled
Claude Code auto-compact is also recoverable: worst case you re-do the one task
that was in flight (its verification had not passed, so no completed work is
lost). Never treat the post-compact summary as authoritative for task state —
the checkpoint and the plan are.

<!-- END gor-mobile overlay -->
