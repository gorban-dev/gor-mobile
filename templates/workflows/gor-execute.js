export const meta = {
  name: 'gor-execute',
  description: 'Deterministic plan executor: implementer, verification, combined review and fix-loop per task; nested gor-review as the final gate',
  whenToUse: 'Execute an approved implementation plan (docs/plans or .gor-mobile/plans) task by task in a gor-mobile repo',
  phases: [
    { title: 'Setup', detail: 'workspace, plan parsing, artifact-line validation' },
    { title: 'Tasks', detail: 'per task: snapshot, implement, verify, review, fix-loop' },
    { title: 'Final', detail: 'nested gor-review + one fix wave' },
  ],
}

// Slash invocation delivers a string or token array; a programmatic call may
// pass an object. Normalize defensively.
const tokens = Array.isArray(args) ? args.map(String)
  : typeof args === 'string' ? args.split(/\s+/).filter(Boolean)
  : []
const opt = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const planPath = opt.plan ?? tokens.find(t => !t.startsWith('-')) ?? null

const deferredMinors = []
const parkedAll = []
const taskResults = []
let initialBase = null

const out = (extra) => ({ tasksDone: taskResults.length, taskResults, deferredMinors, parked: parkedAll, ...extra })

if (!planPath) return out({ status: 'error', error: 'usage: /gor-execute <plan-file>' })

const SCRIPTS = '~/.gor-mobile/scripts'
// The installed Bash allow entry (sddScriptsAllowEntry) is the literal
// resolved absolute path with no quotes — a command starting with a quote or
// an unexpanded shell parameter expansion cannot prefix-match it and the
// agent stalls on a permission prompt. Every prompt that runs a script below
// carries this same instruction so agents resolve ~ themselves before
// invoking, rather than handing the literal text to Bash.
const SCRIPTS_NOTE = 'expand ~ to the absolute home directory and invoke by absolute path, without quotes (if GOR_MOBILE_HOME is set in the environment, use $GOR_MOBILE_HOME/scripts instead)'

phase('Setup')

const SETUP_SCHEMA = {
  type: 'object',
  required: ['workspace', 'specPath', 'constraints', 'tasks'],
  properties: {
    workspace: { type: 'string', description: 'absolute path printed by sdd-workspace' },
    specPath: { type: ['string', 'null'], description: 'spec file the plan names, null if none' },
    constraints: { type: 'string', description: 'the plan Global Constraints section verbatim' },
    verificationAll: { type: ['string', 'null'], description: 'a whole-project verification command if the plan names one, else null' },
    tasks: {
      type: 'array',
      items: {
        type: 'object',
        required: ['n', 'title', 'files', 'layers', 'conformsTo', 'shapePerUser', 'category', 'security', 'verification'],
        properties: {
          n: { type: 'number' },
          title: { type: 'string' },
          files: { type: 'array', items: { type: 'string' } },
          layers: { type: 'array', items: { type: 'string' }, description: 'architecture layers the task touches per the rules pack (empty when none/unknown)' },
          conformsTo: { type: 'array', items: { type: 'string' }, description: 'absolute reference-file paths from Conforms to: lines (pack paths resolved under $HOME/.gor-mobile/rules/, project-precedent paths under the repo)' },
          shapePerUser: { type: ['string', 'null'], description: 'the Shape per user: line verbatim, null if absent' },
          category: { enum: ['behavioral', 'non-behavioral', 'design'] },
          security: { type: 'boolean', description: 'touches security/auth/payments/crypto/IPC/binder' },
          verification: { type: ['string', 'null'], description: 'the exact verification command for this task, null if the plan gives none' },
        },
      },
    },
  },
}

const setup = await agent(`You are the setup parser for a plan execution run in this repository.
1. Run ${SCRIPTS}/sdd-workspace "${planPath}" — ${SCRIPTS_NOTE} — and record the printed workspace path.
2. Read the plan file at ${planPath}. Extract: the path of the spec it names
   (Spec: line), the Global Constraints section verbatim, and every task.
3. Per task determine: number and title; the exact file paths it creates or
   modifies; the architecture layers those files belong to per
   $HOME/.gor-mobile/rules/examples/index.json (empty list if the index is
   missing or nothing matches); reference files from its artifact lines —
   resolve "Conforms to: <pack path>" against $HOME/.gor-mobile/rules/ and
   "Conforms to (project precedent): <repo path>" against the repo root; any
   "Shape per user:" line verbatim; its category — 'non-behavioral' for pure
   wiring/DI/resources/flag work with no input-to-output or state logic,
   'design' if the plan marks it as a design decision or human-judgment task,
   otherwise 'behavioral'; whether it touches security/auth/payments/crypto/
   IPC/binder surfaces; and the exact verification command the task or plan
   states (null if none).
4. Also return a whole-project verification command if the plan names one.
Return ONLY the structured result.`, { label: 'setup', effort: 'low', schema: SETUP_SCHEMA })

if (!setup) return out({ status: 'error', error: 'setup parser failed — rerun /gor-execute' })
if (setup.tasks.length === 0) return out({ status: 'error', error: `no tasks found in ${planPath}` })

// Artifact-line gate is code, not a reviewer mandate: a layer-touching task
// with no reference and no user-stated shape is a plan defect — stop before
// any implementer writes code to an improvised shape.
const artifactDefects = setup.tasks
  .filter(t => t.layers.length > 0 && t.conformsTo.length === 0 && !t.shapePerUser)
  .map(t => `Task ${t.n} (${t.title}): touches layers [${t.layers.join(', ')}] but carries no Conforms to: / project-precedent / Shape per user: line`)
if (artifactDefects.length > 0) {
  return out({ status: 'blocked', blocked: 'plan artifact-line defects — fix the plan, then rerun', details: artifactDefects })
}

const PREP_SCHEMA = {
  type: 'object', required: ['base', 'briefPath'],
  properties: { base: { type: 'string' }, briefPath: { type: 'string' } },
}
const SNAPSHOT_SCHEMA = {
  type: 'object', required: ['base'],
  properties: { base: { type: 'string' } },
}
const IMPL_SCHEMA = {
  type: 'object', required: ['status', 'summary'],
  properties: {
    status: { enum: ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] },
    summary: { type: 'string' },
    concerns: { type: 'array', items: { type: 'string' } },
  },
}
const VERIFY_SCHEMA = {
  type: 'object', required: ['passed', 'tail'],
  properties: { passed: { type: 'boolean' }, tail: { type: 'string', description: 'last ~30 lines of output' } },
}
const PACKAGE_SCHEMA = {
  type: 'object', required: ['head', 'packagePath', 'loc'],
  properties: {
    head: { type: 'string' }, packagePath: { type: 'string' },
    loc: { type: 'number', description: 'insertions+deletions in the packaged range' },
  },
}
const FINDING = {
  type: 'object', required: ['severity', 'title', 'detail'],
  properties: {
    severity: { enum: ['critical', 'important', 'minor'] },
    title: { type: 'string' }, file: { type: 'string' }, detail: { type: 'string' },
  },
}
const REVIEW_SCHEMA = {
  type: 'object', required: ['specFindings', 'qualityFindings'],
  properties: {
    specFindings: { type: 'array', items: FINDING },
    qualityFindings: { type: 'array', items: FINDING },
    strengths: { type: 'array', items: { type: 'string' } },
  },
}
const REREVIEW_SCHEMA = {
  type: 'object', required: ['verdicts', 'newFindings'],
  properties: {
    verdicts: {
      type: 'array',
      items: {
        type: 'object', required: ['title', 'verdict'],
        properties: { title: { type: 'string' }, verdict: { enum: ['ADDRESSED', 'NOT_ADDRESSED'] } },
      },
    },
    newFindings: { type: 'array', items: FINDING, description: 'new breakage introduced by the fix diff itself, nothing else' },
  },
}
const BREAKER_SCHEMA = {
  type: 'object', required: ['rulings'],
  properties: {
    rulings: {
      type: 'array',
      items: {
        type: 'object', required: ['title', 'decision', 'ruling'],
        properties: { title: { type: 'string' }, decision: { enum: ['parked', 'blocked'] }, ruling: { type: 'string' } },
      },
    },
  },
}

const tierUp = (m) => m === 'haiku' ? 'sonnet' : m === 'sonnet' ? undefined : undefined
const implModelFor = (t) => t.category === 'design' || t.files.length > 6 ? undefined
  : t.category === 'non-behavioral' ? 'haiku' : 'sonnet'

function refBlock(t) {
  const lines = []
  if (t.conformsTo.length > 0) lines.push('Reference files — REQUIRED reading; the diff shape in each touched layer must conform to them exactly:\n' + t.conformsTo.map(p => '- ' + p).join('\n'))
  if (t.shapePerUser) lines.push('Shape per user (verbatim from the plan): ' + t.shapePerUser)
  if (lines.length === 0) lines.push('Canonical examples: none for this task')
  return lines.join('\n')
}

function implPrompt(t, briefPath, reportPath, extra) {
  return `You are the implementer for Task ${t.n} (${t.title}) of the plan at ${planPath} in this repository.

Read this first — it is your requirements, with the exact values to use verbatim: ${briefPath}

Allowed paths — refuse to create or modify anything outside this list:
${t.files.map(p => '- ' + p).join('\n')}

${refBlock(t)}

Global constraints binding every task:
${setup.constraints}

Fidelity: reproduce the task's calls exactly — match signatures, keep modifier
chains and named arguments as written, never simplify or drop parameters.
Never run git commit, git branch, git checkout, or git worktree — changes
accumulate uncommitted in the working tree.
${t.verification ? 'The orchestrator will verify with: ' + t.verification + ' — do not skip making it pass.' : ''}
${extra ?? ''}
You never dispatch subagents. Write your full report (what you did, decisions,
self-review) to ${reportPath}. Return ONLY the structured result: status
(DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED — use NEEDS_CONTEXT or
BLOCKED honestly instead of guessing), a one-line summary, and concerns.`
}

function reviewPrompt(t, briefPath, reportPath, packagePath, reduced) {
  return `You are reviewing Task ${t.n} (${t.title}) of the plan at ${planPath}.

Read: the task brief at ${briefPath}; the implementer report at ${reportPath};
the diff under review at ${packagePath} (commit list, stat, full diff — the
only diff in scope).

${refBlock(t)}

Report TWO sections, both required:
1. specFindings — the code versus the brief VERBATIM: every requirement
   present, nothing extra, exact values and modifier chains preserved.
2. qualityFindings — correctness, conventions, and diff shape versus the
   reference files above.
${reduced ? 'This task is non-behavioral wiring: check only allowed-paths compliance, that it plausibly compiles, and diff shape versus the reference files. Nothing else.' : ''}
Verification has already been run by the orchestrator — do not re-run builds
or tests; your job is code-level inspection. Severity: critical = must fix
now, important = fix before proceeding, minor = note. Return the structured
result only.`
}

function reReviewPrompt(findings, briefPath, reportPath, packagePath) {
  return `You are the scoped re-reviewer for a fix round. Findings that were to be fixed:
${findings.map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}

Read: the task brief at ${briefPath}; the implementer report (with its fix
appendix) at ${reportPath}; the fix diff at ${packagePath}.

Verdict each finding ADDRESSED or NOT ADDRESSED ("attempted" is not
addressed). Copy each verdict's title VERBATIM from the findings list above —
a paraphrased title counts as no verdict. Inspect ONLY the fix diff for new
breakage — out-of-scope observations do not belong in newFindings. Return the
structured result only.`
}

phase('Tasks')

for (const t of setup.tasks) {
  const label = `t${t.n}`
  const reportPath = `${setup.workspace}/task-${t.n}-report.md`

  const prep = await agent(`Run these two commands in the repository root — ${SCRIPTS_NOTE} — and return the results:
1. ${SCRIPTS}/sdd-snapshot "${planPath}"  — its printed tree SHA is "base".
2. ${SCRIPTS}/task-brief "${planPath}" ${t.n}  — its printed file path is "briefPath".`,
    { label: `${label}:prep`, phase: 'Tasks', effort: 'low', schema: PREP_SCHEMA })
  if (!prep) return out({ status: 'error', error: `prep agent failed on task ${t.n}` })
  if (!initialBase) initialBase = prep.base

  const implModel = implModelFor(t)
  let impl = await agent(implPrompt(t, prep.briefPath, reportPath),
    { label: `${label}:impl`, phase: 'Tasks', model: implModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })

  // No mid-run user input exists: one retry with widened context, then a
  // structured stop the session can act on (fix the plan, resume the run).
  if (impl && (impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED')) {
    log(`task ${t.n}: implementer ${impl.status} — one retry with widened context`)
    impl = await agent(implPrompt(t, prep.briefPath, reportPath,
      `A previous attempt returned ${impl.status} (${(impl.concerns ?? []).join('; ') || impl.summary}). Additional context: the full plan is at ${planPath}${setup.specPath ? ', the spec at ' + setup.specPath : ''}; earlier task reports live in ${setup.workspace}/. Resolve what blocked the previous attempt from these sources.`),
      { label: `${label}:impl-retry`, phase: 'Tasks', model: implModel === 'haiku' ? 'sonnet' : implModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })
  }
  if (!impl || impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED') {
    return out({
      status: 'blocked',
      blocked: `Task ${t.n} (${t.title}): implementer ${impl ? impl.status : 'failed'} — ${impl ? (impl.concerns ?? []).join('; ') || impl.summary : 'agent error'}. Fix the plan or provide context, then RERUN /gor-execute — a resume replays the cached plan parse and will not see plan edits.`,
    })
  }
  if (impl.status === 'DONE_WITH_CONCERNS' && (impl.concerns ?? []).length > 0) {
    for (const c of impl.concerns) deferredMinors.push(`Task ${t.n} implementer concern: ${c}`)
  }

  const verify = async (roundLabel) => t.verification
    ? agent(`Run this exact command in the repository root and report honestly:\n\n    ${t.verification}\n\nReturn passed=true only on a zero exit code, with the last ~30 lines of output as "tail".`,
        { label: roundLabel, phase: 'Tasks', effort: 'low', schema: VERIFY_SCHEMA })
    : Promise.resolve({ passed: true, tail: '(no verification command in plan)' })

  const pack = async (fromSha, roundLabel) => agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} — and return the results:
1. ${SCRIPTS}/sdd-snapshot "${planPath}"  — printed tree SHA is "head".
2. ${SCRIPTS}/review-package "${planPath}" ${fromSha} <head>  — printed file path is "packagePath"; read the stat section of the file review-package wrote and report loc = total insertions + deletions from it.`,
    { label: roundLabel, phase: 'Tasks', effort: 'low', schema: PACKAGE_SCHEMA })

  let v = await verify(`${label}:verify`)
  if (t.verification && !v) return out({ status: 'error', error: `verification agent failed on task ${t.n}` })
  let openFindings = (v && !v.passed)
    ? [{ severity: 'critical', title: 'verification failed', detail: v.tail }]
    : []

  let reviewed = false
  let lastReviewBase = prep.base
  let round = 0
  let taskParked = []

  // First green verification unlocks the combined review; its C/I findings
  // (plus any later verification failure) drive the fix loop, cap 5.
  while (round <= 5) {
    if (openFindings.length === 0 && !reviewed) {
      const p = await pack(prep.base, `${label}:package`)
      if (!p) return out({ status: 'error', error: `package agent failed on task ${t.n}` })
      const deep = t.security || p.loc > 400
      const reduced = t.category === 'non-behavioral' && !deep
      const review = await agent(reviewPrompt(t, prep.briefPath, reportPath, p.packagePath, reduced), {
        label: `${label}:review`, phase: 'Tasks',
        agentType: deep ? 'gor-mobile-code-reviewer-deep' : 'gor-mobile-code-reviewer',
        model: reduced ? 'haiku' : undefined,
        schema: REVIEW_SCHEMA,
      })
      if (!review) return out({ status: 'error', error: `review agent failed on task ${t.n}` })
      const all = [...review.specFindings, ...review.qualityFindings]
      for (const f of all.filter(f => f.severity === 'minor')) deferredMinors.push(`Task ${t.n}: ${f.title}`)
      openFindings = all.filter(f => f.severity !== 'minor')
      reviewed = true
      lastReviewBase = p.head
    }
    if (openFindings.length === 0) break
    if (round === 5) {
      const breaker = await agent(`You are the breaker adjudicating a fix loop that hit its cap on Task ${t.n} (${t.title}) of the plan at ${planPath}. Open findings:
${openFindings.map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}
Read the plan${setup.specPath ? ` and the spec at ${setup.specPath}` : ''}, the report at ${reportPath}, and the relevant code. Per finding decide: 'parked' (contestable, or real but nothing downstream builds on it — give the ruling) or 'blocked' (real and load-bearing: a later task builds on it or it reveals a plan defect). Return the structured result only.`,
        { label: `${label}:breaker`, phase: 'Tasks', schema: BREAKER_SCHEMA })
      if (!breaker) return out({ status: 'error', error: `breaker agent failed on task ${t.n}` })
      const blockedRulings = breaker.rulings.filter(r => r.decision === 'blocked')
      if (blockedRulings.length > 0) {
        return out({
          status: 'blocked',
          blocked: `Task ${t.n} breaker: ${blockedRulings.map(r => `${r.title} — ${r.ruling}`).join('; ')}`,
        })
      }
      for (const r of breaker.rulings) taskParked.push(`Task ${t.n}: parked — ${r.title} — ruling: ${r.ruling}`)
      parkedAll.push(...taskParked)
      break
    }
    round++
    const fixModel = round <= 3 ? implModel : tierUp(implModel)
    const fix = await agent(implPrompt(t, prep.briefPath, reportPath,
      `${round > 3 ? `A prior implementer attempted this task ${round - 1} time(s); you own it now. Read the report file for what was tried. ` : ''}Fix round ${round}/5 — address these findings, nothing else:\n${openFindings.map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}\nAppend your fix report to the same report file.`),
      { label: `${label}:fix${round}`, phase: 'Tasks', model: fixModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })
    if (!fix) return out({ status: 'error', error: `fix agent failed on task ${t.n} round ${round}` })
    v = await verify(`${label}:verify${round}`)
    if (t.verification && !v) return out({ status: 'error', error: `verification agent failed on task ${t.n}` })
    if (v && !v.passed) {
      openFindings = [
        { severity: 'critical', title: 'verification failed', detail: v.tail },
        ...openFindings.filter(f => f.title !== 'verification failed'),
      ]
      continue
    }
    if (!reviewed) { openFindings = []; continue }
    const fp = await pack(lastReviewBase, `${label}:package${round}`)
    if (!fp) return out({ status: 'error', error: `package agent failed on task ${t.n} round ${round}` })
    const rr = await agent(reReviewPrompt(openFindings, prep.briefPath, reportPath, fp.packagePath), {
      label: `${label}:rereview${round}`, phase: 'Tasks',
      agentType: 'gor-mobile-code-reviewer', schema: REREVIEW_SCHEMA,
    })
    if (!rr) return out({ status: 'error', error: `re-review agent failed on task ${t.n} round ${round}` })
    lastReviewBase = fp.head
    const notAddressed = openFindings.filter(f => !rr.verdicts.some(vd => vd.title === f.title && vd.verdict === 'ADDRESSED'))
    for (const f of rr.newFindings.filter(f => f.severity === 'minor')) deferredMinors.push(`Task ${t.n} (fix ${round}): ${f.title}`)
    openFindings = [...notAddressed, ...rr.newFindings.filter(f => f.severity !== 'minor')]
  }

  taskResults.push({ n: t.n, title: t.title, rounds: round, parked: taskParked })
  await agent(`Append one line to ${setup.workspace}/progress.md (create the file if missing): "Task ${t.n}: complete (${round} fix rounds, ${taskParked.length} parked) — ${impl.summary}". Return the word "ok".`,
    { label: `${label}:checkpoint`, phase: 'Tasks', effort: 'low', model: 'haiku' })
}

phase('Final')
const finalReview = await workflow('gor-review', {
  mode: 'final', base: initialBase, planPath,
  deferredMinors, parked: parkedAll,
})
// A null or errored nested review is a hard stop, not a quiet 'done' — the
// advertised final gate must actually have run for the session to trust it.
if (!finalReview || finalReview.status === 'error') {
  return out({
    status: 'blocked',
    blocked: 'final review failed — run /gor-review standalone, then address its findings',
    finalReview: { status: 'error', residualFindings: [] },
  })
}
let finalOpen = finalReview.status === 'reviewed'
  ? finalReview.findings.filter(f => f.severity !== 'minor')
  : []
if (finalReview.status === 'reviewed') {
  for (const f of finalReview.findings.filter(f => f.severity === 'minor')) deferredMinors.push(`Final review: ${f.title}`)
}

// One fix wave, one scoped re-review — residuals surface to the session.
if (finalOpen.length > 0) {
  const waveReport = `${setup.workspace}/final-fix-report.md`
  // Snapshot BEFORE the wave runs so the final package below covers only the
  // wave's own diff, not the whole plan implementation since initialBase.
  const snap = await agent(`Run ${SCRIPTS}/sdd-snapshot "${planPath}" in the repository root — ${SCRIPTS_NOTE} — and return its printed tree SHA as "base".`,
    { label: 'final:snapshot', phase: 'Final', effort: 'low', schema: SNAPSHOT_SCHEMA })
  if (!snap) return out({ status: 'error', error: 'final snapshot agent failed' })
  const waveBase = snap.base
  const wave = await agent(`You are the fix-wave implementer for the final review of the plan at ${planPath} in this repository. Fix ALL of these findings in the working tree (no commits):
${finalOpen.map(f => `- [${f.severity}] ${f.title}${f.file ? ' (' + f.file + ')' : ''}: ${f.detail}`).join('\n')}
Global constraints:\n${setup.constraints}
${setup.verificationAll ? `Then run: ${setup.verificationAll} — it must pass.` : ''}
You never dispatch subagents. Full report → ${waveReport}. Return the structured result.`,
    { label: 'final:fixwave', phase: 'Final', schema: IMPL_SCHEMA })
  if (!wave) return out({ status: 'error', error: 'final fixwave agent failed' })
  const fp = await agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} — and return the results:
1. ${SCRIPTS}/sdd-snapshot "${planPath}"  — printed tree SHA is "head".
2. ${SCRIPTS}/review-package "${planPath}" ${waveBase} <head>  — printed path is "packagePath"; read the stat section of the file review-package wrote and report loc = total insertions + deletions from it.`,
    { label: 'final:package', phase: 'Final', effort: 'low', schema: PACKAGE_SCHEMA })
  const rr = (wave && fp) ? await agent(reReviewPrompt(finalOpen, planPath, waveReport, fp.packagePath), {
    label: 'final:rereview', phase: 'Final', agentType: 'gor-mobile-code-reviewer', schema: REREVIEW_SCHEMA,
  }) : null
  const residual = rr
    ? [...finalOpen.filter(f => !rr.verdicts.some(vd => vd.title === f.title && vd.verdict === 'ADDRESSED')), ...rr.newFindings.filter(f => f.severity !== 'minor')]
    : finalOpen
  finalOpen = residual
}

return out({
  status: 'done',
  finalReview: {
    status: finalReview.status, codexRan: finalReview.codexRan ?? false,
    gorRan: finalReview.gorRan ?? false, residualFindings: finalOpen,
    conflicts: finalReview.conflicts ?? [],
  },
})