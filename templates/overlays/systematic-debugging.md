<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `debug-*` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` at the start of Phase 1 (symptom narrowing).

### Phase-to-model assignment

- **Phase 1 — symptom narrowing.** Main orchestrator (Opus). Clarifying
  what "broken" actually means is judgement work.
- **Phase 2 — evidence gathering.** Log scan, stack-trace reading,
  skimming unfamiliar modules for a suspect function — high-volume
  read-only work. Delegate to Sonnet with read-only tools only:

        Task(
          subagent_type = "general-purpose",
          model         = "sonnet",
          prompt        = <evidence-gathering-prompt>
        )

  Instruct the subagent to use only Grep / Read / Glob and to return a
  structured report (findings + cited file:line references). No Edit,
  no Write.
- **Phase 3 — hypothesis formation.** Main orchestrator (Opus). Causal
  reasoning over the evidence is not worth a round-trip.
- **Phase 4 — failing test + fix.** See the TDD overlay.

<!-- END gor-mobile overlay -->