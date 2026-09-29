import { execFileSync } from "node:child_process";
import { cpSync, existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";

const sh = (cmd, args, opts = {}) => execFileSync(cmd, args, { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], ...opts });
const readJson = (p, dflt) => (existsSync(p) ? JSON.parse(readFileSync(p, "utf8")) : dflt);

export function removeProjectKeys(paths, claudeJson = join(homedir(), ".claude.json")) {
  if (!paths.length || !existsSync(claudeJson)) return;
  const j = readJson(claudeJson, {});
  let dirty = false;
  for (const w of paths) if (j.projects?.[w]) { delete j.projects[w]; dirty = true; }
  if (dirty) writeFileSync(claudeJson, JSON.stringify(j, null, 2));
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

export function prepareVariant(name, spec, { repo, root }) {
  const base = join(root, name);
  mkdirSync(base, { recursive: true });
  let src = repo;
  if (spec !== ".") {
    src = join(base, "src");
    sh("git", ["worktree", "add", "--detach", src, spec], { cwd: repo });
  }
  const env = { ...process.env, GOR_MOBILE_HOME: join(base, "gm"), CODEX_HOME: join(base, "cx") };
  mkdirSync(env.CODEX_HOME, { recursive: true });
  cpSync(join(homedir(), ".codex", "auth.json"), join(env.CODEX_HOME, "auth.json"));
  sh("node", [join(src, "bin", "gor-mobile.mjs"), "setup", "--yes", "--no-tui", "--skip-android-update", "--target", "codex"], { env });
  return { name, spec, src, env };
}

export function prepareRun(variant, kase, { repo, root, registry }) {
  const runDir = realpathSync(sh("mktemp", ["-d", join(root, "run-XXXXXX")]).trim());
  const workdir = join(runDir, "app");
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
}

export function teardownRun({ runDir, workdir }, variant, registry) {
  try {
    sh("node", [join(variant.src, "bin", "gor-mobile.mjs"), "uninstall", "--project", "--yes"], { cwd: workdir, env: variant.env });
  } catch { /* cleanupStale on the next start covers it */ }
  removeProjectKeys([workdir]);
  register(registry, workdir, false);
  sh("rm", ["-rf", runDir]);
}

export function dropVariant(variant, repo) {
  if (variant.spec !== ".") sh("git", ["worktree", "remove", "--force", variant.src], { cwd: repo });
}