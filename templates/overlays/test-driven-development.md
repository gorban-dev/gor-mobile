<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin + local-LLM delegation)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Before writing tests or implementation, load the relevant rules sections
from `$HOME/.gor-mobile/rules/` (always `core` + `architecture`; plus
`testing-*` sections that match the layer under test). Paths come from
`manifest.json` — never hardcode.

### GREEN stage — local-LLM offload
The implementer in the GREEN phase (make the failing test pass) can be
delegated to LM Studio via:

    $HOME/.gor-mobile/scripts/llm-implement.sh \
        <task-file>     # "make ${TestClass}.${method} pass"
        <working-dir>
        "<allowed-paths>"   # production-code paths, NOT the test file
        <ref-files>...      # the failing test + 1-2 layer examples

The test file stays out of the allowed-paths list so Gemma cannot change
the assertion to make the test trivially pass. Verify the JSON `status`:
- `DONE` → run Gradle test, confirm GREEN, proceed to REFACTOR.
- `DONE_WITH_CONCERNS` with deviations — inspect before accepting.
- `NEEDS_CONTEXT` / `BLOCKED` → take over yourself.

**IMPORTANT:** `DONE` from Gemma ≠ code is correct. Gemma has no
execute-tool — she cannot know if imports / case are right. After every
`DONE` you MUST run Gradle compile + test. Only commit after green.

**Tool protocol (v0.3.3):** For GREEN-stage modifications of existing
prod code, Gemma uses `edit_file` (exact substring replace, tiny
tool-calls). Large production-code files (>150 LOC) are safe now — no
full-file regeneration. `write_file` is used only for new files created
as part of the fix.

REFACTOR stays on main Claude — refactoring requires holistic judgment.

Tests: `./gradlew :<module>:test --tests "*<Name>Test*"`.

<!-- END gor-mobile overlay -->
