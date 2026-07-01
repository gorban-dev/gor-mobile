# Code Quality Reviewer Prompt Template

Use this template when dispatching a code quality reviewer subagent.

**Purpose:** Verify implementation is well-built (clean, tested, maintainable)

**Only dispatch after spec compliance review passes.**

> **MANDATORY — this is not a single dispatch.** The code-quality review stage
> is owned by `gor-mobile-requesting-code-review`, which requires **two
> independent passes**: the gor-mobile reviewer *and* an independent Codex pass
> when the `codex` plugin is installed. Prefer invoking
> `Skill(gor-mobile-requesting-code-review)` to orchestrate both. If you dispatch
> the reviewer directly, you must still detect `$CODEX_COMPANION` **first**; if
> it resolves, the Codex pass is mandatory in this same step and you may not
> report quality-review results until both passes return. See the "Codex second
> opinion" section of the requesting-code-review overlay for the exact
> detect+run commands. A bare reviewer dispatch that skips Codex is a review
> failure.

```
Task tool (superpowers:code-reviewer):
  Use template at requesting-code-review/code-reviewer.md

  WHAT_WAS_IMPLEMENTED: [from implementer's report]
  PLAN_OR_REQUIREMENTS: Task N from [plan-file]
  BASE_SHA: [commit before task]
  HEAD_SHA: [current commit]
  DESCRIPTION: [task summary]
```

**In addition to standard code quality concerns, the reviewer should check:**
- Does each file have one clear responsibility with a well-defined interface?
- Are units decomposed so they can be understood and tested independently?
- Is the implementation following the file structure from the plan?
- Did this implementation create new files that are already large, or significantly grow existing files? (Don't flag pre-existing file sizes — focus on what this change contributed.)

**Code reviewer returns:** Strengths, Issues (Critical/Important/Minor), Assessment
