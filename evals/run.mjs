#!/usr/bin/env node
import { spawn } from "node:child_process";
import { appendFileSync, existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, rmSync, writeFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { homedir, tmpdir } from "node:os";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { parseClaude } from "./lib/adapters/claude.mjs";
import { parseCodex } from "./lib/adapters/codex.mjs";
import { grade, changedFiles } from "./lib/graders.mjs";
import { acquireLock, cleanupStale, codexTokenHoursLeft, dropVariant, prepareRun, prepareVariant, releaseLock, teardownRun } from "./lib/sandbox.mjs";

const REPO = join(dirname(fileURLToPath(import.meta.url)), "..");
const { values } = parseArgs({
  options: {
    variant: { type: "string", multiple: true },
    harness: { type: "string", default: "claude,codex" },
    split: { type: "string", default: "train" },
    case: { type: "string" },
    runs: { type: "string" },
    "max-cost-usd": { type: "string" },
    concurrency: { type: "string", default: "1" },
    "claude-model": { type: "string" },
    "codex-model": { type: "string" },
    "allow-stale-codex-auth": { type: "boolean", default: false }
  }
});

const DEFAULT_TOOLS = ["Skill", "Agent","Read", "Glob", "Grep", "Write", "Edit", "Bash(ast-index:*)", "Bash(ls:*)", "Bash(cat:*)", "Bash(git status:*)", "Bash(git diff:*)"];

function loadCases() {
  const dir = join(REPO, "evals", "cases");
  const files = readdirSync(dir, { recursive: true }).filter((f) => String(f).endsWith(".json"));
  const glob = values.case ? new RegExp("^" + values.case.replace(/\*/g, ".*") + "$") : null;
  return files.map((f) => JSON.parse(readFileSync(join(dir, String(f)), "utf8")))
    .filter((c) => values.split === "all" || c.split === values.split)
    .filter((c) => !glob || glob.test(c.name));
}

const CHILDREN = new Set();

function exec(cmd, args, { cwd, env, timeoutMs }) {
  return new Promise((resolve) => {
    const p = spawn(cmd, args, { cwd, env, stdio: ["ignore", "pipe", "pipe"], detached: true });
    CHILDREN.add(p);
    const killGroup = () => { try { process.kill(-p.pid, "SIGKILL"); } catch { /* already gone */ } };
    let out = "";
    p.stdout.on("data", (d) => (out += d));
    p.stderr.on("data", (d) => (out += d));
    let timedOut = false;
    const t = setTimeout(() => { timedOut = true; killGroup(); }, timeoutMs);
    p.on("close", (code) => { clearTimeout(t); CHILDREN.delete(p); killGroup(); resolve({ out, code, timedOut }); });
  });
}

function sessionError(harness, meta) {
  if (harness === "claude") {
    if (!meta.has_result) return "no result line";
    if (meta.is_error && meta.outcome !== "error_max_turns") return `claude ${meta.outcome ?? "error"}`;
    return undefined;
  }
  if (meta.error_message) return `codex: ${String(meta.error_message).slice(0, 200)}`;
  if (!meta.completed) return "codex: no turn.completed";
  return undefined;
}

async function runOnce(variant, kase, harness, n, resultsDir) {
  const run = prepareRun(variant, kase, { repo: REPO, root: ROOT, registry: REGISTRY });
  try {
    const timeoutMs = (kase.timeout_s ?? 900) * 1000;
    let res;
    if (harness === "claude") {
      const tools = kase.allowed_tools ?? DEFAULT_TOOLS;
      const bareTools = [...new Set(tools.map((t) => t.replace(/\(.*$/, "")))];
      const args = ["-p", kase.prompt, "--output-format", "stream-json", "--verbose", "--max-turns", String(kase.max_turns),
        "--no-session-persistence", "--tools", bareTools.join(","), "--allowedTools", ...tools];
      if (values["claude-model"]) args.push("--model", values["claude-model"]);
      res = await exec("claude", args, { cwd: run.workdir, env: variant.runEnv, timeoutMs });
    } else {
      const args = ["exec", "--json", "--skip-git-repo-check", "--ephemeral", "-s", "workspace-write", "-C", run.workdir, kase.prompt];
      if (values["codex-model"]) args.splice(1, 0, "-m", values["codex-model"]);
      res = await exec("codex", args, { cwd: run.workdir, env: { ...variant.runEnv, CODEX_HOME: run.codexHome }, timeoutMs });
    }
    const rawDir = join(resultsDir, variant.name, harness, kase.name);
    mkdirSync(rawDir, { recursive: true });
    writeFileSync(join(rawDir, `${n}.jsonl`), res.out);
    const lines = res.out.split("\n");
    const { events, meta } = harness === "claude" ? parseClaude(lines) : parseCodex(lines);
    const ctx = { events, meta, workdir: run.workdir, changed: changedFiles(run.workdir) };
    const grades = [];
    for (const g of kase.graders) grades.push(await grade(g, ctx));
    const error = res.timedOut ? "timeout" : sessionError(harness, meta) ?? (res.code !== 0 && events.length === 0 ? `exit ${res.code}` : undefined);
    return {
      variant: variant.name, harness, case: kase.name, split: kase.split, run: n,
      pass: !error && grades.every((g) => g.pass), error, grades,
      cost_usd: meta.cost_usd, tokens: meta.input_tokens !== undefined ? meta.input_tokens + meta.output_tokens : undefined, model: meta.model
    };
  } finally {
    teardownRun(run, variant, REGISTRY);
  }
}

async function pool(tasks, size) {
  const it = tasks[Symbol.iterator]();
  await Promise.all(Array.from({ length: size }, async () => { for (const t of it) await t(); }));
}

const stamp = new Date().toISOString().replace(/[:.]/g, "-");
const resultsDir = join(REPO, "evals", "results", stamp);
// Outside the repo: Claude loads every ancestor CLAUDE.md, so runs under the repo would see the dev one.
const ROOT = realpathSync(mkdtempSync(join(tmpdir(), "gm-evals-")));
const REGISTRY = join(REPO, "evals", "results", "registry.json");
const LOCK = join(REPO, "evals", "results", ".lock");
mkdirSync(resultsDir, { recursive: true });
try { acquireLock(LOCK); } catch (e) { rmSync(ROOT, { recursive: true, force: true }); console.error(e.message); process.exit(1); }
const scores = join(resultsDir, "scores.jsonl");
const variants = [];
let cleaned = false;
function cleanup() {
  if (cleaned) return;
  cleaned = true;
  for (const c of CHILDREN) try { process.kill(-c.pid, "SIGKILL"); } catch { /* gone */ }
  for (const v of variants) try { dropVariant(v, REPO); } catch { /* best effort */ }
  rmSync(ROOT, { recursive: true, force: true });
  if (!existsSync(scores)) rmSync(resultsDir, { recursive: true, force: true });
  try { execFileSync("git", ["worktree", "prune"], { cwd: REPO }); } catch { /* best effort */ }
  releaseLock(LOCK);
}
process.on("exit", cleanup);
for (const sig of ["SIGINT", "SIGTERM"]) process.on(sig, () => { cleanup(); process.exit(130); });
try { execFileSync("git", ["worktree", "prune"], { cwd: REPO }); } catch { /* best effort */ }
cleanupStale(REGISTRY);

const specs = (values.variant ?? []).map((v) => v.split("="));
const harnesses = values.harness.split(",");
const ceiling = values["max-cost-usd"] ? Number(values["max-cost-usd"]) : Infinity;
let spent = 0;
try {
  if (specs.length === 0) throw new Error("need at least one --variant name=<git-ref|.>");
  if (harnesses.includes("codex")) {
    const auth = join(homedir(), ".codex", "auth.json");
    if (!existsSync(auth)) throw new Error(`codex harness requested but ${auth} is missing (run codex login)`);
    const hours = codexTokenHoursLeft(JSON.parse(readFileSync(auth, "utf8")));
    if (hours === null) console.warn("warning: cannot decode the codex access token, skipping the expiry check");
    else if (hours < 6 && !values["allow-stale-codex-auth"]) {
      throw new Error(`Codex access token expires in ${Math.max(hours, 0).toFixed(1)}h; run \`codex\` once to refresh its login, then retry`);
    }
  }
  const cases = loadCases();
  for (const [name, spec] of specs) variants.push(prepareVariant(name, spec, { repo: REPO, root: ROOT, harnesses }));
  const tasks = [];
  for (const kase of cases) for (const harness of harnesses) {
    if (!kase.harness.includes(harness)) continue;
    for (let n = 0; n < Number(values.runs ?? kase.runs ?? 3); n++) for (const v of variants) {
      tasks.push(async () => {
        if (spent >= ceiling) return;
        let row;
        try { row = await runOnce(v, kase, harness, n, resultsDir); }
        catch (e) { row = { variant: v.name, harness, case: kase.name, split: kase.split, run: n, pass: false, error: String(e.message ?? e).slice(0, 300) }; }
        spent += row.cost_usd ?? 0;
        appendFileSync(scores, JSON.stringify(row) + "\n");
        console.log(`${row.pass ? "PASS" : "FAIL"} ${v.name} ${harness} ${kase.name}#${n}${row.error ? " " + row.error : ""}`);
      });
    }
  }
  await pool(tasks, Number(values.concurrency));
} finally {
  cleanup();
}
console.log(`scores: ${scores}\nspent (claude): $${spent.toFixed(2)}`);