---
description: Subagent-Driven Development — execute plan task-by-task with two-stage review
---

Task from user: **$ARGUMENTS**

## Android adaptation (gor-mobile overlay)

This is the superpowers `subagent-driven-development` skill, adapted for Android/gor-mobile. The skill text below is verbatim; the overlay only adds:

- **Local-LLM delegation (MANDATORY for implementer subagents)**: implementer subagents MUST generate Kotlin via the local LLM, not Opus, unless it declines:

  ```sh
  gor-mobile llm impl --input <prompt-file>
  ```

  The CLI returns JSON `{status, model, content, tokens, elapsed_ms}`. On `status == OK` → use `.content`. On `status == BLOCKED` or `ERROR` → fall back to Opus.

- **Rules & examples to pass into every implementer prompt**:
  - `$HOME/.gor-mobile/rules/rules/core.md` (always)
  - `$HOME/.gor-mobile/rules/rules/architecture.md` and, when relevant, `naming.md` / `testing.md` / `modification.md`
  - 2-3 matching example files from `$HOME/.gor-mobile/rules/examples/<layer>/*.kt`

- **Reviewer subagents** use the separate `/review` command (requesting-code-review), which internally delegates to `gor-mobile llm review` and `code-reviewer` agent.

- **Test command** in plan verification: `./gradlew :<module>:test --tests "*<Name>Test*"`.

- **Commit policy**: the verbatim superpowers text below says "implementer implements, tests, commits". In gor-mobile we **only** commit code when the user explicitly asks. Implementer subagents MUST NOT run `git add` / `git commit` on their own — leave the working tree dirty and report what changed. The user will commit (or delegate that) at the end.

- **Proving delegation**: every `gor-mobile llm impl` call emits a stderr marker (`[gor-mobile llm] role=impl model=<id> …`) and appends a JSON line to `~/.config/gor-mobile/llm-audit.log`. When you finish a task, tell the user the marker line or tail the audit log if they want proof the local model did the work.

Everything else — fresh subagent per task, two-stage review (spec → quality), BLOCKED/NEEDS_CONTEXT/DONE handling, red flags — is **unchanged**.

---

# Subagent-Driven Development

Execute plan by dispatching fresh subagent per task, with two-stage review after each: spec compliance review first, then code quality review.

**Why subagents:** You delegate tasks to specialized agents with isolated context. By precisely crafting their instructions and context, you ensure they stay focused and succeed at their task. They should never inherit your session's context or history — you construct exactly what they need. This also preserves your own context for coordination work.

**Core principle:** Fresh subagent per task + two-stage review (spec then quality) = high quality, fast iteration

## When to Use

**Use this when:**
- You have an implementation plan (written by `/plan`)
- Tasks are mostly independent
- You want to stay in this session

**If tasks are tightly coupled or you'd rather execute manually:** fall back to inline execution.

## The Process

1. Read plan file once, extract all tasks with full text, note context, create TodoWrite with all tasks.
2. **For each task:**
   1. Dispatch implementer subagent with the full task text + curated context (rules excerpts, example files).
   2. If implementer asks questions → answer, re-dispatch.
   3. Implementer implements, tests, commits, self-reviews.
   4. Dispatch spec reviewer subagent — confirm code matches spec. If issues → implementer fixes, re-review.
   5. Dispatch code quality reviewer subagent — approve or demand fixes. If issues → implementer fixes, re-review.
   6. Mark task complete in TodoWrite.
3. After all tasks: dispatch final code reviewer for the entire implementation.
4. Run `/finishing-branch` (finishing-a-development-branch skill).

## Model Selection

Use the least powerful model that can handle each role to conserve cost and increase speed.

**Mechanical implementation tasks** (isolated functions, clear specs, 1-2 files): use a fast, cheap model. Most implementation tasks are mechanical when the plan is well-specified. On gor-mobile, this means the local LLM via `gor-mobile llm impl`.

**Integration and judgment tasks** (multi-file coordination, pattern matching, debugging): use a standard model.

**Architecture, design, and review tasks**: use the most capable available model.

**Task complexity signals:**
- Touches 1-2 files with a complete spec → cheap model
- Touches multiple files with integration concerns → standard model
- Requires design judgment or broad codebase understanding → most capable model

## Handling Implementer Status

Implementer subagents report one of four statuses. Handle each appropriately:

**DONE:** Proceed to spec compliance review.

**DONE_WITH_CONCERNS:** The implementer completed the work but flagged doubts. Read the concerns before proceeding. If the concerns are about correctness or scope, address them before review. If they're observations (e.g., "this file is getting large"), note them and proceed to review.

**NEEDS_CONTEXT:** The implementer needs information that wasn't provided. Provide the missing context and re-dispatch.

**BLOCKED:** The implementer cannot complete the task. Assess the blocker:
1. If it's a context problem, provide more context and re-dispatch with the same model
2. If the task requires more reasoning, re-dispatch with a more capable model
3. If the task is too large, break it into smaller pieces
4. If the plan itself is wrong, escalate to the human

**Never** ignore an escalation or force the same model to retry without changes. If the implementer said it's stuck, something needs to change.

## Implementer Prompt Shape (gor-mobile)

When you dispatch an implementer subagent, the prompt MUST include:

1. The full task text from the plan (verbatim, not a summary).
2. The surrounding context (why this task exists, what it feeds into).
3. Project facts the implementer can't guess: base package, DI framework (Koin/Kodein), `BaseSharedViewModel` import path, `UseCase<Params, T>` import path.
4. Relevant excerpts from `$HOME/.gor-mobile/rules/rules/core.md` + `architecture.md`.
5. 2-3 matching example files from `$HOME/.gor-mobile/rules/examples/<layer>/`.
6. An explicit instruction: "Generate Kotlin by calling `gor-mobile llm impl --input /tmp/gor-mobile-impl-$$.md`. Each output file in its own ```kotlin``` fenced block with `// FILE: <relative-path>` header on line 1. On BLOCKED/ERROR, fall back to direct Opus generation and note it in your report."
7. Expected report shape: `{status, files_touched, model_used, self_review_notes}`.

## Advantages

**vs. Manual execution:**
- Subagents follow TDD naturally
- Fresh context per task (no confusion)
- Parallel-safe (subagents don't interfere)
- Subagent can ask questions (before AND during work)

**Quality gates:**
- Self-review catches issues before handoff
- Two-stage review: spec compliance, then code quality
- Review loops ensure fixes actually work
- Spec compliance prevents over/under-building
- Code quality ensures implementation is well-built

## Red Flags

**Never:**
- Start implementation on main/master branch without explicit user consent
- Skip reviews (spec compliance OR code quality)
- Proceed with unfixed issues
- Dispatch multiple implementation subagents in parallel (conflicts)
- Make subagent read plan file (provide full text instead)
- Skip scene-setting context (subagent needs to understand where task fits)
- Ignore subagent questions (answer before letting them proceed)
- Accept "close enough" on spec compliance (spec reviewer found issues = not done)
- Skip review loops (reviewer found issues = implementer fixes = review again)
- Let implementer self-review replace actual review (both are needed)
- **Start code quality review before spec compliance is ✅** (wrong order)
- Move to next task while either review has open issues

**If subagent asks questions:**
- Answer clearly and completely
- Provide additional context if needed
- Don't rush them into implementation

**If reviewer finds issues:**
- Implementer (same subagent) fixes them
- Reviewer reviews again
- Repeat until approved
- Don't skip the re-review

**If subagent fails task:**
- Dispatch fix subagent with specific instructions
- Don't try to fix manually (context pollution)

## Integration

**Required workflow skills:**
- **`/brainstorm`** (brainstorming) — writes the spec this flow consumes
- **`/plan`** (writing-plans) — writes the plan this flow executes
- **`/review`** (requesting-code-review) — review template for reviewer subagents
- **`/finishing-branch`** (finishing-a-development-branch) — complete development after all tasks

**Subagents should follow:**
- **`/tdd`** (test-driven-development) — subagents follow TDD for each task
