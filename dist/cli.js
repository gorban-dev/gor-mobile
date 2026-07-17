// src/cli.ts
import { Command } from "commander";

// src/constants.ts
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
var GOR_MOBILE_VERSION = "0.3.2";
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
var CODEX_DIR = process.env.CODEX_HOME ?? join(HOME, ".codex");
var CODEX_SKILLS_DIR = join(CODEX_DIR, "skills");
var CODEX_AGENTS_DIR = join(CODEX_DIR, "agents");
var CODEX_AGENTS_MD = join(CODEX_DIR, "AGENTS.md");
var CODEX_HOOKS_JSON = join(CODEX_DIR, "hooks.json");
var CODEX_CONFIG_TOML = join(CODEX_DIR, "config.toml");
var PROJECT_MARKER_NAME = ".gor-mobile.json";
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

// src/commands/setup.ts
import { existsSync as existsSync12, readdirSync as readdirSync4 } from "fs";
import { join as join8 } from "path";
import { execa as execa4 } from "execa";
import pc7 from "picocolors";
import { cancel as cancel3, isCancel as isCancel3 } from "@clack/prompts";

// src/helpers/android-cli.ts
import { accessSync as accessSync2, constants as constants2, cpSync, existsSync as existsSync4, rmSync } from "fs";
import { homedir as homedir2 } from "os";
import { dirname as dirname3, join as join4 } from "path";
import { execa as execa2 } from "execa";

// src/targets.ts
import { existsSync as existsSync3, readdirSync } from "fs";
import { join as join2 } from "path";

// src/helpers/settings-merge.ts
import { existsSync as existsSync2 } from "fs";

// src/helpers/paths.ts
import { mkdirSync, existsSync, readFileSync, writeFileSync } from "fs";
import { dirname as dirname2 } from "path";
function ensureDir(path) {
  mkdirSync(path, { recursive: true });
}
function ensureParentDir(filePath) {
  mkdirSync(dirname2(filePath), { recursive: true });
}
function readJsonSafe(path, fallback) {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}
function writeJson(path, data) {
  ensureParentDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}

// src/helpers/settings-merge.ts
var HOOK_MARKER = {
  SessionStart: "templates/session-start-hook.sh",
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh",
  PreToolUse: "templates/ast-index-guard-hook.sh"
};
function isManagedEntry(entry, hookType) {
  if ((entry._managed_by ?? "") === MANAGED_TAG) return true;
  const marker = HOOK_MARKER[hookType];
  return (entry.hooks ?? []).some(
    (h) => h.type === "command" && h.command.includes(marker)
  );
}
function ensureSettingsFile(hooksFile) {
  ensureParentDir(hooksFile);
  if (!existsSync2(hooksFile)) {
    writeJson(hooksFile, {});
  }
  return readJsonSafe(hooksFile, {});
}
function upsertHook(hooksFile, hookType, matcher, command) {
  const settings = ensureSettingsFile(hooksFile);
  settings.hooks = settings.hooks ?? {};
  const existing = settings.hooks[hookType] ?? [];
  const previous = existing.filter((entry) => !isManagedEntry(entry, hookType));
  const next = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(hooksFile, settings);
  return { collapsed: existing.length - previous.length };
}
function removeHook(hooksFile, hookType) {
  if (!existsSync2(hooksFile)) return;
  const settings = readJsonSafe(hooksFile, {});
  if (!settings.hooks || !settings.hooks[hookType]) return;
  const remaining = settings.hooks[hookType].filter(
    (entry) => !isManagedEntry(entry, hookType)
  );
  if (remaining.length === 0) {
    delete settings.hooks[hookType];
  } else {
    settings.hooks[hookType] = remaining;
  }
  writeJson(hooksFile, settings);
}
function sessionStartCommand(target) {
  const base = `bash ${GOR_MOBILE_HOME}/templates/session-start-hook.sh`;
  return target.id === "claude" ? base : `GORM_SKILLS_DIR=${target.skillsDir} ${base}`;
}
function installSessionStartHook(target) {
  return upsertHook(
    target.hooksFile,
    "SessionStart",
    "startup|clear|compact|resume",
    sessionStartCommand(target)
  );
}
function removeSessionStartHook(target) {
  removeHook(target.hooksFile, "SessionStart");
}
function installUserPromptSubmitHook(target) {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  return upsertHook(target.hooksFile, "UserPromptSubmit", "", cmd);
}
function removeUserPromptSubmitHook(target) {
  removeHook(target.hooksFile, "UserPromptSubmit");
}
function installAstIndexGuardHook(target) {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/ast-index-guard-hook.sh`;
  const matcher = target.id === "claude" ? "Grep|Bash" : "Bash";
  return upsertHook(target.hooksFile, "PreToolUse", matcher, cmd);
}
function removeAstIndexGuardHook(target) {
  removeHook(target.hooksFile, "PreToolUse");
}
var CLEAR_CONTEXT_ON_PLAN_ACCEPT = "showClearContextOnPlanAccept";
function enableClearContextOnPlanAccept(file) {
  const settings = ensureSettingsFile(file);
  if (settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT] === true) return false;
  settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT] = true;
  writeJson(file, settings);
  return true;
}
function removeClearContextOnPlanAccept(file) {
  if (!existsSync2(file)) return;
  const settings = readJsonSafe(file, {});
  if (!(CLEAR_CONTEXT_ON_PLAN_ACCEPT in settings)) return;
  delete settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT];
  writeJson(file, settings);
}
function countManagedHooks(hookType, target) {
  const settings = readJsonSafe(target.hooksFile, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.filter((e) => isManagedEntry(e, hookType)).length;
}
function hasManagedHooksInFile(hooksFile) {
  const settings = readJsonSafe(hooksFile, {});
  for (const hookType of ["SessionStart", "UserPromptSubmit", "PreToolUse"]) {
    const entries = settings.hooks?.[hookType] ?? [];
    if (entries.some((e) => isManagedEntry(e, hookType))) return true;
  }
  return false;
}

// src/targets.ts
var TARGETS = {
  claude: {
    id: "claude",
    label: "Claude Code",
    scope: "user",
    home: CLAUDE_DIR,
    skillsDir: CLAUDE_SKILLS_DIR,
    agentsDir: CLAUDE_AGENTS_DIR,
    instructionsFile: CLAUDE_CLAUDE_MD,
    instructionsSnippet: "claude-md-snippet.md",
    hooksFile: CLAUDE_SETTINGS,
    hooksKind: "claude-settings",
    agentFormat: "md",
    androidAgentFlag: "claude-code",
    supportsStatusLine: true,
    statusLineKind: "claude-command",
    supportsMcpPrune: true
  },
  codex: {
    id: "codex",
    label: "Codex",
    scope: "user",
    home: CODEX_DIR,
    skillsDir: CODEX_SKILLS_DIR,
    agentsDir: CODEX_AGENTS_DIR,
    instructionsFile: CODEX_AGENTS_MD,
    // Codex has no Skill tool and its reviewer sessions must not recurse into
    // codex-companion — the section body differs from the Claude one.
    instructionsSnippet: "agents-md-snippet-codex.md",
    hooksFile: CODEX_HOOKS_JSON,
    hooksKind: "codex-hooks-json",
    agentFormat: "toml",
    androidAgentFlag: "codex",
    supportsStatusLine: true,
    statusLineKind: "codex-config",
    supportsMcpPrune: false
  }
};
var ALL_TARGET_IDS = ["claude", "codex"];
function projectClaudeSpec(root) {
  const home = join2(root, ".claude");
  return {
    id: "claude",
    label: "Claude Code (project)",
    scope: "project",
    home,
    skillsDir: join2(home, "skills"),
    agentsDir: join2(home, "agents"),
    instructionsFile: "",
    instructionsSnippet: "claude-md-snippet.md",
    hooksFile: join2(home, "settings.local.json"),
    hooksKind: "claude-settings",
    agentFormat: "md",
    androidAgentFlag: "claude-code",
    supportsStatusLine: false,
    statusLineKind: null,
    supportsMcpPrune: false
  };
}
function targetSpecs(ids) {
  return ids.map((id) => TARGETS[id]);
}
function agentHomeExists(id) {
  return existsSync3(TARGETS[id].home);
}
function detectInstalledTargets() {
  return ALL_TARGET_IDS.filter(agentHomeExists);
}
function hasGorMobileSkills(skillsDir) {
  if (!existsSync3(skillsDir)) return false;
  try {
    return readdirSync(skillsDir).some((e) => e.startsWith("gor-mobile-"));
  } catch {
    return false;
  }
}
function detectGorMobileTargets() {
  return ALL_TARGET_IDS.filter((id) => {
    const spec = TARGETS[id];
    return hasManagedHooksInFile(spec.hooksFile) || hasGorMobileSkills(spec.skillsDir);
  });
}
function parseTargetFlag(raw) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (!t) continue;
    if (t !== "claude" && t !== "codex") {
      throw new Error(`unknown target '${t}' \u2014 valid targets: claude, codex`);
    }
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  if (out.length === 0) {
    throw new Error("no valid targets in --target (expected claude and/or codex)");
  }
  return out;
}

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
import { delimiter, join as join3 } from "path";
function which(cmd) {
  const PATH = process.env.PATH ?? "";
  for (const dir of PATH.split(delimiter)) {
    if (!dir) continue;
    const full = join3(dir, cmd);
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

// src/helpers/net.ts
import { execa } from "execa";
async function isOnline() {
  try {
    const res = await execa(
      "curl",
      ["-sS", "--max-time", "3", "-o", "/dev/null", "-I", "https://dl.google.com"],
      { reject: false, timeout: 5e3 }
    );
    return res.exitCode === 0;
  } catch {
    return false;
  }
}

// src/ui/log.ts
import pc from "picocolors";
function isTty() {
  return Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;
}
function prefix(symbol, color) {
  return isTty() ? color(symbol) : symbol;
}
var log = {
  info(msg) {
    console.error(`  ${prefix("i", pc.cyan)} ${msg}`);
  },
  ok(msg) {
    console.error(`  ${prefix("\u2713", pc.green)} ${msg}`);
  },
  warn(msg) {
    console.error(`  ${prefix("!", pc.yellow)} ${msg}`);
  },
  err(msg) {
    console.error(`  ${prefix("\u2717", pc.red)} ${msg}`);
  },
  step(title) {
    const label = isTty() ? pc.bold(pc.magenta(`\u25B8 ${title}`)) : `\u25B8 ${title}`;
    console.error(`
${label}`);
  },
  muted(msg) {
    console.error(`  ${isTty() ? pc.dim(msg) : msg}`);
  },
  raw(msg) {
    console.error(msg);
  }
};

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
function androidCliSkillPath(skillsDir = CLAUDE_SKILLS_DIR) {
  return join4(skillsDir, "android-cli", "SKILL.md");
}
function androidCliSkillInstalled(skillsDir = CLAUDE_SKILLS_DIR) {
  return existsSync4(androidCliSkillPath(skillsDir));
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
    const res = await execa2(shell, [shellFlag, cmd], {
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
    const res = await execa2(cli, ["update"], {
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
    const res = await execa2(cli, ["skills", "list"], {
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
    const res = await execa2(
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
    const res = await execa2(
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
    if (canWrite(dirname3(cli))) {
      try {
        rmSync(cli, { force: true });
        removed.push(cli);
      } catch (err) {
        errors.push(`${cli}: ${err.message}`);
      }
    } else {
      const res = await execa2("sudo", ["rm", "-f", cli], {
        stdio: "inherit",
        reject: false
      });
      if (res.exitCode === 0) removed.push(cli);
      else errors.push(`${cli}: sudo rm exit ${res.exitCode}`);
    }
  }
  const paths = [
    join4(homedir2(), ".android", "bin", "android-cli"),
    join4(homedir2(), ".android", "cli"),
    // `android init` may have dropped the stock skill into any target's folder.
    ...ALL_TARGET_IDS.map((id) => join4(TARGETS[id].skillsDir, "android-cli"))
  ];
  for (const p of paths) {
    if (!existsSync4(p)) continue;
    try {
      rmSync(p, { recursive: true, force: true });
      removed.push(p);
    } catch (err) {
      errors.push(`${p}: ${err.message}`);
    }
  }
  return { removed, errors };
}
async function runAndroidInit(target = TARGETS.claude) {
  const cli = androidCliPath();
  if (!cli) return { ran: false, skillInstalled: false };
  const skillPath = androidCliSkillPath(target.skillsDir);
  try {
    const res = await execa2(cli, ["init"], { reject: false, timeout: 3e4 });
    const ok = res.exitCode === 0;
    return {
      ran: true,
      skillInstalled: existsSync4(skillPath),
      error: ok ? void 0 : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return {
      ran: true,
      skillInstalled: existsSync4(skillPath),
      error: err.message
    };
  }
}
async function provisionProjectAndroidSkill(projectSkillsDir) {
  const cli = androidCliPath();
  const dst = join4(projectSkillsDir, "android-cli");
  if (!cli) {
    return { ran: false, installed: existsSync4(join4(dst, "SKILL.md")) };
  }
  let error;
  try {
    const res = await execa2(cli, ["init"], { reject: false, timeout: 3e4 });
    if (res.exitCode !== 0) {
      error = (res.stderr || res.stdout || "").toString().slice(0, 200);
    }
  } catch (err) {
    error = err.message;
  }
  const claudeSrc = join4(CLAUDE_SKILLS_DIR, "android-cli");
  const codexSrc = join4(CODEX_SKILLS_DIR, "android-cli");
  const src = existsSync4(join4(claudeSrc, "SKILL.md")) ? claudeSrc : existsSync4(join4(codexSrc, "SKILL.md")) ? codexSrc : null;
  if (src && src !== dst) {
    ensureDir(projectSkillsDir);
    rmSync(dst, { recursive: true, force: true });
    cpSync(src, dst, { recursive: true });
  }
  if (existsSync4(claudeSrc)) rmSync(claudeSrc, { recursive: true, force: true });
  return { ran: true, installed: existsSync4(join4(dst, "SKILL.md")), error };
}
async function androidCliVersion() {
  const cli = androidCliPath();
  if (!cli) return null;
  try {
    const res = await execa2(cli, ["--version"], { reject: false, timeout: 3e4 });
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
    const tap = await execa2("brew", ["tap", "android/tap"], { stdio: "inherit", reject: false, timeout: 12e4 });
    if (tap.exitCode !== 0) return { installed: false, error: `brew tap exit ${tap.exitCode}` };
    const inst = await execa2("brew", ["install", "android-cli"], { stdio: "inherit", reject: false, timeout: 3e5 });
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
    const res = await execa2(cli, ["help"], { reject: false, timeout: 6e4 });
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
    const res = await execa2("brew", ["upgrade", "android-cli"], { stdio: "inherit", reject: false, timeout: 3e5 });
    return res.exitCode === 0;
  } catch {
    return false;
  }
}
async function androidInstallMethod() {
  const cli = androidCliPath();
  if (cli && (cli.startsWith("/opt/homebrew/") || cli.startsWith("/usr/local/") || cli.startsWith("/home/linuxbrew/"))) {
    return "brew";
  }
  try {
    const res = await execa2("brew", ["list", "android-cli"], {
      reject: false,
      timeout: 3e4
    });
    if (res.exitCode === 0) return "brew";
  } catch {
  }
  return "standalone";
}
async function ensureAndroidCliCurrent(opts = {}) {
  const cli = androidCliPath();
  if (!cli) {
    log.info("android CLI not on PATH \u2014 skipping update");
    return;
  }
  if (opts.dryRun) {
    log.info("dry-run: skipping android CLI update");
    return;
  }
  const skipRequested = opts.skip || Boolean(process.env.GOR_MOBILE_SKIP_ANDROID_UPDATE);
  let upgraded = false;
  if (skipRequested) {
    log.info("skipping android CLI update (requested)");
  } else if (!await isOnline()) {
    log.info("offline \u2014 skipping android CLI update");
  } else {
    const method = await androidInstallMethod();
    log.step(`Updating android CLI (${method})`);
    upgraded = method === "brew" ? await tryBrewUpgrade() : (await runAndroidUpdate()).ok;
    if (!upgraded) log.warn("android CLI update did not complete");
  }
  const smoke = await smokeTestContract();
  if (smoke.missing.length > 0) {
    log.warn(
      `android CLI missing contract commands: ${smoke.missing.join(", ")} \u2014 update gor-mobile`
    );
  } else if (smoke.belowFloor) {
    log.warn(
      `android CLI v${smoke.version ?? "?"} still below floor ${ANDROID_CLI_FLOOR} \u2014 check Google's update channel`
    );
  } else {
    log.ok(`android CLI current (v${smoke.version ?? "?"})`);
  }
}

// src/helpers/claude-md-section.ts
import { existsSync as existsSync5, readFileSync as readFileSync2, writeFileSync as writeFileSync2 } from "fs";
function readCurrent(file) {
  if (!existsSync5(file)) return "";
  return readFileSync2(file, "utf8");
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
function writeManagedSection(file, snippetPath) {
  if (!existsSync5(snippetPath)) {
    throw new Error(`snippet not found: ${snippetPath}`);
  }
  ensureParentDir(file);
  const existing = readCurrent(file);
  const stripped = stripManagedSection(existing);
  const snippet = readFileSync2(snippetPath, "utf8");
  const prefix2 = stripped.length > 0 && !stripped.endsWith("\n") ? `${stripped}
` : stripped;
  const next = `${prefix2}
${SECTION_BEGIN}
${snippet.endsWith("\n") ? snippet : `${snippet}
`}${SECTION_END}
`;
  writeFileSync2(file, next);
}
function removeManagedSection(file) {
  if (!existsSync5(file)) return;
  const stripped = stripManagedSection(readCurrent(file));
  writeFileSync2(file, stripped);
}
function hasManagedSection(file) {
  if (!existsSync5(file)) return false;
  return readFileSync2(file, "utf8").includes(SECTION_BEGIN);
}

// src/helpers/ast-index.ts
var AST_INDEX_REPO_URL = "https://github.com/defendend/Claude-ast-index-search";
var AST_INDEX_INSTALL_SNIPPET = "brew tap defendend/ast-index && brew install ast-index";
function astIndexPath() {
  return which("ast-index");
}

// src/helpers/install-assets.ts
import {
  cpSync as cpSync2,
  chmodSync,
  copyFileSync,
  existsSync as existsSync6,
  readdirSync as readdirSync2,
  readFileSync as readFileSync3,
  rmSync as rmSync2,
  statSync,
  writeFileSync as writeFileSync3
} from "fs";
import { basename, join as join5 } from "path";
function copyHookTemplates() {
  ensureDir(GOR_MOBILE_TEMPLATES_DIR);
  const scripts = [
    "session-start-hook.sh",
    "user-prompt-submit-hook.sh",
    "ast-index-guard-hook.sh",
    "statusline-command.sh",
    "statusline-cat.sh"
  ];
  for (const name of scripts) {
    const src = join5(gorMobileRoot(), "templates", name);
    const dst = join5(GOR_MOBILE_TEMPLATES_DIR, name);
    copyFileSync(src, dst);
    chmodSync(dst, 493);
  }
  const snippet = "claude-md-snippet.md";
  copyFileSync(join5(gorMobileRoot(), "templates", snippet), join5(GOR_MOBILE_TEMPLATES_DIR, snippet));
  for (const stale of ["session-start-snippet.md", "detect-mobile-context.sh"]) {
    const p = join5(GOR_MOBILE_TEMPLATES_DIR, stale);
    if (existsSync6(p)) rmSync2(p);
  }
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
function installSkills(target) {
  ensureDir(target.skillsDir);
  for (const entry of readdirSync2(target.skillsDir)) {
    if (entry.startsWith("gor-mobile-")) {
      rmSync2(join5(target.skillsDir, entry), { recursive: true, force: true });
    }
  }
  const root = gorMobileRoot();
  const skillsDir = join5(root, "templates", "skills");
  const overlaysDir = join5(root, "templates", "overlays");
  const installed = [];
  const missingPrefix = [];
  if (!existsSync6(skillsDir)) return { installed, missingPrefix };
  for (const name of readdirSync2(skillsDir)) {
    const srcDir = join5(skillsDir, name);
    if (!statSync(srcDir).isDirectory()) continue;
    const dstDir = join5(target.skillsDir, `gor-mobile-${name}`);
    cpSync2(srcDir, dstDir, { recursive: true });
    const skillMd = join5(dstDir, "SKILL.md");
    if (existsSync6(skillMd)) {
      let body = transformSkillBody(readFileSync3(skillMd, "utf8"));
      const overlayPath = join5(overlaysDir, `${name}.md`);
      if (existsSync6(overlayPath)) {
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
function installAgents(target) {
  ensureDir(target.agentsDir);
  const srcSub = target.agentFormat === "toml" ? "agents-codex" : "agents";
  const ext = `.${target.agentFormat}`;
  const src = join5(gorMobileRoot(), "templates", srcSub);
  const copied = [];
  if (!existsSync6(src)) return copied;
  for (const name of readdirSync2(src)) {
    if (!name.endsWith(ext)) continue;
    const from = join5(src, name);
    const to = join5(target.agentsDir, name);
    copyFileSync(from, to);
    chmodSync(to, 420);
    copied.push(name);
  }
  return copied;
}
function cleanupLegacyCommands(commandsDir) {
  if (!existsSync6(commandsDir)) return [];
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
    const file = join5(commandsDir, `${cmd}.md`);
    if (!existsSync6(file)) continue;
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
  const advisor = join5(CLAUDE_AGENTS_DIR, "gor-mobile-advisor.md");
  if (existsSync6(advisor)) {
    rmSync2(advisor);
    removed.push(basename(advisor));
  }
  const legacyCr = join5(CLAUDE_AGENTS_DIR, "code-reviewer.md");
  if (existsSync6(legacyCr)) {
    const head = readFileSync3(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
    if (/^name: code-reviewer/m.test(head)) {
      rmSync2(legacyCr);
      removed.push(basename(legacyCr));
    }
  }
  return removed;
}

// src/helpers/legacy.ts
import { existsSync as existsSync7, readdirSync as readdirSync3 } from "fs";
import pc2 from "picocolors";
function legacyClaudeFootprint() {
  const findings = [];
  if (existsSync7(CLAUDE_SKILLS_DIR)) {
    const skills = readdirSync3(CLAUDE_SKILLS_DIR).filter(
      (e) => e.startsWith("gor-mobile-")
    );
    if (skills.length > 0) {
      findings.push({
        label: `${skills.length} gor-mobile-* skills`,
        path: CLAUDE_SKILLS_DIR
      });
    }
  }
  if (existsSync7(CLAUDE_AGENTS_DIR)) {
    const agents = readdirSync3(CLAUDE_AGENTS_DIR).filter(
      (e) => e.startsWith("gor-mobile-") && e.endsWith(".md")
    );
    if (agents.length > 0) {
      findings.push({
        label: `${agents.length} gor-mobile-* agents`,
        path: CLAUDE_AGENTS_DIR
      });
    }
  }
  if (hasManagedHooksInFile(CLAUDE_SETTINGS)) {
    findings.push({ label: "managed hooks", path: CLAUDE_SETTINGS });
  }
  if (hasManagedSection(CLAUDE_CLAUDE_MD)) {
    findings.push({ label: "managed CLAUDE.md section", path: CLAUDE_CLAUDE_MD });
  }
  return findings;
}
function printBanner(findings) {
  console.error("");
  console.error(pc2.yellow("\u250C\u2500 gor-mobile: legacy v0.2.x install detected \u2500\u2510"));
  for (const f of findings) {
    console.error(pc2.yellow(`\u2502 ${f.label} \u2192 ${f.path}`));
  }
  console.error(
    pc2.yellow(
      "\u2502 Since v0.3.0 the Claude workflow installs per-project. Run 'gor-mobile migrate',"
    )
  );
  console.error(
    pc2.yellow(
      "\u2502 then 'gor-mobile setup' once and 'gor-mobile init' in each mobile repo."
    )
  );
  console.error(pc2.yellow("\u2514\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2518"));
  console.error("");
}
function legacyGate(opts) {
  const findings = legacyClaudeFootprint();
  if (findings.length === 0) return false;
  printBanner(findings);
  if (opts.block) {
    log.err("blocked: migrate the legacy install first (gor-mobile migrate)");
    return true;
  }
  return false;
}

// src/helpers/rules-pack.ts
import { existsSync as existsSync8, cpSync as cpSync3, rmSync as rmSync3 } from "fs";
import { join as join6 } from "path";
import { execa as execa3 } from "execa";
function manifestPath() {
  return join6(GOR_MOBILE_RULES_DIR, "manifest.json");
}
function readManifest() {
  if (!existsSync8(manifestPath())) return null;
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
  if (existsSync8(join6(GOR_MOBILE_RULES_DIR, ".git"))) {
    await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
      reject: false
    });
    return;
  }
  if (existsSync8(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  ensureDir(join6(GOR_MOBILE_RULES_DIR, ".."));
  await execa3("git", [
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
  if (existsSync8(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync3(source, GOR_MOBILE_RULES_DIR, { recursive: true });
}
function fallbackToBundled(bundledRoot) {
  if (existsSync8(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync3(bundledRoot, GOR_MOBILE_RULES_DIR, { recursive: true });
}
async function pullCurrent() {
  if (!existsSync8(join6(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout \u2014 cannot pull");
  }
  await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
    stdio: "inherit"
  });
}
async function diffAgainstUpstream() {
  if (!existsSync8(join6(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout");
  }
  await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "fetch", "origin"], {
    reject: false
  });
  const { stdout } = await execa3(
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
      if (!existsSync8(join6(GOR_MOBILE_RULES_DIR, rel))) {
        errors.push(`missing rule file: ${rel}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, manifest: m };
}
async function gitBranchAndRev() {
  if (!existsSync8(join6(GOR_MOBILE_RULES_DIR, ".git"))) return {};
  const branch = await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  const rev = await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--short", "HEAD"], { reject: false });
  return { branch: branch.stdout.trim(), rev: rev.stdout.trim() };
}

// src/helpers/settings-statusline.ts
import { existsSync as existsSync9 } from "fs";
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
  if (!existsSync9(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  if (isManaged(settings.statusLine)) {
    delete settings.statusLine;
    writeJson(CLAUDE_SETTINGS, settings);
  }
}

// src/helpers/codex-statusline.ts
import { existsSync as existsSync10, readFileSync as readFileSync4, writeFileSync as writeFileSync4 } from "fs";
var CODEX_STATUS_LINE_ITEMS = [
  "model-with-reasoning",
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "task-progress"
];
var MARKER = `# ${MANAGED_TAG}`;
var TUI_HEADER_RE = /^\s*\[tui\]\s*$/;
var TABLE_RE = /^\s*\[/;
var SL_RE = /^\s*status_line\s*=/;
var COLORS_RE = /^\s*status_line_use_colors\s*=/;
function statusLineLine() {
  const arr = CODEX_STATUS_LINE_ITEMS.map((i) => `"${i}"`).join(", ");
  return `status_line = [${arr}] ${MARKER}`;
}
var COLORS_LINE = `status_line_use_colors = true ${MARKER}`;
function readConfig2() {
  return existsSync10(CODEX_CONFIG_TOML) ? readFileSync4(CODEX_CONFIG_TOML, "utf8") : "";
}
function findTuiBody(lines) {
  const header = lines.findIndex((l) => TUI_HEADER_RE.test(l));
  if (header === -1) return null;
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (TABLE_RE.test(lines[i])) {
      end = i;
      break;
    }
  }
  return { header, end };
}
function codexStatusLineState() {
  const content = readConfig2();
  if (!content) return { present: false, managed: false, foreign: false };
  const lines = content.split("\n");
  const body = findTuiBody(lines);
  if (!body) return { present: false, managed: false, foreign: false };
  for (let i = body.header + 1; i < body.end; i++) {
    if (SL_RE.test(lines[i])) {
      const managed = lines[i].includes(MANAGED_TAG);
      return { present: true, managed, foreign: !managed };
    }
  }
  return { present: false, managed: false, foreign: false };
}
function installCodexStatusLine(opts = {}) {
  const content = readConfig2();
  const sl = statusLineLine();
  const lines = content.length ? content.split("\n") : [];
  const body = findTuiBody(lines);
  if (!body) {
    const base = content.replace(/\n*$/, "");
    const sep = base.length ? "\n\n" : "";
    const next = `${base}${sep}[tui]
${sl}
${COLORS_LINE}
`;
    ensureParentDir(CODEX_CONFIG_TOML);
    writeFileSync4(CODEX_CONFIG_TOML, next);
    return true;
  }
  let slIdx = -1;
  let colorsIdx = -1;
  let lastBareKey = body.header;
  for (let i = body.header + 1; i < body.end; i++) {
    const line = lines[i];
    if (SL_RE.test(line)) slIdx = i;
    else if (COLORS_RE.test(line)) colorsIdx = i;
    if (line.trim() && !TABLE_RE.test(line)) lastBareKey = i;
  }
  const slForeign = slIdx !== -1 && !lines[slIdx].includes(MANAGED_TAG);
  if (slForeign && !opts.force) return false;
  const colorsForeign = colorsIdx !== -1 && !lines[colorsIdx].includes(MANAGED_TAG);
  const del = [];
  if (slIdx !== -1 && (!slForeign || opts.force)) del.push(slIdx);
  if (colorsIdx !== -1 && (!colorsForeign || opts.force)) del.push(colorsIdx);
  del.sort((a, b) => b - a).forEach((i) => {
    lines.splice(i, 1);
    if (i <= lastBareKey) lastBareKey--;
  });
  const insert = [sl];
  if (!(colorsForeign && !opts.force)) insert.push(COLORS_LINE);
  lines.splice(lastBareKey + 1, 0, ...insert);
  ensureParentDir(CODEX_CONFIG_TOML);
  writeFileSync4(CODEX_CONFIG_TOML, lines.join("\n"));
  return true;
}
function removeCodexStatusLine() {
  const content = readConfig2();
  if (!content) return;
  const lines = content.split("\n");
  const body = findTuiBody(lines);
  if (!body) return;
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    const inBody = i > body.header && i < body.end;
    const isOurs = inBody && (SL_RE.test(lines[i]) || COLORS_RE.test(lines[i])) && lines[i].includes(MANAGED_TAG);
    if (isOurs) continue;
    kept.push(lines[i]);
  }
  writeFileSync4(CODEX_CONFIG_TOML, kept.join("\n"));
}

// src/ui/banner.ts
import { existsSync as existsSync11, readFileSync as readFileSync5 } from "fs";
import { join as join7 } from "path";
import pc3 from "picocolors";
function renderBanner() {
  const path = join7(gorMobileRoot(), "templates", "banner.txt");
  if (existsSync11(path)) {
    const raw = readFileSync5(path, "utf8");
    const trimmed = raw.replace(/\n+$/, "");
    const colored = trimmed.split("\n").map((line) => pc3.magenta(line)).join("\n");
    console.log("");
    console.log(colored);
  } else {
    console.log("");
    console.log(pc3.bold(pc3.magenta("GOR-MOBILE")));
  }
  const subtitle = `Android-aware overlay installer for Claude Code  \xB7  v${GOR_MOBILE_VERSION}`;
  console.log(pc3.dim(subtitle));
  console.log("");
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

// src/ui/note.ts
import { note as clackNote } from "@clack/prompts";
import pc4 from "picocolors";
function note(body, title) {
  if (isTuiOn()) {
    clackNote(body, title);
    return;
  }
  if (title) {
    console.log("");
    console.log(pc4.bold(title));
  }
  for (const line of body.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("");
}

// src/ui/progress.ts
import pc5 from "picocolors";
var SYMBOLS = {
  ok: pc5.green("\u2713"),
  fail: pc5.red("\u2717"),
  warn: pc5.yellow("!"),
  skip: pc5.dim("\u25CB")
};
function pad(n, total) {
  const width = String(total).length;
  return String(n).padStart(width, " ");
}
function progressItem(i, total, label, status, note2) {
  const prefix2 = pc5.dim(`(${pad(i, total)}/${total})`);
  const suffix = note2 ? pc5.dim(` ${note2}`) : "";
  console.log(`    ${prefix2}  ${label.padEnd(38)} ${SYMBOLS[status]}${suffix}`);
}

// src/ui/section-header.ts
import pc6 from "picocolors";
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
  const sep = pc6.dim(" \u203A ");
  return labels.map((label, i) => {
    const step = i + 1;
    if (step < current) return pc6.green(`\u2713 ${label}`);
    if (step === current) return pc6.bold(pc6.magenta(`\u25B8 ${label}`));
    return pc6.dim(label);
  }).join(sep);
}
function sectionHeader(n, total, title) {
  console.log("");
  const labels = STEP_LABELS.length === total ? STEP_LABELS : Array.from({ length: total }, (_, i) => String(i + 1));
  console.log(`  ${breadcrumb(n, labels)}`);
  const lead = pc6.bold(pc6.magenta(`${n}/${total}`));
  console.log(`  ${lead}  ${pc6.bold(title)}`);
}

// src/ui/statusline-select.ts
import { select, isCancel as isCancel2, cancel as cancel2 } from "@clack/prompts";
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
  const pick = await select({
    message: "Status line (optional)",
    options: [
      { value: "command", label: "Classic", hint: "3-line colored bars" },
      { value: "cat", label: "Cat", hint: "ASCII cat that reacts to usage" },
      { value: "skip", label: "Skip", hint: "don't install a status line" }
    ],
    initialValue: "skip"
  });
  if (isCancel2(pick)) {
    cancel2("Cancelled");
    process.exit(0);
  }
  return pick;
}

// src/commands/setup.ts
function dryLog(msg) {
  console.log(`    ${pc7.dim("[dry-run]")} ${msg}`);
}
function shouldInstallCodex(target) {
  if (target) return parseTargetFlag(target).includes("codex");
  return agentHomeExists("codex");
}
function warnLegacy() {
  const findings = legacyClaudeFootprint();
  if (findings.length === 0) return;
  const body = [
    "A legacy v0.2.x global install was found in ~/.claude:",
    ...findings.map((f) => `  \xB7 ${f.label} \u2192 ${f.path}`),
    "",
    "Since v0.3.0 the Claude workflow installs per-project. Remove the old",
    "global footprint first:",
    "  gor-mobile migrate",
    "then re-run 'gor-mobile setup'."
  ].join("\n");
  note(body, "Legacy install detected");
}
async function stepDeps() {
  sectionHeader(1, 5, "Base dependencies");
  const required = [
    ["git", which("git")],
    ["curl", which("curl")],
    ["node", which("node")]
  ];
  const missing = [];
  let i = 0;
  for (const [name, path] of required) {
    i++;
    if (path) progressItem(i, required.length, name, "ok", path);
    else {
      progressItem(i, required.length, name, "fail", "not found");
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    throw new Error(`Install missing deps first: ${missing.join(", ")}`);
  }
  if (!which("jq")) {
    log.warn("jq not found \u2014 status line and the ast-index guard hook need it (brew install jq)");
  }
}
async function stepAndroidBinary(ctx) {
  sectionHeader(2, 5, "Google Android CLI");
  const existing = androidCliPath();
  if (existing) {
    progressItem(1, 1, "android CLI", "ok", existing);
    if (!ctx.opts.dryRun) {
      await ensureAndroidCliCurrent({
        skip: ctx.opts.skipAndroidUpdate,
        dryRun: ctx.opts.dryRun
      });
    }
    return;
  }
  if (!androidCliInstallSupported()) {
    progressItem(1, 1, "android CLI", "fail", `unsupported platform ${process.platform}/${process.arch}`);
    throw new Error(`platform ${process.platform}/${process.arch} unsupported by Google Android CLI`);
  }
  const displayCmd = process.platform === "win32" ? `curl -fsSL ${ANDROID_CLI_INSTALL_URL} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"` : process.platform === "darwin" ? "brew tap android/tap && brew install android-cli" : `curl -fsSL ${ANDROID_CLI_INSTALL_URL} | bash`;
  note(
    [
      "The Google Android CLI is required by gor-mobile and is not yet installed.",
      "",
      "Install command (from Google):",
      `  ${displayCmd}`,
      "",
      "This installs a ~5 MB launcher into ~/.local/bin/android (user-local, no sudo)."
    ].join("\n"),
    "Android CLI required"
  );
  if (ctx.opts.dryRun) {
    progressItem(1, 1, "android CLI", "skip", `dry-run: ${displayCmd}`);
    return;
  }
  const install = ctx.opts.yes ? true : await confirmStep("Install the Android CLI now? (required to continue)", true);
  if (!install) {
    progressItem(1, 1, "android CLI", "fail", "declined");
    throw new Error("user declined Android CLI install \u2014 gor-mobile cannot continue");
  }
  let res = process.platform === "darwin" && which("brew") !== null ? await installAndroidCliViaBrew() : { installed: false, error: void 0 };
  if (!res.installed) res = await installAndroidCli();
  if (!res.installed) {
    progressItem(1, 1, "android CLI", "fail", res.error ?? "install failed");
    throw new Error(`Android CLI install failed: ${res.error ?? "unknown error"}`);
  }
  progressItem(1, 1, "android CLI", "ok", androidCliPath() ?? "installed");
  await ensureAndroidCliCurrent({ skip: ctx.opts.skipAndroidUpdate, dryRun: ctx.opts.dryRun });
}
function stepAstIndex(ctx) {
  sectionHeader(3, 5, "ast-index CLI (code search)");
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
  note(
    [
      "ast-index powers fast structural code search. gor-mobile installs the",
      "skill (gor-mobile-ast-index) regardless, but search only works with the CLI.",
      "",
      "Install (Homebrew):",
      `  ${AST_INDEX_INSTALL_SNIPPET}`,
      "",
      `Other install options: ${AST_INDEX_REPO_URL}`
    ].join("\n"),
    "ast-index recommended"
  );
}
async function stepRules(ctx) {
  sectionHeader(4, 5, "Rules pack + shared hook scripts");
  if (ctx.opts.advanced && !ctx.opts.rules) {
    ctx.rulesUrl = await textPrompt("Rules pack URL", ctx.rulesUrl, (v) => {
      if (!v.trim()) return "URL cannot be empty";
      if (!/^https?:\/\/|^git@|^\//.test(v.trim())) return "Expected http(s)://, git@, or absolute path";
      return void 0;
    });
  }
  if (ctx.opts.dryRun) {
    progressItem(1, 3, "fetch rules pack", "skip", `dry-run: ${ctx.rulesUrl}`);
    progressItem(2, 3, "save config", "skip", "dry-run");
    progressItem(3, 3, "hook scripts \u2192 ~/.gor-mobile/templates", "skip", "dry-run");
    return;
  }
  const alreadyCloned = existsSync12(join8(GOR_MOBILE_RULES_DIR, ".git"));
  if (alreadyCloned) {
    await execa4("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
    ctx.rulesVersion = readManifest()?.version ?? "?";
    progressItem(1, 3, "pull existing pack", "ok", `v${ctx.rulesVersion} @ ${GOR_MOBILE_RULES_DIR}`);
  } else {
    try {
      await cloneOrPull(ctx.rulesUrl, DEFAULT_RULES_REF);
      ctx.rulesVersion = readManifest()?.version ?? "?";
      progressItem(1, 3, "clone rules pack", "ok", `v${ctx.rulesVersion} from ${ctx.rulesUrl}`);
    } catch (err) {
      log.warn(`git clone failed: ${err.message}`);
      fallbackToBundled(join8(gorMobileRoot(), "rules-default"));
      ctx.rulesVersion = readManifest()?.version ?? "bundled";
      progressItem(1, 3, "clone rules pack", "warn", `fallback to bundled v${ctx.rulesVersion}`);
    }
  }
  saveConfig(ctx.rulesUrl, DEFAULT_RULES_REF);
  progressItem(2, 3, "save config", "ok", GOR_MOBILE_RULES_DIR);
  copyHookTemplates();
  progressItem(3, 3, "hook scripts", "ok", "~/.gor-mobile/templates");
}
async function stepClaudeStatusLine(ctx) {
  if (ctx.opts.dryRun || ctx.opts.yes || !isTuiOn()) return;
  const choice = await statusLineSelect(false);
  if (choice === "skip") return;
  const st = statusLineState();
  let force = false;
  if (st.foreign) {
    force = await confirmStep("A non-gor-mobile statusLine already exists in ~/.claude. Replace it?", false);
    if (!force) {
      log.info("Kept your existing statusLine");
      return;
    }
  }
  installStatusLine(choice, { force });
  log.ok(`Claude status line installed (${choice === "cat" ? "Cat" : "Classic"})`);
}
async function stepCodex(ctx) {
  if (!ctx.installCodex) return;
  const target = TARGETS.codex;
  sectionHeader(5, 5, "Codex integration (user-level)");
  if (ctx.opts.dryRun) {
    dryLog(`merge SessionStart + UserPromptSubmit + PreToolUse \u2192 ${target.hooksFile}`);
    dryLog(`install skills \u2192 ${target.skillsDir}`);
    dryLog(`install agents (${target.agentFormat}) \u2192 ${target.agentsDir}`);
    dryLog(`write managed section \u2192 ${target.instructionsFile}`);
    dryLog("android init (stock android-cli skill)");
    dryLog("status line: tui.status_line in config.toml");
    return;
  }
  installSessionStartHook(target);
  installUserPromptSubmitHook(target);
  installAstIndexGuardHook(target);
  log.ok(`Hooks merged \u2192 ${target.hooksFile}`);
  const skills = installSkills(target);
  log.ok(`${skills.installed.length} gor-mobile-* skills \u2192 ${target.skillsDir}`);
  const agents = installAgents(target);
  log.ok(`${agents.length} review agents \u2192 ${target.agentsDir}`);
  writeManagedSection(target.instructionsFile, join8(gorMobileRoot(), "templates", target.instructionsSnippet));
  log.ok(`Managed section \u2192 ${target.instructionsFile}`);
  const androidRes = await runAndroidInit(target);
  if (androidRes.ran && androidRes.skillInstalled) {
    log.ok(`android-cli skill \u2192 ${target.skillsDir}/android-cli/`);
  } else if (!androidRes.ran) {
    log.warn("android CLI not on PATH \u2014 skipped android init");
  }
  if (!ctx.opts.yes && isTuiOn()) {
    const st = codexStatusLineState();
    if (st.foreign) {
      if (await confirmStep("~/.codex/config.toml already has a status_line. Replace it?", false)) {
        installCodexStatusLine({ force: true });
        log.ok("Codex status line replaced");
      }
    } else if (await confirmStep("Install the recommended Codex status line?", true)) {
      installCodexStatusLine();
      log.ok("Codex status line installed");
    }
  }
}
function templateSkillCount() {
  const src = join8(gorMobileRoot(), "templates", "skills");
  return existsSync12(src) ? readdirSync4(src).filter((n) => !n.startsWith(".")).length : 0;
}
async function cmdSetup(opts = {}) {
  if (opts.noTui || opts.tui === false) forceNoTui();
  renderBanner();
  console.log(pc7.bold("  Machine setup \u2014 one time per machine:"));
  for (const b of [
    "Verify base deps (git, curl, node, jq).",
    "Install + update the Google Android CLI (hard requirement).",
    "Soft-check the ast-index CLI.",
    "Clone the rules pack + hook scripts into ~/.gor-mobile/.",
    "Optionally install a Claude status line.",
    "Install the Codex workflow (user-level) if Codex is present."
  ]) {
    console.log(`    ${pc7.dim("\u2022")} ${b}`);
  }
  console.log("");
  console.log(pc7.dim("  Per-repo: run 'gor-mobile init' inside each mobile project.\n"));
  if (opts.dryRun) log.info("DRY RUN \u2014 no changes will be made");
  warnLegacy();
  const ctx = {
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    rulesVersion: "?",
    installCodex: shouldInstallCodex(opts.target)
  };
  try {
    await stepDeps();
    await stepAndroidBinary(ctx);
    stepAstIndex(ctx);
    await stepRules(ctx);
    await stepClaudeStatusLine(ctx);
    await stepCodex(ctx);
  } catch (err) {
    if (isCancel3(err)) {
      cancel3("Cancelled");
      process.exit(130);
    }
    log.err(`setup failed: ${err.message}`);
    process.exit(1);
  }
  console.log("");
  log.ok(`Machine ready \u2014 rules v${ctx.rulesVersion}, ${templateSkillCount()} skills available per project.`);
  log.info("Next: cd into a mobile repo and run 'gor-mobile init'.");
}

// src/commands/init.ts
import { existsSync as existsSync14 } from "fs";
import { join as join10 } from "path";
import pc8 from "picocolors";
import { cancel as cancel4, isCancel as isCancel4, select as select2 } from "@clack/prompts";

// src/helpers/enabled-plugins.ts
var SUPERPOWERS_KEY = "superpowers@claude-plugins-official";
var PLUGIN_ALIASES = {
  superpowers: SUPERPOWERS_KEY,
  figma: "figma@claude-plugins-official",
  "swagger-android": "swagger-android@gor-dev-plugins",
  "yandex-tracker": "yandex-tracker@gor-dev-plugins"
};
function resolvePluginKey(name) {
  const t = name.trim();
  return t.includes("@") ? t : PLUGIN_ALIASES[t] ?? t;
}
function applyEnabledPlugins(file, enable, disable) {
  const settings = readJsonSafe(file, {});
  const plugins = settings.enabledPlugins ?? {};
  const touched = [];
  for (const name of disable) {
    const key = resolvePluginKey(name);
    plugins[key] = false;
    touched.push(key);
  }
  for (const name of enable) {
    const key = resolvePluginKey(name);
    plugins[key] = true;
    touched.push(key);
  }
  settings.enabledPlugins = plugins;
  writeJson(file, settings);
  return touched;
}
function removeEnabledPlugins(file, keys) {
  const settings = readJsonSafe(file, {});
  if (!settings.enabledPlugins) return;
  for (const key of keys) delete settings.enabledPlugins[key];
  if (Object.keys(settings.enabledPlugins).length === 0) {
    delete settings.enabledPlugins;
  }
  writeJson(file, settings);
}

// src/helpers/project.ts
import {
  appendFileSync,
  existsSync as existsSync13,
  readdirSync as readdirSync5,
  readFileSync as readFileSync6,
  statSync as statSync2,
  writeFileSync as writeFileSync5
} from "fs";
import { dirname as dirname4, join as join9 } from "path";
import { execa as execa5 } from "execa";
function findProjectRoot(from = process.cwd()) {
  let dir = from;
  while (true) {
    if (existsSync13(join9(dir, PROJECT_MARKER_NAME))) return dir;
    if (dir === HOME) return null;
    const parent = dirname4(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
function readProjectMarker(root) {
  return readJsonSafe(join9(root, PROJECT_MARKER_NAME), {});
}
function writeProjectMarker(root, marker) {
  writeJson(join9(root, PROJECT_MARKER_NAME), marker);
}
function detectPlatform(root) {
  const androidMarkers = [
    "build.gradle",
    "build.gradle.kts",
    "settings.gradle",
    "settings.gradle.kts",
    "gradlew"
  ];
  if (androidMarkers.some((m) => existsSync13(join9(root, m)))) return "android";
  try {
    const entries = readdirSync5(root);
    if (entries.some((e) => e.endsWith(".xcodeproj") || e.endsWith(".xcworkspace")) || entries.includes("Podfile") || entries.includes("Package.swift")) {
      return "ios";
    }
  } catch {
  }
  return null;
}
function findGitRoot(from) {
  let dir = from;
  while (true) {
    if (existsSync13(join9(dir, ".git"))) return dir;
    const parent = dirname4(dir);
    if (parent === dir) return null;
    dir = parent;
  }
}
async function gitInit(root) {
  const res = await execa5("git", ["init"], { cwd: root, reject: false });
  return res.exitCode === 0;
}
async function gitInfoExcludePath(root) {
  let gitDir = join9(root, ".git");
  if (!existsSync13(gitDir)) return null;
  if (!statSync2(gitDir).isDirectory()) {
    const res = await execa5(
      "git",
      ["-C", root, "rev-parse", "--path-format=absolute", "--git-common-dir"],
      { reject: false }
    );
    if (res.exitCode !== 0) return null;
    gitDir = res.stdout.trim();
  }
  return join9(gitDir, "info", "exclude");
}
async function ensureLocalExclude(root, entries) {
  const file = await gitInfoExcludePath(root);
  if (!file) return null;
  ensureParentDir(file);
  const current = existsSync13(file) ? readFileSync6(file, "utf8") : "";
  const lines = new Set(current.split("\n").map((l) => l.trim()));
  const added = entries.filter((e) => !lines.has(e));
  if (added.length > 0) {
    const prefix2 = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    appendFileSync(file, `${prefix2}${added.map((e) => `${e}
`).join("")}`);
  }
  return { file, added };
}
async function removeLocalExclude(root, entries) {
  const file = await gitInfoExcludePath(root);
  if (!file || !existsSync13(file)) return null;
  const drop = new Set(entries);
  const kept = [];
  const removed = [];
  for (const line of readFileSync6(file, "utf8").split("\n")) {
    if (drop.has(line.trim())) removed.push(line.trim());
    else kept.push(line);
  }
  if (removed.length > 0) {
    writeFileSync5(file, kept.join("\n"));
  }
  return { file, added: removed };
}
function ensureGitignoreFallback(root, entries) {
  const file = join9(root, ".gitignore");
  const current = existsSync13(file) ? readFileSync6(file, "utf8") : "";
  const lines = new Set(current.split("\n").map((l) => l.trim()));
  const added = entries.filter((e) => !lines.has(e));
  if (added.length > 0) {
    const prefix2 = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    writeFileSync5(file, `${current}${prefix2}${added.map((e) => `${e}
`).join("")}`);
  }
  return { file, added };
}

// src/commands/init.ts
var EXCLUDE_ENTRIES = [".claude/", ".gor-mobile/", PROJECT_MARKER_NAME];
function machineReady() {
  if (!existsSync14(join10(GOR_MOBILE_TEMPLATES_DIR, "session-start-hook.sh"))) {
    return { ok: false, reason: "hook scripts not found in ~/.gor-mobile/templates" };
  }
  if (!readManifest()) {
    return { ok: false, reason: "rules pack not installed in ~/.gor-mobile/rules" };
  }
  return { ok: true };
}
function parsePlatformFlag(raw) {
  if (!raw) return null;
  const t = raw.trim().toLowerCase();
  if (t === "android" || t === "ios") return t;
  throw new Error(`unknown --platform '${raw}' (expected android or ios)`);
}
async function resolvePlatform(root, opts, marker) {
  const fromFlag = parsePlatformFlag(opts.platform);
  if (fromFlag) return fromFlag;
  if (marker.platform) return marker.platform;
  const detected = detectPlatform(root);
  if (detected) return detected;
  if (opts.yes || !isTuiOn()) {
    log.info("No build markers found \u2014 defaulting platform to android (override with --platform).");
    return "android";
  }
  const pick = await select2({
    message: "What platform is this project?",
    options: [
      { value: "android", label: "Android", hint: "Kotlin / Jetpack" },
      { value: "ios", label: "iOS", hint: "Swift (early support)" }
    ],
    initialValue: "android"
  });
  if (isCancel4(pick)) {
    cancel4("Cancelled");
    process.exit(130);
  }
  return pick;
}
async function ensureGit(root, opts) {
  if (findGitRoot(root)) return "git";
  if (opts.dryRun) return "none";
  const doInit = opts.yes ? true : await confirmStep("This folder is not a git repo. Run 'git init' now? (needed for local-only install)", true);
  if (doInit && await gitInit(root)) {
    log.ok("git init");
    return "git";
  }
  return "gitignore";
}
async function writeExcludes(root, mode) {
  if (mode === "none") return;
  if (mode === "git") {
    const res2 = await ensureLocalExclude(root, EXCLUDE_ENTRIES);
    if (res2 && res2.added.length > 0) log.ok(`Local ignore updated (${res2.file})`);
    else log.info("Local ignore already covers gor-mobile files");
    return;
  }
  const res = ensureGitignoreFallback(root, EXCLUDE_ENTRIES);
  if (res.added.length > 0) {
    log.warn(`No git repo \u2014 wrote ${res.added.join(", ")} to .gitignore (will be committed).`);
  }
}
async function cmdInit(opts = {}) {
  if (opts.noTui || opts.tui === false) forceNoTui();
  const ready = machineReady();
  if (!ready.ok && !opts.dryRun) {
    log.err(`Machine not set up: ${ready.reason}.`);
    log.info("Run 'gor-mobile setup' once per machine, then re-run 'gor-mobile init' here.");
    process.exit(1);
  }
  const root = process.cwd();
  const spec = projectClaudeSpec(root);
  const marker = readProjectMarker(root);
  const reinit = existsSync14(join10(root, PROJECT_MARKER_NAME));
  console.log("");
  console.log(pc8.bold(pc8.magenta(`gor-mobile init`)) + pc8.dim(`  \xB7  ${root}`));
  if (reinit) log.info("Existing install found \u2014 refreshing (idempotent re-init).");
  if (opts.dryRun) log.info("DRY RUN \u2014 no changes will be made");
  const platform = await resolvePlatform(root, opts, marker);
  log.info(`Platform: ${platform}`);
  if (opts.dryRun) {
    if (!ready.ok) {
      log.warn(`Machine not set up (${ready.reason}) \u2014 run 'gor-mobile setup' before a real init.`);
    }
    console.log("");
    for (const line of [
      `install skills \u2192 ${spec.skillsDir}`,
      `install agents \u2192 ${spec.agentsDir}`,
      `merge SessionStart + UserPromptSubmit + PreToolUse \u2192 ${spec.hooksFile}`,
      `disable ${SUPERPOWERS_KEY} in ${spec.hooksFile}` + (opts.plugins ? ` (+enable ${opts.plugins})` : ""),
      `enable ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} in ${spec.hooksFile}`,
      "android init \u2192 copy stock skill into .claude/skills, drop Claude-home copy",
      `write ${PROJECT_MARKER_NAME} (platform=${platform})`,
      `git exclude += ${EXCLUDE_ENTRIES.join(", ")}`
    ]) {
      console.log(`    ${pc8.dim("[dry-run]")} ${line}`);
    }
    return;
  }
  const gitMode = await ensureGit(root, opts);
  installSessionStartHook(spec);
  installUserPromptSubmitHook(spec);
  installAstIndexGuardHook(spec);
  log.ok(`Hooks \u2192 ${spec.hooksFile}`);
  const skills = installSkills(spec);
  log.ok(`${skills.installed.length} gor-mobile-* skills \u2192 ${spec.skillsDir}`);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${skills.missingPrefix.length} skill(s)`);
  }
  const agents = installAgents(spec);
  log.ok(`${agents.length} review agents \u2192 ${spec.agentsDir}`);
  const extraPlugins = (opts.plugins ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const managedPlugins = applyEnabledPlugins(spec.hooksFile, extraPlugins, [SUPERPOWERS_KEY]);
  log.ok(
    extraPlugins.length > 0 ? `Plugins: disabled superpowers, enabled ${extraPlugins.join(", ")}` : "Disabled duplicate superpowers plugin for this repo"
  );
  const clearContextEnabled = enableClearContextOnPlanAccept(spec.hooksFile);
  const managedSettings = clearContextEnabled ? [.../* @__PURE__ */ new Set([...marker.managed_settings ?? [], CLEAR_CONTEXT_ON_PLAN_ACCEPT])] : marker.managed_settings ?? [];
  if (clearContextEnabled) {
    log.ok(`Enabled ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} (plan-approval "clear context" option)`);
  }
  const android = await provisionProjectAndroidSkill(spec.skillsDir);
  if (android.installed) log.ok(`android-cli skill \u2192 ${spec.skillsDir}/android-cli/`);
  else if (!android.ran) log.warn("android CLI not on PATH \u2014 skipped android-cli skill (run 'gor-mobile setup')");
  else log.warn(`android-cli skill not placed: ${android.error ?? "stock skill missing"}`);
  if (platform === "android") noteAstIndex(root);
  const nextMarker = {
    ...marker,
    platform,
    version: GOR_MOBILE_VERSION,
    installed_at: opts.now ?? marker.installed_at ?? (/* @__PURE__ */ new Date()).toISOString().slice(0, 10),
    managed_plugins: managedPlugins,
    managed_settings: managedSettings
  };
  writeProjectMarker(root, nextMarker);
  log.ok(`Wrote ${PROJECT_MARKER_NAME}`);
  await writeExcludes(root, gitMode);
  outro(root, platform);
}
function noteAstIndex(root) {
  if (!astIndexPath()) return;
  if (existsSync14(join10(root, ".claude", "rules", "ast-index.md"))) return;
  note(
    [
      "ast-index CLI detected but this repo is not indexed yet. To enable the",
      "structural-search guard, run once inside Claude Code:",
      "  /ast-index:initialize-android",
      "It writes .claude/rules/ast-index.md and builds the index."
    ].join("\n"),
    "ast-index (optional)"
  );
}
function outro(root, platform) {
  console.log("");
  console.log(`  ${pc8.green("\u2713")} ${pc8.bold("gor-mobile initialized for this repo")}`);
  console.log("");
  console.log(pc8.bold("  Next steps:"));
  const steps = detectPlatform(root) === null ? [
    "Open Claude Code in this folder: claude",
    `Ask it to scaffold your ${platform} project \u2014 the brainstorming skill drives 'android' CLI.`
  ] : [
    "Open Claude Code in this folder: claude",
    "The SessionStart hook loads the gor-mobile workflow automatically."
  ];
  for (const s of steps) console.log(`    ${pc8.cyan(s)}`);
  console.log("");
}

// src/commands/migrate.ts
import pc9 from "picocolors";
import { confirm as confirm2, isCancel as isCancel5 } from "@clack/prompts";

// src/helpers/teardown.ts
import { existsSync as existsSync16, readdirSync as readdirSync6, readFileSync as readFileSync7, rmSync as rmSync4 } from "fs";
import { join as join11 } from "path";

// src/helpers/mcp-register.ts
import { existsSync as existsSync15 } from "fs";
function unregisterManaged() {
  if (!existsSync15(CLAUDE_MCP)) return;
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

// src/helpers/teardown.ts
function teardownUserTarget(target, opts = {}) {
  log.step(`Removing gor-mobile from ${target.label} (${target.home})`);
  removeSessionStartHook(target);
  removeUserPromptSubmitHook(target);
  removeAstIndexGuardHook(target);
  log.ok("Hooks removed");
  if (!opts.keepStatusLine) {
    if (target.statusLineKind === "claude-command") {
      removeStatusLine();
      log.ok("Status line removed (only if managed)");
    } else if (target.statusLineKind === "codex-config") {
      removeCodexStatusLine();
      log.ok("Codex status line removed (only if managed)");
    }
  }
  if (target.id === "claude") {
    cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  }
  if (existsSync16(target.skillsDir)) {
    for (const entry of readdirSync6(target.skillsDir)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync4(join11(target.skillsDir, entry), { recursive: true, force: true });
      }
    }
  }
  log.ok(`Skills removed (${target.skillsDir})`);
  if (existsSync16(target.agentsDir)) {
    const ext = `.${target.agentFormat}`;
    for (const entry of readdirSync6(target.agentsDir)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(ext)) {
        rmSync4(join11(target.agentsDir, entry), { force: true });
      }
    }
    if (target.id === "claude") {
      const legacyCr = join11(target.agentsDir, "code-reviewer.md");
      if (existsSync16(legacyCr)) {
        const head = readFileSync7(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
        if (/^name: code-reviewer/m.test(head)) {
          rmSync4(legacyCr);
        }
      }
    }
  }
  log.ok(`Agents removed (${target.agentsDir})`);
  if (target.supportsMcpPrune) {
    unregisterManaged();
    log.ok("Managed MCP entries removed");
  }
  if (target.instructionsFile) {
    removeManagedSection(target.instructionsFile);
    log.ok(`Managed instructions section cleaned (${target.instructionsFile})`);
  }
}

// src/commands/migrate.ts
async function cmdMigrate(opts = {}) {
  const legacy = legacyClaudeFootprint();
  if (legacy.length === 0) {
    log.ok("Nothing to migrate \u2014 no legacy v0.2.x install found in ~/.claude.");
    log.info("On a fresh machine: run 'gor-mobile setup', then 'gor-mobile init' in each mobile repo.");
    return;
  }
  const ids = /* @__PURE__ */ new Set(["claude", ...detectGorMobileTargets()]);
  const targets = targetSpecs([...ids]);
  console.error("");
  console.error(pc9.bold("gor-mobile migrate \u2014 legacy v0.2.x global install found:"));
  for (const f of legacy) console.error(`  \xB7 ${f.label} \u2192 ${f.path}`);
  for (const t of targets) {
    console.error(pc9.dim(`  will clear: ${t.label} (${t.home}) \u2014 hooks, skills, agents, managed section`));
  }
  console.error(pc9.dim("  keeps:  ~/.gor-mobile (rules pack) and the gor-mobile CLI"));
  console.error("");
  if (!opts.yes) {
    const proceed = await confirm2({
      message: "Remove the legacy global install now?",
      initialValue: true
    });
    if (isCancel5(proceed) || proceed !== true) {
      log.info("Aborted \u2014 nothing changed.");
      return;
    }
  }
  let removeStatusLines = false;
  const slManaged = statusLineState().managed || codexStatusLineState().managed;
  if (slManaged && !opts.yes) {
    const drop = await confirm2({
      message: "Also remove the gor-mobile status line?",
      initialValue: false
    });
    removeStatusLines = !isCancel5(drop) && drop === true;
  }
  for (const target of targets) {
    teardownUserTarget(target, { keepStatusLine: !removeStatusLines });
  }
  console.error("");
  log.ok("Legacy global install removed.");
  log.info("Next:");
  log.info("  1. gor-mobile setup          # once per machine");
  log.info("  2. gor-mobile init           # in each mobile repo");
}

// src/commands/doctor.ts
import { existsSync as existsSync17, mkdirSync as mkdirSync2, mkdtempSync, readFileSync as readFileSync8, readdirSync as readdirSync7, rmSync as rmSync5, writeFileSync as writeFileSync6 } from "fs";
import { tmpdir } from "os";
import { join as join12 } from "path";
import { execa as execa6 } from "execa";
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
  if (existsSync17(path)) {
    log.ok(`${label} \u2192 ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}
function checkHooks(target) {
  if (!existsSync17(target.hooksFile)) {
    log.warn(`No ${target.hooksFile}`);
    return;
  }
  for (const hookType of ["SessionStart", "UserPromptSubmit", "PreToolUse"]) {
    const n = countManagedHooks(hookType, target);
    if (n === 0) {
      log.warn(`${hookType} hook NOT registered \u2014 run 'gor-mobile repair'`);
    } else if (n > 1) {
      log.warn(`${hookType} has ${n} duplicate managed entries \u2014 run 'gor-mobile repair'`);
    } else {
      log.ok(`${hookType} hook registered`);
    }
  }
}
function checkInstructionsSection(target) {
  if (!existsSync17(target.instructionsFile)) {
    log.warn(`${target.instructionsFile} does not exist`);
    return;
  }
  if (readFileSync8(target.instructionsFile, "utf8").includes(SECTION_BEGIN)) {
    log.ok("managed instructions section present");
  } else {
    log.warn("managed instructions section missing \u2014 run 'gor-mobile repair'");
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
function checkCodexStatusLine() {
  const st = codexStatusLineState();
  if (st.managed) {
    log.ok("Status line: managed (tui.status_line in config.toml)");
  } else if (st.foreign) {
    log.info("Status line: custom (not managed by gor-mobile)");
  }
}
function checkRulesPack() {
  if (!existsSync17(GOR_MOBILE_RULES_DIR)) {
    log.warn(`Rules pack not installed (${GOR_MOBILE_RULES_DIR}) \u2014 run 'gor-mobile setup'`);
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
function checkHookTemplates() {
  const scripts = [
    "session-start-hook.sh",
    "user-prompt-submit-hook.sh",
    "ast-index-guard-hook.sh",
    "claude-md-snippet.md"
  ];
  let ok = true;
  for (const f of scripts) {
    if (!existsSync17(join12(GOR_MOBILE_TEMPLATES_DIR, f))) {
      ok = false;
      log.warn(`hook template missing: ${f} \u2014 run 'gor-mobile setup'`);
    }
  }
  if (ok) log.ok(`Hook scripts present (${GOR_MOBILE_TEMPLATES_DIR})`);
}
async function verboseHookEmulation(target) {
  const hooks = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"],
    ["ast-index-guard-hook.sh", "PreToolUse"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync17(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    const input = label === "PreToolUse" ? JSON.stringify({
      tool_name: "Grep",
      cwd: process.cwd(),
      tool_input: { pattern: "gor-mobile doctor probe" }
    }) : JSON.stringify({
      cwd: process.cwd(),
      session_id: "gor-mobile-doctor",
      prompt: "gor-mobile doctor"
    });
    const result = await execa6("bash", [path], {
      reject: false,
      input,
      env: {
        ...process.env,
        GORM_SKILLS_DIR: target.skillsDir
      }
    });
    if (result.exitCode !== 0) {
      log.warn(`[${label}] hook exited ${result.exitCode}:`);
      console.error(result.stdout || result.stderr);
      continue;
    }
    if (label === "PreToolUse") {
      log.ok(`[${label}] guard allows non-symbol probe (exit 0)`);
      const probeDir = mkdtempSync(join12(tmpdir(), "gorm-guard-probe-"));
      try {
        mkdirSync2(join12(probeDir, ".claude", "rules"), { recursive: true });
        writeFileSync6(join12(probeDir, ".claude", "rules", "ast-index.md"), "");
        const deny = await execa6("bash", [path], {
          reject: false,
          input: JSON.stringify({
            tool_name: "Grep",
            cwd: probeDir,
            tool_input: { pattern: "getFormatValue" }
          })
        });
        if (deny.exitCode === 2) {
          log.ok(`[${label}] guard denies structural probe (exit 2)`);
        } else {
          log.warn(
            `[${label}] guard is INERT \u2014 structural probe exited ${deny.exitCode}, expected 2 (jq or ast-index missing, or hook broken)`
          );
        }
      } finally {
        rmSync5(probeDir, { recursive: true, force: true });
      }
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
function verboseSkillsFrontmatter(target) {
  if (!existsSync17(target.skillsDir)) {
    log.warn(`${target.skillsDir} missing`);
    return;
  }
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync7(target.skillsDir)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join12(target.skillsDir, entry, "SKILL.md");
    if (!existsSync17(skillMd)) continue;
    count++;
    const content = readFileSync8(skillMd, "utf8");
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
    log.warn("android CLI version unreadable \u2014 run 'gor-mobile setup'");
    return;
  }
  if (smoke.missing.length > 0) {
    log.err(`android CLI missing contract commands: ${smoke.missing.join(", ")} \u2014 update gor-mobile`);
  } else if (smoke.belowFloor) {
    log.warn(`android CLI v${smoke.version} is below floor \u2014 run 'gor-mobile setup' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}
function verboseContractLint(target) {
  const skill = join12(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (!existsSync17(skill)) {
    log.warn("bridge skill missing \u2014 cannot lint contract");
    return;
  }
  const text = readFileSync8(skill, "utf8");
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
function checkTarget(target) {
  checkFile(target.hooksFile, target.hooksKind === "codex-hooks-json" ? "hooks.json" : "settings file");
  checkHooks(target);
  checkFile(target.agentsDir, "agents/");
  if (androidCliSkillInstalled(target.skillsDir)) {
    log.ok(`android-cli skill installed in ${target.skillsDir}`);
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const bridgePath = join12(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync17(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join12(target.skillsDir, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync17(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing \u2014 run 'gor-mobile repair'");
  }
  if (target.instructionsFile) checkInstructionsSection(target);
  if (target.statusLineKind === "claude-command") checkStatusLine();
  else if (target.statusLineKind === "codex-config") checkCodexStatusLine();
}
function checkProject(root) {
  const marker = readProjectMarker(root);
  log.ok(`.gor-mobile.json \u2192 platform=${marker.platform ?? "?"}, v${marker.version ?? "?"} (${root})`);
  if (marker.version && marker.version !== GOR_MOBILE_VERSION) {
    log.warn(`installed v${marker.version} \u2260 CLI v${GOR_MOBILE_VERSION} \u2014 run 'gor-mobile init' to refresh`);
  }
  const spec = projectClaudeSpec(root);
  checkTarget(spec);
  return spec;
}
async function cmdDoctor(opts = {}) {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), true);
  if (!androidCliPath()) {
    log.info("  \u2192 run 'gor-mobile setup' to install the android CLI (hard-mandatory)");
  } else {
    await checkAndroidContract();
  }
  reportDep("ast-index", astIndexPath(), false);
  if (!astIndexPath()) {
    log.info(
      "  \u2192 install: brew tap defendend/ast-index && brew install ast-index"
    );
  }
  reportDep("jq", which("jq"), false);
  if (!which("jq")) {
    log.info(
      "  \u2192 jq powers the status line AND the ast-index guard hook (guard fails open without it) \u2014 brew install jq"
    );
  }
  log.step("Machine (~/.gor-mobile)");
  checkHookTemplates();
  checkRulesPack();
  checkFile(GOR_MOBILE_CONFIG, "config.json");
  const emulationTargets = [];
  const root = findProjectRoot();
  log.step("Project (this repo)");
  if (root) {
    emulationTargets.push(checkProject(root));
  } else {
    log.info("No .gor-mobile.json in the current directory tree.");
    log.info("  \u2192 cd into a mobile repo and run 'gor-mobile init' to install the workflow.");
  }
  if (agentHomeExists("codex")) {
    log.step("Codex integration (user-level)");
    checkTarget(TARGETS.codex);
    emulationTargets.push(TARGETS.codex);
  }
  if (opts.verbose) {
    for (const target of emulationTargets) {
      log.step(`Hooks emulation (verbose) \u2014 ${target.label}`);
      await verboseHookEmulation(target);
      log.step(`Skills frontmatter (verbose) \u2014 ${target.label}`);
      verboseSkillsFrontmatter(target);
      verboseContractLint(target);
    }
  }
  console.error("");
  log.info("If anything is missing, run: gor-mobile repair (project + codex) or gor-mobile setup (machine).");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}

// src/commands/repair.ts
import { join as join13 } from "path";
function refreshHooks(target) {
  const ss = installSessionStartHook(target);
  log.ok(
    ss.collapsed > 1 ? `SessionStart hook refreshed (collapsed ${ss.collapsed} \u2192 1)` : "SessionStart hook refreshed"
  );
  const ups = installUserPromptSubmitHook(target);
  log.ok(
    ups.collapsed > 1 ? `UserPromptSubmit hook refreshed (collapsed ${ups.collapsed} \u2192 1)` : "UserPromptSubmit hook refreshed"
  );
  const guard = installAstIndexGuardHook(target);
  log.ok(
    guard.collapsed > 1 ? `PreToolUse guard hook refreshed (collapsed ${guard.collapsed} \u2192 1)` : "PreToolUse guard hook refreshed"
  );
}
async function repairProject(root) {
  const spec = projectClaudeSpec(root);
  log.step(`Repairing project (${spec.home})`);
  refreshHooks(spec);
  const skills = installSkills(spec);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s):`);
    for (const m of skills.missingPrefix) log.warn(`  ${m} (missing 'name: gor-mobile-' prefix)`);
  }
  log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs \u2192 ${spec.skillsDir})`);
  const agents = installAgents(spec);
  log.ok(`Agents refreshed (${agents.length} in ${spec.agentsDir})`);
  const android = await provisionProjectAndroidSkill(spec.skillsDir);
  if (android.installed) log.ok(`android-cli skill refreshed \u2192 ${spec.skillsDir}/android-cli/`);
  else if (!android.ran) log.info("android CLI not on PATH \u2014 skipped android-cli skill");
  else log.warn(`android-cli skill not placed: ${android.error ?? "stock skill missing"}`);
  applyEnabledPlugins(spec.hooksFile, [], [SUPERPOWERS_KEY]);
  log.ok("Duplicate superpowers plugin kept disabled for this repo");
  const marker = readProjectMarker(root);
  const enabledNow = enableClearContextOnPlanAccept(spec.hooksFile);
  const managedSettings = enabledNow ? [.../* @__PURE__ */ new Set([...marker.managed_settings ?? [], CLEAR_CONTEXT_ON_PLAN_ACCEPT])] : marker.managed_settings ?? [];
  if (enabledNow) log.ok(`Enabled ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} (plan-approval "clear context" option)`);
  writeProjectMarker(root, { ...marker, version: GOR_MOBILE_VERSION, managed_settings: managedSettings });
  log.ok(`Marker refreshed (v${GOR_MOBILE_VERSION})`);
}
async function repairCodex(target) {
  log.step(`Repairing ${target.label} (${target.home})`);
  refreshHooks(target);
  if (target.statusLineKind === "codex-config" && codexStatusLineState().managed) {
    installCodexStatusLine({ force: true });
    log.ok("Codex status line refreshed (tui.status_line)");
  }
  const skills = installSkills(target);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s)`);
  }
  log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs \u2192 ${target.skillsDir})`);
  const agents = installAgents(target);
  log.ok(`Agents refreshed (${agents.length} in ${target.agentsDir})`);
  const androidRes = await runAndroidInit(target);
  if (!androidRes.ran) log.info("android CLI not on PATH \u2014 skipping 'android init'");
  else if (androidRes.skillInstalled) log.ok("android-cli skill refreshed via 'android init'");
  else if (androidRes.error) log.warn(`'android init' failed: ${androidRes.error}`);
  writeManagedSection(target.instructionsFile, join13(gorMobileRoot(), "templates", target.instructionsSnippet));
  log.ok(`Managed instructions section refreshed (${target.instructionsFile})`);
}
async function cmdRepair(opts = {}) {
  copyHookTemplates();
  log.ok("Hook scripts refreshed \u2192 ~/.gor-mobile/templates");
  for (const f of cleanupLegacyCommands(CLAUDE_COMMANDS_DIR)) log.ok(`Removed legacy command ${f}`);
  for (const f of cleanupLegacyAgents()) log.ok(`Removed legacy agent ${f}`);
  const sl = statusLineState();
  if (sl.managed && sl.variant) {
    installStatusLine(sl.variant, { force: true });
    log.ok(`Claude status line (${sl.variant === "cat" ? "Cat" : "Classic"}) refreshed`);
  }
  const root = findProjectRoot();
  if (root) {
    await repairProject(root);
  } else {
    log.info("Not inside a gor-mobile repo \u2014 skipped project refresh (cd into one and run 'gor-mobile init').");
  }
  if (agentHomeExists("codex")) {
    await repairCodex(TARGETS.codex);
  }
  await ensureAndroidCliCurrent({ skip: opts.skipAndroidUpdate });
  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}

// src/commands/uninstall.ts
import { existsSync as existsSync18, readdirSync as readdirSync8, rmdirSync, rmSync as rmSync6 } from "fs";
import { join as join14 } from "path";
import { confirm as confirm3, isCancel as isCancel6, select as select3 } from "@clack/prompts";
var EXCLUDE_ENTRIES2 = [".claude/", ".gor-mobile/", PROJECT_MARKER_NAME];
async function resolveMode(opts) {
  if (opts.machine) return "machine";
  if (opts.project) return "project";
  if (opts.yes || !isTuiOn()) return "machine";
  const pick = await select3({
    message: "What do you want to remove?",
    options: [
      { value: "project", label: "This repo", hint: ".claude footprint + .gor-mobile.json" },
      { value: "machine", label: "The whole machine", hint: "user homes + ~/.gor-mobile + rules" }
    ]
  });
  if (isCancel6(pick)) return null;
  return pick;
}
function rmdirIfEmpty(dir) {
  try {
    if (existsSync18(dir) && readdirSync8(dir).length === 0) rmdirSync(dir);
  } catch {
  }
}
async function uninstallProject(opts) {
  const root = findProjectRoot() ?? process.cwd();
  if (!existsSync18(join14(root, PROJECT_MARKER_NAME))) {
    log.info(`No gor-mobile project install here (${PROJECT_MARKER_NAME} not found in ${root}).`);
    return;
  }
  if (!opts.yes) {
    const proceed = await confirm3({
      message: `Remove the gor-mobile footprint from this repo (${root})?`,
      initialValue: false
    });
    if (isCancel6(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }
  const spec = projectClaudeSpec(root);
  const marker = readProjectMarker(root);
  removeSessionStartHook(spec);
  removeUserPromptSubmitHook(spec);
  removeAstIndexGuardHook(spec);
  removeEnabledPlugins(spec.hooksFile, marker.managed_plugins ?? [SUPERPOWERS_KEY]);
  if ((marker.managed_settings ?? []).includes(CLEAR_CONTEXT_ON_PLAN_ACCEPT)) {
    removeClearContextOnPlanAccept(spec.hooksFile);
  }
  log.ok(`Hooks + plugin overrides removed (${spec.hooksFile})`);
  if (existsSync18(spec.skillsDir)) {
    for (const entry of readdirSync8(spec.skillsDir)) {
      if (entry.startsWith("gor-mobile-") || entry === "android-cli") {
        rmSync6(join14(spec.skillsDir, entry), { recursive: true, force: true });
      }
    }
    rmdirIfEmpty(spec.skillsDir);
  }
  log.ok(`Skills removed (${spec.skillsDir})`);
  if (existsSync18(spec.agentsDir)) {
    for (const entry of readdirSync8(spec.agentsDir)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync6(join14(spec.agentsDir, entry), { force: true });
      }
    }
    rmdirIfEmpty(spec.agentsDir);
  }
  log.ok(`Agents removed (${spec.agentsDir})`);
  rmSync6(join14(root, PROJECT_MARKER_NAME), { force: true });
  log.ok(`Removed ${PROJECT_MARKER_NAME}`);
  const excl = await removeLocalExclude(root, EXCLUDE_ENTRIES2);
  if (excl && excl.added.length > 0) log.ok(`Local ignore cleaned (${excl.file})`);
  log.ok("gor-mobile removed from this repo. Run 'gor-mobile uninstall --machine' to remove the machine-level install too.");
}
async function uninstallMachine(opts) {
  if (!opts.yes) {
    const proceed = await confirm3({
      message: "Remove gor-mobile from all user agent homes plus templates, rules pack, and config?",
      initialValue: false
    });
    if (isCancel6(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }
  const detected = detectInstalledTargets();
  const targets = targetSpecs(detected.length > 0 ? detected : ["claude"]);
  for (const target of targets) {
    teardownUserTarget(target);
  }
  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync18(GOR_MOBILE_HOME)) {
    rmSync6(GOR_MOBILE_HOME, { recursive: true, force: true });
  }
  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync18(GOR_MOBILE_CONFIG)) rmSync6(GOR_MOBILE_CONFIG);
  rmdirIfEmpty(GOR_MOBILE_CONFIG_DIR);
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
  log.info("Per-repo footprints (.claude, .gor-mobile.json) stay put \u2014 run 'gor-mobile uninstall --project' inside each.");
}
async function cmdUninstall(opts = {}) {
  const mode = await resolveMode(opts);
  if (!mode) {
    log.info("Aborted");
    return;
  }
  if (mode === "project") await uninstallProject(opts);
  else await uninstallMachine(opts);
}

// src/commands/rules.ts
import { existsSync as existsSync19, rmSync as rmSync7 } from "fs";
async function rulesList() {
  if (!existsSync19(GOR_MOBILE_RULES_DIR)) {
    log.warn("No rules pack installed. Run: gor-mobile rules use <url>");
    return;
  }
  const m = readManifest();
  const cfg = existsSync19(GOR_MOBILE_CONFIG) ? readConfig() : {};
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
  if (existsSync19(GOR_MOBILE_RULES_DIR)) {
    log.info(`Backing up existing pack to ${backup}`);
    if (existsSync19(backup)) rmSync7(backup, { recursive: true, force: true });
    const { renameSync } = await import("fs");
    renameSync(GOR_MOBILE_RULES_DIR, backup);
  }
  try {
    if (existsSync19(target)) {
      log.info(`Copying local pack from ${target}`);
      copyFromLocal(target);
    } else {
      log.info(`Cloning ${target}`);
      await cloneOrPull(target, DEFAULT_RULES_REF);
    }
  } catch (err) {
    log.err(`Install failed \u2014 restoring backup: ${err.message}`);
    if (existsSync19(GOR_MOBILE_RULES_DIR)) {
      rmSync7(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
    }
    if (existsSync19(backup)) {
      const { renameSync } = await import("fs");
      renameSync(backup, GOR_MOBILE_RULES_DIR);
    }
    process.exitCode = 1;
    return;
  }
  saveConfig(target);
  log.ok(`Rules pack installed at ${GOR_MOBILE_RULES_DIR}`);
  if (existsSync19(backup)) rmSync7(backup, { recursive: true, force: true });
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
import { execa as execa7 } from "execa";
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
    const res = await execa7(cli, ["docs", q], { stdio: "inherit", reject: false });
    if (res.exitCode === 0) return;
    log.warn("android docs returned nothing; falling back to web search");
  }
  const encoded = encodeURIComponent(q);
  console.log(`Native android docs unavailable for this query.`);
  console.log(``);
  console.log(`Open: https://developer.android.com/search?q=${encoded}`);
}

// src/commands/self-update.ts
import { existsSync as existsSync20 } from "fs";
import { join as join15 } from "path";
import { execa as execa8 } from "execa";
function noteMigration() {
  if (legacyClaudeFootprint().length === 0) return;
  log.warn("A legacy v0.2.x global install remains in ~/.claude.");
  log.info("Migrate it: gor-mobile migrate \u2192 gor-mobile setup \u2192 gor-mobile init (per repo). See CHANGELOG 0.3.0.");
}
async function cmdSelfUpdate() {
  const root = gorMobileRoot();
  if (existsSync20(join15(root, ".git"))) {
    log.step(`git pull in ${root}`);
    await execa8("git", ["-C", root, "pull", "--ff-only"], { stdio: "inherit" });
    log.step("npm install");
    await execa8("npm", ["install", "--production=false"], { cwd: root, stdio: "inherit" });
    log.step("npm run build");
    await execa8("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    log.ok("CLI updated");
    noteMigration();
    return;
  }
  if (has("brew")) {
    const res = await execa8("brew", ["list", "gor-mobile"], { reject: false });
    if (res.exitCode === 0) {
      log.info("Brew-managed install \u2014 use: brew upgrade gor-mobile");
      noteMigration();
      return;
    }
  }
  log.warn("Unable to self-update: not a git repo and not a brew install.");
  log.info(
    "Reinstall via: curl -fsSL https://raw.githubusercontent.com/gorban-dev/gor-mobile/main/install.sh | bash"
  );
}

// src/commands/android.ts
import { existsSync as existsSync21 } from "fs";
import { execa as execa9 } from "execa";
async function cmdAndroid(args) {
  const cli = androidCliPath();
  if (cli) {
    const res = await execa9(cli, args, { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }
  const first = args[0];
  if (first && ["build", "assemble", "assembleDebug", "assembleRelease"].includes(first) && existsSync21("./gradlew")) {
    log.info(`Falling back to ./gradlew ${first}`);
    const res = await execa9("./gradlew", [first], { stdio: "inherit", reject: false });
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
import { existsSync as existsSync22 } from "fs";
import { join as join16 } from "path";
import { cancel as cancel5, isCancel as isCancel7, multiselect, spinner } from "@clack/prompts";
function isInstalled(name) {
  return existsSync22(join16(CLAUDE_SKILLS_DIR, name, "SKILL.md"));
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
    cancel5("Cancelled");
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
import { existsSync as existsSync23 } from "fs";
import { join as join17 } from "path";
import { execa as execa10 } from "execa";
async function cmdUpdate() {
  log.step("Updating rules pack");
  if (existsSync23(join17(GOR_MOBILE_RULES_DIR, ".git"))) {
    const res = await execa10(
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
    const list = await execa10("brew", ["list", "gor-mobile"], { reject: false });
    if (list.exitCode === 0) {
      log.step("Checking for brew update");
      await execa10("brew", ["update"], { reject: false });
      const info = await execa10("brew", ["info", "--json=v2", "gor-mobile"], { reject: false });
      const versions = await execa10("brew", ["list", "--versions", "gor-mobile"], { reject: false });
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
  log.step("Repairing managed files");
  await cmdRepair();
}

// src/cli.ts
var program = new Command();
var LEGACY_BLOCK = /* @__PURE__ */ new Set(["init", "doctor", "repair", "update"]);
var LEGACY_EXEMPT = /* @__PURE__ */ new Set(["version", "migrate", "uninstall", "setup"]);
program.name("gor-mobile").description("Android-aware Claude Code / Codex workflow \u2014 machine setup + per-project install").version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");
program.hook("preAction", (_thisCommand, actionCommand) => {
  const name = actionCommand.name();
  if (LEGACY_EXEMPT.has(name)) return;
  const block = LEGACY_BLOCK.has(name);
  if (legacyGate({ block }) && block) process.exit(1);
});
program.command("version").description("Print version").action(() => {
  console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
});
program.command("setup").description("Machine setup (once): android CLI, ast-index, rules pack, hook scripts, Codex").option("--dry-run", "print planned actions; no filesystem changes").option("-y, --yes", "assume yes to all prompts (non-interactive)").option("--no-tui", "force plain-text prompts").option("--advanced", "confirm each step and allow URL override").option("--rules <url>", "custom rules-pack git URL").option("--skip-android-update", "do not auto-update the Android CLI").option("--target <targets>", "user-level agents to set up (codex)").action(async (opts) => {
  await cmdSetup(opts);
});
program.command("init").description("Install the gor-mobile workflow into the current repo (per-project)").option("--dry-run", "print planned actions; no filesystem changes").option("-y, --yes", "assume yes to all prompts (non-interactive)").option("--no-tui", "force plain-text prompts").option("--platform <platform>", "android or ios (skip detection/prompt)").option("--plugins <list>", "comma-separated extra plugins to enable (figma,swagger-android,\u2026)").action(async (opts) => {
  await cmdInit(opts);
});
program.command("migrate").description("Remove a legacy v0.2.x global install (keeps the rules pack)").option("-y, --yes", "skip confirmation").action(async (opts) => {
  await cmdMigrate(opts);
});
program.command("doctor").description("Check machine setup, the current project, and Codex").option("-v, --verbose", "dump hook payload + skill frontmatter").action(async (opts) => {
  await cmdDoctor(opts);
});
program.command("repair").description("Refresh managed files: machine hook scripts, this project, and Codex").option("--skip-android-update", "do not auto-update the Android CLI").action(async (opts) => {
  await cmdRepair(opts);
});
program.command("android-skills").description("Browse + install/remove optional Google Android CLI skills").action(async () => {
  await cmdAndroidSkills();
});
program.command("update").description("Pull latest rules, then repair managed files (also updates the Android CLI)").action(async () => {
  await cmdUpdate();
});
program.command("self-update").description("Update the CLI itself (curl-install path)").action(async () => {
  await cmdSelfUpdate();
});
program.command("uninstall").description("Remove gor-mobile \u2014 from this repo (--project) or the whole machine (--machine)").option("-y, --yes", "skip confirmation").option("--project", "remove only this repo's .claude footprint + .gor-mobile.json").option("--machine", "remove user agent homes + ~/.gor-mobile (templates, rules)").action(async (opts) => {
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