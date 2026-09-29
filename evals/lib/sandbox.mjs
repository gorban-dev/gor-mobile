import { execFileSync } from "node:child_process";
import { chmodSync, closeSync, cpSync, existsSync, statSync, symlinkSync, mkdirSync, openSync, readFileSync, realpathSync, renameSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const readJson = (p, dflt) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : dflt);

export function removeProjectKeys(paths, claudeJson = join(homedir(), ".claude.json")) {
  if (!paths.length || !existsSync(claudeJson)) return;
  const j = readJson(claudeJson, {});
  let dirty = false;
  for (const w of paths) if (j.projects?.[w]) { delete j.projects[w]; dirty = true; }
  if (!dirty) return;
  const tmp = `${claudeJson}.evals-tmp-${process.pid}`;
  writeFileSync(tmp, JSON.stringify(j, null, 2));
  chmodSync(tmp, statSync(claudeJson).mode & 0o777);
  renameSync(tmp, claudeJson);
}

// Hours until the Codex access token expires, or null when it cannot be decoded.
export function codexTokenHoursLeft(auth, now = Date.now()) {
  try {
    const payload = String(auth?.tokens?.access_token ?? "").split(".")[1];
    const exp = JSON.parse(Buffer.from(payload, "base64url").toString("utf8")).exp;
    return typeof exp === "number" ? (exp * 1000 - now) / 3600_000 : null;
  } catch { return null; }
}

export function acquireLock(path) {
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const fd = openSync(path, "wx");
      writeFileSync(fd, String(process.pid));
      closeSync(fd);
      return;
    } catch (e) {
      if (e.code !== "EEXIST") throw e;
      const pid = Number(readFileSync(path, "utf8"));
      let alive = false;
      if (pid) {
        try { process.kill(pid, 0); alive = true; } catch (k) { alive = k.code === "EPERM"; }
      }
      if (alive) throw new Error(`another eval run is active (pid ${pid})`);
      unlinkSync(path);
    }
  }
  throw new Error("could not acquire eval lock");
}

export function releaseLock(path) {
  try { unlinkSync(path); } catch { /* already gone */ }
}

export function cleanupStale(registry, claudeJson = join(homedir(), ".claude.json")) {
  removeProjectKeys(readJson(registry, []), claudeJson);
  writeFileSync(registry, "[]");
}

function register(registry, workdir, add) {
  const list = readJson(registry, []).filter((w) => w !== workdir);
  if (add) list.push(workdir);
  writeFileSync(registry, JSON.stringify(list));
}

export function prepareVariant(name, spec, { repo, root, harnesses = ["claude", "codex"] }) {
  const wantCodex = harnesses.includes("codex");
  const auth = join(homedir(), ".codex", "auth.json");
  if (wantCodex && !existsSync(auth)) throw new Error(`codex harness requested but ${auth} is missing (run codex login)`);
  const base = join(root, name);
  mkdirSync(base, { recursive: true });
  let src = repo;
  let added = false;
  try {
    if (spec !== ".") {
      src = join(base, "src");
      sh("git", ["worktree", "add", "--detach", src, spec], { cwd: repo });
      added = true;
      // The worktree lives outside the repo, so dist/cli.js cannot resolve deps from a parent node_modules.
      symlinkSync(join(repo, "node_modules"), join(src, "node_modules"), "dir");
    }
    // gor-mobile CLI calls (setup/init/uninstall) get a fake home: `android init` writes the stock
    // skill into the real ~/.claude/skills and init deletes it again. claude/codex keep the real HOME (auth).
    const fakeHome = join(base, "home");
    mkdirSync(fakeHome, { recursive: true });
    const shared = { GOR_MOBILE_HOME: join(base, "gm"), CODEX_HOME: join(base, "cx") };
    // The android binary resolves the home dir via the JVM, not $HOME, hence user.home.
    const env = { ...process.env, ...shared, HOME: fakeHome, JAVA_TOOL_OPTIONS: `-Duser.home=${fakeHome}` };
    const runEnv = { ...process.env, ...shared };
    mkdirSync(env.CODEX_HOME, { recursive: true });
    const setup = ["setup", "--yes", "--no-tui", "--skip-android-update"];
    if (wantCodex) {
      cpSync(auth, join(env.CODEX_HOME, "auth.json"));
      setup.push("--target", "codex");
    }
    sh("node", [join(src, "bin", "gor-mobile.mjs"), ...setup], { env });
    return { name, spec, src, env, runEnv, base };
  } catch (e) {
    if (added) try { sh("git", ["worktree", "remove", "--force", src], { cwd: repo }); } catch { /* best effort */ }
    throw e;
  }
}

export function prepareRun(variant, kase, { repo, root, registry }) {
  const runDir = realpathSync(sh("mktemp", ["-d", join(root, "run-XXXXXX")]).trim());
  const workdir = join(runDir, "app");
  try {
    if (kase.fixture === "empty") mkdirSync(workdir);
    else cpSync(join(repo, "evals", "fixtures", kase.fixture), workdir, { recursive: true });
    const git = (...a) => sh("git", ["-c", "user.email=eval@local", "-c", "user.name=eval", ...a], { cwd: workdir });
    git("init", "-q");
    git("add", "-A");
    git("commit", "-q", "--allow-empty", "-m", "base");
    register(registry, workdir, true);
    sh("node", [join(variant.src, "bin", "gor-mobile.mjs"), "init", "--yes", "--no-tui", "--platform", "android"], { cwd: workdir, env: variant.env });
    if (kase.fixture === "android-app") {
      mkdirSync(join(workdir, ".claude", "rules"), { recursive: true });
      writeFileSync(join(workdir, ".claude", "rules", "ast-index.md"), "");
      sh("ast-index", ["rebuild"], { cwd: workdir });
    }
    for (const [rel, text] of Object.entries(kase.files ?? {})) {
      mkdirSync(dirname(join(workdir, rel)), { recursive: true });
      writeFileSync(join(workdir, rel), text);
    }
    const codexHome = join(runDir, "cx");
    cpSync(variant.env.CODEX_HOME, codexHome, { recursive: true });
    return { runDir, workdir, codexHome };
  } catch (e) {
    try { sh("ast-index", ["clear"], { cwd: workdir }); } catch { /* index may not exist */ }
    removeProjectKeys([workdir]);
    register(registry, workdir, false);
    sh("rm", ["-rf", runDir]);
    throw e;
  }
}

export function teardownRun({ runDir, workdir }, variant, registry) {
  try {
    sh("node", [join(variant.src, "bin", "gor-mobile.mjs"), "uninstall", "--project", "--yes"], { cwd: workdir, env: variant.env });
  } catch { /* cleanupStale on the next start covers it */ }
  try { sh("ast-index", ["clear"], { cwd: workdir }); } catch { /* index may not exist */ }
  removeProjectKeys([workdir]);
  register(registry, workdir, false);
  sh("rm", ["-rf", runDir]);
}

export function dropVariant(variant, repo) {
  if (variant.spec !== ".") sh("git", ["worktree", "remove", "--force", variant.src], { cwd: repo });
  sh("rm", ["-rf", variant.base]);
}