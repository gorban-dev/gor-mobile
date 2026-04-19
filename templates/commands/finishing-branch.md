---
description: Android — finish a development branch: tidy commits, PR description, checklist
---

# /finishing-branch — wrap up a dev branch

## Preconditions

- `/verify` has passed (VERDICT: PASS with evidence)
- Working tree is clean or has intentional staged changes

## Step 1 — state of the branch

Run (via Bash):

- `git status`
- `git log --oneline main..HEAD`
- `git diff main...HEAD --stat`

Summarise: what the branch does, which features/layers changed, open TODOs.

## Step 2 — tidy up

- No `println`, no stale TODOs, no commented-out code
- Commit messages use conventional style (`feat:`, `fix:`, `refactor:`, ...)
- Squash noise commits if the branch has churn — propose the plan and WAIT for user approval before rewriting history

## Step 3 — PR description

Compose a draft PR body with these sections:

```
## Summary
<1-3 bullets: what changed, user-visible impact>

## Changes
- <layer/feature>: <what>
- ...

## Testing
- Unit tests: <what was added/covered>
- Manual: <test-ui evidence or screenshots>

## Risks / follow-ups
- ...
```

## Step 4 — ask

Ask the user: `Push this branch and open a PR?`

Do NOT push or `gh pr create` without explicit approval. When approved, use the `commit-commands:commit-push-pr` skill if available, otherwise push + `gh pr create`.

## Routing

This command is cloud-routed (Opus). Do not delegate to `gor-mobile llm`.
