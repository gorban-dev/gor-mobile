<!-- BEGIN gor-mobile overlay -->

## gor-mobile overlay (Android/Kotlin)

The skill body above runs verbatim. The following ADD to it when the target
is an Android/Kotlin codebase.

### Architecture rules
Load `core` + `architecture` sections from `$HOME/.gor-mobile/rules/` via
`manifest.json` before preparing the review context.

Then resolve the layers touched by the diff against
`$HOME/.gor-mobile/rules/examples/index.json` → `.layers` (the *current*
pack's declared layers — never a remembered default list) and include those
layers' example `.kt` files (1–3 per layer, prefer the closest analogue) in
the `<review-prompt>` built for the gor-mobile reviewer (see Reviewer
selection below). A shape deviation from a canonical layer example is at
least an **Important** finding. If only some touched layers have matching
examples, include the ones that do and name the ones that don't. Layers the
plan grounded via the absence ladder travel here too: include the repo
files from `Conforms to (project precedent): ...` lines (a deviation from
that reference shape is likewise at least **Important**) and quote any
`Shape per user: ...` line. If the pack ships no examples, or none match
the diff, state that in the `<review-prompt>` in one line (e.g.
`Canonical examples: none for this diff`) — alongside the absence-ladder
references when the plan carries them — so the reviewer's examples
tripwire stays silent instead of hunting for missing context.

The Codex pass has no equivalent prompt channel — its CLI accepts custom
text only as the `adversarial-review` focus phrase (plain `review` takes
none). When the adversarial variant runs, fold the touched layers' example
paths into the focus phrase (e.g. `shape conformance to
examples/data/ExampleDataSource.kt`); on the plain `review` path Codex
reviews the diff unaided and conventions-conformance coverage comes from
the gor-mobile pass — union coverage, same as with diff scope.

### What a complete review is

A complete gor-mobile review is **two independent passes when the `codex`
plugin is present**: the gor-mobile reviewer (below) **and** an independent
Codex pass (further below). Detect Codex presence as the *first* action of the
review (step 1 under "Codex second opinion"); if `$CODEX_COMPANION` resolves,
the Codex pass is mandatory. Do not report the review's findings until both
passes have returned (or Codex has been confirmed absent). Announcing "I'll run
Codex" and then not dispatching it is a review failure.

**Codex runs once, on a complete implementation — not per task.** This skill is
the review of *finished* work: a standalone "review this" request, or the
**final full-implementation review** after every task in a plan is done. That is
the one place the Codex pass fires. Mid-plan **per-task / per-checkpoint**
code-quality reviews in the `subagent-driven-development` and `executing-plans`
flows do **not** invoke this skill — they dispatch
`Agent(gor-mobile-code-reviewer)` directly (gor-mobile reviewer only) and defer
Codex to this final gate. This is deliberate: Codex re-reviewing half-built
mid-plan state at every checkpoint is the token/time overrun this removes. The
guarantee is the inverse of the old one — Codex must run **at the end**, exactly
once, and the flows' mandatory final-review step routes here to ensure it does.

**This overlay remains the single source of truth for the Codex pass** — its
detection (`$CODEX_COMPANION`) and dispatch live here and nowhere else.

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

### Codex second opinion — MANDATORY when the `codex` plugin is installed

This pass belongs to a **complete / final review** (see "What a complete review
is" above) — once per plan, at the end, never per task.

If `$CODEX_COMPANION` resolves (step 1 below), you **MUST** run this second,
independent pass through the OpenAI Codex plugin (`codex@openai-codex`)
**in addition to** the gor-mobile reviewer above, and **before** you report
any review findings to the user. It is not an optional add-on and not a
"nice to have": two model families catch different classes of defect, and
the Codex pass never replaces the gor-mobile reviewer. The only way out of
this pass is `$CODEX_COMPANION` being empty (plugin absent).

1. **Detect the companion script first — before you dispatch the gor-mobile
   reviewer, not "in parallel later."** Its `review` / `adversarial-review`
   slash commands are `disable-model-invocation: true`, so you cannot
   trigger them yourself — call the script directly (newest installed
   version wins):

        CODEX_COMPANION="$(ls -t "$HOME"/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null | head -1)"

   If `$CODEX_COMPANION` is empty the plugin is not installed — skip this
   section. No second pass, not an error.

2. **Choose the scope to match the gor-mobile git model.** gor-mobile does
   not commit between tasks, so the work is usually uncommitted in the
   working tree. Passing `--base` forces Codex into `HEAD..base`
   (committed-only) mode — with no commits ahead that diff is **empty**, so:
   - Dirty working tree (typical mid-cycle) → run with **no `--base`**; Codex
     auto-selects the uncommitted working-tree diff.
   - Clean tree with commits ahead of `<BASE_REF>` (typical pre-merge) →
     pass `--base <BASE_REF>` for the branch diff.

   The gor-mobile reviewer already covers the full `git diff <BASE_REF>`
   range (committed + uncommitted), so even when Codex's narrower native
   scope sees only part of it, the union of the two passes still has full
   coverage.

3. **Run the pass.** Pick the command by the *same* trigger that escalates
   Sonnet → Opus above. Normal change → standard review:

        # dirty working tree (mid-cycle): no --base
        node "$CODEX_COMPANION" review "--wait"
        # clean tree, commits ahead (pre-merge):
        node "$CODEX_COMPANION" review "--base <BASE_REF> --wait"

   Deep / thorough, or the change touches security / auth / payments /
   crypto / IPC / binder, or diff > ~400 LOC → adversarial
   (challenge-the-design) review; append a short focus phrase naming the
   risk surface (e.g. `concurrency and the token lifecycle`):

        node "$CODEX_COMPANION" adversarial-review "--wait <focus>"
        node "$CODEX_COMPANION" adversarial-review "--base <BASE_REF> --wait <focus>"

   `--wait` runs the review in the foreground and returns Codex's report
   inline so you can act on it. For a very large change prefer `--background`
   and poll `/codex:status`.

4. **If Codex is present but not ready.** The companion requires the `codex`
   CLI; if it exits with an "is not installed" error, surface that once
   (point the user at `/codex:setup`) and continue with the gor-mobile
   reviewer's result alone. Never block the cycle on Codex.

5. **Merge the two reports.** De-duplicate overlapping findings, keep the
   union, and apply the existing severity policy (Critical → fix now,
   Important → fix before proceeding, Minor → note). On a genuine
   disagreement, prefer the finding backed by a concrete repro / line
   reference and surface the conflict to the user rather than silently
   dropping one.

### Red Flags (Codex pass)

**Never:**
- Announce "I'll check for Codex" / "running Codex in parallel" and then
  move on without actually dispatching it. Detect, then dispatch, in the
  same breath.
- Treat a present-but-unused Codex plugin as "good enough." If
  `$CODEX_COMPANION` resolved, the pass runs — it is not a judgement call.
- Report review findings to the user before the Codex pass has returned
  (or been confirmed absent).

### Context compaction — review outcome is a safe boundary

A completed review whose outcome is durable — findings applied and re-verified,
or recorded — is a safe point to compact: nothing is in flight. If a checkpoint
exists (`.gor-mobile/state/*.progress.md`), append the review outcome to it
before compacting. Do NOT compact while findings are still being triaged or
fixes are half-applied.

<!-- END gor-mobile overlay -->
