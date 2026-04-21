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

<!-- END gor-mobile overlay -->