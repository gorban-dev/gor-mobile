# Implementer Subagent Prompt Template

Use this template when dispatching an implementer subagent.

```
Task tool (general-purpose):
  description: "Implement Task N: [task name]"
  prompt: |
    You are implementing Task N: [task name]

    ## Task Brief

    Read this file FIRST — it is your requirements, with the exact values
    (numbers, strings, signatures) to use verbatim:

    [BRIEF_PATH — from scripts/task-brief PLAN_FILE N]

    Isolation inputs (see Tooling contract): ISOLATE_SCRIPT =
    [absolute path of scripts/sdd-isolate — ~/.gor-mobile/scripts/sdd-isolate
    expanded], BASE_SHA = [the tree SHA scripts/sdd-snapshot printed before
    this dispatch].

    Do not read the rest of the plan file — the brief is your complete spec.

    ## Context

    [Scene-setting: ONE line on where this task fits, plus interfaces and
    decisions from earlier tasks the brief cannot know. Not the session's
    history.]

    ## Before You Begin

    You cannot ask the controller a question mid-task: your only channel
    back is your final reply. If the brief leaves a requirement, an
    acceptance criterion, a dependency or an approach ambiguous, return
    **NEEDS_CONTEXT** with the exact question before editing anything —
    the controller answers and re-dispatches you. Do not resolve the
    ambiguity by guessing.

    ## Your Job

    1. Implement exactly what the task specifies
    2. Write tests only if the user explicitly asked for them
    3. Run the verification command named in the brief and put its tail in
       the report
    4. Self-review (see below)
    5. Report back

    Work from: [directory]

    ## Code Organization

    You reason best about code you can hold in context at once, and your edits are more
    reliable when files are focused. Keep this in mind:
    - Follow the file structure defined in the plan
    - Each file should have one clear responsibility with a well-defined interface
    - If a file you're creating is growing beyond the plan's intent, stop and report
      it as DONE_WITH_CONCERNS — don't split files on your own without plan guidance
    - If an existing file you're modifying is already large or tangled, work carefully
      and note it as a concern in your report
    - In existing codebases, follow established patterns. Improve code you're touching
      the way a good developer would, but don't restructure things outside your task.

    ## Compose rules (Android/Kotlin)

    If your task creates or modifies any `@Composable`: BEFORE writing code,
    read the rules digest of the `gor-mobile-compose-internals` skill
    (SKILL.md) and every reference file listed in the brief's
    `Compose rules:` line. Code that violates the digest — a side effect in
    the composable body outside an effect handler, state without `remember`,
    a dynamic list without `key(...)`, unstable collection parameters,
    `ViewModel` / `MutableState` passed down the tree — is a defect even
    when it compiles.

    ## Tooling contract

    - External API signatures (SDK, Jetpack, any library): never from memory —
      ground them via the docs-first ladder in the gor-mobile-using-android-cli
      skill (`android docs search` / `docs fetch`, the
      google-developer-knowledge MCP server, then the resolved artifact) and
      cite what you read in your report.
    - Symbol counts and call chains: `ast-index usages|symbol|implementations`,
      never grep — a bare-identifier grep is refused by this repo's guard hook.
    - Device / emulator work: build with `./gradlew`, then deploy with the
      android CLI (`android describe` to locate the APK → `android run --apks
      <path>`; there is no --variant flag). Gestures are `android screen capture
      --annotate` → `android screen resolve --screenshot <png> --string "tap #N"`
      → `adb shell input <the printed coordinates>`: the CLI resolves targets,
      adb performs them. After any deploy, confirm the right build is actually
      running — `adb shell dumpsys activity activities | grep -m1
      topResumedActivity` must show the variant's applicationId (a debug build
      is a different package from release, and both can be installed at once).
    - A build is not verified by its exit code: require BUILD SUCCESSFUL /
      BUILD SUCCEEDED in the log, and never chain a build with `;`, `&&` or a
      pipe — the composite reports its last element.
    - A runtime bug you cannot explain from a static read: gather runtime
      evidence with the debroid CLI (`debroid launch|attach`, `break`,
      `catch-exception`, `pause-state`, `inspect`, `set-var` + `resume`) per
      the gor-mobile-systematic-debugging skill, before rewriting code on a
      hypothesis.
    - A verification command that fails unexpectedly: FIRST run it on the
      unmodified pre-task tree (isolation run) and put the result in your
      report — a gate that was already red is not your defect to repair. The
      pre-task tree is `[ISOLATE_SCRIPT] [BASE_SHA]` (prints a temp directory
      holding exactly that tree; run the command inside it). Never use git
      checkout, stash, worktree or clone to get there.
    - Never run git commit, git branch, git checkout, or git worktree — changes
      accumulate uncommitted in the working tree.
    - When you were given a numbered findings list to fix, report `unfixable`
      for any finding whose action item lies outside your allowed paths:
      its number, verbatim title, and why.

    ## When to Stop

    Return **BLOCKED** or **NEEDS_CONTEXT** instead of continuing when the
    task needs an architectural decision with several valid approaches,
    needs code or context you were not given and cannot locate, or requires
    restructuring the plan did not anticipate. State what you are stuck on,
    what you tried, and what would unblock you; the controller supplies
    context, re-dispatches on a more capable model, or splits the task.
    Unsure work reported as DONE costs a review round and a fix round; the
    same doubt reported as DONE_WITH_CONCERNS costs one line.

    ## Before Reporting Back: Self-Review

    Check, against the brief and the report you are about to write:

    - Every requirement in the brief is implemented, with the brief's exact
      values (numbers, strings, signatures) — not paraphrased.
    - Every edit is inside the allowed paths, and nothing was built beyond
      the brief (YAGNI). Anything you deliberately left out that the brief
      allowed or the code invited goes in the report as Skipped, not dropped
      silently.
    - New code follows the reference files and the existing patterns of the
      files it touches.
    - The verification command ran and its result is in the report.
    - Tests, if the user asked for them, assert behavior rather than mocks.

    Fix what the check finds before reporting.

    ## Report Format

    Write your FULL report to this file (create it; on a fix round, append
    a "## Fix round R" section instead of overwriting):

    [REPORT_PATH — brief path with -brief.md replaced by -report.md]

    The full report contains: what you implemented (or attempted, if
    blocked), what you tested and the results (commands + output summary),
    files changed, self-review findings, issues or concerns, Skipped lines.

    Then reply with ONLY:
    - **Status:** DONE | DONE_WITH_CONCERNS | BLOCKED | NEEDS_CONTEXT
    - One line on what you did
    - Concerns, one line each (if any)
    - Skipped, one line each (if any): `<what> — add when <trigger>`
    - Unfixable (fix rounds only): `<n> — <verbatim finding title> — <why>`,
      one per line, for findings whose action item lies outside your allowed
      paths

    The report file carries the detail — do not repeat it in your reply.

    Use DONE_WITH_CONCERNS if you completed the work but have doubts about correctness.
    Use BLOCKED if you cannot complete the task. Use NEEDS_CONTEXT if you need
    information that wasn't provided. Never silently produce work you're unsure about.
```
