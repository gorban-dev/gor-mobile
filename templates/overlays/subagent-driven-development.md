<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin + local-LLM delegation)

The skill body above runs verbatim. The following ADD to (never override) it
when the target is an Android/Kotlin codebase:

### Architecture rules (delta 2)
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

### Local-LLM delegation (delta 1 — craft-skills pattern)
The implementer subagent can be offloaded to LM Studio via the craft-skills
script suite installed at `$HOME/.gor-mobile/scripts/`:

    # Write task description to a temp file, then:
    $HOME/.gor-mobile/scripts/llm-implement.sh \
        <task-file> \
        <working-dir> \
        "<comma-separated-allowed-paths>" \
        <ref-file1> <ref-file2> …

Returns JSON to stdout:

    {
      "status":        "DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED",
      "severity":      "none | minor | major",
      "summary":       "…",
      "files_changed": ["…"],
      "exports_added": ["…"],
      "concerns":      "…",
      "notes":         "…",
      "deviations":    "…",
      "routing_hint":  "" | "consider-sonnet",
      "routing_hint_reasons": "…"
    }

**Decision rules for the orchestrator (main Claude):**
- `status == "DONE"` — accept, **verify with gradle before trusting**
  (Gemma has no execute-tool → can silently break imports / case), move on.
- `status == "DONE_WITH_CONCERNS"` — read `concerns` + `deviations`; if minor
  accept and note; if major re-dispatch with correction or escalate to Opus.
- `status == "NEEDS_CONTEXT"` — the LLM honestly asking for more files. Add
  missing reference to the ref-files list and retry.
- `status == "BLOCKED"` — take over yourself (Opus/Sonnet).
- `routing_hint == "consider-sonnet"` — **advisory** since v0.3.3. Modify
  tasks on large files now use `edit_file` (tiny tool-calls, no
  regeneration) → size no longer critical. Still consider-sonnet if the
  task creates a new large file (>480 LOC via `write_file`) or involves
  holistic refactor across many files.

**Delegation gate (MANDATORY before falling back to main Claude Edit/Bash):**
For every implementer task check if it qualifies for LM Studio delegation.
It qualifies when ALL of:
1. File paths are enumerated in the task (no open-ended "find and fix").
2. ≤6 files in allowed-paths.
3. Not touching build config (gradle), CI, release machinery.
4. Not declared "design decision" / "human review required".

If qualifies → dispatch via `llm-implement.sh`. Only fall back to direct
Edit/Bash when the script returns `status == "BLOCKED"` (LM Studio down or
genuine failure) or `routing_hint == "consider-sonnet"` with a reason that
still applies post-edit_file (new large file via write_file, cross-file
refactor).

On Gemma failure (truncate, HTTP error mid-session, post-verify shows
breakage): **re-dispatch a fix-task**, do NOT patch manually. The
upstream skill body already says this — overlay reinforces: no
`git checkout --` / `git reset --hard` as shortcut, no manual Edit on
Gemma's scope files. Write a new fix-task.md with point-by-point
instructions and re-dispatch `llm-implement.sh`.

**Tool protocol (v0.3.3):** Gemma now has `edit_file(path, old_string,
new_string)` in addition to `write_file(path, content)`. Routing is
automatic and model-driven:
- Existing file + modification → `edit_file` (exact substring replace,
  small tool-call, no regeneration → no truncation, no stochastic
  substitutions).
- New file → `write_file` (full content, one pass).
- `write_file` on existing file returns an error instructing Gemma to
  use `edit_file`.

**Scope protection:** both `write_file` and `edit_file` are hard-restricted
to the `<allowed-paths>` list. Gemma cannot touch anything else; if it tries,
it gets `NEEDS_CONTEXT` and has to raise the scope formally.

Tests are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

Doc paths land in the gitignored project-local workspace:
`.gor-mobile/specs/YYYY-MM-DD-<topic>-design.md`
`.gor-mobile/plans/YYYY-MM-DD-<feature>.md`.

### Graceful degradation
If LM Studio is down (`curl` fails) or the model refuses to load,
`llm-implement.sh` emits `{"status":"BLOCKED","concerns":"LM Studio not running…"}`
within 2 seconds. Main Claude takes over.

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
- **Agent** (dispatch via `Agent` tool with `subagent_type`):
  - `gor-mobile-code-reviewer` (note the `-er` suffix — different from the
    `requesting-code-review` skill). This is the subagent used internally
    **by** the `requesting-code-review` skill, not a separate entry point.

If you see `{"status":"Agent type not found"}` for a review step, the
dispatch went to the wrong tool. Retry with `Skill(gor-mobile-requesting-code-review)`
and let that skill orchestrate the `Agent(gor-mobile-code-reviewer)` call itself.

<!-- END gor-mobile overlay -->
