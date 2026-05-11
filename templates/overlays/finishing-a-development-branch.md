<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (no-op default)

The skill body above describes a full merge / branch-delete / commit
flow. The gor-mobile overlay **disables all of it by default**.

### Default behaviour (from any entry point)

When this skill is invoked from another flow (`executing-plans`,
`subagent-driven-development`, or as the natural "wrap-up" step after
a feature is implemented):

1. Run `git status --short` and `git diff --stat` to show what changed.
2. Print:

       All changes are uncommitted in your working tree.
       Review `git diff`, then commit / branch / push at your own
       discretion. gor-mobile will not touch git state for you.

3. Stop. Do **not** run `git merge`, `git branch -d/-D`,
   `git checkout`, `git commit`, `git push`, or
   `git worktree remove`. gor-mobile never modifies git state
   automatically — the user owns those decisions.

### Explicit user request — opt-in only

If the user explicitly asks for a specific git operation by name
("squash my work into one commit on main", "delete the feature
branch <name>", "push and open a PR"), execute exactly that single
operation and stop. Do not chain extras (no automatic test runs,
no `git push`, no `gh pr create` unless those were also asked for).

If the user wants the full upstream merge-mode flow (sub-options
1a / 1b / 1c from the original superpowers skill), they will say so
explicitly — at which point the upstream skill body above can run.
Until that happens, this skill is a no-op reporter.

<!-- END gor-mobile overlay -->
