<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin + local-LLM delegation)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `debug-*` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` at the start of Phase 1 (symptom narrowing).

### Phase 2 evidence gathering — local-LLM offload
Log scanning, reading large stack traces, skimming unfamiliar modules for
a suspect function — this is cheap, high-volume work that Gemma handles
well. Delegate via:

    $HOME/.gor-mobile/scripts/llm-agent.sh <prompt-file> <working-dir>

This script gives Gemma read-only tools (`read_file`, `list_files`, `grep`)
and returns a JSON report. No `write_file` is exposed — evidence gathering
must stay read-only.

Phases 3 (hypothesis) and 4 (failing test + fix) stay on main Claude —
causal reasoning and the fix itself are not worth the round-trip through
Gemma and require full context from the evidence gathered in Phase 2.

<!-- END gor-mobile overlay -->
