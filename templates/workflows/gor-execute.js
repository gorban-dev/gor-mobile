export const meta = {
  name: 'gor-execute',
  description: 'Deterministic plan executor: compact implement+verify for small tasks (same-shape batches in one dispatch), full review pipeline for security/design/wide ones; nested gor-review as the final gate',
  whenToUse: 'Execute an approved implementation plan (docs/plans or .gor-mobile/plans) task by task in a gor-mobile repo',
  phases: [
    { title: 'Setup', detail: 'workspace, plan parsing, artifact-line validation, base snapshot, baseline pass over the plan verification commands' },
    { title: 'Tasks', detail: 'compact tasks: implement+verify, same-shape batches in one dispatch; security/design/wide tasks: implement, verify+snapshot, review, fix-loop' },
    { title: 'Final', detail: 'progress log, nested gor-review + one fix wave' },
  ],
}

// Slash invocation delivers a string or token array; a programmatic call may
// pass an object. Normalize defensively.
const tokens = Array.isArray(args) ? args.map(String)
  : typeof args === 'string' ? args.split(/\s+/).filter(Boolean)
  : []
const opt = args && typeof args === 'object' && !Array.isArray(args) ? args : {}
const planPath = opt.plan ?? tokens.find(t => !t.startsWith('-')) ?? null
const skipBaseline = opt.noBaseline === true || tokens.includes('--no-baseline')

const deferredMinors = []
const parkedAll = []
const taskResults = []
const unverified = []
let initialBase = null

const out = (extra) => ({ tasksDone: taskResults.length, taskResults, deferredMinors, parked: parkedAll, unverified, ...extra })

if (!planPath) return out({ status: 'error', error: 'usage: /gor-execute <plan-file>' })
if (!/^[\w./-]+$/.test(planPath)) return out({ status: 'error', error: 'plan path contains unsupported characters' })

// Every agent-returned tree SHA and path below is interpolated into a later
// prompt that names a Bash command an agent will run under the sdd-scripts
// allow entry — validate shape before reuse so a hostile/confused agent
// result cannot smuggle shell metacharacters into that command.
const SHA_SHAPE = /^[0-9a-f]{7,64}$/
const PATH_SHAPE = /^[\w./ -]+$/

const SCRIPTS = '~/.gor-mobile/scripts'
// The installed Bash allow entry (sddScriptsAllowEntry) is the literal
// resolved absolute path with no quotes — a command starting with a quote
// cannot prefix-match it and the agent stalls on a permission prompt. Every
// prompt that runs a script below carries this same instruction so agents
// resolve ~ themselves before invoking, rather than handing the literal text
// to Bash.
const SCRIPTS_NOTE = 'expand ~ to the absolute home directory in the SCRIPT path only, and invoke it by absolute path without quotes — every other argument is passed exactly as written, never prefixed with the home directory or any other path'

// A build's exit code is not a verdict: an unresolved xcodebuild destination
// exits before compiling anything, and a composite pipeline reports the status
// of its last element, not of the build (field case: three iOS builds reported
// "exit 0" without ever compiling). Build commands are gated on the log marker
// instead, and every verification command is forced to run as one command.
const BUILD_CMD = /(^|[\s;&|(])(\.?\/?gradlew|xcodebuild|swift\s+build)\b/
const ONE_COMMAND = 'Run it as ONE command — no `;`, no `&&`, no pipe, no background job: a composite reports the status of its last element, not of the command being verified.'
const REJECTED_FLAG = 'Output that is a usage/help listing ("Usage:", "Unknown option", "Missing required option") is passed=false: a CLI answering with its own help text has not performed the command.'
const verifyContract = (cmd) => BUILD_CMD.test(cmd)
  ? `\n   ${ONE_COMMAND} This is a build: report passed=true ONLY if the output contains the marker BUILD SUCCEEDED (xcodebuild) or BUILD SUCCESSFUL (gradle). Output carrying neither marker is passed=false whatever the exit code — an unresolved destination or a rejected flag prints neither. ${REJECTED_FLAG} Report the last ~30 lines of output as "tail".`
  : `\n   ${ONE_COMMAND} Report passed=true only on a zero exit code, with the last ~30 lines of output as "tail". ${REJECTED_FLAG}`

phase('Setup')

const SETUP_SCHEMA = {
  type: 'object',
  required: ['workspace', 'base', 'specPath', 'constraints', 'tasks'],
  properties: {
    workspace: { type: 'string', description: 'absolute path printed by sdd-workspace' },
    base: { type: 'string', description: 'tree SHA printed by sdd-snapshot' },
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
          composeRefs: { type: 'array', items: { type: 'string' }, description: 'absolute paths from the Compose rules: line, resolved against the installed gor-mobile-compose-internals skill directory (empty when the task has no such line)' },
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
2. Run ${SCRIPTS}/sdd-snapshot "${planPath}" and record its printed tree SHA as "base".
3. Read the plan file at ${planPath}. Extract: the path of the spec it names
   (Spec: line), the Global Constraints section verbatim, and every task.
4. Per task determine: number and title; the exact file paths it creates or
   modifies; the architecture layers those files belong to per
   $HOME/.gor-mobile/rules/examples/index.json (empty list if the index is
   missing or nothing matches); reference files from its artifact lines —
   resolve "Conforms to: <pack path>" against $HOME/.gor-mobile/rules/ and
   "Conforms to (project precedent): <repo path>" against the repo root; the
   paths on a "Compose rules:" line against the installed
   gor-mobile-compose-internals skill directory (<repo>/.claude/skills/
   gor-mobile-compose-internals/, or $CODEX_HOME/skills/ on Codex) — those
   are written relative to that skill, NOT to the rules pack; any
   "Shape per user:" line verbatim; its category — 'non-behavioral' for pure
   wiring/DI/resources/flag work with no input-to-output or state logic,
   'design' if the plan marks it as a design decision or human-judgment task,
   otherwise 'behavioral'; whether it touches security/auth/payments/crypto/
   IPC/binder surfaces; and the exact verification command the task or plan
   states (null if none).
5. Also return a whole-project verification command if the plan names one.
Return ONLY the structured result.`, { label: 'setup', effort: 'low', schema: SETUP_SCHEMA })

if (!setup) return out({ status: 'error', error: 'setup parser failed — rerun /gor-execute' })
if (setup.tasks.length === 0) return out({ status: 'error', error: `no tasks found in ${planPath}` })
if (!SHA_SHAPE.test(setup.base)) return out({ status: 'error', error: 'setup returned a malformed tree SHA' })
if (!PATH_SHAPE.test(setup.workspace)) return out({ status: 'error', error: 'setup returned a malformed workspace path' })
initialBase = setup.base

// progress.md is the rehydration artifact: a run that stops early is exactly
// when the session needs it. v0.4.1 collapsed the per-task checkpoint into a
// single Final-phase writer, so a run that stopped in Tasks wrote nothing at
// all — every non-normal exit flushes what it has before returning.
const progressLines = []
let progressFlushed = 0
const flushProgress = async () => {
  const pending = progressLines.slice(progressFlushed)
  if (pending.length === 0) return
  progressFlushed = progressLines.length
  await agent(`Append these ${pending.length} line(s) verbatim to ${setup.workspace}/progress.md (create the file if missing):\n${pending.join('\n')}\nReturn ok=true.`,
    runnerOpts('progress', 'Tasks'))
}
const bail = async (obj) => { await flushProgress(); return out(obj) }

// Artifact-line gate is code, not a reviewer mandate: a layer-touching task
// with no reference and no user-stated shape is a plan defect — stop before
// any implementer writes code to an improvised shape.
const artifactDefects = setup.tasks
  .filter(t => t.layers.length > 0 && t.conformsTo.length === 0 && !t.shapePerUser)
  .map(t => `Task ${t.n} (${t.title}): touches layers [${t.layers.join(', ')}] but carries no Conforms to: / project-precedent / Shape per user: line`)
if (artifactDefects.length > 0) {
  return out({ status: 'blocked', blocked: 'plan artifact-line defects — fix the plan, then rerun', details: artifactDefects })
}

// Backstop for the no-silent-downgrade invariant: the parser's security flag
// is one LLM judgment — a file path that smells like a sensitive surface
// forces security routing regardless. Over-escalation costs tokens;
// under-escalation skips a review gate.
const SECURITY_PATH = /auth|login|credential|password|secret|token|keystore|biometric|crypt|payment|billing|purchase|wallet|binder|ipc/i
for (const t of setup.tasks) t.security = t.security || t.files.some(f => SECURITY_PATH.test(f))

const RUNNER_SCHEMA = {
  type: 'object',
  properties: {
    passed: { type: 'boolean', description: 'the verification command exited 0 (omit when no verification command was listed)' },
    tail: { type: 'string', description: 'last ~30 lines of the verification output' },
    sha: { type: 'string', description: 'tree SHA printed by sdd-snapshot' },
    loc: { type: 'number', description: 'insertions + deletions from git diff --shortstat' },
    files: { type: 'array', items: { type: 'string' }, description: 'paths printed by git diff --name-only' },
    ok: { type: 'boolean', description: 'every listed command ran' },
  },
}
// One shape for every mechanical runner: model, effort, agentType (and its
// restricted tool set) and schema all match, so sequential runners share one
// prompt-cache prefix instead of each paying its own cache write (the cache
// key spans model/effort/type/tools/schema/cwd).
const runnerOpts = (label, ph) => ({ label, phase: ph, effort: 'low', model: 'haiku', agentType: 'gor-mobile-runner', schema: RUNNER_SCHEMA })

const IMPL_SCHEMA = {
  type: 'object', required: ['status', 'summary'],
  properties: {
    status: { enum: ['DONE', 'DONE_WITH_CONCERNS', 'NEEDS_CONTEXT', 'BLOCKED'] },
    summary: { type: 'string' },
    concerns: { type: 'array', items: { type: 'string' } },
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
        type: 'object', required: ['n', 'title', 'verdict'],
        properties: { n: { type: 'number' }, title: { type: 'string' }, verdict: { enum: ['ADDRESSED', 'NOT_ADDRESSED'] } },
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

// lastHead: tree SHA of the last snapshot known to equal the current working
// tree; null when an unsnapshotted change may exist (a compact task with no
// verification command, or a just-finished fix wave). Verify runners refresh
// it, so a separate per-task prep/snapshot agent is only ever spawned by
// ensureBase() after a gap in the chain.
let lastHead = setup.base
const ensureBase = async (label, ph) => {
  if (lastHead) return lastHead
  const s = await agent(`Run ${SCRIPTS}/sdd-snapshot "${planPath}" in the repository root — ${SCRIPTS_NOTE} — and return its printed tree SHA as "sha".`,
    runnerOpts(label, ph))
  if (!s || !SHA_SHAPE.test(s.sha ?? '')) return null
  lastHead = s.sha
  return lastHead
}

// Small, non-security, non-design tasks skip the per-task review pipeline:
// each per-task agent pays a large session baseline, and the nested final
// gor-review already covers the whole accumulated diff. Security, design,
// and wide tasks keep the full pipeline — there an early per-task finding is
// cheaper than a late fix wave.
const isCompact = (t) => !t.security && t.category !== 'design' && t.files.length <= 6

const tierUp = (m) => m === 'haiku' ? 'sonnet' : m === 'sonnet' ? undefined : undefined
const implModelFor = (t) => t.category === 'design' || t.files.length > 6 ? undefined
  : t.category === 'non-behavioral' ? 'haiku' : 'sonnet'

function refBlock(t) {
  const lines = []
  if (t.conformsTo.length > 0) lines.push('Reference files — REQUIRED reading; the diff shape in each touched layer must conform to them exactly:\n' + t.conformsTo.map(p => '- ' + p).join('\n'))
  // The plan writes these relative to the compose-internals skill; the brief
  // carries them verbatim, so without the resolved path the implementer looks
  // for them under the rules pack and reports them missing.
  if ((t.composeRefs ?? []).length > 0) lines.push('Compose rules — REQUIRED reading (the plan cites these by their skill-relative name):\n' + t.composeRefs.map(p => '- ' + p).join('\n'))
  if (t.shapePerUser) lines.push('Shape per user (verbatim from the plan): ' + t.shapePerUser)
  if (lines.length === 0) lines.push('Canonical examples: none for this task')
  return lines.join('\n')
}

// The repo's tooling is installed but invisible from inside a subagent
// dispatch: nothing in a workflow prompt used to name the android CLI, adb,
// debroid or the docs-first ladder, so implementers improvised device work
// and coded remembered API signatures. This block is the contract, kept short
// enough to ride along on every implementer and fix dispatch.
const TOOL_CONTRACT = `Tooling contract for this repository:
- External API signatures (SDK, Jetpack, any library): never from memory —
  ground them via the docs-first ladder in the gor-mobile-using-android-cli
  skill (\`android docs search\` / \`docs fetch\`, the
  google-developer-knowledge MCP server, then the resolved artifact) and cite
  what you read in your report.
- Symbol counts and call chains: \`ast-index usages|symbol|implementations\`,
  never grep — a bare-identifier grep is refused by this repo's guard hook.
- Device / emulator work: build with \`./gradlew\`, then deploy with the
  android CLI (\`android describe\` to locate the APK → \`android run --apks
  <path>\`; there is no --variant flag). Gestures are \`android screen capture
  --annotate\` → \`android screen resolve --screenshot <png> --string "tap #N"\`
  → \`adb shell input <the printed coordinates>\`: the CLI resolves targets, adb
  performs them. After any deploy, confirm the right build is actually running
  — \`adb shell dumpsys activity activities | grep -m1 topResumedActivity\`
  must show the variant's applicationId (a debug build is a different package
  from release, and both can be installed at once).
- A build is not verified by its exit code: require BUILD SUCCESSFUL /
  BUILD SUCCEEDED in the log, and never chain a build with \`;\`, \`&&\` or a
  pipe — the composite reports its last element.
- A runtime bug you cannot explain from a static read: gather runtime evidence
  with the debroid CLI (\`debroid launch|attach\`, \`break\`,
  \`catch-exception\`, \`pause-state\`, \`inspect\`, \`set-var\` + \`resume\`) per
  the gor-mobile-systematic-debugging skill, before rewriting code on a
  hypothesis.`

// Implementers on both paths generate and read their own brief: task-brief
// writes to the deterministic path <workspace>/task-<N>-brief.md, so no
// agent-returned path ever crosses back into an orchestrator prompt.
function implPrompt(t, reportPath, extra) {
  return `You are the implementer for Task ${t.n} (${t.title}) of the plan at ${planPath} in this repository.

First run ${SCRIPTS}/task-brief "${planPath}" ${t.n} — ${SCRIPTS_NOTE} — then read the brief it writes to ${setup.workspace}/task-${t.n}-brief.md: it is your requirements, with the exact values to use verbatim.

Allowed paths — refuse to create or modify anything outside this list:
${t.files.map(p => '- ' + p).join('\n')}

${refBlock(t)}

Global constraints binding every task:
${setup.constraints}

${TOOL_CONTRACT}

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

// base and head are orchestrator-validated tree SHAs; the reviewer packages
// exactly that range itself, so no separate package agent runs.
function reviewPrompt(t, reportPath, base, head, reduced) {
  return `You are reviewing Task ${t.n} (${t.title}) of the plan at ${planPath}.

First run ${SCRIPTS}/review-package "${planPath}" ${base} ${head} — ${SCRIPTS_NOTE} — then read the file whose path it prints: stat and full diff — the only diff in scope.
Also read: the task brief at ${setup.workspace}/task-${t.n}-brief.md; the implementer report at ${reportPath}.

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

function reReviewPrompt(findings, briefPath, reportPath, base, head) {
  return `You are the scoped re-reviewer for a fix round. Findings that were to be fixed:
${findings.map((f, i) => `${i + 1}. [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}

First run ${SCRIPTS}/review-package "${planPath}" ${base} ${head} — ${SCRIPTS_NOTE} — then read the file whose path it prints: that is the fix diff.
Also read: the task brief at ${briefPath}; the implementer report (with its
fix appendix) at ${reportPath}.

Verdict each finding ADDRESSED or NOT ADDRESSED ("attempted" is not
addressed). Echo each verdict's n exactly as numbered above, and copy its
title VERBATIM from the findings list — a paraphrased title counts as no
verdict. Inspect ONLY the fix diff for new breakage — out-of-scope
observations do not belong in newFindings. Return the structured result only.`
}

// Upstream superpowers 6.3.0 (#2078): consecutive small same-shape tasks
// batch into ONE implementer dispatch — micro-task plans were paying a full
// implementer baseline per one-line change. Only non-behavioral compact
// tasks batch (mechanical sameness), and only with an identical verification
// command, so one verify run covers the whole batch. A deterministic
// diff check below refuses a batch where any task's listed files never got
// touched.
const units = []
for (const t of setup.tasks) {
  const prev = units[units.length - 1]
  const batchable = isCompact(t) && t.category === 'non-behavioral'
  if (batchable && prev && prev.kind === 'batch' && prev.tasks[0].verification === t.verification) {
    prev.tasks.push(t)
  } else {
    units.push(batchable ? { kind: 'batch', tasks: [t] } : { kind: 'task', t })
  }
}

// Baseline gate: a verification command that already fails on the untouched
// tree can never say anything about a task's diff — it burns fix rounds and
// stops the run on a defect that is not in the code (field case: a plan's
// xcodebuild destination demanded an x86_64 slice the project stopped
// producing three weeks earlier). Each DISTINCT command runs once here, while
// the tree is still clean; the ones that fail are dropped from their tasks
// and reported instead of gating them. `--no-baseline` skips the pass.
const BASELINE_SCHEMA = {
  type: 'object', required: ['results'],
  properties: {
    results: {
      type: 'array',
      items: {
        type: 'object', required: ['n', 'passed'],
        properties: { n: { type: 'number' }, passed: { type: 'boolean' }, tail: { type: 'string' } },
      },
    },
  },
}
const baselineCmds = [...new Set([...setup.tasks.map(t => t.verification), setup.verificationAll].filter(Boolean))]
if (!skipBaseline && baselineCmds.length > 0) {
  const bl = await agent(`You are running a baseline pass on an UNMODIFIED working tree, before any task of the plan at ${planPath} is implemented. Each command below is a verification gate the plan states; the only question is whether it can pass on this repository AT ALL.

${baselineCmds.map((c, i) => `${i + 1}. ${c}${verifyContract(c)}`).join('\n')}

Run each one exactly as written, in order, and report per command: n (its number above), passed, and the last ~30 lines as "tail" when it did not pass. Change nothing in the repository, run no other command, and never adjust a command's flags to coax it green — a command that cannot pass is the result this pass exists to find. Return the structured result only.`,
    { label: 'setup:baseline', phase: 'Setup', effort: 'low', model: 'haiku', agentType: 'gor-mobile-runner', schema: BASELINE_SCHEMA })
  if (bl) {
    const broken = new Set(bl.results.filter(r => r.passed === false).map(r => baselineCmds[r.n - 1]).filter(Boolean))
    for (const c of broken) {
      const tail = (bl.results.find(r => baselineCmds[r.n - 1] === c) ?? {}).tail ?? ''
      unverified.push(`"${c}" fails on the unmodified tree — dropped as a gate for this run. Baseline tail:\n${tail}`)
      log(`baseline: "${c}" fails on a clean tree — dropped as a verification gate`)
    }
    for (const t of setup.tasks) if (t.verification && broken.has(t.verification)) t.verification = null
    if (setup.verificationAll && broken.has(setup.verificationAll)) setup.verificationAll = null
  } else {
    log('baseline pass failed to report — verification commands stay in force unchecked')
  }
}

phase('Tasks')

for (const u of units) {
  if (u.kind === 'batch' && u.tasks.length > 1) {
    const ts = u.tasks
    const label = `t${ts[0].n}-${ts[ts.length - 1].n}`
    const reportPath = `${setup.workspace}/tasks-${ts[0].n}-${ts[ts.length - 1].n}-report.md`
    const verification = ts[0].verification

    const base = await ensureBase(`${label}:base`, 'Tasks')
    if (!base) return await bail({ status: 'error', error: `base snapshot agent failed before batch ${label}` })

    const batchImplPrompt = (extra) => `You are the implementer for a batch of ${ts.length} small same-shape tasks of the plan at ${planPath} in this repository:
${ts.map(t => `- Task ${t.n}: ${t.title}`).join('\n')}

For EACH task in order: first run ${SCRIPTS}/task-brief "${planPath}" <task number> — ${SCRIPTS_NOTE} — then read the brief it writes to ${setup.workspace}/task-<task number>-brief.md: it is that task's requirements, with the exact values to use verbatim. Implement every task in the batch — a task whose listed files show no change afterwards counts as not done.

Allowed paths — refuse to create or modify anything outside this list:
${ts.flatMap(t => t.files.map(p => `- ${p} (task ${t.n})`)).join('\n')}

${ts.map(t => `Task ${t.n} references:\n${refBlock(t)}`).join('\n')}

Global constraints binding every task:
${setup.constraints}

${TOOL_CONTRACT}

Fidelity: reproduce each task's calls exactly — match signatures, keep modifier
chains and named arguments as written, never simplify or drop parameters.
Never run git commit, git branch, git checkout, or git worktree — changes
accumulate uncommitted in the working tree.
${verification ? 'The orchestrator will verify with: ' + verification + ' — do not skip making it pass.' : ''}
${extra ?? ''}
You never dispatch subagents. Write your full report (per task: what you did,
decisions, self-review) to ${reportPath}. Return ONLY the structured result:
status (DONE | DONE_WITH_CONCERNS | NEEDS_CONTEXT | BLOCKED — use
NEEDS_CONTEXT or BLOCKED honestly instead of guessing), a one-line summary,
and concerns.`

    let impl = await agent(batchImplPrompt(), { label: `${label}:impl`, phase: 'Tasks', model: 'haiku', agentType: 'general-purpose', schema: IMPL_SCHEMA })
    if (impl && (impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED')) {
      log(`batch ${label}: implementer ${impl.status} — one retry with widened context`)
      impl = await agent(batchImplPrompt(`A previous attempt returned ${impl.status} (${(impl.concerns ?? []).join('; ') || impl.summary}). Additional context: the full plan is at ${planPath}${setup.specPath ? ', the spec at ' + setup.specPath : ''}; earlier task reports live in ${setup.workspace}/. Resolve what blocked the previous attempt from these sources.`),
        { label: `${label}:impl-retry`, phase: 'Tasks', model: 'sonnet', agentType: 'general-purpose', schema: IMPL_SCHEMA })
    }
    if (!impl || impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED') {
      return await bail({
        status: 'blocked',
        blocked: `Batch ${label} (${ts.map(t => 'Task ' + t.n).join(', ')}): implementer ${impl ? impl.status : 'failed'} — ${impl ? (impl.concerns ?? []).join('; ') || impl.summary : 'agent error'}. Fix the plan or provide context, then RERUN /gor-execute — a resume replays the cached plan parse and will not see plan edits.`,
      })
    }
    if (impl.status === 'DONE_WITH_CONCERNS' && (impl.concerns ?? []).length > 0) {
      for (const c of impl.concerns) deferredMinors.push(`Batch ${label} implementer concern: ${c}`)
    }

    // Batch verify always runs: it gates the batch on the #2078 check —
    // every task's listed files must actually appear in the diff — and
    // snapshots for the chain.
    const verifyBatch = (roundLabel) => {
      const steps = []
      if (verification) steps.push(`${verification}${verifyContract(verification)}`)
      steps.push(`${SCRIPTS}/sdd-snapshot "${planPath}" — its printed tree SHA is "sha".`)
      steps.push(`git diff --name-only ${base} <the SHA from the previous step> — report the printed paths as "files".`)
      return agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} for the scripts — and report honestly:\n`
        + steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
        + `\nReturn the structured result only.`,
        runnerOpts(roundLabel, 'Tasks'))
    }
    const batchProblems = (v) => {
      const problems = []
      if (verification && v.passed !== true) problems.push(`verification failed:\n${v.tail ?? ''}`)
      const verifyOnly = problems.length === 1
      const touched = v.files ?? []
      for (const t of ts) {
        if (!t.files.some(f => touched.some(c => c === f || c.endsWith('/' + f) || f.endsWith('/' + c)))) {
          problems.push(`Task ${t.n} (${t.title}): none of its listed files appear in the diff — the task was not implemented`)
        }
      }
      // A batch whose ONLY problem is the shared verification command is the
      // same case the per-task breaker adjudicates: the command may be
      // unusable rather than the code broken.
      problems.verifyOnly = verifyOnly && problems.length === 1
      return problems
    }

    let v = await verifyBatch(`${label}:verify`)
    if (!v || !SHA_SHAPE.test(v.sha ?? '')) return await bail({ status: 'error', error: `verification agent failed on batch ${label}` })
    let problems = batchProblems(v)
    let round = 0
    let escalation = null
    while (problems.length > 0 && round < 3 && !escalation) {
      round++
      const fix = await agent(batchImplPrompt(
        `Fix round ${round}/3 — address these problems, changing nothing beyond what that requires:\n${problems.map(p => '- ' + p).join('\n')}\n${problems.verifyOnly ? 'If the verification command fails identically on an unmodified tree, say so as BLOCKED with that evidence instead of changing more code — an isolation run is your FIRST move on a failure you did not expect, not your last.\n' : ''}Append your fix report to the same report file.`),
        { label: `${label}:fix${round}`, phase: 'Tasks', model: round < 3 ? 'haiku' : 'sonnet', agentType: 'general-purpose', schema: IMPL_SCHEMA })
      if (!fix) return await bail({ status: 'error', error: `fix agent failed on batch ${label} round ${round}` })
      if (fix.status === 'BLOCKED' || fix.status === 'NEEDS_CONTEXT') {
        escalation = `${fix.status} — ${(fix.concerns ?? []).join('; ') || fix.summary}`
        break
      }
      v = await verifyBatch(`${label}:verify${round}`)
      if (!v || !SHA_SHAPE.test(v.sha ?? '')) return await bail({ status: 'error', error: `verification agent failed on batch ${label}` })
      problems = batchProblems(v)
    }
    let batchUnusable = false
    if (problems.length > 0) {
      if (!problems.verifyOnly) {
        return await bail({ status: 'blocked', blocked: `Batch ${label}: still failing after ${round} fix round(s)${escalation ? ` (implementer escalated: ${escalation})` : ''}: ${problems.join('; ')}` })
      }
      const br = await agent(`You are the breaker adjudicating a verification gate that stayed red on a batch of ${ts.length} tasks (${ts.map(t => 'Task ' + t.n).join(', ')}) of the plan at ${planPath}.

Command: ${verification}
Last output tail:
${v.tail ?? ''}
${escalation ? `The implementer escalated: ${escalation}\n` : ''}Read the implementer report at ${reportPath} — isolation evidence, if any, lives there — plus the batch's diff and the plan.

Return exactly ONE ruling, its title the literal string "verification failed":
- 'parked' — the command is UNUSABLE in this repository: it fails the same way on an unmodified tree, or it names a destination / flag / target that does not exist. The code stands and the run continues without this gate.
- 'blocked' — the code these tasks wrote is genuinely broken.
Confirm the claim yourself before ruling 'parked': run the diagnosis that settles it — an isolation run of the same command, xcodebuild -showBuildSettings, --help on the flag the command passes. The implementer's word alone is not evidence. Return the structured result only.`,
        { label: `${label}:vbreaker`, phase: 'Tasks', schema: BREAKER_SCHEMA })
      if (!br || br.rulings.some(r => r.decision === 'blocked')) {
        return await bail({ status: 'blocked', blocked: `Batch ${label}: verification still failing after ${round} fix round(s)${br ? ' — breaker: ' + br.rulings.filter(r => r.decision === 'blocked').map(r => r.ruling).join('; ') : ' and the breaker agent failed'}: ${v.tail ?? ''}` })
      }
      batchUnusable = true
      unverified.push(`Batch ${label} (${ts.map(t => 'Task ' + t.n).join(', ')}): "${verification}" ruled unusable — ${br.rulings.map(r => r.ruling).join('; ')}`)
      parkedAll.push(`Batch ${label}: code applied, verification not run — ${br.rulings.map(r => r.ruling).join('; ')}`)
    }
    lastHead = escalation ? null : v.sha
    for (const t of ts) {
      taskResults.push({ n: t.n, title: t.title, mode: 'batch', rounds: round, parked: [], unverified: batchUnusable })
      progressLines.push(`Task ${t.n}: ${batchUnusable ? 'code applied, verification unusable' : 'complete'} (batched ${label}, ${round} fix rounds) — ${impl.summary}`)
    }
    continue
  }

  const t = u.kind === 'batch' ? u.tasks[0] : u.t
  const label = `t${t.n}`
  const reportPath = `${setup.workspace}/task-${t.n}-report.md`
  const briefPath = `${setup.workspace}/task-${t.n}-brief.md`
  const implModel = implModelFor(t)

  // Every verify runner also snapshots the tree it verified — the SHA feeds
  // review packaging and the next task's base without a separate prep agent.
  // With statBase set it additionally measures the diff for review routing.
  const verify = (roundLabel, statBase) => {
    const steps = []
    if (t.verification) steps.push(`${t.verification}${verifyContract(t.verification)}`)
    steps.push(`${SCRIPTS}/sdd-snapshot "${planPath}" — its printed tree SHA is "sha".`)
    if (statBase) steps.push(`git diff --shortstat ${statBase} <the SHA from the previous step> — report loc = insertions + deletions.`)
    return agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} for the scripts — and report honestly:\n`
      + steps.map((s, i) => `${i + 1}. ${s}`).join('\n')
      + `\nReturn the structured result only.`,
      runnerOpts(roundLabel, 'Tasks'))
  }

  const runImpl = async () => {
    let impl = await agent(implPrompt(t, reportPath),
      { label: `${label}:impl`, phase: 'Tasks', model: implModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })

    // No mid-run user input exists: one retry with widened context, then a
    // structured stop the session can act on (fix the plan, resume the run).
    if (impl && (impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED')) {
      log(`task ${t.n}: implementer ${impl.status} — one retry with widened context`)
      impl = await agent(implPrompt(t, reportPath,
        `A previous attempt returned ${impl.status} (${(impl.concerns ?? []).join('; ') || impl.summary}). Additional context: the full plan is at ${planPath}${setup.specPath ? ', the spec at ' + setup.specPath : ''}; earlier task reports live in ${setup.workspace}/. Resolve what blocked the previous attempt from these sources.`),
        { label: `${label}:impl-retry`, phase: 'Tasks', model: implModel === 'haiku' ? 'sonnet' : implModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })
    }
    return impl
  }
  const implBlocked = (impl) => bail({
    status: 'blocked',
    blocked: `Task ${t.n} (${t.title}): implementer ${impl ? impl.status : 'failed'} — ${impl ? (impl.concerns ?? []).join('; ') || impl.summary : 'agent error'}. Fix the plan or provide context, then RERUN /gor-execute — a resume replays the cached plan parse and will not see plan edits.`,
  })

  // A gate that stays red after its fix rounds is not automatically a code
  // defect: a command that cannot pass on ANY tree (an unresolvable
  // destination, a flag the CLI does not have, a target the build never
  // produced) fails identically before and after the diff. Field case: an
  // implementer proved with an isolation run on HEAD that the plan's
  // xcodebuild command had been broken for three weeks, and the run stopped
  // at task 3 of 8 anyway. The breaker reads that evidence and rules the
  // verification unusable — code kept, gate dropped, run continues — or
  // confirms the code is really broken.
  const verificationBreaker = async (tail, escalation) => agent(
    `You are the breaker adjudicating a verification gate that stayed red on Task ${t.n} (${t.title}) of the plan at ${planPath}.

Command: ${t.verification}
Last output tail:
${tail ?? ''}
${escalation ? `The implementer escalated: ${escalation}\n` : ''}
Read the implementer report at ${reportPath} — isolation evidence, if any, lives there — plus the task's diff and the plan.

Return exactly ONE ruling, its title the literal string "verification failed":
- 'parked' — the command is UNUSABLE in this repository: it fails the same way on an unmodified tree, or it names a destination / flag / target that does not exist. The task's code stands and the run continues without this gate.
- 'blocked' — the code this task wrote is genuinely broken, or a later task builds on something this failure shows is wrong.
Confirm the claim yourself before ruling 'parked': run the diagnosis that settles it — an isolation run of the same command, xcodebuild -showBuildSettings, --help on the flag the command passes. The implementer's word alone is not evidence. Return the structured result only.`,
    { label: `${label}:vbreaker`, phase: 'Tasks', schema: BREAKER_SCHEMA })

  if (isCompact(t)) {
    const impl = await runImpl()
    if (!impl || impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED') return await implBlocked(impl)
    if (impl.status === 'DONE_WITH_CONCERNS' && (impl.concerns ?? []).length > 0) {
      for (const c of impl.concerns) deferredMinors.push(`Task ${t.n} implementer concern: ${c}`)
    }

    let round = 0
    let unusable = false
    if (t.verification) {
      let v = await verify(`${label}:verify`, null)
      if (!v) return await bail({ status: 'error', error: `verification agent failed on task ${t.n}` })
      // An implementer that escalates has stopped changing code — burning the
      // remaining rounds on the same dead end only repeats its report.
      let escalation = null
      while (v.passed !== true && round < 3 && !escalation) {
        round++
        const fix = await agent(implPrompt(t, reportPath,
          `Fix round ${round}/3 — the verification command failed; make it pass, changing nothing beyond what that requires. Output tail:\n${v.tail ?? ''}\nIf the command fails identically on an unmodified tree, say so as BLOCKED with that evidence instead of changing more code — an isolation run is your FIRST move on a failure you did not expect, not your last.\nAppend your fix report to the same report file.`),
          { label: `${label}:fix${round}`, phase: 'Tasks', model: round < 3 ? implModel : tierUp(implModel), agentType: 'general-purpose', schema: IMPL_SCHEMA })
        if (!fix) return await bail({ status: 'error', error: `fix agent failed on task ${t.n} round ${round}` })
        if (fix.status === 'BLOCKED' || fix.status === 'NEEDS_CONTEXT') {
          escalation = `${fix.status} — ${(fix.concerns ?? []).join('; ') || fix.summary}`
          break
        }
        v = await verify(`${label}:verify${round}`, null)
        if (!v) return await bail({ status: 'error', error: `verification agent failed on task ${t.n}` })
      }
      if (v.passed !== true) {
        const br = await verificationBreaker(v.tail, escalation)
        if (!br) return await bail({ status: 'blocked', blocked: `Task ${t.n} (${t.title}): verification still failing after ${round} fix round(s) and the breaker agent failed: ${v.tail ?? ''}` })
        const blockedRulings = br.rulings.filter(r => r.decision === 'blocked')
        if (blockedRulings.length > 0) {
          return await bail({ status: 'blocked', blocked: `Task ${t.n} (${t.title}): verification failing after ${round} fix round(s) — breaker: ${blockedRulings.map(r => r.ruling).join('; ')}` })
        }
        unusable = true
        unverified.push(`Task ${t.n} (${t.title}): "${t.verification}" ruled unusable — ${br.rulings.map(r => r.ruling).join('; ')}`)
        parkedAll.push(`Task ${t.n}: code applied, verification not run — ${br.rulings.map(r => r.ruling).join('; ')}`)
      }
      // After an escalation the last fix ran without a following snapshot, so
      // v.sha no longer describes the tree — force the next base to be taken.
      lastHead = (!escalation && SHA_SHAPE.test(v.sha ?? '')) ? v.sha : null
    } else {
      lastHead = null
    }
    taskResults.push({ n: t.n, title: t.title, mode: 'compact', rounds: round, parked: [], unverified: unusable })
    progressLines.push(`Task ${t.n}: ${unusable ? 'code applied, verification unusable' : 'complete'} (compact, ${round} fix rounds) — ${impl.summary}`)
    continue
  }

  const base = await ensureBase(`${label}:base`, 'Tasks')
  if (!base) return await bail({ status: 'error', error: `base snapshot agent failed on task ${t.n}` })

  const impl = await runImpl()
  if (!impl || impl.status === 'NEEDS_CONTEXT' || impl.status === 'BLOCKED') return await implBlocked(impl)
  if (impl.status === 'DONE_WITH_CONCERNS' && (impl.concerns ?? []).length > 0) {
    for (const c of impl.concerns) deferredMinors.push(`Task ${t.n} implementer concern: ${c}`)
  }

  let v = await verify(`${label}:verify`, base)
  if (!v || !SHA_SHAPE.test(v.sha ?? '')) return await bail({ status: 'error', error: `verification agent failed on task ${t.n}` })
  lastHead = v.sha
  let head = v.sha
  // A runner that omitted loc routes the review deep — the safe direction.
  let loc = Number.isFinite(v.loc) ? v.loc : Infinity
  let openFindings = (t.verification && v.passed !== true)
    ? [{ severity: 'critical', title: 'verification failed', detail: v.tail ?? '' }]
    : []

  let reviewed = false
  let lastReviewBase = base
  let round = 0
  let escalated = null
  let taskParked = []

  // First green verification unlocks the combined review; its C/I findings
  // (plus any later verification failure) drive the fix loop, cap 5.
  while (round <= 5) {
    if (openFindings.length === 0 && !reviewed) {
      const deep = t.security || loc > 400
      const reduced = t.category === 'non-behavioral' && !deep
      const review = await agent(reviewPrompt(t, reportPath, lastReviewBase, head, reduced), {
        label: `${label}:review`, phase: 'Tasks',
        agentType: deep ? 'gor-mobile-code-reviewer-deep' : 'gor-mobile-code-reviewer',
        model: reduced ? 'haiku' : undefined,
        schema: REVIEW_SCHEMA,
      })
      if (!review) return await bail({ status: 'error', error: `review agent failed on task ${t.n}` })
      const all = [...review.specFindings, ...review.qualityFindings]
      for (const f of all.filter(f => f.severity === 'minor')) deferredMinors.push(`Task ${t.n}: ${f.title}`)
      openFindings = all.filter(f => f.severity !== 'minor')
      reviewed = true
      lastReviewBase = head
    }
    if (openFindings.length === 0) break
    if (round >= 5 || escalated) {
      const breaker = await agent(`You are the breaker adjudicating a fix loop that ${escalated ? 'an implementer escalated out of' : 'hit its cap'} on Task ${t.n} (${t.title}) of the plan at ${planPath}.${escalated ? ` The implementer escalated: ${escalated}` : ''} Open findings:
${openFindings.map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}
Read the plan${setup.specPath ? ` and the spec at ${setup.specPath}` : ''}, the report at ${reportPath}, and the relevant code. Per finding decide: 'parked' (contestable, or real but nothing downstream builds on it — give the ruling) or 'blocked' (real and load-bearing: a later task builds on it or it reveals a plan defect). A finding titled "verification failed" is 'parked' when the command is unusable in this repository — it fails the same way on an unmodified tree, or names a destination / flag / target that does not exist — but confirm that yourself with the diagnosis that settles it, not on the implementer's word. Return the structured result only.`,
        { label: `${label}:breaker`, phase: 'Tasks', schema: BREAKER_SCHEMA })
      if (!breaker) return await bail({ status: 'error', error: `breaker agent failed on task ${t.n}` })
      const blockedRulings = breaker.rulings.filter(r => r.decision === 'blocked')
      if (blockedRulings.length > 0) {
        return await bail({
          status: 'blocked',
          blocked: `Task ${t.n} breaker: ${blockedRulings.map(r => `${r.title} — ${r.ruling}`).join('; ')}`,
        })
      }
      for (const r of breaker.rulings) {
        taskParked.push(`Task ${t.n}: parked — ${r.title} — ruling: ${r.ruling}`)
        if (r.title === 'verification failed') unverified.push(`Task ${t.n} (${t.title}): "${t.verification}" ruled unusable — ${r.ruling}`)
      }
      parkedAll.push(...taskParked)
      break
    }
    round++
    const fixModel = round <= 3 ? implModel : tierUp(implModel)
    const fix = await agent(implPrompt(t, reportPath,
      `${round > 3 ? `A prior implementer attempted this task ${round - 1} time(s); you own it now. Read the report file for what was tried. ` : ''}Fix round ${round}/5 — address these findings, nothing else:\n${openFindings.map(f => `- [${f.severity}] ${f.title}: ${f.detail}`).join('\n')}\n${openFindings.some(f => f.title === 'verification failed') ? 'If the verification command fails identically on an unmodified tree, say so as BLOCKED with that evidence instead of changing more code — an isolation run is your FIRST move on a failure you did not expect, not your last.\n' : ''}Append your fix report to the same report file.`),
      { label: `${label}:fix${round}`, phase: 'Tasks', model: fixModel, agentType: 'general-purpose', schema: IMPL_SCHEMA })
    if (!fix) return await bail({ status: 'error', error: `fix agent failed on task ${t.n} round ${round}` })
    if (fix.status === 'BLOCKED' || fix.status === 'NEEDS_CONTEXT') {
      escalated = `${fix.status} — ${(fix.concerns ?? []).join('; ') || fix.summary}`
      lastHead = null
      continue
    }
    v = await verify(`${label}:verify${round}`, lastReviewBase)
    if (!v || !SHA_SHAPE.test(v.sha ?? '')) return await bail({ status: 'error', error: `verification agent failed on task ${t.n}` })
    lastHead = v.sha
    head = v.sha
    loc = Number.isFinite(v.loc) ? v.loc : Infinity
    if (t.verification && v.passed !== true) {
      openFindings = [
        { severity: 'critical', title: 'verification failed', detail: v.tail ?? '' },
        ...openFindings.filter(f => f.title !== 'verification failed'),
      ]
      continue
    }
    if (!reviewed) { openFindings = []; continue }
    const rr = await agent(reReviewPrompt(openFindings, briefPath, reportPath, lastReviewBase, head), {
      label: `${label}:rereview${round}`, phase: 'Tasks',
      agentType: 'gor-mobile-code-reviewer', schema: REREVIEW_SCHEMA,
    })
    if (!rr) return await bail({ status: 'error', error: `re-review agent failed on task ${t.n} round ${round}` })
    lastReviewBase = head
    const notAddressed = openFindings.filter((f, i) => !rr.verdicts.some(vd => vd.n === i + 1 && vd.verdict === 'ADDRESSED'))
    for (const f of rr.newFindings.filter(f => f.severity === 'minor')) deferredMinors.push(`Task ${t.n} (fix ${round}): ${f.title}`)
    openFindings = [...notAddressed, ...rr.newFindings.filter(f => f.severity !== 'minor')]
  }

  taskResults.push({ n: t.n, title: t.title, mode: 'full', rounds: round, parked: taskParked })
  progressLines.push(`Task ${t.n}: complete (${round} fix rounds, ${taskParked.length} parked) — ${impl.summary}`)
}

phase('Final')

// One writer for whatever the Tasks phase did not already flush — a
// mid-run stop flushes on its way out, so the checkpoint exists either way.
await flushProgress()

// Whole-project verification the plan named — run and independently checked
// here, not delegated prose inside another agent's prompt (see verify() in
// the task loop, which requires the same zero-exit contract). The runner
// also snapshots, so a following fix wave reuses the SHA as its base.
if (setup.verificationAll) {
  const va = await agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} for the script — and report honestly:
1. ${setup.verificationAll}${verifyContract(setup.verificationAll)}
2. ${SCRIPTS}/sdd-snapshot "${planPath}" — its printed tree SHA is "sha".
Return the structured result only.`,
    runnerOpts('final:verifyAll', 'Final'))
  if (!va || va.passed !== true) return await bail({ status: 'blocked', blocked: 'whole-project verification failed: ' + (va ? va.tail ?? '' : 'agent error') })
  if (SHA_SHAPE.test(va.sha ?? '')) lastHead = va.sha
}

const finalReview = await workflow('gor-review', {
  mode: 'final', base: initialBase, planPath,
  deferredMinors, parked: parkedAll,
})
// A null or errored nested review is a hard stop, not a quiet 'done' — the
// advertised final gate must actually have run for the session to trust it.
if (!finalReview || finalReview.status === 'error') {
  return await bail({
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
  // Base BEFORE the wave runs (reusing the last verified snapshot when the
  // chain is clean) so the re-review below covers only the wave's own diff,
  // not the whole plan implementation since initialBase.
  const waveBase = await ensureBase('final:base', 'Final')
  if (!waveBase) return await bail({ status: 'error', error: 'final snapshot agent failed' })
  const wave = await agent(`You are the fix-wave implementer for the final review of the plan at ${planPath} in this repository. Fix ALL of these findings in the working tree (no commits):
${finalOpen.map(f => `- [${f.severity}] ${f.title}${f.file ? ' (' + f.file + ')' : ''}: ${f.detail}`).join('\n')}
Global constraints:\n${setup.constraints}
${setup.verificationAll ? `Then run: ${setup.verificationAll} — it must pass.` : ''}
You never dispatch subagents. Full report → ${waveReport}. Return the structured result.`,
    { label: 'final:fixwave', phase: 'Final', schema: IMPL_SCHEMA })
  lastHead = null

  // A wave that never ran, or reports it could not complete, has changed
  // nothing trustworthy — skip packaging/re-review and stop, same as the
  // per-task loop's handling of these two statuses.
  if (!wave || wave.status === 'NEEDS_CONTEXT' || wave.status === 'BLOCKED') {
    return await bail({
      status: 'blocked',
      blocked: 'final fix wave did not complete — ' + (wave ? `${wave.status} — ${(wave.concerns ?? []).join('; ') || wave.summary}` : 'agent error'),
      finalReview: {
        status: finalReview.status, codexRan: finalReview.codexRan ?? false,
        gorRan: finalReview.gorRan ?? false, residualFindings: finalOpen,
        conflicts: finalReview.conflicts ?? [],
      },
    })
  }
  if (wave.status === 'DONE_WITH_CONCERNS' && (wave.concerns ?? []).length > 0) {
    for (const c of wave.concerns) deferredMinors.push(`Final fix wave concern: ${c}`)
  }

  // Post-wave runner: independent whole-project verification (when the plan
  // names one) plus the head snapshot the re-review packages against. Runs
  // BEFORE the re-review — the re-review is read-only, so verifying first
  // loses nothing and one runner covers both jobs.
  const pw = await agent(`Run these commands in the repository root — ${SCRIPTS_NOTE} for the script — and report honestly:\n`
    + (setup.verificationAll
      ? `1. ${setup.verificationAll}${verifyContract(setup.verificationAll)}\n2. ${SCRIPTS}/sdd-snapshot "${planPath}" — its printed tree SHA is "sha".`
      : `1. ${SCRIPTS}/sdd-snapshot "${planPath}" — its printed tree SHA is "sha".`)
    + `\nReturn the structured result only.`,
    runnerOpts('final:postwave', 'Final'))
  if (setup.verificationAll && (!pw || pw.passed !== true)) {
    return await bail({ status: 'blocked', blocked: 'whole-project verification failed: ' + (pw ? pw.tail ?? '' : 'agent error') })
  }
  const waveHead = pw && SHA_SHAPE.test(pw.sha ?? '') ? pw.sha : null
  if (waveHead) lastHead = waveHead
  const rr = waveHead ? await agent(reReviewPrompt(finalOpen, planPath, waveReport, waveBase, waveHead), {
    label: 'final:rereview', phase: 'Final', agentType: 'gor-mobile-code-reviewer', schema: REREVIEW_SCHEMA,
  }) : null
  const residual = rr
    ? [...finalOpen.filter((f, i) => !rr.verdicts.some(vd => vd.n === i + 1 && vd.verdict === 'ADDRESSED')), ...rr.newFindings.filter(f => f.severity !== 'minor')]
    : finalOpen
  finalOpen = residual
}

// 'done' only with an empty residual set — a caller reading top-level status
// must never see 'done' while findings from the final gate are still open.
// A run whose gates were dropped is 'done' on code and open on evidence:
// say so in the result, or the session reports work as verified that no
// command ever checked.
return out({
  status: finalOpen.length > 0 ? 'blocked' : 'done',
  ...(finalOpen.length > 0 ? { blocked: `final review found ${finalOpen.length} unresolved finding(s): ${finalOpen.map(f => f.title).join('; ')}` } : {}),
  ...(unverified.length > 0 ? { needsManualVerification: `${unverified.length} verification command(s) were unusable — the code they covered was never built or run. Report this to the user instead of calling those tasks verified.` } : {}),
  finalReview: {
    status: finalReview.status, codexRan: finalReview.codexRan ?? false,
    gorRan: finalReview.gorRan ?? false, residualFindings: finalOpen,
    conflicts: finalReview.conflicts ?? [],
  },
})
