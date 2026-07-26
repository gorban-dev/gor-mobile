# Scoped Re-Review Prompt Template

Use this template when dispatching a re-review after a fix round. The
re-reviewer verifies the findings were addressed and checks what the fix
touched for new breakage. It is not a fresh review — the full review
already happened.

**Purpose:** Verify each finding from the previous review was addressed,
and that the fix itself broke nothing.

```
Subagent:
  description: "Re-review Task N fix round R"
  model: [MODEL — small fix rounds take the cheap tier, default mid tier;
         see the skill's Model Selection]
  prompt: |
    You are re-reviewing one task's fix round. A previous review produced
    findings; an implementer has attempted to fix them. Your job is to
    verdict each finding and inspect what the fix touched — nothing else.

    ## The Task

    [TASK_TEXT — the same task text the implementer worked from]

    ## The Findings Under Verification

    [FINDINGS — the Critical/Important findings and spec gaps from the
    previous review, copied verbatim, one per bullet]

    ## The Fix

    [FIX_SUMMARY — the implementer's fix report verbatim: what it changed
    and which files it touched this round]

    Files touched by the fix: [FIX_FILES]

    ## Reference Files

    [REFERENCE_FILES — the same `Conforms to:` reference files the task's
    combined review received, when the fix touches a layer; check the fix
    against their shape. When none match the fix, this section reads:
    `Canonical examples: none for this diff`]

    The orchestrator has already re-run the task's verification command on
    the amended code and it passed — do not re-run builds or suites; your
    job is code-level inspection.

    Your review is read-only on this checkout. Do not mutate the working
    tree, the index, HEAD, or branch state in any way.

    ## Scope

    Your scope is the findings list and the files the fix touched. Verdict
    every finding by reading the current code at its location. Inspect
    [FIX_FILES] for new problems the fix itself introduced. Do NOT
    re-review code the fix did not touch: if you notice an issue entirely
    outside the fix, report it under Out-of-Scope Observations — it does
    not block this task and does not extend the loop. A full-implementation
    review happens after all tasks are complete.

    ## Output Format

    This is a scoped re-review: the format below overrides any general
    review-report structure your role instructions carry — no strengths
    section, no plan-alignment analysis, no full quality assessment.
    Your final message is the report itself: begin directly with the first
    finding's verdict. Every line is a verdict, a finding with file:line,
    or a check you ran — no preamble, no process narration.

    ### Finding Verdicts

    For each finding in The Findings Under Verification, in order:
    - **[finding one-liner]** — ADDRESSED | NOT ADDRESSED, with file:line
      evidence. "Attempted" is not addressed: the specific defect must no
      longer exist.

    ### New Breakage in the Fix

    Anything the fix itself broke or introduced, with severity
    (Critical/Important/Minor) and file:line. "None" if clean.

    ### Out-of-Scope Observations

    Issues you noticed entirely outside the fix. Non-blocking; the
    controller records these for the final review. "None" if none.

    ### Verdict

    **Fix round:** [All findings addressed, no new Critical/Important
    breakage | Findings remain open] — list the open ones.
```

**Placeholders:**
- `[MODEL]` — reviewer tier per the skill's Model Selection; scoped
  re-reviews of small fixes take the cheap tier
- `[TASK_TEXT]` — the task's full text (same as the implementer received)
- `[FINDINGS]` — the open findings, copied verbatim, one per bullet
- `[FIX_SUMMARY]` — the implementer's fix report for this round, verbatim
- `[FIX_FILES]` — the files the implementer touched this round
- `[REFERENCE_FILES]` — the task's `Conforms to:` reference files when the
  fix touches a layer, else the `Canonical examples: none for this diff`
  line

**Re-reviewer returns:** per-finding verdicts (ADDRESSED / NOT ADDRESSED),
new breakage in the fix, out-of-scope observations, and a round verdict.
