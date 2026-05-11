<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `architecture` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` before preparing the review context.

### Reviewer selection

Default path — dispatch the Sonnet reviewer:

    Task(subagent_type = "gor-mobile-code-reviewer", prompt = <review-prompt>)

Escalate to the Opus reviewer when any of:
- Diff exceeds ~400 LOC changed.
- The change touches security, auth, payments, crypto, IPC, or binder code.
- The user explicitly asks for a "deep" / "thorough" review.

        Task(subagent_type = "gor-mobile-code-reviewer-deep", prompt = <review-prompt>)

Both reviewers share a system prompt; the deep variant carries extra
scrutiny instructions and runs on Opus.

### Override: review the working tree, not a SHA range

gor-mobile cycles do not commit between tasks (see the overlays for
`executing-plans`, `subagent-driven-development`, and
`test-driven-development`). The upstream reviewer prompt template at
`requesting-code-review/code-reviewer.md` (and the dispatch templates
referenced from `subagent-driven-development/*-reviewer-prompt.md`)
assumes a `BASE_SHA..HEAD_SHA` range. With no commits, that range is
empty and the reviewer sees nothing.

Override the placeholder substitution for **every** reviewer dispatch
(through this skill, through `subagent-driven-development` flow, or
otherwise):

1. **Resolve the base ref** at dispatch time. Try in order:
   - `git symbolic-ref refs/remotes/origin/HEAD` and strip
     `refs/remotes/origin/` (gives e.g. `main` or `master`).
   - `origin/main` if the remote ref exists.
   - `main`, then `master`.
   - If none resolve, ask the user for the base branch and use that.

   Store the result as `<BASE_REF>`.

2. **Fill the upstream prompt template** with:
   - `{BASE_SHA}` ← `<BASE_REF>` (a ref name, not a SHA).
   - `{HEAD_SHA}` ← the literal string `WORKING_TREE`.

3. **Replace the "Git Range to Review" block** in the filled prompt
   from:

        ## Git Range to Review

        **Base:** {BASE_SHA}
        **Head:** {HEAD_SHA}

        ```bash
        git diff --stat {BASE_SHA}..{HEAD_SHA}
        git diff {BASE_SHA}..{HEAD_SHA}
        ```

   to:

        ## What to Review

        **Base ref:** <BASE_REF>
        **Scope:** every change accumulated on the current branch —
        both committed and uncommitted in the working tree.

        ```bash
        git status --short
        git diff --stat <BASE_REF>
        git diff <BASE_REF>
        ```

   `git diff <BASE_REF>` (no `..HEAD`, no `--cached`) compares the
   working tree against the base, so committed-on-branch commits and
   uncommitted modifications appear in one unified diff — exactly the
   set of changes the gor-mobile user is about to inspect.

4. **Skip review when the diff is empty.** Before dispatch, run
   `git diff --quiet <BASE_REF>`. If it exits 0, there is nothing to
   review yet — do not spend a Task call. This prevents per-task no-op
   review dispatches inside `subagent-driven-development` when an
   implementer subagent ran but produced no working-tree change.

The reviewer agents (`gor-mobile-code-reviewer`,
`gor-mobile-code-reviewer-deep`) are unchanged — their system prompts
are generic about review and accept whatever diff the caller passes.

<!-- END gor-mobile overlay -->
