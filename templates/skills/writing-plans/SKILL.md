---
name: writing-plans
description: Use when you have a spec or requirements for a multi-step task, before touching code
---

# Writing Plans

## Overview

Write comprehensive implementation plans assuming the engineer has zero context for our codebase and questionable taste. Document everything they need to know: which files to touch for each task, code, testing, docs they might need to check, how to test it. Give them the whole plan as bite-sized tasks. DRY. YAGNI. Frequent commits.

Assume they are a skilled developer, but know almost nothing about our toolset or problem domain. Assume they don't know good test design very well.

**Announce at start:** "I'm using the writing-plans skill to create the implementation plan."

**Context:** This should be run in a dedicated worktree (created by brainstorming skill).

**Save plans to:** `docs/superpowers/plans/YYYY-MM-DD-<feature-name>.md`
- (User preferences for plan location override this default)

## Scope Check

If the spec covers multiple independent subsystems, it should have been broken into sub-project specs during brainstorming. If it wasn't, suggest breaking this into separate plans — one per subsystem. Each plan should produce working, testable software on its own.

## File Structure

Before defining tasks, map out which files will be created or modified and what each one is responsible for. This is where decomposition decisions get locked in.

- Design units with clear boundaries and well-defined interfaces. Each file should have one clear responsibility.
- You reason best about code you can hold in context at once, and your edits are more reliable when files are focused. Prefer smaller, focused files over large ones that do too much.
- Files that change together should live together. Split by responsibility, not by technical layer.
- In existing codebases, follow established patterns. If the codebase uses large files, don't unilaterally restructure - but if a file you're modifying has grown unwieldy, including a split in the plan is reasonable.

This structure informs the task decomposition. Each task should produce self-contained changes that make sense independently.

## Bite-Sized Task Granularity

**Each step is one action (2-5 minutes):**
- "Implement one focused change" - step
- "Run the exact verification command and check its output" - step
- "Commit" - step

## Plan Document Header

**Every plan MUST start with this header:**

```markdown
# [Feature Name] Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use the sub-skill named in **Execution mode** below (superpowers:subagent-driven-development or superpowers:executing-plans) to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** [One sentence describing what this builds]

**Architecture:** [2-3 sentences about approach]

**Tech Stack:** [Key technologies/libraries]

**Execution mode:** [executing-plans | subagent-driven-development] — [one line: which Execution Mode row fired, or "user's choice"]. Tasks: [N], files touched: [M], dependency chain: [yes | no].

**Spec:** [path to the spec/design doc this plan implements — the plan
argues from the spec, so the spec travels with it; executors read both]

## Global Constraints

[The spec's project-wide requirements — version floors, dependency limits,
naming and copy rules, platform requirements — one line each, with exact
values copied verbatim from the spec. Every task's requirements implicitly
include this section.]

---
```

## Task Structure

````markdown
### Task N: [Component Name]

**Files:**
- Create: `exact/path/to/file.py`
- Modify: `exact/path/to/existing.py:123-145`

- [ ] **Step 1: Implement**

```python
def function(input):
    return expected
```

- [ ] **Step 2: Verify**

Run: `python -m app.cli function-input`
Expected: prints `expected`

- [ ] **Step 3: Commit**

```bash
git add src/path/file.py
git commit -m "feat: add specific feature"
```
````

## No Placeholders

Every step must contain the actual content an engineer needs. These are **plan failures** — never write them:
- "TBD", "TODO", "implement later", "fill in details"
- "Add appropriate error handling" / "add validation" / "handle edge cases"
- "Write tests for the above" (without actual test code)
- "Similar to Task N" (repeat the code — the engineer may be reading tasks out of order)
- Steps that describe what to do without showing how (code blocks required for code steps)
- References to types, functions, or methods not defined in any task

## Remember
- Exact file paths always
- Complete code in every step — if a step changes code, show the code
- Exact commands with expected output
- DRY, YAGNI, frequent commits

## Self-Review

After writing the complete plan, look at the spec with fresh eyes and check the plan against it. This is a checklist you run yourself — not a subagent dispatch.

**1. Spec coverage:** Skim each section/requirement in the spec. Can you point to a task that implements it? List any gaps.

**2. Placeholder scan:** Search your plan for red flags — any of the patterns from the "No Placeholders" section above. Fix them.

**3. Type consistency:** Do the types, method signatures, and property names you used in later tasks match what you defined in earlier tasks? A function called `clearLayers()` in Task 3 but `clearFullLayers()` in Task 7 is a bug.

**4. Run every verification command.** Not read — RUN, on the current clean tree, before the plan ships. A command that fails on an unmodified tree cannot say anything about a task's diff: the executor reads its failure as broken code and burns fix rounds on code that is fine. Field case: a plan's `xcodebuild -destination 'generic/platform=iOS Simulator'` demanded an architecture slice the project had stopped building three weeks earlier — the executor "fixed" its own correct code three times before testing the baseline. Same for deploy and CLI commands: check the flags against `--help`, because a CLI that rejects an unknown option by printing help and exiting 0 reads as success. A command you could not run is not a verification step — replace it or mark the step manual.

**5. Resolve every path the plan cites.** Reference files, rules files, example files, spec paths: each one either exists on disk right now or does not belong in the plan. A cited path that resolves to nothing sends the implementer looking for a file that was never there.

**6. Anchor every claim about current behavior.** A sentence of the form "today the code does X" (especially one used to justify a task) carries `file:line`, and you opened that file to check. An unverified premise turns into a task that makes the code worse — a plan once justified a new dismiss handler with "the tap path skips OnDismiss", when the file it named already sent OnDismiss unconditionally, so the task would have fired the callback twice.

If you find issues, fix them inline. No need to re-review — just fix and move on. If you find a spec requirement with no task, add the task.

## Execution Mode

Every plan names its execution mode in the header. The choice is
qualitative and follows the shape of the task list; no file count or task
count selects a mode on its own. Decide it after the self-review, when the
task list is final, taking the first row that matches:

1. **The user chose a mode** (executing-plans, subagent-driven-development,
   or fork inside executing-plans) → that mode. Record "user's choice".
2. **The tasks form a dependency chain** — a task builds on decisions or
   interfaces the previous task settles, the same files or interfaces are
   reshaped more than once, or the work is a sequential refactor inside one
   module → **executing-plans**. One session keeps the chain of decisions;
   a fresh context has to be told every one of them, and nothing measured
   shows a fresh implementer writing more correct code.
3. **The tasks are self-contained** — each states its inputs, its result and
   its verification, and every decision a later task needs can be written
   into a brief or the progress checkpoint → **subagent-driven-development**.
   The bounded scope is what a fresh prompt buys: a reason to isolate the
   implementer and run it on a cheaper model, not a promise of higher
   correctness or parallel speed.
4. **Anything else** (mixed, small, no clear delegation boundary) →
   **executing-plans**.

What does NOT pick a mode: "10+ files", "3+ tasks", or a `Conforms to:`
line. Record task count, files touched and whether a dependency chain
exists in the header — they are observed parameters for later calibration,
not triggers. `Conforms to:` stays a mandatory input for the reviewer in
either mode; it says nothing about who implements.

Write the mode and a one-line reason into the header's `**Execution mode:**`
line. Never change the mode at execution time: the executor runs what the
header names, and if the plan looks mis-classified it tells the user and
lets them choose.

## Execution Handoff

After saving the plan, hand off to execution through the gor-mobile overlay's
handoff seam below (checkpoint + plan-approval dialog). Execution runs the
sub-skill named in the plan header's `**Execution mode:**` line —
superpowers:subagent-driven-development (fresh implementer per task, one
combined review per task, bounded fix loop, final review gate) or
superpowers:executing-plans (the session implements, delegating
self-contained small tasks; fork on the user's request). Same chain on
Claude and Codex.
