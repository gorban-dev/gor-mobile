var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});

// src/cli.ts
import { Command } from "commander";

// src/constants.ts
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
var GOR_MOBILE_VERSION = "0.2.1";
var HOME = homedir();
var GOR_MOBILE_HOME = process.env.GOR_MOBILE_HOME ?? join(HOME, ".gor-mobile");
var GOR_MOBILE_RULES_DIR = join(GOR_MOBILE_HOME, "rules");
var GOR_MOBILE_TEMPLATES_DIR = join(GOR_MOBILE_HOME, "templates");
var XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME ?? join(HOME, ".config");
var GOR_MOBILE_CONFIG_DIR = join(XDG_CONFIG_HOME, "gor-mobile");
var GOR_MOBILE_CONFIG = join(GOR_MOBILE_CONFIG_DIR, "config.json");
var CLAUDE_DIR = join(HOME, ".claude");
var CLAUDE_SETTINGS = join(CLAUDE_DIR, "settings.json");
var CLAUDE_CLAUDE_MD = join(CLAUDE_DIR, "CLAUDE.md");
var CLAUDE_MCP = join(CLAUDE_DIR, "mcp.json");
var CLAUDE_COMMANDS_DIR = join(CLAUDE_DIR, "commands");
var CLAUDE_AGENTS_DIR = join(CLAUDE_DIR, "agents");
var CLAUDE_SKILLS_DIR = join(CLAUDE_DIR, "skills");
var MANAGED_TAG = "gor-mobile";
var SECTION_BEGIN = "<!-- BEGIN gor-mobile managed section -->";
var SECTION_END = "<!-- END gor-mobile managed section -->";
var DEFAULT_RULES_URL = "https://github.com/gorban-dev/gor-mobile-rules-default.git";
var DEFAULT_RULES_REF = "main";
function gorMobileRoot() {
  if (process.env.GOR_MOBILE_ROOT) return process.env.GOR_MOBILE_ROOT;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

// src/commands/init.ts
import { existsSync as existsSync9 } from "fs";
import { join as join7 } from "path";
import { execa as execa3 } from "execa";
import pc8 from "picocolors";
import { cancel as cancel5, isCancel as isCancel5 } from "@clack/prompts";

// src/helpers/android-cli.ts
import { accessSync as accessSync2, constants as constants2, existsSync, rmSync } from "fs";
import { homedir as homedir2 } from "os";
import { dirname as dirname2, join as join3 } from "path";
import { execa } from "execa";

// src/android-contract.ts
var ANDROID_CLI_FLOOR = "1.0.0";
var ANDROID_CONTRACT = [
  { command: ["describe"], phase: "plan", purpose: "JSON metadata: build targets + APK paths" },
  { command: ["info"], phase: "plan", purpose: "SDK location / environment" },
  { command: ["run"], phase: "execute", purpose: "deploy + launch APK (replaces adb install)" },
  { command: ["sdk", "list"], phase: "execute", purpose: "installed vs available SDK packages" },
  { command: ["sdk", "install"], phase: "execute", purpose: "pull a missing platform" },
  { command: ["screen", "capture"], phase: "verify", purpose: "device screenshot (PNG)" },
  { command: ["screen", "resolve"], phase: "verify", purpose: "annotated-label \u2192 tap coords" },
  { command: ["layout"], phase: "verify", purpose: "UI tree as JSON" },
  { command: ["emulator", "list"], phase: "execute", purpose: "list AVDs" },
  { command: ["emulator", "start"], phase: "execute", purpose: "boot an AVD" },
  { command: ["docs", "search"], phase: "research", purpose: "search authoritative Android docs" },
  { command: ["docs", "fetch"], phase: "research", purpose: "fetch a doc article" },
  { command: ["skills", "list"], phase: "meta", purpose: "browse Google's optional skill catalog" },
  { command: ["skills", "add"], phase: "meta", purpose: "install an optional Google skill" },
  { command: ["skills", "remove"], phase: "meta", purpose: "remove an optional Google skill" },
  { command: ["init"], phase: "meta", purpose: "install the stock android-cli skill" },
  // studio group — conditional: needs a running Android Studio (Quail+) instance.
  { command: ["studio", "analyze-file"], phase: "debug", purpose: "IDE-level file inspection", conditional: true },
  { command: ["studio", "render-compose-preview"], phase: "debug", purpose: "render a Compose preview", conditional: true },
  { command: ["studio", "find-declaration"], phase: "plan", purpose: "semantic declaration lookup (after ast-index)", conditional: true },
  { command: ["studio", "find-usages"], phase: "plan", purpose: "semantic usage lookup (after ast-index)", conditional: true },
  { command: ["studio", "version-lookup"], phase: "research", purpose: "latest Maven/Android versions", conditional: true }
];
function requiredTopLevelCommands() {
  return [...new Set(ANDROID_CONTRACT.filter((c) => !c.conditional).map((c) => c.command[0]))];
}

// src/helpers/version.ts
function compareVersions(a, b) {
  const pa = a.split(".").map((s) => parseInt(s, 10) || 0);
  const pb = b.split(".").map((s) => parseInt(s, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const x = pa[i] ?? 0;
    const y = pb[i] ?? 0;
    if (x !== y) return x - y;
  }
  return 0;
}
function meetsFloor(installed, floor) {
  return compareVersions(installed, floor) >= 0;
}

// src/helpers/deps.ts
import { accessSync, constants } from "fs";
import { delimiter, join as join2 } from "path";
function which(cmd) {
  const PATH = process.env.PATH ?? "";
  for (const dir of PATH.split(delimiter)) {
    if (!dir) continue;
    const full = join2(dir, cmd);
    try {
      accessSync(full, constants.X_OK);
      return full;
    } catch {
    }
  }
  return null;
}
function has(cmd) {
  return which(cmd) !== null;
}
function androidCliPath() {
  return which("android");
}

// src/helpers/android-cli.ts
var DARWIN_ARM64_FALLBACK_URL = "https://dl.google.com/android/cli/latest/darwin_arm64/install.sh";
var ANDROID_CLI_INSTALL_URLS = {
  "darwin/arm64": DARWIN_ARM64_FALLBACK_URL,
  "darwin/x64": "https://dl.google.com/android/cli/latest/darwin_x86_64/install.sh",
  "linux/x64": "https://dl.google.com/android/cli/latest/linux_x86_64/install.sh",
  "win32/x64": "https://dl.google.com/android/cli/latest/windows_x86_64/install.cmd"
};
function platformKey() {
  return `${process.platform}/${process.arch}`;
}
function androidCliInstallUrl() {
  return ANDROID_CLI_INSTALL_URLS[platformKey()] ?? null;
}
var ANDROID_CLI_INSTALL_URL = androidCliInstallUrl() ?? DARWIN_ARM64_FALLBACK_URL;
function androidCliSkillPath() {
  return join3(CLAUDE_SKILLS_DIR, "android-cli", "SKILL.md");
}
function androidCliSkillInstalled() {
  return existsSync(androidCliSkillPath());
}
function androidCliInstallSupported() {
  return androidCliInstallUrl() !== null;
}
async function installAndroidCli() {
  const url = androidCliInstallUrl();
  if (!url) {
    return {
      installed: false,
      error: `unsupported platform ${process.platform}/${process.arch}`
    };
  }
  try {
    const cmd = process.platform === "win32" ? `curl -fsSL ${url} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"` : `curl -fsSL ${url} | bash`;
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";
    const shellFlag = process.platform === "win32" ? "/c" : "-c";
    const res = await execa(shell, [shellFlag, cmd], {
      stdio: "inherit",
      reject: false,
      timeout: 18e4
    });
    if (res.exitCode !== 0) {
      return { installed: false, error: `installer exit ${res.exitCode}` };
    }
    return { installed: androidCliPath() !== null };
  } catch (err) {
    return { installed: false, error: err.message };
  }
}
async function runAndroidUpdate() {
  const cli = androidCliPath();
  if (!cli) return { ran: false, ok: false };
  try {
    const res = await execa(cli, ["update"], {
      reject: false,
      stdio: "inherit",
      timeout: 18e4
    });
    return {
      ran: true,
      ok: res.exitCode === 0,
      error: res.exitCode === 0 ? void 0 : `exit ${res.exitCode}`
    };
  } catch (err) {
    return { ran: true, ok: false, error: err.message };
  }
}
async function listAndroidSkills() {
  const cli = androidCliPath();
  if (!cli) return { ok: false, names: [], error: "android CLI not on PATH" };
  try {
    const res = await execa(cli, ["skills", "list"], {
      reject: false,
      timeout: 6e4
    });
    if (res.exitCode !== 0) {
      return {
        ok: false,
        names: [],
        error: (res.stderr || res.stdout || "").toString().slice(0, 200)
      };
    }
    const names = res.stdout.split("\n").map((s) => s.trim()).filter((s) => s.length > 0 && !s.startsWith("["));
    return { ok: true, names };
  } catch (err) {
    return { ok: false, names: [], error: err.message };
  }
}
async function addAndroidSkill(name) {
  const cli = androidCliPath();
  if (!cli) return { ok: false, error: "android CLI not on PATH" };
  try {
    const res = await execa(
      cli,
      ["skills", "add", "--agent=claude-code", `--skill=${name}`],
      { reject: false, timeout: 12e4 }
    );
    return {
      ok: res.exitCode === 0,
      error: res.exitCode === 0 ? void 0 : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
async function removeAndroidSkill(name) {
  const cli = androidCliPath();
  if (!cli) return { ok: false, error: "android CLI not on PATH" };
  try {
    const res = await execa(
      cli,
      ["skills", "remove", "--agent=claude-code", `--skill=${name}`],
      { reject: false, timeout: 6e4 }
    );
    return {
      ok: res.exitCode === 0,
      error: res.exitCode === 0 ? void 0 : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}
function canWrite(path) {
  try {
    accessSync2(path, constants2.W_OK);
    return true;
  } catch {
    return false;
  }
}
async function uninstallAndroidCli() {
  const removed = [];
  const errors = [];
  const cli = androidCliPath();
  if (cli) {
    if (canWrite(dirname2(cli))) {
      try {
        rmSync(cli, { force: true });
        removed.push(cli);
      } catch (err) {
        errors.push(`${cli}: ${err.message}`);
      }
    } else {
      const res = await execa("sudo", ["rm", "-f", cli], {
        stdio: "inherit",
        reject: false
      });
      if (res.exitCode === 0) removed.push(cli);
      else errors.push(`${cli}: sudo rm exit ${res.exitCode}`);
    }
  }
  const paths = [
    join3(homedir2(), ".android", "bin", "android-cli"),
    join3(homedir2(), ".android", "cli"),
    join3(CLAUDE_SKILLS_DIR, "android-cli")
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      rmSync(p, { recursive: true, force: true });
      removed.push(p);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }
  return { removed, errors };
}
async function runAndroidInit() {
  const cli = androidCliPath();
  if (!cli) return { ran: false, skillInstalled: false };
  const skillPath = androidCliSkillPath();
  try {
    const res = await execa(cli, ["init"], { reject: false, timeout: 3e4 });
    const ok = res.exitCode === 0;
    return {
      ran: true,
      skillInstalled: existsSync(skillPath),
      error: ok ? void 0 : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return {
      ran: true,
      skillInstalled: existsSync(skillPath),
      error: err.message
    };
  }
}
async function androidCliVersion() {
  const cli = androidCliPath();
  if (!cli) return null;
  try {
    const res = await execa(cli, ["--version"], { reject: false, timeout: 3e4 });
    if (res.exitCode !== 0) return null;
    const m = res.stdout.trim().split(/\s+/)[0];
    return m && /\d/.test(m) ? m : null;
  } catch {
    return null;
  }
}
async function installAndroidCliViaBrew() {
  if (process.platform !== "darwin") {
    return { installed: false, error: "brew path is macOS-only; use platform channel" };
  }
  try {
    const tap = await execa("brew", ["tap", "android/tap"], { stdio: "inherit", reject: false, timeout: 12e4 });
    if (tap.exitCode !== 0) return { installed: false, error: `brew tap exit ${tap.exitCode}` };
    const inst = await execa("brew", ["install", "android-cli"], { stdio: "inherit", reject: false, timeout: 3e5 });
    if (inst.exitCode !== 0) return { installed: false, error: `brew install exit ${inst.exitCode}` };
    return { installed: androidCliPath() !== null };
  } catch (err) {
    return { installed: false, error: err.message };
  }
}
async function smokeTestContract() {
  const cli = androidCliPath();
  const version = await androidCliVersion();
  if (!cli) return { ok: false, version: null, belowFloor: false, missing: [] };
  const belowFloor = version ? !meetsFloor(version, ANDROID_CLI_FLOOR) : true;
  let helpText = "";
  try {
    const res = await execa(cli, ["help"], { reject: false, timeout: 6e4 });
    helpText = `${res.stdout}
${res.stderr}`;
  } catch {
    helpText = "";
  }
  const missing = requiredTopLevelCommands().filter(
    (cmd) => !new RegExp(`(^|\\s)${cmd}(\\s|$)`, "m").test(helpText)
  );
  return { ok: missing.length === 0 && !belowFloor, version, belowFloor, missing };
}
async function tryBrewUpgrade() {
  if (process.platform !== "darwin") return false;
  try {
    const res = await execa("brew", ["upgrade", "android-cli"], { stdio: "inherit", reject: false, timeout: 3e5 });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

// src/helpers/claude-md-section.ts
import { existsSync as existsSync3, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";

// src/helpers/paths.ts
import { mkdirSync, existsSync as existsSync2, readFileSync, writeFileSync } from "fs";
import { dirname as dirname3 } from "path";
function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}
function ensureParentDir(filePath) {
  mkdirSync(dirname3(filePath), { recursive: true });
}
function readJsonSafe(path, fallback) {
  try {
    if (!existsSync2(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(path, data) {
  ensureParentDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// src/helpers/claude-md-section.ts
function readCurrent() {
  if (!existsSync3(CLAUDE_CLAUDE_MD)) return "";
  return readFileSync2(CLAUDE_CLAUDE_MD, "utf8");
}
function stripManagedSection(content) {
  const lines = content.split("\n");
  const out = [];
  let inside = false;
  for (const line of lines) {
    if (line === SECTION_BEGIN) {
      inside = true;
      continue;
    }
    if (line === SECTION_END) {
      inside = false;
      continue;
    }
    if (!inside) out.push(line);
  }
  return out.join("\n");
}
function writeClaudeMdSection(snippetPath) {
  if (!existsSync3(snippetPath)) {
    throw new Error(`snippet not found: ${snippetPath}`);
  }
  ensureParentDir(CLAUDE_CLAUDE_MD);
  const existing = readCurrent();
  const stripped = stripManagedSection(existing);
  const snippet = readFileSync2(snippetPath, "utf8");
  const prefix2 = stripped.length > 0 && !stripped.endsWith("\n") ? `${stripped}
` : stripped;
  const next = `${prefix2}
${SECTION_BEGIN}
${snippet.endsWith("\n") ? snippet : `${snippet}
`}${SECTION_END}
`;
  writeFileSync2(CLAUDE_CLAUDE_MD, next);
}
function removeClaudeMdSection() {
  if (!existsSync3(CLAUDE_CLAUDE_MD)) return;
  const stripped = stripManagedSection(readCurrent());
  writeFileSync2(CLAUDE_CLAUDE_MD, stripped);
}

// src/helpers/ast-index.ts
var AST_INDEX_REPO_URL = "https://github.com/defendend/Claude-ast-index-search";
var AST_INDEX_INSTALL_SNIPPET = "brew tap defendend/ast-index && brew install ast-index";
function astIndexPath() {
  return which("ast-index");
}

// src/helpers/install-assets.ts
import {
  cpSync,
  chmodSync,
  copyFileSync,
  existsSync as existsSync4,
  readdirSync,
  readFileSync as readFileSync3,
  rmSync as rmSync2,
  statSync,
  writeFileSync as writeFileSync3
} from "fs";
import { basename, join as join4 } from "path";
function copyHookTemplates() {
  ensureDir(GOR_MOBILE_TEMPLATES_DIR);
  const names = [
    "session-start-hook.sh",
    "user-prompt-submit-hook.sh",
    "detect-mobile-context.sh",
    "statusline-command.sh",
    "statusline-cat.sh"
  ];
  for (const name of names) {
    const src = join4(gorMobileRoot(), "templates", name);
    const dst = join4(GOR_MOBILE_TEMPLATES_DIR, name);
    copyFileSync(src, dst);
    chmodSync(dst, 493);
  }
  const stale = join4(GOR_MOBILE_TEMPLATES_DIR, "session-start-snippet.md");
  if (existsSync4(stale)) rmSync2(stale);
}
function transformSkillBody(content) {
  return content.replace(/superpowers:/g, "gor-mobile-").replace(/^name: /gm, "name: gor-mobile-").replace(
    /"Invoke brainstorming skill"/g,
    '"Invoke gor-mobile-brainstorming skill"'
  ).replace(
    /"Invoke writing-plans skill"/g,
    '"Invoke gor-mobile-writing-plans skill"'
  ).replace(
    /~\/\.config\/superpowers\/worktrees/g,
    "~/.config/gor-mobile/worktrees"
  ).replace(/all 5 tasks/g, "all tasks").replace(/docs\/superpowers\/specs\//g, ".gor-mobile/specs/").replace(/docs\/superpowers\/plans\//g, ".gor-mobile/plans/").replace(
    /^[ \t]*-[^\n]*(using-git-worktrees|finishing-a-development-branch)[^\n]*\n/gm,
    ""
  ).replace(
    /"Use gor-mobile-finishing-a-development-branch"/g,
    '"User decides next step"'
  ).replace(
    /Use gor-mobile-finishing-a-development-branch/g,
    "User decides next step"
  );
}
function installSkills() {
  ensureDir(CLAUDE_SKILLS_DIR);
  for (const entry of readdirSync(CLAUDE_SKILLS_DIR)) {
    if (entry.startsWith("gor-mobile-")) {
      rmSync2(join4(CLAUDE_SKILLS_DIR, entry), { recursive: true, force: true });
    }
  }
  const root = gorMobileRoot();
  const skillsDir = join4(root, "templates", "skills");
  const overlaysDir = join4(root, "templates", "overlays");
  const installed = [];
  const missingPrefix = [];
  if (!existsSync4(skillsDir)) return { installed, missingPrefix };
  for (const name of readdirSync(skillsDir)) {
    const srcDir = join4(skillsDir, name);
    if (!statSync(srcDir).isDirectory()) continue;
    const dstDir = join4(CLAUDE_SKILLS_DIR, `gor-mobile-${name}`);
    cpSync(srcDir, dstDir, { recursive: true });
    const skillMd = join4(dstDir, "SKILL.md");
    if (existsSync4(skillMd)) {
      let body = transformSkillBody(readFileSync3(skillMd, "utf8"));
      const overlayPath = join4(overlaysDir, `${name}.md`);
      if (existsSync4(overlayPath)) {
        body += "\n" + readFileSync3(overlayPath, "utf8");
      }
      writeFileSync3(skillMd, body);
      if (!/^name: gor-mobile-/m.test(body)) {
        missingPrefix.push(skillMd);
      }
      if (/using-git-worktrees|finishing-a-development-branch/.test(body)) {
        console.warn(
          `[gor-mobile] warning: stale skill reference in ${skillMd}`
        );
      }
    }
    installed.push(name);
  }
  return { installed, missingPrefix };
}
function installAgents() {
  ensureDir(CLAUDE_AGENTS_DIR);
  const src = join4(gorMobileRoot(), "templates", "agents");
  const copied = [];
  if (!existsSync4(src)) return copied;
  for (const name of readdirSync(src)) {
    if (!name.endsWith(".md")) continue;
    const from = join4(src, name);
    const to = join4(CLAUDE_AGENTS_DIR, name);
    copyFileSync(from, to);
    chmodSync(to, 420);
    copied.push(name);
  }
  return copied;
}
function cleanupLegacyCommands(commandsDir) {
  if (!existsSync4(commandsDir)) return [];
  const legacy = [
    "brainstorm",
    "plan",
    "worktree",
    "implement",
    "execute",
    "parallel",
    "tdd",
    "review",
    "verify",
    "debug",
    "finishing-branch"
  ];
  const removed = [];
  for (const cmd of legacy) {
    const file = join4(commandsDir, `${cmd}.md`);
    if (!existsSync4(file)) continue;
    const head = readFileSync3(file, "utf8").split("\n").slice(0, 10).join("\n");
    if (head.includes("Task from user: **$ARGUMENTS**")) {
      rmSync2(file);
      removed.push(basename(file));
    }
  }
  return removed;
}
function cleanupLegacyAgents() {
  const removed = [];
  const advisor = join4(CLAUDE_AGENTS_DIR, "gor-mobile-advisor.md");
  if (existsSync4(advisor)) {
    rmSync2(advisor);
    removed.push(basename(advisor));
  }
  const legacyCr = join4(CLAUDE_AGENTS_DIR, "code-reviewer.md");
  if (existsSync4(legacyCr)) {
    const head = readFileSync3(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
    if (/^name: code-reviewer/m.test(head)) {
      rmSync2(legacyCr);
      removed.push(basename(legacyCr));
    }
  }
  return removed;
}

// src/helpers/rules-pack.ts
import { existsSync as existsSync5, cpSync as cpSync2, rmSync as rmSync3 } from "fs";
import { join as join5 } from "path";
import { execa as execa2 } from "execa";
function manifestPath() {
  return join5(GOR_MOBILE_RULES_DIR, "manifest.json");
}
function readManifest() {
  if (!existsSync5(manifestPath())) return null;
  try {
    return readJsonSafe(manifestPath(), {});
  } catch {
    return null;
  }
}
function readConfig() {
  return readJsonSafe(GOR_MOBILE_CONFIG, {});
}
function saveConfig(source, ref = DEFAULT_RULES_REF) {
  ensureDir(GOR_MOBILE_CONFIG_DIR);
  const current = readConfig();
  writeJson(GOR_MOBILE_CONFIG, {
    ...current,
    rules_source: source,
    rules_ref: ref,
    preset: current.preset ?? "balanced"
  });
}
async function cloneOrPull(url, ref = DEFAULT_RULES_REF) {
  if (existsSync5(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
    await execa2("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
      reject: false
    });
    return;
  }
  if (existsSync5(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  ensureDir(join5(GOR_MOBILE_RULES_DIR, ".."));
  await execa2("git", [
    "clone",
    "--depth",
    "1",
    "--branch",
    ref,
    url,
    GOR_MOBILE_RULES_DIR
  ]);
}
function copyFromLocal(source) {
  if (existsSync5(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync2(source, GOR_MOBILE_RULES_DIR, { recursive: true });
}
function fallbackToBundled(bundledRoot) {
  if (existsSync5(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync2(bundledRoot, GOR_MOBILE_RULES_DIR, { recursive: true });
}
async function pullCurrent() {
  if (!existsSync5(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout \u2014 cannot pull");
  }
  await execa2("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
    stdio: "inherit"
  });
}
async function diffAgainstUpstream() {
  if (!existsSync5(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout");
  }
  await execa2("git", ["-C", GOR_MOBILE_RULES_DIR, "fetch", "origin"], {
    reject: false
  });
  const { stdout } = await execa2(
    "git",
    ["-C", GOR_MOBILE_RULES_DIR, "diff", "HEAD", "origin/HEAD", "--stat"],
    { reject: false }
  );
  return stdout;
}
function validateManifest() {
  const errors = [];
  const m = readManifest();
  if (!m) {
    errors.push("manifest.json missing or unreadable");
    return { ok: false, errors };
  }
  if (!m.version) errors.push("manifest.version missing");
  if (!m.stack) errors.push("manifest.stack missing");
  if (m.sections) {
    for (const rel of Object.values(m.sections)) {
      if (!existsSync5(join5(GOR_MOBILE_RULES_DIR, rel))) {
        errors.push(`missing rule file: ${rel}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, manifest: m };
}
async function gitBranchAndRev() {
  if (!existsSync5(join5(GOR_MOBILE_RULES_DIR, ".git"))) return {};
  const branch = await execa2("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  const rev = await execa2("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--short", "HEAD"], { reject: false });
  return { branch: branch.stdout.trim(), rev: rev.stdout.trim() };
}

// src/helpers/settings-merge.ts
import { existsSync as existsSync6 } from "fs";
var HOOK_MARKER = {
  SessionStart: "templates/session-start-hook.sh",
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh"
};
function isManagedEntry(entry, hookType) {
  if ((entry._managed_by ?? "") === MANAGED_TAG) return true;
  const marker = HOOK_MARKER[hookType];
  return (entry.hooks ?? []).some(
    (h) => h.type === "command" && h.command.includes(marker)
  );
}
function ensureSettingsFile() {
  ensureParentDir(CLAUDE_SETTINGS);
  if (!existsSync6(CLAUDE_SETTINGS)) {
    writeJson(CLAUDE_SETTINGS, {});
  }
  return readJsonSafe(CLAUDE_SETTINGS, {});
}
function upsertHook(hookType, matcher, command) {
  const settings = ensureSettingsFile();
  settings.hooks = settings.hooks ?? {};
  const existing = settings.hooks[hookType] ?? [];
  const previous = existing.filter((entry) => !isManagedEntry(entry, hookType));
  const next = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(CLAUDE_SETTINGS, settings);
  return { collapsed: existing.length - previous.length };
}
function removeHook(hookType) {
  if (!existsSync6(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  if (!settings.hooks || !settings.hooks[hookType]) return;
  const remaining = settings.hooks[hookType].filter(
    (entry) => !isManagedEntry(entry, hookType)
  );
  if (remaining.length === 0) {
    delete settings.hooks[hookType];
  } else {
    settings.hooks[hookType] = remaining;
  }
  writeJson(CLAUDE_SETTINGS, settings);
}
function installSessionStartHook() {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/session-start-hook.sh`;
  return upsertHook("SessionStart", "startup|clear|compact|resume", cmd);
}
function removeSessionStartHook() {
  removeHook("SessionStart");
}
function installUserPromptSubmitHook() {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  return upsertHook("UserPromptSubmit", "", cmd);
}
function removeUserPromptSubmitHook() {
  removeHook("UserPromptSubmit");
}
function countManagedHooks(hookType) {
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.filter((e) => isManagedEntry(e, hookType)).length;
}

// src/ui/confirm-step.ts
import { confirm, isCancel, cancel } from "@clack/prompts";

// src/ui/tui-mode.ts
var forcedOff = false;
function forceNoTui() {
  forcedOff = true;
}
function isTuiOn() {
  if (forcedOff) return false;
  if (process.env.NO_TUI === "1") return false;
  if (!process.stdin.isTTY || !process.stdout.isTTY) return false;
  return true;
}

// src/ui/confirm-step.ts
async function confirmStep(message, fallback = true) {
  if (!isTuiOn()) return fallback;
  const res = await confirm({ message, initialValue: fallback });
  if (isCancel(res)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return res === true;
}
async function textPrompt(message, initial, validate) {
  if (!isTuiOn()) return initial;
  const { text } = await import("@clack/prompts");
  const res = await text({ message, initialValue: initial, validate });
  if (isCancel(res)) {
    cancel("Cancelled");
    process.exit(0);
  }
  return String(res);
}

// src/ui/mode-select.ts
import { select, isCancel as isCancel2, cancel as cancel2 } from "@clack/prompts";
async function modeSelect(defaults) {
  if (defaults.advanced) return "advanced";
  if (defaults.yes) return "quickstart";
  if (!isTuiOn()) return "quickstart";
  const pick = await select({
    message: "Setup mode",
    options: [
      {
        value: "quickstart",
        label: "QuickStart",
        hint: "Install everything with defaults"
      },
      {
        value: "advanced",
        label: "Advanced",
        hint: "Override rules URL, confirm each step"
      }
    ],
    initialValue: "quickstart"
  });
  if (isCancel2(pick)) {
    cancel2("Cancelled");
    process.exit(0);
  }
  return pick;
}

// src/ui/note.ts
import { note as clackNote } from "@clack/prompts";
import pc from "picocolors";
function note(body, title) {
  if (isTuiOn()) {
    clackNote(body, title);
    return;
  }
  if (title) {
    console.log("");
    console.log(pc.bold(title));
  }
  for (const line of body.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("");
}

// src/ui/outro.ts
import pc2 from "picocolors";
var NEXT_STEPS = [
  "gor-mobile doctor           verify setup",
  "gor-mobile rules list       inspect installed architecture rules",
  "cd <android-project>        open Claude Code; the session-start hook loads workflow"
];
function finalOutro(s) {
  const summary = `Installed: ${s.skills} skills \xB7 ${s.agents} agents \xB7 ${s.hooks} hooks \xB7 rules v${s.rulesVersion}`;
  console.log("");
  console.log(`  ${pc2.green("\u2713")} ${pc2.bold(summary)}`);
  console.log("");
  console.log(pc2.bold("  Next steps:"));
  for (const n of NEXT_STEPS) console.log(`    ${pc2.cyan(n)}`);
  console.log("");
}

// src/ui/progress.ts
import pc3 from "picocolors";
var SYMBOLS = {
  ok: pc3.green("\u2713"),
  fail: pc3.red("\u2717"),
  warn: pc3.yellow("!"),
  skip: pc3.dim("\u25CB")
};
function pad(n, total) {
  const width = String(total).length;
  return String(n).padStart(width, " ");
}
function progressItem(i, total, label, status, note2) {
  const prefix2 = pc3.dim(`(${pad(i, total)}/${total})`);
  const suffix = note2 ? pc3.dim(` ${note2}`) : "";
  console.log(`    ${prefix2}  ${label.padEnd(38)} ${SYMBOLS[status]}${suffix}`);
}

// src/ui/section-header.ts
import pc4 from "picocolors";
var STEP_LABELS = [
  "deps",
  "android",
  "rules",
  "hooks",
  "skills",
  "agents",
  "claude-md",
  "summary"
];
function breadcrumb(current, labels) {
  const sep = pc4.dim(" \u203A ");
  return labels.map((label, i) => {
    const step = i + 1;
    if (step < current) return pc4.green(`\u2713 ${label}`);
    if (step === current) return pc4.bold(pc4.magenta(`\u25B8 ${label}`));
    return pc4.dim(label);
  }).join(sep);
}
function sectionHeader(n, total, title) {
  console.log("");
  const labels = STEP_LABELS.length === total ? STEP_LABELS : Array.from({ length: total }, (_, i) => String(i + 1));
  console.log(`  ${breadcrumb(n, labels)}`);
  const lead = pc4.bold(pc4.magenta(`${n}/${total}`));
  console.log(`  ${lead}  ${pc4.bold(title)}`);
}

// src/ui/welcome.ts
import { confirm as confirm2, isCancel as isCancel3, cancel as cancel3 } from "@clack/prompts";
import pc6 from "picocolors";

// src/ui/banner.ts
import { existsSync as existsSync7, readFileSync as readFileSync4 } from "fs";
import { join as join6 } from "path";
import pc5 from "picocolors";
function renderBanner() {
  const path = join6(gorMobileRoot(), "templates", "banner.txt");
  if (existsSync7(path)) {
    const raw = readFileSync4(path, "utf8");
    const trimmed = raw.replace(/\n+$/, "");
    const colored = trimmed.split("\n").map((line) => pc5.magenta(line)).join("\n");
    console.log("");
    console.log(colored);
  } else {
    console.log("");
    console.log(pc5.bold(pc5.magenta("GOR-MOBILE")));
  }
  const subtitle = `Android-aware overlay installer for Claude Code  \xB7  v${GOR_MOBILE_VERSION}`;
  console.log(pc5.dim(subtitle));
  console.log("");
}

// src/ui/welcome.ts
var BULLETS = [
  "Check base deps (git, curl, node).",
  "Install (via curl) + initialize the Google Android CLI; drops ~/.claude/skills/android-cli/ SKILL.md.",
  "Soft-check the ast-index CLI; warn + install hint if missing.",
  "Clone the architecture rules pack into ~/.gor-mobile/rules/.",
  "Merge SessionStart + UserPromptSubmit hooks into ~/.claude/settings.json.",
  "Install 14 gor-mobile-* skills into ~/.claude/skills/.",
  "Install 2 review agents (Sonnet + Opus) into ~/.claude/agents/.",
  "Write a managed section into ~/.claude/CLAUDE.md."
];
async function welcome(skip) {
  renderBanner();
  console.log(pc6.bold("  What will happen:"));
  for (const b of BULLETS) console.log(`    ${pc6.dim("\u2022")} ${b}`);
  console.log("");
  if (skip || !isTuiOn()) return;
  const proceed = await confirm2({
    message: "Ready to start?",
    initialValue: true
  });
  if (isCancel3(proceed) || proceed !== true) {
    cancel3("Cancelled");
    process.exit(0);
  }
}

// src/ui/log.ts
import pc7 from "picocolors";
function isTty() {
  return Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;
}
function prefix(symbol, color) {
  return isTty() ? color(symbol) : symbol;
}
var log = {
  info(msg) {
    console.error(`  ${prefix("i", pc7.cyan)} ${msg}`);
  },
  ok(msg) {
    console.error(`  ${prefix("\u2713", pc7.green)} ${msg}`);
  },
  warn(msg) {
    console.error(`  ${prefix("!", pc7.yellow)} ${msg}`);
  },
  err(msg) {
    console.error(`  ${prefix("\u2717", pc7.red)} ${msg}`);
  },
  step(title) {
    const label = isTty() ? pc7.bold(pc7.magenta(`\u25B8 ${title}`)) : `\u25B8 ${title}`;
    console.error(`
${label}`);
  },
  muted(msg) {
    console.error(`  ${isTty() ? pc7.dim(msg) : msg}`);
  },
  raw(msg) {
    console.error(msg);
  }
};

// src/ui/statusline-select.ts
import { select as select2, isCancel as isCancel4, cancel as cancel4 } from "@clack/prompts";
var CLASSIC_PREVIEW = [
  "Context  \u2501\u2501\u2501\u2501\u2501\u2501\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  42%  of 200k",
  "5h limit \u2501\u2501\u2501\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  18%  resets 14:30  \u25BD off-peak",
  "7d limit \u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2501\u2500\u2500\u2500\u2500\u2500\u2500  61%  resets Jun 04 09:00",
  "(colored in a real terminal)"
].join("\n");
var CAT_PREVIEW = [
  "                          /\\_/\\",
  "                         ( o.o )",
  "Sonnet 4.6 (200k) \u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u25AC\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500  42%",
  "5h \u25AC\u2500\u2500\u2500\u2500\u2500\u2500 18% 14:30 \u25BD off-peak  |  7d \u25AC\u25AC\u25AC\u25AC\u2500\u2500\u2500 61% Jun 04  |  \u23F1 session 1h12m",
  "(face shifts ^.^ \u2192 o.o \u2192 >.< \u2192 @.@ \u2192 x_x as context fills)"
].join("\n");
function showStatusLinePreviews() {
  note(CLASSIC_PREVIEW, "Classic \u2014 3-line colored bars");
  note(CAT_PREVIEW, "Cat \u2014 ASCII cat, reacts to context usage");
}
async function statusLineSelect(yes) {
  if (yes || !isTuiOn()) return "skip";
  showStatusLinePreviews();
  const pick = await select2({
    message: "Status line (optional)",
    options: [
      { value: "command", label: "Classic", hint: "3-line colored bars" },
      { value: "cat", label: "Cat", hint: "ASCII cat that reacts to usage" },
      { value: "skip", label: "Skip", hint: "don't install a status line" }
    ],
    initialValue: "skip"
  });
  if (isCancel4(pick)) {
    cancel4("Cancelled");
    process.exit(0);
  }
  return pick;
}

// src/helpers/settings-statusline.ts
import { existsSync as existsSync8 } from "fs";
var SCRIPT_FILE = {
  command: "statusline-command.sh",
  cat: "statusline-cat.sh"
};
var STATUSLINE_MARKER = "templates/statusline-";
function isManaged(sl) {
  if (!sl) return false;
  if ((sl._managed_by ?? "") === MANAGED_TAG) return true;
  return typeof sl.command === "string" && sl.command.includes(STATUSLINE_MARKER);
}
function variantOf(sl) {
  if (!sl || typeof sl.command !== "string") return null;
  if (sl.command.includes(SCRIPT_FILE.cat)) return "cat";
  if (sl.command.includes(SCRIPT_FILE.command)) return "command";
  return null;
}
function statusLineState() {
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  const sl = settings.statusLine;
  const present = Boolean(sl);
  const managed = isManaged(sl);
  return { present, managed, foreign: present && !managed, variant: managed ? variantOf(sl) : null };
}
function installStatusLine(variant, opts = {}) {
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  if (settings.statusLine && !isManaged(settings.statusLine) && !opts.force) {
    return false;
  }
  settings.statusLine = {
    type: "command",
    command: `bash ${GOR_MOBILE_HOME}/templates/${SCRIPT_FILE[variant]}`,
    _managed_by: MANAGED_TAG
  };
  writeJson(CLAUDE_SETTINGS, settings);
  return true;
}
function removeStatusLine() {
  if (!existsSync8(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  if (isManaged(settings.statusLine)) {
    delete settings.statusLine;
    writeJson(CLAUDE_SETTINGS, settings);
  }
}

// src/commands/init.ts
var TOTAL_STEPS = 10;
function dryLog(msg) {
  console.log(`    ${pc8.dim("[dry-run]")} ${msg}`);
}
function runStep(stepNum, title) {
  sectionHeader(stepNum, TOTAL_STEPS, title);
}
async function step1Deps(ctx) {
  runStep(1, "Base dependencies");
  const required = [
    ["git", which("git")],
    ["curl", which("curl")],
    ["node", which("node")]
  ];
  const missing = [];
  let i = 0;
  for (const [name, path] of required) {
    i++;
    if (path) {
      progressItem(i, required.length, name, "ok", path);
    } else {
      progressItem(i, required.length, name, "fail", "not found");
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Install missing deps first: ${missing.join(", ")}`);
  }
}
async function runAndroidInitStep() {
  const res = await runAndroidInit();
  if (res.skillInstalled) {
    progressItem(2, 2, "initialize android skills", "ok", "~/.claude/skills/android-cli/");
    log.info(
      "Browse Google's skill catalog \u2014 run 'gor-mobile android-skills' to install optional skills."
    );
  } else if (res.error) {
    throw new Error(`android init failed: ${res.error}`);
  } else {
    throw new Error("android init succeeded but android-cli skill not found");
  }
  const smoke = await smokeTestContract();
  if (!smoke.ok && smoke.belowFloor) {
    log.warn(`android CLI v${smoke.version ?? "?"} below floor \u2014 attempting brew upgrade`);
    await tryBrewUpgrade();
  }
  const after = await smokeTestContract();
  if (after.missing.length > 0) {
    log.warn(`android CLI is missing contract commands: ${after.missing.join(", ")} \u2014 update gor-mobile`);
  } else if (after.belowFloor) {
    log.warn(`android CLI contract commands present but v${after.version ?? "?"} still below floor \u2014 update gor-mobile`);
  } else {
    log.ok(`android CLI contract OK (v${after.version ?? "?"})`);
  }
}
async function step2Android(ctx) {
  runStep(2, "Google Android CLI");
  const existing = androidCliPath();
  if (existing) {
    progressItem(1, 2, "android CLI", "ok", existing);
    if (ctx.opts.dryRun) {
      progressItem(2, 2, "initialize android skills", "skip", "dry-run: android init");
      return;
    }
    await runAndroidInitStep();
    return;
  }
  if (!androidCliInstallSupported()) {
    progressItem(1, 2, "android CLI", "fail", `unsupported platform ${process.platform}/${process.arch}`);
    const body2 = [
      `gor-mobile requires the Google Android CLI, and Google does not`,
      `ship an installer for ${process.platform}/${process.arch}.`,
      "",
      "Supported platforms: darwin/arm64, darwin/x64, linux/x64, win32/x64.",
      "",
      "See https://developer.android.com/tools/agents \u2014 if Google later",
      "publishes an installer for your platform, re-run 'gor-mobile init'."
    ].join("\n");
    note(body2, "Android CLI required");
    throw new Error(`platform ${process.platform}/${process.arch} unsupported by Google Android CLI`);
  }
  const displayCmd = process.platform === "win32" ? `curl -fsSL ${ANDROID_CLI_INSTALL_URL} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"` : process.platform === "darwin" ? "brew tap android/tap && brew install android-cli" : `curl -fsSL ${ANDROID_CLI_INSTALL_URL} | bash`;
  const body = [
    "The Google Android CLI is required by gor-mobile and is not yet",
    "installed on this machine.",
    "",
    "What it is:",
    "  An official Google CLI that lets AI agents drive the Android",
    "  toolchain (build, install, run, SDK) without shelling out to",
    "  adb/gradle directly. It also ships a Claude skill",
    "  (~/.claude/skills/android-cli/) via `android init`.",
    "",
    "Learn more: https://developer.android.com/tools/agents",
    "",
    "Install command (from Google):",
    `  ${displayCmd}`,
    "",
    "This installs a ~5 MB launcher into ~/.local/bin/android",
    "(user-local, no sudo). The launcher fetches the full CLI on",
    "first run."
  ].join("\n");
  note(body, "Android CLI required");
  if (ctx.opts.dryRun) {
    progressItem(1, 2, "android CLI", "skip", `dry-run: ${displayCmd}`);
    progressItem(2, 2, "initialize android skills", "skip", "dry-run: android init");
    return;
  }
  const install = ctx.opts.yes ? true : await confirmStep("Install the Android CLI now? (required to continue)", true);
  if (!install) {
    progressItem(1, 2, "android CLI", "fail", "declined \u2014 gor-mobile requires the Android CLI");
    throw new Error("user declined Android CLI install \u2014 gor-mobile cannot continue");
  }
  let res = process.platform === "darwin" && which("brew") !== null ? await installAndroidCliViaBrew() : { installed: false, error: void 0 };
  if (!res.installed) {
    res = await installAndroidCli();
  }
  if (!res.installed) {
    progressItem(1, 2, "android CLI", "fail", res.error ?? "install failed");
    throw new Error(`Android CLI install failed: ${res.error ?? "unknown error"}`);
  }
  progressItem(1, 2, "android CLI", "ok", androidCliPath() ?? "installed");
  await runAndroidInitStep();
}
async function step3AstIndex(ctx) {
  runStep(3, "ast-index CLI (code search)");
  if (ctx.opts.dryRun) {
    progressItem(1, 1, "ast-index CLI", "skip", "dry-run: which ast-index");
    return;
  }
  const path = astIndexPath();
  if (path) {
    progressItem(1, 1, "ast-index CLI", "ok", path);
    return;
  }
  progressItem(1, 1, "ast-index CLI", "warn", "not found");
  const body = [
    "ast-index is recommended for fast structural code search in",
    "Android/Kotlin/Java projects. gor-mobile installs the skill",
    "(gor-mobile-ast-index) regardless \u2014 but search commands will",
    "only work once the CLI is installed.",
    "",
    "Install (Homebrew):",
    `  ${AST_INDEX_INSTALL_SNIPPET}`,
    "",
    `Other install options: ${AST_INDEX_REPO_URL}`,
    "",
    "Re-run 'gor-mobile doctor' after install to verify."
  ].join("\n");
  note(body, "ast-index recommended");
}
async function step4Rules(ctx) {
  runStep(4, "Rules pack");
  if (ctx.mode === "advanced" && !ctx.opts.rules) {
    ctx.rulesUrl = await textPrompt(
      "Rules pack URL",
      ctx.rulesUrl,
      (v) => {
        if (!v.trim()) return "URL cannot be empty";
        if (!/^https?:\/\/|^git@|^\//.test(v.trim())) return "Expected http(s)://, git@, or absolute path";
        return void 0;
      }
    );
  }
  if (ctx.opts.dryRun) {
    progressItem(1, 2, "fetch rules pack", "skip", `dry-run: ${ctx.rulesUrl}`);
    progressItem(2, 2, "save config", "skip", "dry-run");
    return;
  }
  const alreadyCloned = existsSync9(join7(GOR_MOBILE_RULES_DIR, ".git"));
  if (alreadyCloned) {
    await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
    const m = readManifest();
    ctx.rulesVersion = m?.version ?? "?";
    progressItem(1, 2, "pull existing pack", "ok", `v${ctx.rulesVersion} @ ${GOR_MOBILE_RULES_DIR}`);
  } else {
    try {
      await cloneOrPull(ctx.rulesUrl, DEFAULT_RULES_REF);
      const m = readManifest();
      ctx.rulesVersion = m?.version ?? "?";
      progressItem(1, 2, "clone rules pack", "ok", `v${ctx.rulesVersion} from ${ctx.rulesUrl}`);
    } catch (err) {
      log.warn(`git clone failed: ${err.message}`);
      fallbackToBundled(join7(gorMobileRoot(), "rules-default"));
      const m = readManifest();
      ctx.rulesVersion = m?.version ?? "bundled";
      progressItem(1, 2, "clone rules pack", "warn", `fallback to bundled v${ctx.rulesVersion}`);
    }
  }
  saveConfig(ctx.rulesUrl, DEFAULT_RULES_REF);
  progressItem(2, 2, "save config", "ok", GOR_MOBILE_RULES_DIR);
}
async function step5Hooks(ctx) {
  runStep(5, "SessionStart + UserPromptSubmit hooks");
  if (ctx.opts.dryRun) {
    progressItem(1, 4, "copy session-start-hook.sh", "skip", "dry-run");
    progressItem(2, 4, "copy user-prompt-submit-hook.sh", "skip", "dry-run");
    progressItem(3, 4, "merge SessionStart", "skip", "dry-run");
    progressItem(4, 4, "merge UserPromptSubmit", "skip", "dry-run");
    ctx.counts.hooks = 2;
    return;
  }
  copyHookTemplates();
  progressItem(1, 4, "copy session-start-hook.sh", "ok");
  progressItem(2, 4, "copy user-prompt-submit-hook.sh", "ok");
  installSessionStartHook();
  progressItem(3, 4, "merge SessionStart", "ok", CLAUDE_SETTINGS);
  installUserPromptSubmitHook();
  progressItem(4, 4, "merge UserPromptSubmit", "ok", CLAUDE_SETTINGS);
  ctx.counts.hooks = 2;
}
async function step6Skills(ctx) {
  runStep(6, "Skills \u2192 ~/.claude/skills/gor-mobile-*/");
  if (ctx.opts.dryRun) {
    const { readdirSync: readdirSync2 } = await import("fs");
    const src = join7(gorMobileRoot(), "templates", "skills");
    const names = existsSync9(src) ? readdirSync2(src).filter((n) => !n.startsWith(".")) : [];
    for (let i = 0; i < names.length; i++) {
      dryLog(`install skill ${names[i]} (sed + overlay)`);
    }
    ctx.counts.skills = names.length;
    return;
  }
  cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  const res = installSkills();
  const total = res.installed.length;
  for (let i = 0; i < total; i++) {
    const name = res.installed[i];
    const hasPrefixIssue = res.missingPrefix.some((p) => p.includes(`gor-mobile-${name}/`));
    progressItem(
      i + 1,
      total,
      `gor-mobile-${name}`,
      hasPrefixIssue ? "warn" : "ok"
    );
  }
  if (res.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${res.missingPrefix.length} skill(s)`);
  }
  ctx.counts.skills = total;
}
async function step7Agents(ctx) {
  runStep(7, "Agents \u2192 ~/.claude/agents/");
  if (ctx.opts.dryRun) {
    const { readdirSync: readdirSync2 } = await import("fs");
    const src = join7(gorMobileRoot(), "templates", "agents");
    const files2 = existsSync9(src) ? readdirSync2(src).filter((f) => f.endsWith(".md")) : [];
    for (let i = 0; i < files2.length; i++) {
      dryLog(`install agent ${files2[i]}`);
    }
    ctx.counts.agents = files2.length;
    return;
  }
  cleanupLegacyAgents();
  const files = installAgents();
  const total = files.length;
  for (let i = 0; i < total; i++) {
    const name = files[i];
    const label = name.replace(/\.md$/, "");
    const model = /reviewer/.test(label) && /deep/.test(label) ? "Opus" : "Sonnet";
    progressItem(i + 1, total, label, "ok", model);
  }
  ctx.counts.agents = total;
}
async function step8ClaudeMd(ctx) {
  runStep(8, "CLAUDE.md managed section");
  if (ctx.opts.dryRun) {
    progressItem(1, 1, "write managed section", "skip", "dry-run");
    return;
  }
  writeClaudeMdSection(join7(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  progressItem(1, 1, "write managed section", "ok", "~/.claude/CLAUDE.md");
}
async function step9StatusLine(ctx) {
  runStep(9, "Status line (optional)");
  if (ctx.opts.dryRun) {
    showStatusLinePreviews();
    progressItem(1, 1, "status line", "skip", "dry-run: choose Classic / Cat / Skip");
    return;
  }
  const choice = await statusLineSelect(Boolean(ctx.opts.yes));
  if (choice === "skip") {
    progressItem(1, 1, "status line", "skip", "not installed");
    return;
  }
  if (!which("jq")) {
    log.warn("jq not found \u2014 the status line needs jq to render (brew install jq); installing anyway");
  }
  const st = statusLineState();
  let force = false;
  if (st.foreign) {
    force = await confirmStep("A non-gor-mobile statusLine already exists. Replace it?", false);
    if (!force) {
      progressItem(1, 1, "status line", "skip", "kept your existing statusLine");
      return;
    }
  }
  installStatusLine(choice, { force });
  const label = choice === "cat" ? "Cat" : "Classic";
  progressItem(1, 1, "status line", "ok", `${label} \u2192 ${CLAUDE_SETTINGS}`);
}
async function step10Summary(ctx) {
  if (ctx.opts.skipSanity) {
    runStep(10, "Summary");
    log.info("Skipped (--skip-sanity)");
    return;
  }
  runStep(10, "Summary");
  const skills = existsSync9(CLAUDE_SKILLS_DIR) ? (await import("fs")).readdirSync(CLAUDE_SKILLS_DIR).filter((n) => n.startsWith("gor-mobile-")).length : 0;
  const agents = existsSync9(CLAUDE_AGENTS_DIR) ? (await import("fs")).readdirSync(CLAUDE_AGENTS_DIR).filter((n) => n.endsWith(".md")).length : 0;
  progressItem(1, 4, "Skills", skills > 0 ? "ok" : "warn", String(skills));
  progressItem(2, 4, "Agents", agents > 0 ? "ok" : "warn", String(agents));
  progressItem(3, 4, "Hooks", ctx.counts.hooks === 2 ? "ok" : "warn", String(ctx.counts.hooks));
  progressItem(4, 4, "Rules pack", ctx.rulesVersion !== "?" ? "ok" : "warn", `v${ctx.rulesVersion}`);
}
async function cmdInit(opts = {}) {
  if (opts.noTui || opts.tui === false) forceNoTui();
  await welcome(Boolean(opts.yes));
  const mode = opts.advanced ? "advanced" : opts.yes ? "quickstart" : await modeSelect({ yes: Boolean(opts.yes), advanced: Boolean(opts.advanced) });
  if (opts.dryRun) {
    log.info("DRY RUN \u2014 no changes will be made");
  }
  const ctx = {
    mode,
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    counts: { skills: 0, agents: 0, hooks: 0 },
    rulesVersion: "?"
  };
  try {
    await step1Deps(ctx);
    await step2Android(ctx);
    await step3AstIndex(ctx);
    await step4Rules(ctx);
    await step5Hooks(ctx);
    await step6Skills(ctx);
    await step7Agents(ctx);
    await step8ClaudeMd(ctx);
    await step9StatusLine(ctx);
    await step10Summary(ctx);
  } catch (err) {
    if (isCancel5(err)) {
      cancel5("Cancelled");
      process.exit(130);
    }
    log.err(`init failed: ${err.message}`);
    process.exit(1);
  }
  finalOutro({
    skills: ctx.counts.skills,
    agents: ctx.counts.agents,
    hooks: ctx.counts.hooks,
    rulesVersion: ctx.rulesVersion
  });
  void GOR_MOBILE_VERSION;
}

// src/commands/doctor.ts
import { existsSync as existsSync10, readFileSync as readFileSync5 } from "fs";
import { join as join8 } from "path";
import { execa as execa4 } from "execa";
function reportDep(name, path, required) {
  if (path) {
    log.ok(`${name} \u2192 ${path}`);
  } else if (required) {
    log.err(`${name} not found (required)`);
  } else {
    log.warn(`${name} not found (optional)`);
  }
}
function checkFile(path, label) {
  if (existsSync10(path)) {
    log.ok(`${label} \u2192 ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}
function checkHooks() {
  if (!existsSync10(CLAUDE_SETTINGS)) {
    log.warn(`No ${CLAUDE_SETTINGS}`);
    return;
  }
  for (const hookType of ["SessionStart", "UserPromptSubmit"]) {
    const n = countManagedHooks(hookType);
    if (n === 0) {
      log.warn(`${hookType} hook NOT registered \u2014 run 'gor-mobile repair'`);
    } else if (n > 1) {
      log.warn(`${hookType} has ${n} duplicate managed entries \u2014 run 'gor-mobile repair'`);
    } else {
      log.ok(`${hookType} hook registered`);
    }
  }
}
function checkClaudeMdSection() {
  if (!existsSync10(CLAUDE_CLAUDE_MD)) {
    log.warn(`${CLAUDE_CLAUDE_MD} does not exist`);
    return;
  }
  if (readFileSync5(CLAUDE_CLAUDE_MD, "utf8").includes(SECTION_BEGIN)) {
    log.ok("CLAUDE.md managed section present");
  } else {
    log.warn("CLAUDE.md managed section missing \u2014 run 'gor-mobile repair'");
  }
}
function checkStatusLine() {
  const st = statusLineState();
  if (st.managed) {
    log.ok(`Status line: ${st.variant === "cat" ? "Cat" : "Classic"} (managed)`);
    if (!which("jq")) {
      log.warn("  \u2192 status line needs jq to render \u2014 brew install jq");
    }
  } else if (st.foreign) {
    log.info("Status line: custom (not managed by gor-mobile)");
  }
}
function checkRulesPack() {
  if (!existsSync10(GOR_MOBILE_RULES_DIR)) {
    log.warn(`Rules pack not installed (${GOR_MOBILE_RULES_DIR})`);
    return;
  }
  const m = readManifest();
  if (!m) {
    log.warn("manifest.json missing or unreadable in rules pack");
    return;
  }
  log.ok(
    `Rules pack v${m.version ?? "?"} (stack=${m.stack ?? "?"}) at ${GOR_MOBILE_RULES_DIR}`
  );
}
async function verboseHookEmulation() {
  const hooks = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync10(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    const result = await execa4("bash", [path], {
      reject: false,
      input: JSON.stringify({
        cwd: process.cwd(),
        session_id: "gor-mobile-doctor",
        prompt: "gor-mobile doctor"
      }),
      env: { ...process.env, GORM_FORCE_MOBILE: "1" }
    });
    if (result.exitCode !== 0) {
      log.warn(`[${label}] hook exited ${result.exitCode}:`);
      console.error(result.stdout || result.stderr);
      continue;
    }
    try {
      const parsed = JSON.parse(result.stdout);
      const ctx = parsed?.hookSpecificOutput?.additionalContext;
      if (!ctx) {
        log.warn(`[${label}] hook produced no additionalContext`);
        console.error(result.stdout);
        continue;
      }
      log.ok(`[${label}] hook injects ${String(ctx).length} chars of additionalContext`);
      console.error(`    --- first 30 lines of ${label} context ---`);
      console.error(
        String(ctx).split("\n").slice(0, 30).map((l) => `    ${l}`).join("\n")
      );
      console.error("    --- end ---");
    } catch {
      log.warn(`[${label}] hook output is not valid JSON`);
      console.error(result.stdout);
    }
  }
}
function verboseSkillsFrontmatter() {
  if (!existsSync10(CLAUDE_SKILLS_DIR)) {
    log.warn(`${CLAUDE_SKILLS_DIR} missing`);
    return;
  }
  const { readdirSync: readdirSync2 } = __require("fs");
  const { join: join15 } = __require("path");
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync2(CLAUDE_SKILLS_DIR)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join15(CLAUDE_SKILLS_DIR, entry, "SKILL.md");
    if (!existsSync10(skillMd)) continue;
    count++;
    const content = readFileSync5(skillMd, "utf8");
    if (!/^name: gor-mobile-/m.test(content)) {
      bad++;
      log.warn(`  ${skillMd} missing 'name: gor-mobile-' prefix`);
    }
  }
  if (bad === 0) {
    log.ok(`Skills frontmatter OK (${count} SKILL.md files, all prefixed)`);
  } else {
    log.warn(`Skills frontmatter: ${bad} of ${count} missing prefix \u2014 run 'gor-mobile repair'`);
  }
}
async function checkAndroidContract() {
  const smoke = await smokeTestContract();
  if (smoke.version === null) {
    log.warn("android CLI version unreadable \u2014 run 'gor-mobile repair'");
    return;
  }
  if (smoke.missing.length > 0) {
    log.err(`android CLI missing contract commands: ${smoke.missing.join(", ")} \u2014 update gor-mobile`);
  } else if (smoke.belowFloor) {
    log.warn(`android CLI v${smoke.version} is below floor \u2014 run 'gor-mobile init' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}
function verboseContractLint() {
  const skill = join8(CLAUDE_SKILLS_DIR, "gor-mobile-using-android-cli", "SKILL.md");
  if (!existsSync10(skill)) {
    log.warn("bridge skill missing \u2014 cannot lint contract");
    return;
  }
  const text = readFileSync5(skill, "utf8");
  const mentioned = /* @__PURE__ */ new Set();
  const re = /`android ([a-z-]+(?: [a-z-]+)?)/g;
  let m;
  while ((m = re.exec(text)) !== null) mentioned.add(m[1]);
  const known = new Set(ANDROID_CONTRACT.map((c) => c.command.join(" ")));
  const knownTopLevel = new Set(ANDROID_CONTRACT.map((c) => c.command[0]));
  const stray = [...mentioned].filter((cmd) => !known.has(cmd) && !knownTopLevel.has(cmd.split(" ")[0]));
  if (stray.length === 0) log.ok(`bridge skill \u2194 contract in sync (${mentioned.size} cmds referenced)`);
  else log.warn(`bridge skill references commands NOT in contract: ${stray.join(", ")}`);
}
async function cmdDoctor(opts = {}) {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), true);
  if (!androidCliPath()) {
    log.info("  \u2192 run 'gor-mobile init' to install android CLI (hard-mandatory after v0.1.0)");
  } else {
    await checkAndroidContract();
  }
  reportDep("ast-index", astIndexPath(), false);
  if (!astIndexPath()) {
    log.info(
      "  \u2192 install: brew tap defendend/ast-index && brew install ast-index"
    );
  }
  log.step("Claude Code integration");
  checkFile(CLAUDE_SETTINGS, "settings.json");
  checkHooks();
  checkFile(
    join8(GOR_MOBILE_HOME, "templates", "detect-mobile-context.sh"),
    "mobile-context detector"
  );
  checkFile(CLAUDE_AGENTS_DIR, "agents/");
  if (androidCliSkillInstalled()) {
    log.ok("android-cli skill installed in ~/.claude/skills/");
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const bridgePath = join8(CLAUDE_SKILLS_DIR, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync10(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join8(CLAUDE_SKILLS_DIR, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync10(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing \u2014 run 'gor-mobile repair'");
  }
  checkClaudeMdSection();
  checkStatusLine();
  log.step("Rules pack");
  checkRulesPack();
  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");
  if (opts.verbose) {
    log.step("Hooks emulation (verbose)");
    await verboseHookEmulation();
    log.step("Skills frontmatter (verbose)");
    verboseSkillsFrontmatter();
    verboseContractLint();
  }
  console.error("");
  log.info("If anything is missing, run: gor-mobile repair");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}

// src/commands/repair.ts
import { join as join9 } from "path";

// src/helpers/mcp-register.ts
import { existsSync as existsSync11 } from "fs";
function unregisterManaged() {
  if (!existsSync11(CLAUDE_MCP)) return;
  const cfg = readJsonSafe(CLAUDE_MCP, {});
  if (!cfg.mcpServers) return;
  const filtered = {};
  for (const [name, server] of Object.entries(cfg.mcpServers)) {
    if ((server._managed_by ?? "") !== MANAGED_TAG) {
      filtered[name] = server;
    }
  }
  cfg.mcpServers = filtered;
  writeJson(CLAUDE_MCP, cfg);
}

// src/commands/repair.ts
async function cmdRepair() {
  log.step("Repairing ~/.claude/ managed files");
  copyHookTemplates();
  const ss = installSessionStartHook();
  log.ok(
    ss.collapsed > 1 ? `SessionStart hook refreshed (collapsed ${ss.collapsed} \u2192 1)` : "SessionStart hook refreshed"
  );
  const ups = installUserPromptSubmitHook();
  log.ok(
    ups.collapsed > 1 ? `UserPromptSubmit hook refreshed (collapsed ${ups.collapsed} \u2192 1)` : "UserPromptSubmit hook refreshed"
  );
  const sl = statusLineState();
  if (sl.managed && sl.variant) {
    installStatusLine(sl.variant, { force: true });
    log.ok(`Status line (${sl.variant === "cat" ? "Cat" : "Classic"}) refreshed`);
  }
  const legacyCmds = cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  for (const f of legacyCmds) log.ok(`Removed legacy command ${f}`);
  const legacyAgents = cleanupLegacyAgents();
  for (const f of legacyAgents) log.ok(`Removed legacy agent ${f}`);
  const skills = installSkills();
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s):`);
    for (const m of skills.missingPrefix) {
      log.warn(`  ${m} (missing 'name: gor-mobile-' prefix)`);
    }
  }
  log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs)`);
  const agents = installAgents();
  log.ok(`Agents refreshed (${agents.length} in ~/.claude/agents)`);
  try {
    unregisterManaged();
    log.ok("Managed MCP entries pruned from ~/.claude/mcp.json");
  } catch (err) {
    log.warn(`MCP cleanup failed: ${err.message}`);
  }
  const androidRes = await runAndroidInit();
  if (!androidRes.ran) {
    log.info("android CLI not on PATH \u2014 skipping 'android init'");
  } else if (androidRes.skillInstalled) {
    log.ok("android-cli skill refreshed via 'android init'");
  } else if (androidRes.error) {
    log.warn(`'android init' failed: ${androidRes.error}`);
  } else {
    log.warn("'android init' ran but ~/.claude/skills/android-cli/SKILL.md missing");
  }
  writeClaudeMdSection(join9(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  log.ok("CLAUDE.md managed section refreshed");
  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}

// src/commands/uninstall.ts
import { existsSync as existsSync12, readFileSync as readFileSync6, rmSync as rmSync4 } from "fs";
import { join as join10 } from "path";
import { confirm as confirm3, isCancel as isCancel6 } from "@clack/prompts";
async function cmdUninstall(opts = {}) {
  if (!opts.yes) {
    const proceed = await confirm3({
      message: "Remove gor-mobile hooks, skills, agents, templates, rules pack, config, and managed CLAUDE.md section?",
      initialValue: false
    });
    if (isCancel6(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }
  log.step("Removing SessionStart hook");
  removeSessionStartHook();
  log.ok("SessionStart hook removed");
  log.step("Removing UserPromptSubmit hook");
  removeUserPromptSubmitHook();
  log.ok("UserPromptSubmit hook removed");
  log.step("Removing managed status line");
  removeStatusLine();
  log.ok("Status line removed (only if managed)");
  log.step("Removing legacy commands/ (signature-matched)");
  cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  log.step("Removing skills/");
  if (existsSync12(CLAUDE_SKILLS_DIR)) {
    const { readdirSync: readdirSync2 } = await import("fs");
    for (const entry of readdirSync2(CLAUDE_SKILLS_DIR)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync4(join10(CLAUDE_SKILLS_DIR, entry), { recursive: true, force: true });
      }
    }
  }
  log.step("Removing agents/");
  if (existsSync12(CLAUDE_AGENTS_DIR)) {
    const { readdirSync: readdirSync2 } = await import("fs");
    for (const entry of readdirSync2(CLAUDE_AGENTS_DIR)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(".md")) {
        rmSync4(join10(CLAUDE_AGENTS_DIR, entry), { force: true });
      }
    }
    const legacyCr = join10(CLAUDE_AGENTS_DIR, "code-reviewer.md");
    if (existsSync12(legacyCr)) {
      const head = readFileSync6(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
      if (/^name: code-reviewer/m.test(head)) {
        rmSync4(legacyCr);
      }
    }
  }
  log.step("Removing MCP entries");
  unregisterManaged();
  log.step("Cleaning CLAUDE.md managed section");
  removeClaudeMdSection();
  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync12(GOR_MOBILE_HOME)) {
    rmSync4(GOR_MOBILE_HOME, { recursive: true, force: true });
  }
  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync12(GOR_MOBILE_CONFIG)) rmSync4(GOR_MOBILE_CONFIG);
  if (existsSync12(GOR_MOBILE_CONFIG_DIR)) {
    try {
      rmSync4(GOR_MOBILE_CONFIG_DIR, { recursive: false });
    } catch {
    }
  }
  log.ok("gor-mobile artifacts removed");
  const cli = androidCliPath();
  if (cli && !opts.yes) {
    const removeAndroid = await confirm3({
      message: "Also uninstall the Android CLI (launcher + ~/.android/cli cache + android-cli skill)?",
      initialValue: false
    });
    if (!isCancel6(removeAndroid) && removeAndroid === true) {
      log.step("Removing Android CLI");
      const res = await uninstallAndroidCli();
      for (const p of res.removed) log.ok(`removed ${p}`);
      for (const e of res.errors) log.warn(e);
      if (res.errors.length === 0) log.ok("Android CLI removed");
    }
  }
}

// src/commands/rules.ts
import { existsSync as existsSync13, rmSync as rmSync5 } from "fs";
async function rulesList() {
  if (!existsSync13(GOR_MOBILE_RULES_DIR)) {
    log.warn("No rules pack installed. Run: gor-mobile rules use <url>");
    return;
  }
  const m = readManifest();
  const cfg = existsSync13(GOR_MOBILE_CONFIG) ? readConfig() : {};
  const { branch, rev } = await gitBranchAndRev();
  console.log("Installed pack:");
  console.log(`  name:    ${m?.name ?? "?"}`);
  console.log(`  version: ${m?.version ?? "?"}`);
  console.log(`  stack:   ${m?.stack ?? "?"}`);
  console.log(`  source:  ${cfg.rules_source ?? "(unknown)"}`);
  console.log(`  path:    ${GOR_MOBILE_RULES_DIR}`);
  if (branch && rev) {
    console.log(`  git:     ${branch} @ ${rev}`);
  }
}
async function rulesUse(target) {
  if (!target) {
    log.err("Usage: gor-mobile rules use <url|path>");
    process.exitCode = 1;
    return;
  }
  const backup = `${GOR_MOBILE_RULES_DIR}.bak`;
  if (existsSync13(GOR_MOBILE_RULES_DIR)) {
    log.info(`Backing up existing pack to ${backup}`);
    if (existsSync13(backup)) rmSync5(backup, { recursive: true, force: true });
    const { renameSync } = await import("fs");
    renameSync(GOR_MOBILE_RULES_DIR, backup);
  }
  try {
    if (existsSync13(target)) {
      log.info(`Copying local pack from ${target}`);
      copyFromLocal(target);
    } else {
      log.info(`Cloning ${target}`);
      await cloneOrPull(target, DEFAULT_RULES_REF);
    }
  } catch (err) {
    log.err(`Install failed \u2014 restoring backup: ${err.message}`);
    if (existsSync13(GOR_MOBILE_RULES_DIR)) {
      rmSync5(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
    }
    if (existsSync13(backup)) {
      const { renameSync } = await import("fs");
      renameSync(backup, GOR_MOBILE_RULES_DIR);
    }
    process.exitCode = 1;
    return;
  }
  saveConfig(target);
  log.ok(`Rules pack installed at ${GOR_MOBILE_RULES_DIR}`);
  if (existsSync13(backup)) rmSync5(backup, { recursive: true, force: true });
  const res = validateManifest();
  if (!res.ok) {
    for (const e of res.errors) log.err(e);
  } else {
    log.ok(
      `manifest.json valid (v${res.manifest?.version}, stack=${res.manifest?.stack}, compat=${res.manifest?.compatible_with ?? "?"})`
    );
  }
}
async function rulesUpdate() {
  try {
    await pullCurrent();
    log.ok("Rules pack updated");
  } catch (err) {
    log.err(err.message);
    process.exitCode = 1;
  }
}
async function rulesDiff() {
  try {
    const out = await diffAgainstUpstream();
    if (out) console.log(out);
    else console.log("(no diff)");
  } catch (err) {
    log.err(err.message);
    process.exitCode = 1;
  }
}
async function rulesValidate() {
  const res = validateManifest();
  if (!res.ok) {
    for (const e of res.errors) log.err(e);
    process.exitCode = 1;
    return;
  }
  log.ok(
    `manifest.json valid (v${res.manifest?.version}, stack=${res.manifest?.stack}, compat=${res.manifest?.compatible_with ?? "?"})`
  );
}

// src/commands/docs.ts
import { execa as execa5 } from "execa";
async function cmdDocs(query) {
  const q = query.join(" ").trim();
  if (!q) {
    log.err("Usage: gor-mobile docs <query>");
    process.exitCode = 1;
    return;
  }
  const cli = androidCliPath();
  if (cli) {
    log.info(`\u2192 android docs "${q}"`);
    const res = await execa5(cli, ["docs", q], { stdio: "inherit", reject: false });
    if (res.exitCode === 0) return;
    log.warn("android docs returned nothing; falling back to web search");
  }
  const encoded = encodeURIComponent(q);
  console.log(`Native android docs unavailable for this query.`);
  console.log(``);
  console.log(`Open: https://developer.android.com/search?q=${encoded}`);
}

// src/commands/self-update.ts
import { existsSync as existsSync14 } from "fs";
import { join as join11 } from "path";
import { execa as execa6 } from "execa";
async function cmdSelfUpdate() {
  const root = gorMobileRoot();
  if (existsSync14(join11(root, ".git"))) {
    log.step(`git pull in ${root}`);
    await execa6("git", ["-C", root, "pull", "--ff-only"], { stdio: "inherit" });
    log.step("npm install");
    await execa6("npm", ["install", "--production=false"], { cwd: root, stdio: "inherit" });
    log.step("npm run build");
    await execa6("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    log.ok("CLI updated");
    return;
  }
  if (has("brew")) {
    const res = await execa6("brew", ["list", "gor-mobile"], { reject: false });
    if (res.exitCode === 0) {
      log.info("Brew-managed install \u2014 use: brew upgrade gor-mobile");
      return;
    }
  }
  log.warn("Unable to self-update: not a git repo and not a brew install.");
  log.info(
    "Reinstall via: curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash"
  );
}

// src/commands/android.ts
import { existsSync as existsSync15 } from "fs";
import { execa as execa7 } from "execa";
async function cmdAndroid(args) {
  const cli = androidCliPath();
  if (cli) {
    const res = await execa7(cli, args, { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }
  const first = args[0];
  if (first && ["build", "assemble", "assembleDebug", "assembleRelease"].includes(first) && existsSync15("./gradlew")) {
    log.info(`Falling back to ./gradlew ${first}`);
    const res = await execa7("./gradlew", [first], { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }
  if (!first) {
    log.err("Usage: gor-mobile android <subcommand> [args...]");
    process.exit(1);
  }
  log.err("Android CLI not installed and no gradle fallback available.");
  log.info("Install Google Android CLI from: https://developer.android.com/tools/agents");
  process.exit(1);
}

// src/commands/android-skills.ts
import { existsSync as existsSync16 } from "fs";
import { join as join12 } from "path";
import { cancel as cancel6, isCancel as isCancel7, multiselect, spinner } from "@clack/prompts";
function isInstalled(name) {
  return existsSync16(join12(CLAUDE_SKILLS_DIR, name, "SKILL.md"));
}
async function cmdAndroidSkills() {
  if (!androidCliPath()) {
    log.err(
      "android CLI not on PATH. Run 'gor-mobile init' or 'gor-mobile repair' \u2014 android CLI is required after v0.1.0."
    );
    process.exit(1);
  }
  const sp = spinner();
  sp.start("Fetching available Android skills");
  const listed = await listAndroidSkills();
  sp.stop(listed.ok ? `Fetched ${listed.names.length} skills` : "Failed to fetch skills");
  if (!listed.ok) {
    log.err(`android skills list failed: ${listed.error ?? "unknown error"}`);
    process.exit(1);
  }
  if (listed.names.length === 0) {
    log.warn("No skills returned by `android skills list`.");
    return;
  }
  const options = listed.names.map((name) => ({
    value: name,
    label: isInstalled(name) ? `${name} (installed)` : name
  }));
  const preselected = listed.names.filter(isInstalled);
  if (!isTuiOn()) {
    log.info("Available skills:");
    for (const o of options) log.info(`  ${o.label}`);
    log.info("Run this command in a TTY to select/deselect interactively.");
    return;
  }
  const picked = await multiselect({
    message: "Select Android skills to keep installed (space to toggle, enter to confirm):",
    options,
    initialValues: preselected,
    required: false
  });
  if (isCancel7(picked)) {
    cancel6("Cancelled");
    return;
  }
  const chosen = new Set(picked);
  const current = new Set(preselected);
  const toAdd = [...chosen].filter((n) => !current.has(n));
  const toRemove = [...current].filter((n) => !chosen.has(n));
  if (toAdd.length === 0 && toRemove.length === 0) {
    log.ok("No changes.");
    return;
  }
  for (const name of toAdd) {
    const s = spinner();
    s.start(`Installing ${name}`);
    const r = await addAndroidSkill(name);
    if (r.ok) s.stop(`Installed ${name}`);
    else s.stop(`Failed to install ${name}${r.error ? `: ${r.error}` : ""}`);
  }
  for (const name of toRemove) {
    const s = spinner();
    s.start(`Removing ${name}`);
    const r = await removeAndroidSkill(name);
    if (r.ok) s.stop(`Removed ${name}`);
    else s.stop(`Failed to remove ${name}${r.error ? `: ${r.error}` : ""}`);
  }
  log.ok("Done. Re-open Claude Code sessions to pick up skill changes.");
}

// src/commands/update.ts
import { existsSync as existsSync17 } from "fs";
import { join as join13 } from "path";
import { execa as execa8 } from "execa";
async function cmdUpdate() {
  log.step("Updating rules pack");
  if (existsSync17(join13(GOR_MOBILE_RULES_DIR, ".git"))) {
    const res = await execa8(
      "git",
      ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"],
      { reject: false, stdio: "inherit" }
    );
    if (res.exitCode === 0) log.ok("Rules pack updated");
    else log.warn("git pull failed");
  } else {
    log.warn("Rules pack is not a git repo \u2014 skipping pull");
  }
  if (has("brew")) {
    const list = await execa8("brew", ["list", "gor-mobile"], { reject: false });
    if (list.exitCode === 0) {
      log.step("Checking for brew update");
      await execa8("brew", ["update"], { reject: false });
      const info = await execa8("brew", ["info", "--json=v2", "gor-mobile"], { reject: false });
      const versions = await execa8("brew", ["list", "--versions", "gor-mobile"], { reject: false });
      try {
        const parsed = JSON.parse(info.stdout);
        const latest = parsed?.formulae?.[0]?.versions?.stable;
        const current = versions.stdout.split(/\s+/)[1];
        if (latest && latest !== current) {
          log.info(`New CLI version available (${current} \u2192 ${latest}) \u2014 run: brew upgrade gor-mobile`);
        } else if (current) {
          log.ok(`CLI up-to-date (${current})`);
        }
      } catch {
      }
    }
  }
  if (androidCliPath()) {
    log.step("Updating Android CLI");
    const res = await runAndroidUpdate();
    if (res.ok) log.ok("Android CLI updated");
    else if (res.error) log.warn(`android update: ${res.error}`);
  }
  log.step("Repairing managed files");
  await cmdRepair();
}

// src/commands/enable.ts
import { existsSync as existsSync18, writeFileSync as writeFileSync4 } from "fs";
import { join as join14 } from "path";
function cmdEnable() {
  const marker = join14(process.cwd(), ".gor-mobile.json");
  if (existsSync18(marker)) {
    log.ok(`Already enabled \u2014 ${marker} exists`);
    return;
  }
  writeFileSync4(marker, "{}\n");
  log.ok(`gor-mobile enabled for this repo \u2192 ${marker}`);
  log.info("Commit this file so the whole team's sessions activate gor-mobile here.");
}

// src/cli.ts
var program = new Command();
program.name("gor-mobile").description("Android-aware overlay installer for Claude Code").version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");
program.command("version").description("Print version").action(() => {
  console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
});
program.command("init").description("Run the install wizard (Android CLI, hooks, skills, MCP)").option("--dry-run", "print planned actions; no filesystem changes").option("-y, --yes", "assume yes to all prompts (non-interactive)").option("--skip-sanity", "skip final summary step").option("--no-tui", "force plain-text prompts").option("--advanced", "confirm each step and allow URL override").option("--rules <url>", "custom rules-pack git URL").action(async (opts) => {
  await cmdInit(opts);
});
program.command("doctor").description("Check environment (deps, hooks, MCP)").option("-v, --verbose", "dump hook payload + skill frontmatter").action(async (opts) => {
  await cmdDoctor(opts);
});
program.command("repair").description("Restore managed files in ~/.claude/").action(async () => {
  await cmdRepair();
});
program.command("enable").description("Mark the current repo as a gor-mobile (mobile) project").action(() => {
  cmdEnable();
});
program.command("android-skills").description("Browse + install/remove optional Google Android CLI skills").action(async () => {
  await cmdAndroidSkills();
});
program.command("update").description("Pull latest rules, `android update`, then repair managed files").action(async () => {
  await cmdUpdate();
});
program.command("self-update").description("Update the CLI itself (curl-install path)").action(async () => {
  await cmdSelfUpdate();
});
program.command("uninstall").description("Remove everything gor-mobile installed").option("-y, --yes", "skip confirmation").action(async (opts) => {
  await cmdUninstall(opts);
});
var rules = program.command("rules").description("Manage the architecture rules pack");
rules.command("list").alias("ls").description("Show installed pack + source + version").action(async () => {
  await rulesList();
});
rules.command("use <url>").description("Switch to a pack (git URL or local dir)").action(async (url) => {
  await rulesUse(url);
});
rules.command("update").alias("up").description("git pull the current pack").action(async () => {
  await rulesUpdate();
});
rules.command("diff").description("Show diff vs upstream").action(async () => {
  await rulesDiff();
});
rules.command("validate").description("Check manifest.json and compatibility").action(async () => {
  await rulesValidate();
});
program.command("docs").argument("<query...>").description("Search Android docs").action(async (query) => {
  await cmdDocs(query);
});
program.command("android").description("Wrapper around Google's `android` CLI").allowUnknownOption(true).helpOption(false).argument("[args...]", "arguments passed through to android CLI").action(async (args) => {
  await cmdAndroid(args ?? []);
});
program.parseAsync(process.argv).catch((err) => {
  console.error(err);
  process.exit(1);
});
//# sourceMappingURL=cli.js.map