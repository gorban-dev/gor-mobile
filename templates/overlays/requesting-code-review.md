<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin + local-LLM delegation)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `architecture` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` before preparing the review context.

### Pre-screen pass — local-LLM offload
For large diffs (>200 LOC changed), delegate a cheap architecture pre-screen
to LM Studio before dispatching the `gor-mobile-code-reviewer` subagent:

    $HOME/.gor-mobile/scripts/llm-review.sh <diff-or-paths> <working-dir>

Returns JSON with `concerns` and `notes`. Feed these into the reviewer
subagent prompt as "focus areas" — it cuts the reviewer's scope from
"read everything" to "verify these specific claims", producing a tighter
final report.

For smaller diffs, skip the pre-screen and go straight to the reviewer
subagent — the round-trip isn't worth it.

<!-- END gor-mobile overlay -->
