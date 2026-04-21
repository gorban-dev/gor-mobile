<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (merge-mode choice for Option 1)

The skill body above runs verbatim. The following ADDs a sub-choice to
**Option 1 (Merge back to <base-branch> locally)** so the user can pick
how much of the feature-branch history lands in `main`.

### When user picks Option 1 — ask merge mode FIRST

Before running `git merge`, present this sub-prompt:

```
How would you like to land the changes?

1a. Full merge — preserves every commit including spec/plan docs
    (default, matches upstream skill behaviour)
1b. Squash to working tree — all changes appear as uncommitted
    modifications on <base-branch>; you review/run/commit manually
1c. Squash to single commit — one commit on <base-branch> with the
    combined diff, spec/plan commits dropped from history

Which sub-option?
```

Wait for `1a`/`1b`/`1c` reply. Default to `1a` on empty / unrecognised.

### 1a — Full merge (upstream default)

Run the upstream skill body verbatim:

```bash
git checkout <base-branch>
git pull --ff-only
git merge <feature-branch>
<test command>
git branch -d <feature-branch>
```

### 1b — Squash to working tree (solo-dev iterative pattern)

Materialises the full feature diff as **uncommitted** changes on
`<base-branch>`. User then builds/runs on device, reviews manually, and
decides how to commit (new branch + MR, direct commit on base, or
discard).

```bash
git checkout <base-branch>
git pull --ff-only
git merge --squash <feature-branch>   # applies diff to index, no commit
git reset HEAD                         # unstage — leaves changes in working tree
git branch -D <feature-branch>         # drop feature branch (history squashed)
```

After this: `git status` shows the feature as modified/untracked files,
`git diff` shows the full diff. Print this guidance to the user:

```
Done — feature-branch changes are now uncommitted on <base-branch>.

Next steps (your choice):
- Verify on device:       <build command, e.g. ./gradlew installDebug>
- Review diff:            git diff
- New branch + MR:        git checkout -b <name> && git add -p && git commit && git push && gh pr create
- Direct commit on base:  git add -A && git commit -m "<message>"
- Discard everything:     git checkout . && git clean -fd
```

### 1c — Squash to single commit

One commit on `<base-branch>` combining all feature work. Spec/plan
commits drop from history but the diff is preserved.

```bash
git checkout <base-branch>
git pull --ff-only
git merge --squash <feature-branch>
# Prompt user for commit message; default to feature branch name
git commit -m "<message>"
<test command>
git branch -D <feature-branch>
```

### Cleanup rules

For all three sub-options worktree cleanup runs per upstream Step 5
(`git worktree remove <worktree-path>`). No overlay change there.

### When to pick which

- **1a** — team workflow, spec/plan are audit artefacts shared with
  reviewers, git history is part of documentation.
- **1b** — solo workflow, iterative verification on device/simulator
  before committing, user prefers building MR manually with clean
  history.
- **1c** — solo workflow, user trusts AI work enough to commit directly
  on base, wants a clean single-commit history.

<!-- END gor-mobile overlay -->
