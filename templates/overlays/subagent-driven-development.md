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

Doc paths land in the gitignored project-local workspace:
`.gor-mobile/specs/YYYY-MM-DD-<topic>-design.md`
`.gor-mobile/plans/YYYY-MM-DD-<feature>.md`.

### Override: no automatic commits, branches, or worktrees

Never run `git commit`, `git branch`, `git checkout`, or
`git worktree add` between subagent tasks. Implementer-task diffs
accumulate as uncommitted modifications in the working tree across
the entire plan. The user reviews `git diff` and commits / branches /
pushes at their own discretion. If the user explicitly asks for a
worktree or branch, invoke `Skill(gor-mobile-using-git-worktrees)`
or run the requested git command — otherwise do nothing.

### Skill-vs-Agent dispatch (clarification — upstream bug obra/superpowers#1077)

The upstream Integration block lists `requesting-code-review` alongside agent
types in a single bullet list, which causes the model to dispatch it via
`Agent(type="gor-mobile-requesting-code-review")` and fail with
"Agent type not found". Disambiguation:

- **Skills** (invoke via `Skill` tool — these are *skills*, not agents):
  - `gor-mobile-requesting-code-review`
  - `gor-mobile-using-git-worktrees`
  - `gor-mobile-writing-plans`
  - `gor-mobile-finishing-a-development-branch`
- **Agents** (dispatch via `Agent` tool with `subagent_type`):
  - `gor-mobile-code-reviewer` (Sonnet — default review path)
  - `gor-mobile-code-reviewer-deep` (Opus — security / large-diff path)

If you see `{"status":"Agent type not found"}` for a review step, the
dispatch went to the wrong tool. Retry with `Skill(gor-mobile-requesting-code-review)`
and let that skill orchestrate the `Agent(gor-mobile-code-reviewer)` call itself.

<!-- END gor-mobile overlay -->