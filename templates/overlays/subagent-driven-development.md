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
- `status == "DONE"` — accept, verify with gradle, move on.
- `status == "DONE_WITH_CONCERNS"` — read `concerns` + `deviations`; if minor
  accept and note; if major re-dispatch with correction or escalate to Opus.
- `status == "NEEDS_CONTEXT"` — the LLM honestly asking for more files. Add
  missing reference to the ref-files list and retry.
- `status == "BLOCKED"` — take over yourself (Opus/Sonnet).
- `routing_hint == "consider-sonnet"` — pre-check decided the scope is too
  large (>480 LOC single allowed file, or >2500 LOC combined). Don't even
  dispatch to Gemma — do it directly.

**Scope protection:** `write_file` inside Gemma's tool belt is hard-restricted
to the `<allowed-paths>` list. Gemma cannot touch anything else; if it tries,
it gets `NEEDS_CONTEXT` and has to raise the scope formally.

Tests are Gradle:
`./gradlew :<module>:test --tests "*<Name>Test*"`.

Doc paths follow superpowers convention:
`docs/superpowers/specs/YYYY-MM-DD-<topic>-design.md`
`docs/superpowers/plans/YYYY-MM-DD-<feature>.md`.

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
