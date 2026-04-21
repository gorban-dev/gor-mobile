<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Before writing tests or implementation, load the relevant rules sections
from `$HOME/.gor-mobile/rules/` (always `core` + `architecture`; plus
`testing-*` sections that match the layer under test). Paths come from
`manifest.json` — never hardcode.

### Stage-to-model assignment

- **RED (write the failing test)** — main orchestrator (Opus). The
  assertion set is the contract; drafting it is judgement work.
- **GREEN (make the failing test pass)** — delegate to Sonnet:

        Task(
          subagent_type = "general-purpose",
          model         = "sonnet",
          prompt        = <green-task-prompt>
        )

  The prompt's allowed-paths list MUST exclude the test file itself, so
  Sonnet cannot weaken the assertion to make the test trivially pass.
  Reference files: the failing test + 1–2 layer examples from the rules
  pack.

- **REFACTOR** — main orchestrator (Opus). Refactoring requires holistic
  judgement across files the GREEN subagent wasn't scoped to see.

After every GREEN dispatch, the orchestrator runs the Gradle test itself:
`./gradlew :<module>:test --tests "*<Name>Test*"`. Only commit after green.

<!-- END gor-mobile overlay -->