---
description: Requesting Code Review — dispatch code-reviewer subagent to catch issues
---

Target: **$ARGUMENTS** (feature name, file path, or "last changes")

## gor-mobile overlay (two deltas only)

This command runs the superpowers `requesting-code-review` skill **verbatim** — read
`~/.claude/skills/gor-mobile-requesting-code-review/SKILL.md` and follow it exactly.
The `code-reviewer` agent definition referenced by the skill lives at
`~/.claude/skills/gor-mobile-requesting-code-review/code-reviewer.md`.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
The user's installed rules-pack lives at `$HOME/.gor-mobile/rules/`. Never
hardcode the rubric from memory — build it from the pack's own indexes so this
works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections`. Embed the full text
  of `core`, `architecture`, and every other section present in the review
  prompt. Each bullet-rule in those files becomes a rubric entry.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers`. Attach reference
  example files from the layers the diff touches so the reviewer can compare
  actual vs. canonical shape.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

Reviewer MUST report each violation as `[<section>] file:line — description`
where `<section>` comes from the manifest section that was violated, and
end with `VERDICT: PASS|FAIL (N issues)`.

### 2. Local-LLM delegation
Run review in two passes:

**(a) Spec compliance** — dispatch the `code-reviewer` subagent per the skill.

**(b) Architecture compliance** — delegate to local LLM:

    gor-mobile llm review      --input <prompt-file>   # standard
    gor-mobile llm review-deep --input <prompt-file>   # subtle bugs / perf

On `status == OK` use `.content`. On `BLOCKED` / `ERROR` escalate to Opus.

After the review: FAIL → hand issues back to `/implement` in FIX mode.
PASS → run `/verify`.
