# Combined Review Prompt Template

Use this template for the one review dispatch each task gets: spec
compliance and code quality in a single pass by `gor-mobile-code-reviewer`.
Per-task reviews never run Codex — that pass belongs to the final
full-implementation review through `gor-mobile-requesting-code-review`.

**Purpose:** Verify the implementer built what the brief asked (nothing
more, nothing less) and built it well — one dispatch, two report sections.

```
Agent (gor-mobile-code-reviewer):
  description: "Review Task N"
  model: ["sonnet" for the default tier; "haiku" for a non-behavioral
         task; omitted (session model) for escalations, with the
         extra-scrutiny paragraph first — see the overlay's Review routing]
  prompt: |
    You are reviewing one task's implementation for spec compliance and
    code quality. Report both sections; the controller acts on each.

    ## What Was Requested

    Read the task brief — it is the requirements, exact values included:

    [BRIEF_PATH — the same brief file the implementer received]

    Global constraints that bind this task, copied verbatim from the plan:

    [GLOBAL_CONSTRAINTS]

    ## What the Implementer Reports

    [REPORT_PATH]

    The controller has already run the task's verification command on this
    code and it passed — do not re-run builds or suites; your job is
    code-level inspection.

    ## The Change

    Review package (stat summary + full diff of exactly this task's
    changes): [PACKAGE_PATH — from scripts/review-package PLAN_FILE BASE HEAD]

    Read the actual files where the diff needs surrounding context. Your
    review is read-only: do not mutate the working tree, the index, HEAD or
    branch state.

    ## Reference Files

    [REFERENCE_FILES — every file named by the task's artifact lines: the
    `Conforms to:` pack paths resolved against $HOME/.gor-mobile/rules/,
    `Conforms to (project precedent):` repo paths, plus the architecture
    section from manifest.json → .sections.architecture. A layer whose line
    reads `Shape per user: <...>` is quoted here instead. When no example
    matches the diff, this section reads exactly:
    `Canonical examples: none for this diff`]

    ## Section 1 — Spec compliance

    Do not trust the report: read the code and compare it to the brief line
    by line, including modifier chains and argument lists — the brief's
    exact values, not a paraphrase.

    - Missing: requirements skipped, or claimed but not implemented
    - Extra: anything built that the brief did not ask for
    - Misread: a requirement interpreted differently than written

    ## Section 2 — Code quality

    Correctness, error handling, conventions, and diff shape against the
    reference files (a deviation from a canonical layer shape is at least
    Important). Also:
    - Does each file have one clear responsibility with a well-defined
      interface, following the file structure the plan set?
    - Did this change create files that are already large, or grow existing
      ones significantly? Judge what this change contributed, not
      pre-existing sizes.
    - Any `@Composable` touched: check against the
      `gor-mobile-compose-internals` rules digest and the reference files
      named in the brief's `Compose rules:` line; verify unfamiliar Compose
      signatures against KDoc / androidx sources, never from memory.
    - Tests, only if the brief asked for them: do they assert behavior
      rather than mocks?

    ## Report

    ### Spec compliance
    ✅ Compliant, or ❌ with each gap as a finding (file:line, what is
    missing or extra).

    ### Code quality
    Findings by severity — Critical / Important / Minor — each with
    file:line, what is wrong, why it matters, and the fix.

    ### Process notes
    Defects in the brief, the plan or this review context (an under-listed
    `Conforms to:` line, a reference file missing from your context) — the
    plan owner's to fix, never an implementer finding.

    ### Verdict
    Approved (both sections clean, minors only) | Findings open.
```

**Placeholders:**
- `[BRIEF_PATH]`, `[REPORT_PATH]`, `[PACKAGE_PATH]` — as printed by
  `scripts/task-brief`, the dispatch, and `scripts/review-package`
- `[GLOBAL_CONSTRAINTS]` — the plan's Global Constraints section, verbatim
- `[REFERENCE_FILES]` — the task's artifact-line files, or the
  `Canonical examples: none for this diff` line

The dispatch rules of the skill body apply: no pre-judged findings, no
open-ended directives, no request to re-run verification.

**Reviewer returns:** spec-compliance verdict with gaps, code-quality
findings by severity, process notes, and a task verdict.
