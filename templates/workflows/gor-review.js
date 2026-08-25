export const meta = {
  name: 'gor-review',
  description: 'gor-mobile two-pass code review: gor-mobile reviewer and Codex second opinion, in parallel',
  whenToUse: 'Review accumulated working-tree changes against the base branch in a gor-mobile repo — standalone, or as the final review of an executed plan',
  phases: [
    { title: 'Scope', detail: 'diff metrics, touched layers, Codex detection' },
    { title: 'Review', detail: 'gor-mobile reviewer and Codex in parallel' },
    { title: 'Merge', detail: 'dedup, severity policy, conflict surfacing' },
  ],
}

// Slash invocation delivers a string or an array of tokens; the nested call
// from gor-execute (stage 2) passes an object. Normalize both defensively.
const tokens = Array.isArray(args) ? args.map(String)
  : typeof args === 'string' ? args.split(/\s+/).filter(Boolean)
  : []
const opt = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const finalMode = opt.mode === 'final'
const explicitDeep = tokens.includes('deep')
const baseOverride = opt.base
  ?? ((tokens.find(t => t.startsWith('base=')) ?? '').slice(5) || null)
// Strip shell metacharacters — focus is later embedded unquoted-ish inside a
// double-quoted flag string handed to the codex agent to run.
const focus = tokens.filter(t => t !== 'deep' && !t.startsWith('base=')).join(' ').replace(/[^\w\s./-]/g, '')
// baseRef lands in that same double-quoted string; a hostile repo's default
// branch name (git refnames allow $, backticks, parens) could otherwise smuggle
// command substitution into the codex agent's shell command.
const BASE_REF_SHAPE = /^[\w./-]+$/
if (baseOverride && !BASE_REF_SHAPE.test(baseOverride)) {
  return { status: 'error', error: 'base ref contains unsupported characters — pass a plain ref via base=<ref>' }
}

phase('Scope')

const SCOPE_SCHEMA = {
  type: 'object',
  required: ['baseRef', 'emptyDiff', 'treeDirty', 'loc', 'securityTouched', 'layers', 'exampleFiles', 'rulesFiles', 'codexCompanion'],
  properties: {
    baseRef: { type: ['string', 'null'], description: 'resolved base ref, null if unresolvable' },
    emptyDiff: { type: 'boolean' },
    treeDirty: { type: 'boolean', description: 'true if git status --porcelain is non-empty' },
    loc: { type: 'number', description: 'insertions+deletions from git diff --shortstat' },
    securityTouched: { type: 'boolean' },
    layers: { type: 'array', items: { type: 'string' } },
    exampleFiles: { type: 'array', items: { type: 'string' }, description: 'absolute paths of canonical example .kt files for touched layers' },
    rulesFiles: { type: 'array', items: { type: 'string' }, description: 'absolute paths of the core and architecture rules files' },
    codexCompanion: { type: ['string', 'null'], description: 'absolute path of codex-companion.mjs, null if plugin absent' },
  },
}

const scopePrompt = `You are the scope collector for a code review. Run these
checks from the repository root (current directory) and return ONLY the
structured result.

1. Base ref: ${baseOverride ? `use "${baseOverride}" verbatim.` : `try in order
   until one resolves: \`git symbolic-ref refs/remotes/origin/HEAD\` (strip
   only the refs/remotes/ prefix, e.g. refs/remotes/origin/main → origin/main
   — keep the remote name), then origin/main, then main, then master (verify
   with \`git rev-parse --verify <ref>\`). If none resolves, return
   baseRef: null.`}
2. Status: run \`git status --porcelain\` first. treeDirty = non-empty output.
   untrackedFiles = paths from lines starting with \`??\` (strip the \`?? \`
   prefix). Diff: \`git diff --shortstat <baseRef>\` (no ..HEAD — working tree
   vs base, committed and uncommitted together; untracked files never appear
   in a diff, so they do not add to loc). loc = insertions + deletions from
   that output. emptyDiff = true only when the diff produced no output AND
   untrackedFiles is empty.
3. Touched files: \`git diff --name-only <baseRef>\` PLUS untrackedFiles from
   step 2 (deduplicated). securityTouched = any touched path or diff hunk
   concerns security, auth, payments, crypto, IPC, or binder code.
4. Layers: read $HOME/.gor-mobile/rules/examples/index.json if it exists; map
   touched files to its .layers; for each touched layer pick 1-3 example .kt
   paths (prefer the closest analogue), return them as absolute paths under
   $HOME/.gor-mobile/rules/. Missing index → layers: [], exampleFiles: [].
5. Rules: read $HOME/.gor-mobile/rules/manifest.json → .sections; return the
   absolute paths of the core and architecture section files in rulesFiles
   (missing manifest → []).
6. Codex: run \`ls -t $HOME/.claude/plugins/cache/openai-codex/codex/*/scripts/codex-companion.mjs 2>/dev/null\`
   and take the FIRST line of the output yourself; codexCompanion = that
   path, or null if the output is empty.`

const scope = await agent(scopePrompt, { label: 'scope', effort: 'low', schema: SCOPE_SCHEMA })
if (!scope) return { status: 'error', error: 'scope agent failed — rerun /gor-review' }
if (!scope.baseRef) return { status: 'error', error: 'base ref not resolved — rerun as: /gor-review base=<branch>' }
if (!BASE_REF_SHAPE.test(scope.baseRef)) return { status: 'error', error: 'base ref contains unsupported characters — pass a plain ref via base=<ref>' }
if (scope.emptyDiff) return { status: 'clean', baseRef: scope.baseRef, summary: `no changes vs ${scope.baseRef} — nothing to review` }

// codexCompanion is interpolated unquoted into a shell command below — reject
// a shape that doesn't match the expected script path rather than trust a
// confused or prompt-injected scope agent's output.
const CODEX_COMPANION_SHAPE = /^[\w./-]+\/codex-companion\.mjs$/
if (scope.codexCompanion && !CODEX_COMPANION_SHAPE.test(scope.codexCompanion)) {
  log('codex companion path failed validation — skipping Codex pass')
  scope.codexCompanion = null
}

// Routing is code, not prose. Our reviewer escalates on size, risk surface,
// an explicit ask, or final mode; Codex goes adversarial ONLY on risk surface
// or an explicit ask — LOC alone must not buy the most expensive Codex mode.
const deepPass = finalMode || explicitDeep || scope.loc > 400 || scope.securityTouched
const codexAdversarial = explicitDeep || scope.securityTouched
// Codex has no combined mode: with a dirty tree it reviews working-tree
// changes only (staged+unstaged+untracked), NOT the full branch diff vs base
// that our own reviewer covers. Recorded so the merge step and the caller
// know Codex's report may be a strict subset.
const codexScope = scope.treeDirty ? 'working-tree' : 'branch'

const REVIEW_SCHEMA = {
  type: 'object',
  required: ['strengths', 'findings'],
  properties: {
    strengths: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        required: ['severity', 'title', 'detail'],
        properties: {
          severity: { enum: ['critical', 'important', 'minor'] },
          title: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'number' },
          detail: { type: 'string' },
        },
      },
    },
  },
}

const CODEX_SCHEMA = {
  type: 'object',
  required: ['ran', 'report'],
  properties: {
    ran: { type: 'boolean' },
    report: { type: 'string', description: 'the Codex review report verbatim; empty string when ran=false' },
    error: { type: 'string' },
  },
}

const contextLines = []
contextLines.push(`Base ref: ${scope.baseRef}`)
contextLines.push('Scope: every change accumulated on the current branch — committed and uncommitted. Inspect with `git status --short`, `git diff --stat ' + scope.baseRef + '`, `git diff ' + scope.baseRef + '` (no ..HEAD, no --cached).')
if (scope.rulesFiles.length > 0) contextLines.push('Architecture rules — read first: ' + scope.rulesFiles.join(', '))
contextLines.push(scope.exampleFiles.length > 0
  ? 'Canonical layer examples — the diff\'s shape in each touched layer must conform; a deviation is at least Important: ' + scope.exampleFiles.join(', ')
  : 'Canonical examples: none for this diff')
if (focus) contextLines.push('Focus per user: ' + focus)
if (finalMode && opt.planPath) contextLines.push(`Final full-implementation review of the plan at ${opt.planPath}: judge cross-task properties — consistency between tasks, architecture drift, duplication, dead leftovers. Do not re-litigate per-task findings already approved.`)
if (finalMode && Array.isArray(opt.deferredMinors) && opt.deferredMinors.length > 0) contextLines.push('Deferred minor findings from per-task reviews — triage which must be fixed before merge:\n' + opt.deferredMinors.map(m => '- ' + m).join('\n'))
if (finalMode && Array.isArray(opt.parked) && opt.parked.length > 0) contextLines.push('Parked findings with rulings (both sides recorded — re-judge):\n' + opt.parked.map(p => '- ' + p).join('\n'))

const reviewerPrompt = `Review the working-tree changes of this repository.

${contextLines.join('\n\n')}

Do not re-run tests or builds — your job is code-level inspection.
Severity policy: critical = must fix now, important = fix before proceeding,
minor = note. Return the structured result only.`

// Built only when the companion exists — scope.codexCompanion is an unquoted
// absolute path so the command line starts with the literal text
// `node <abs-path>`, matching codexCompanionAllowEntry()'s exact-path allow
// entry, which carries no quotes either. Quoting it here would break that
// prefix match.
const codexCmd = scope.codexCompanion
  ? (codexAdversarial
      ? `node ${scope.codexCompanion} adversarial-review "--wait${codexScope === 'working-tree' ? '' : ' --base ' + scope.baseRef}${focus ? ' ' + focus : ''}"`
      : `node ${scope.codexCompanion} review "--wait${codexScope === 'working-tree' ? '' : ' --base ' + scope.baseRef}"`)
  : null

const codexPrompt = codexCmd ? `Run this exact command in the repository root and wait for
it to finish (it can take many minutes — do not abort it):

    ${codexCmd}

Return ran=true and the full report it prints, verbatim, in "report". If the
command fails because the codex CLI is not installed or not ready, return
ran=false with the error message in "error" — that is a valid outcome, not a
failure to retry.` : null

phase('Review')
const [gor, codex] = await parallel([
  () => agent(reviewerPrompt, {
    label: deepPass ? 'review:deep' : 'review:standard',
    phase: 'Review',
    agentType: deepPass ? 'gor-mobile-code-reviewer-deep' : 'gor-mobile-code-reviewer',
    schema: REVIEW_SCHEMA,
  }),
  () => codexPrompt
    ? agent(codexPrompt, { label: 'review:codex', phase: 'Review', effort: 'low', schema: CODEX_SCHEMA })
    : Promise.resolve(null),
])

const codexRan = Boolean(codex && codex.ran && codex.report)
if (!gor && !codexRan) return { status: 'error', error: 'both review passes failed — rerun /gor-review' }
if (codex && codex.ran === false && codex.error) log('Codex present but not ready: ' + codex.error)
if (!gor && codexRan) log('gor-mobile reviewer pass failed — result is Codex-only')

phase('Merge')
if (!codexRan) {
  return {
    status: 'reviewed', baseRef: scope.baseRef, deep: deepPass, codexRan: false,
    gorRan: Boolean(gor), codexScope,
    strengths: gor.strengths, findings: gor.findings, conflicts: [],
  }
}

const MERGE_SCHEMA = {
  type: 'object',
  required: ['strengths', 'findings', 'conflicts'],
  properties: {
    strengths: { type: 'array', items: { type: 'string' } },
    findings: REVIEW_SCHEMA.properties.findings,
    conflicts: { type: 'array', items: { type: 'string' }, description: 'genuine disagreements between the two passes, one line each — never silently drop a side' },
  },
}

const mergePrompt = `Merge two independent code-review reports into one.
De-duplicate overlapping findings (keep the more precise wording and location),
keep the union, preserve each finding's severity — on a severity disagreement
for the same issue keep the higher one. On a genuine disagreement about whether
an issue is real, prefer the side backed by a concrete repro or line reference
and record the disagreement in "conflicts" instead of dropping either side.

Report A (gor-mobile reviewer, structured):
${JSON.stringify(gor ?? { strengths: [], findings: [] }, null, 2)}

Report B (Codex, prose — extract its findings and severities):
Report B's coverage: ${codexScope === 'working-tree' ? 'uncommitted changes only — a subset of Report A' : 'branch diff vs base'}.${finalMode && scope.treeDirty ? ' The tree may contain pre-existing changes outside the plan — discard Report B findings on files Report A does not cover.' : ''}
${codex.report}`

const merged = await agent(mergePrompt, { label: 'merge', effort: 'low', schema: MERGE_SCHEMA })
if (!merged) return {
  status: 'reviewed', baseRef: scope.baseRef, deep: deepPass, codexRan: true,
  gorRan: Boolean(gor), codexScope,
  strengths: gor ? gor.strengths : [], findings: gor ? gor.findings : [],
  conflicts: ['merge agent failed — Codex report returned unmerged'],
  codexReport: codex.report,
}
return {
  status: 'reviewed', baseRef: scope.baseRef, deep: deepPass, codexRan: true,
  gorRan: Boolean(gor), codexScope,
  strengths: merged.strengths, findings: merged.findings, conflicts: merged.conflicts,
}
