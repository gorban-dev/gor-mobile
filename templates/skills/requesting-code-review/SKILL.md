---
name: requesting-code-review
description: Use when completing tasks, implementing major features, or before merging to verify work meets requirements
---

# Requesting Code Review

Dispatch superpowers:code-reviewer subagent to catch issues before they cascade. The reviewer gets precisely crafted context for evaluation — never your session's history. This keeps the reviewer focused on the work product, not your thought process, and preserves your own context for continued work.

**Core principle:** Review early, review often.

## When to Request Review

**Mandatory:**
- The final full-implementation review of a plan (subagent-driven
  development and executing-plans route here after their last task)
- After completing a major feature outside a plan
- Before merge to main

Per-task reviews inside a plan do not use this skill: the executor skills
dispatch the reviewer agent directly, once per task, with the task's
brief and review package (their overlays name the routing).

**Optional but valuable:**
- When stuck (fresh perspective)
- Before refactoring (baseline check)
- After fixing complex bug

## How to Request

**1. Resolve the base ref.** gor-mobile flows do not commit between tasks,
so the work under review is the branch's committed changes plus the
uncommitted working tree — never a `SHA..SHA` range, which is empty when
nothing was committed. Try in order and store the result as `<BASE_REF>`:
- `git symbolic-ref refs/remotes/origin/HEAD`, stripping
  `refs/remotes/origin/` (gives `main` or `master`).
- `origin/main` if the remote ref exists.
- `main`, then `master`.
- If none resolve, ask the user for the base branch.

**Skip the review when the diff is empty:** `git diff --quiet <BASE_REF>`
exiting 0 means there is nothing to review yet — do not spend a dispatch.

**2. Dispatch code-reviewer subagent:**

Use Task tool with superpowers:code-reviewer type, fill template at `code-reviewer.md`

**Placeholders:**
- `{WHAT_WAS_IMPLEMENTED}` - What you just built
- `{PLAN_OR_REQUIREMENTS}` - What it should do
- `{BASE_REF}` - The base ref resolved above (a ref name, not a SHA)
- `{DESCRIPTION}` - Brief summary

**3. Act on feedback:**
- Fix Critical issues immediately
- Fix Important issues before proceeding
- Note Minor issues for later
- Push back if reviewer is wrong (with reasoning)

## Example

```
[Just completed Task 2: Add verification function]

You: Let me request code review before proceeding.

BASE_REF=$(git symbolic-ref refs/remotes/origin/HEAD | sed 's#refs/remotes/origin/##')
git diff --quiet "$BASE_REF" || echo "changes to review"

[Dispatch superpowers:code-reviewer subagent]
  WHAT_WAS_IMPLEMENTED: Verification and repair functions for conversation index
  PLAN_OR_REQUIREMENTS: Task 2 from docs/superpowers/plans/deployment-plan.md
  BASE_REF: main
  DESCRIPTION: Added verifyIndex() and repairIndex() with 4 issue types

[Subagent returns]:
  Strengths: Clean architecture, real tests
  Issues:
    Important: Missing progress indicators
    Minor: Magic number (100) for reporting interval
  Assessment: Ready to proceed

You: [Fix progress indicators]
[Continue to Task 3]
```

## Integration with Workflows

**Subagent-Driven Development / Executing Plans:**
- Per-task combined reviews are dispatched by those skills directly
- This skill runs once, on the finished implementation

**Ad-Hoc Development:**
- Review before merge
- Review when stuck

## Red Flags

**Never:**
- Skip review because "it's simple"
- Ignore Critical issues
- Proceed with unfixed Important issues
- Argue with valid technical feedback

**If reviewer wrong:**
- Push back with technical reasoning
- Show code/tests that prove it works
- Request clarification

See template at: requesting-code-review/code-reviewer.md
