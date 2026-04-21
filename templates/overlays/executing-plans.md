<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin + local-LLM delegation)

The skill body above runs verbatim. On Android/Kotlin projects each task of
the plan is delegated to a local LLM via LM Studio instead of being typed
out by main Claude — that is the core value proposition of gor-mobile.

### Task-loop (delta — replaces "Step 2: Execute Tasks")

For every task in the plan, in order:

1. **Mark the TodoWrite entry `in_progress`.**
2. **Classify the task.** If its steps are purely code changes on enumerated
   files (create/modify known paths, tests, wiring) — delegate. If the task
   requires architectural judgement, a cross-cutting refactor with no clear
   scope, or a decision that is not in the plan — do it yourself (Opus).
3. **Delegate** via the craft-skills dispatcher installed at
   `$HOME/.gor-mobile/scripts/`:

        $HOME/.gor-mobile/scripts/llm-implement.sh \
            <task-file> \
            <working-dir> \
            "<comma-separated-allowed-paths>" \
            <ref-file1> <ref-file2> …

    - `<task-file>` — a temp file containing the verbatim task section from
      the plan (header, Files list, all Steps with their code blocks).
    - `<allowed-paths>` — exact paths the plan lists under **Files:**
      (Create + Modify + Test). The scope-restricted `write_file` tool
      inside the local model will refuse writes outside this list.
    - `<ref-file*>` — 1–3 reference files from the rules-pack
      (`$HOME/.gor-mobile/rules/examples/index.json → .layers`) that
      match the layer this task touches (presentation, usecase,
      repository, data, di). Always also pass the architecture section
      from `manifest.json → .sections.architecture`.

4. **Parse the JSON response** (same schema as subagent-driven-development):

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

5. **Decide:**
    - `DONE` — **always run the task's verification step before trusting**
      (Gradle test, compile check). Gemma has no execute-tool and can
      silently break imports / case — do not commit until verification
      passes. Then mark TodoWrite `completed`, continue.
    - `DONE_WITH_CONCERNS` + `severity: minor` — accept, log the concern,
      continue. `severity: major` — re-dispatch with a correction note
      appended to the task file, or take over yourself if the second pass
      also returns major.
    - `NEEDS_CONTEXT` — add the files it asked for to `<ref-file*>` and
      retry once. Two consecutive NEEDS_CONTEXT for the same task means
      the plan is under-specified — stop, raise with the human partner.
    - `BLOCKED` — LM Studio down or genuine failure. Do the task yourself.
    - `routing_hint == "consider-sonnet"` — advisory since v0.3.3.
      Modifications use `edit_file` now (no regeneration → size not
      critical). Still escalate for new large files, or cross-file
      refactors.

**On delegation failure (partial write, truncate, post-verify breakage):**
re-dispatch a fix-task with precise instructions. Do NOT patch manually
(context pollution) and do NOT `git checkout --` / `git reset --hard` as a
shortcut — ask the user before any destructive git op.

**Tool protocol (v0.3.3):** `llm-implement.sh` now gives Gemma both
`write_file` (new files only) and `edit_file` (existing-file substring
replace). Modify-heavy tasks on large Compose/Kotlin files are reliable.
No overlay action needed — the script's SYSTEM_PROMPT routes
automatically.

6. **Verification (delegated too when scripted):** the plan's verification
   steps that are `./gradlew …` commands can be run directly — no LLM
   needed. Only delegate verification when it involves interpreting output
   (flaky-test diagnosis, diff review) — then use `llm-analyze.sh` or
   `llm-review.sh` respectively.

7. **Mark TodoWrite `completed`**, advance to next task.

### Graceful degradation
`llm-implement.sh` emits `{"status":"BLOCKED","concerns":"LM Studio not running…"}`
within 2 seconds if LM Studio is down. Main Claude takes over that task and
continues the loop — one unavailable tool must not stall the whole plan.

### What NOT to delegate
- Cross-file refactors where the "allowed paths" list would balloon (>6 files).
- Tasks where the plan explicitly says "design decision" or "human review
  required".
- Any task that touches build config, CI, or release machinery — those stay
  with main Claude.

### Rules-pack is user-replaceable
Read section paths from `$HOME/.gor-mobile/rules/manifest.json → .sections`.
Never hardcode filenames — user may have swapped the pack via
`gor-mobile rules use <url>`.

<!-- END gor-mobile overlay -->
