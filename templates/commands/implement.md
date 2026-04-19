---
description: Android — CREATE / MODIFY / REFACTOR / FIX a feature, delegating code gen to local LLM
---

# /implement — Android feature implementation

Task from user: **$ARGUMENTS**

<EXTREMELY_IMPORTANT>
You MUST delegate code generation to the local LLM via:

```sh
gor-mobile llm impl --input <prompt-file>
```

- The CLI returns JSON `{status, model, content, tokens, elapsed_ms}`.
- On `status == OK` → parse `.content`, validate against core rules, write files.
- On `status == BLOCKED` or `ERROR` → then, and only then, fall back to Opus code-gen.
- Do NOT skip the CLI call. Do NOT use `--force-cloud` unless the user explicitly requested it.
</EXTREMELY_IMPORTANT>

## Mode detection

- **CREATE** — feature not found in project → build from scratch
- **MODIFY** — feature found → extend without breaking existing contracts
- **REFACTOR** — bring code to standard (migration guide)
- **FIX** — apply a list of issues from `/review` or `/test-ui`

## Step 1 — Project preparation

1. Detect base package from existing modules / CLAUDE.md
2. Detect DI framework: Koin or Kodein (from `build.gradle` or existing DI modules)
3. Find `BaseSharedViewModel` full import path
4. Find `UseCase<Params, T>` full import path
5. Read core rules: `$HOME/.gor-mobile/rules/rules/core.md`
6. Read section rules: `$HOME/.gor-mobile/rules/rules/architecture.md` (+ `modification.md` for MODIFY/REFACTOR)

## Step 2 — Compose the delegation prompt

Write `/tmp/gor-mobile-impl-$$.md` containing:

- The task (copy `$ARGUMENTS`)
- The working mode (CREATE/MODIFY/REFACTOR/FIX)
- The detected project facts (base package, DI, ViewModel base, navigation mechanism)
- The relevant excerpts from `core.md` + `architecture.md`
- 2-3 matching example files from `$HOME/.gor-mobile/rules/examples/<layer>/`
- An explicit instruction: "Produce the Kotlin files, each in its own ```kotlin``` fenced block with a `// FILE: <relative-path>` header comment on the first line."

## Step 3 — Dispatch

```sh
gor-mobile llm impl --input /tmp/gor-mobile-impl-$$.md
```

## Step 4 — Validate and write

For each generated file:

- [ ] Screen contains no logic / remember / UI state
- [ ] View is in its own file with a Preview wrapped in `{App}Theme { }`
- [ ] ViewModel extends `BaseSharedViewModel`, no Compose imports
- [ ] UseCase uses `suspend fun execute(...)`, NOT `operator fun invoke`
- [ ] UseCase returns `Result<T>`
- [ ] Repository has `I{Feature}Repository` interface
- [ ] Exactly one class per file
- [ ] Package path matches architecture layout

If any check fails, either:
- Compose a follow-up prompt with specific feedback and re-run `gor-mobile llm impl`, OR
- Escalate to Opus with a clear justification (paste the failed output + rule)

## Step 5 — Report

- List files created/modified
- Show which model generated each (from the CLI response)
- Next step suggestion: `Run /review to audit the implementation.`
