---
description: Android — Test-Driven Development for UseCases, Mappers, and business logic
---

# /tdd — Test-Driven Development

Task from user: **$ARGUMENTS**

<EXTREMELY_IMPORTANT>
Follow RED → GREEN → REFACTOR strictly. The RED step generates a failing test and MUST delegate to the local LLM:

```sh
gor-mobile llm tdd-red --input <prompt-file>
```

Do not write implementation code until a failing test exists.
</EXTREMELY_IMPORTANT>

## Scope

Apply TDD only to logic with a clear input → output contract:

- UseCases (especially those with branching or validation)
- Mappers (DTO → domain, domain → view state)
- Pure business functions

Do NOT TDD trivial code (POKOs, dumb ViewModels, plain repositories).

## Flow

1. **RED** — specify the behaviour, generate a failing test via `gor-mobile llm tdd-red`
2. **GREEN** — implement the simplest code that makes it pass (`gor-mobile llm impl`)
3. **REFACTOR** — clean up while keeping the test green
4. Repeat per behaviour

## References

- `$HOME/.gor-mobile/rules/rules/core.md`
- `$HOME/.gor-mobile/rules/rules/testing.md`

## RED prompt template

Write to `/tmp/gor-mobile-tdd-$$.md`:

- Unit under test (class + method)
- Behaviour being specified (one at a time)
- Input examples and expected output
- The test framework in use (detect from `build.gradle`: JUnit 4 / 5 / Kotlin Test)
- Instruction: "Produce exactly one failing test in a ```kotlin``` block with a `// FILE: <path>` header. Do NOT produce implementation code."

## Validation per cycle

- [ ] The new test fails for the right reason (missing behaviour, not compile error)
- [ ] GREEN implementation passes that test and does not break prior ones
- [ ] REFACTOR keeps all tests green
