---
description: Dispatching Parallel Agents — fan out independent subagents for broad research or independent tasks
---

Task from user: **$ARGUMENTS**

## gor-mobile overlay (two deltas only)

This command runs the superpowers `dispatching-parallel-agents` skill **verbatim** — read
`~/.claude/skills/gor-mobile-dispatching-parallel-agents/SKILL.md` and follow it exactly.

The following two adaptations apply (they ADD to, do not override, the skill):

### 1. Architecture rules + examples
When dispatched subagents touch Kotlin, include the rules-pack in their prompt.
Never hardcode section / layer names — read them from the pack's own indexes
so this works with the default pack AND with a user's custom one
(`gor-mobile rules use <url>`):

- `$HOME/.gor-mobile/rules/manifest.json` — `.sections`. Pass `core` +
  `architecture` excerpts, plus any sections relevant to the subagent's slice.
- `$HOME/.gor-mobile/rules/examples/index.json` — `.layers`. Attach 1-3 example
  files from the matching layer.

If `manifest.json` / `examples/index.json` are missing, fall back to
`ls $HOME/.gor-mobile/rules/rules/*.md` and `ls $HOME/.gor-mobile/rules/examples/*/`.

### 2. Local-LLM delegation
This command routes to Opus — no local delegation. The orchestrator role is
the point; individual subagents may still call `gor-mobile llm <role>` inside
their work per their own skill overlay.
