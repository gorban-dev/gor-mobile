// src/cli.ts
import { Command } from "commander";

// src/constants.ts
import { homedir } from "os";
import { join, resolve, dirname } from "path";
import { fileURLToPath } from "url";
var GOR_MOBILE_VERSION = "0.2.8";
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
import { existsSync as existsSync11, readdirSync as readdirSync3 } from "fs";
import { join as join7 } from "path";
import { execa as execa4 } from "execa";
import pc8 from "picocolors";
import { cancel as cancel6, isCancel as isCancel6 } from "@clack/prompts";

// src/helpers/android-cli.ts
import { accessSync as accessSync2, constants as constants2, existsSync as existsSync4, rmSync } from "fs";
import { homedir as homedir2 } from "os";
import { dirname as dirname3, join as join3 } from "path";
import { execa as execa2 } from "execa";

// src/targets.ts
import { existsSync as existsSync3, readdirSync } from "fs";

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
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh"
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
function countManagedHooks(hookType, target) {
  const settings = readJsonSafe(target.hooksFile, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.filter((e) => isManagedEntry(e, hookType)).length;
}
function hasManagedHooksInFile(hooksFile) {
  const settings = readJsonSafe(hooksFile, {});
  for (const hookType of ["SessionStart", "UserPromptSubmit"]) {
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
    home: CLAUDE_DIR,
    skillsDir: CLAUDE_SKILLS_DIR,
    agentsDir: CLAUDE_AGENTS_DIR,
    instructionsFile: CLAUDE_CLAUDE_MD,
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
    home: CODEX_DIR,
    skillsDir: CODEX_SKILLS_DIR,
    agentsDir: CODEX_AGENTS_DIR,
    instructionsFile: CODEX_AGENTS_MD,
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
  return join3(skillsDir, "android-cli", "SKILL.md");
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
    join3(homedir2(), ".android", "bin", "android-cli"),
    join3(homedir2(), ".android", "cli"),
    // `android init` may have dropped the stock skill into any target's folder.
    ...ALL_TARGET_IDS.map((id) => join3(TARGETS[id].skillsDir, "android-cli"))
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
  existsSync as existsSync6,
  readdirSync as readdirSync2,
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
  if (existsSync6(stale)) rmSync2(stale);
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
      rmSync2(join4(target.skillsDir, entry), { recursive: true, force: true });
    }
  }
  const root = gorMobileRoot();
  const skillsDir = join4(root, "templates", "skills");
  const overlaysDir = join4(root, "templates", "overlays");
  const installed = [];
  const missingPrefix = [];
  if (!existsSync6(skillsDir)) return { installed, missingPrefix };
  for (const name of readdirSync2(skillsDir)) {
    const srcDir = join4(skillsDir, name);
    if (!statSync(srcDir).isDirectory()) continue;
    const dstDir = join4(target.skillsDir, `gor-mobile-${name}`);
    cpSync(srcDir, dstDir, { recursive: true });
    const skillMd = join4(dstDir, "SKILL.md");
    if (existsSync6(skillMd)) {
      let body = transformSkillBody(readFileSync3(skillMd, "utf8"));
      const overlayPath = join4(overlaysDir, `${name}.md`);
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
  const src = join4(gorMobileRoot(), "templates", srcSub);
  const copied = [];
  if (!existsSync6(src)) return copied;
  for (const name of readdirSync2(src)) {
    if (!name.endsWith(ext)) continue;
    const from = join4(src, name);
    const to = join4(target.agentsDir, name);
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
    const file = join4(commandsDir, `${cmd}.md`);
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
  const advisor = join4(CLAUDE_AGENTS_DIR, "gor-mobile-advisor.md");
  if (existsSync6(advisor)) {
    rmSync2(advisor);
    removed.push(basename(advisor));
  }
  const legacyCr = join4(CLAUDE_AGENTS_DIR, "code-reviewer.md");
  if (existsSync6(legacyCr)) {
    const head = readFileSync3(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
    if (/^name: code-reviewer/m.test(head)) {
      rmSync2(legacyCr);
      removed.push(basename(legacyCr));
    }
  }
  return removed;
}

// src/helpers/rules-pack.ts
import { existsSync as existsSync7, cpSync as cpSync2, rmSync as rmSync3 } from "fs";
import { join as join5 } from "path";
import { execa as execa3 } from "execa";
function manifestPath() {
  return join5(GOR_MOBILE_RULES_DIR, "manifest.json");
}
function readManifest() {
  if (!existsSync7(manifestPath())) return null;
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
  if (existsSync7(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
    await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
      reject: false
    });
    return;
  }
  if (existsSync7(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  ensureDir(join5(GOR_MOBILE_RULES_DIR, ".."));
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
  if (existsSync7(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync2(source, GOR_MOBILE_RULES_DIR, { recursive: true });
}
function fallbackToBundled(bundledRoot) {
  if (existsSync7(GOR_MOBILE_RULES_DIR)) {
    rmSync3(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync2(bundledRoot, GOR_MOBILE_RULES_DIR, { recursive: true });
}
async function pullCurrent() {
  if (!existsSync7(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout \u2014 cannot pull");
  }
  await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
    stdio: "inherit"
  });
}
async function diffAgainstUpstream() {
  if (!existsSync7(join5(GOR_MOBILE_RULES_DIR, ".git"))) {
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
      if (!existsSync7(join5(GOR_MOBILE_RULES_DIR, rel))) {
        errors.push(`missing rule file: ${rel}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, manifest: m };
}
async function gitBranchAndRev() {
  if (!existsSync7(join5(GOR_MOBILE_RULES_DIR, ".git"))) return {};
  const branch = await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  const rev = await execa3("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--short", "HEAD"], { reject: false });
  return { branch: branch.stdout.trim(), rev: rev.stdout.trim() };
}

// src/ui/target-select.ts
import { cancel, isCancel, multiselect } from "@clack/prompts";

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

// src/ui/target-select.ts
async function resolveTargets(opts) {
  if (opts.target) {
    return targetSpecs(parseTargetFlag(opts.target));
  }
  const detected = detectInstalledTargets();
  const fallback = detected.length > 0 ? detected : ["claude"];
  if (opts.yes || !isTuiOn()) {
    if (detected.length > 0) {
      log.info(`Targets auto-detected: ${detected.join(", ")}`);
    } else {
      log.info("No agent homes detected \u2014 defaulting to claude");
    }
    return targetSpecs(fallback);
  }
  const picked = await multiselect({
    message: "Which agents should gor-mobile install into?",
    options: [
      { value: "claude", label: TARGETS.claude.label, hint: TARGETS.claude.home },
      { value: "codex", label: TARGETS.codex.label, hint: TARGETS.codex.home }
    ],
    initialValues: fallback,
    required: true
  });
  if (isCancel(picked)) {
    cancel("Cancelled");
    process.exit(130);
  }
  return targetSpecs(picked);
}

// src/ui/confirm-step.ts
import { confirm, isCancel as isCancel2, cancel as cancel2 } from "@clack/prompts";
async function confirmStep(message, fallback = true) {
  if (!isTuiOn()) return fallback;
  const res = await confirm({ message, initialValue: fallback });
  if (isCancel2(res)) {
    cancel2("Cancelled");
    process.exit(0);
  }
  return res === true;
}
async function textPrompt(message, initial, validate) {
  if (!isTuiOn()) return initial;
  const { text } = await import("@clack/prompts");
  const res = await text({ message, initialValue: initial, validate });
  if (isCancel2(res)) {
    cancel2("Cancelled");
    process.exit(0);
  }
  return String(res);
}

// src/ui/mode-select.ts
import { select, isCancel as isCancel3, cancel as cancel3 } from "@clack/prompts";
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
  if (isCancel3(pick)) {
    cancel3("Cancelled");
    process.exit(0);
  }
  return pick;
}

// src/ui/note.ts
import { note as clackNote } from "@clack/prompts";
import pc2 from "picocolors";
function note(body, title) {
  if (isTuiOn()) {
    clackNote(body, title);
    return;
  }
  if (title) {
    console.log("");
    console.log(pc2.bold(title));
  }
  for (const line of body.split("\n")) {
    console.log(`  ${line}`);
  }
  console.log("");
}

// src/ui/outro.ts
import pc3 from "picocolors";
var NEXT_STEPS = [
  "gor-mobile doctor           verify setup",
  "gor-mobile rules list       inspect installed architecture rules",
  "cd <android-project>        open Claude Code; the session-start hook loads workflow"
];
function finalOutro(s) {
  const summary = `Installed: ${s.skills} skills \xB7 ${s.agents} agents \xB7 ${s.hooks} hooks \xB7 rules v${s.rulesVersion}`;
  console.log("");
  console.log(`  ${pc3.green("\u2713")} ${pc3.bold(summary)}`);
  console.log("");
  console.log(pc3.bold("  Next steps:"));
  for (const n of NEXT_STEPS) console.log(`    ${pc3.cyan(n)}`);
  console.log("");
}

// src/ui/progress.ts
import pc4 from "picocolors";
var SYMBOLS = {
  ok: pc4.green("\u2713"),
  fail: pc4.red("\u2717"),
  warn: pc4.yellow("!"),
  skip: pc4.dim("\u25CB")
};
function pad(n, total) {
  const width = String(total).length;
  return String(n).padStart(width, " ");
}
function progressItem(i, total, label, status, note2) {
  const prefix2 = pc4.dim(`(${pad(i, total)}/${total})`);
  const suffix = note2 ? pc4.dim(` ${note2}`) : "";
  console.log(`    ${prefix2}  ${label.padEnd(38)} ${SYMBOLS[status]}${suffix}`);
}

// src/ui/section-header.ts
import pc5 from "picocolors";
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
  const sep = pc5.dim(" \u203A ");
  return labels.map((label, i) => {
    const step = i + 1;
    if (step < current) return pc5.green(`\u2713 ${label}`);
    if (step === current) return pc5.bold(pc5.magenta(`\u25B8 ${label}`));
    return pc5.dim(label);
  }).join(sep);
}
function sectionHeader(n, total, title) {
  console.log("");
  const labels = STEP_LABELS.length === total ? STEP_LABELS : Array.from({ length: total }, (_, i) => String(i + 1));
  console.log(`  ${breadcrumb(n, labels)}`);
  const lead = pc5.bold(pc5.magenta(`${n}/${total}`));
  console.log(`  ${lead}  ${pc5.bold(title)}`);
}

// src/ui/welcome.ts
import { confirm as confirm2, isCancel as isCancel4, cancel as cancel4 } from "@clack/prompts";
import pc7 from "picocolors";

// src/ui/banner.ts
import { existsSync as existsSync8, readFileSync as readFileSync4 } from "fs";
import { join as join6 } from "path";
import pc6 from "picocolors";
function renderBanner() {
  const path = join6(gorMobileRoot(), "templates", "banner.txt");
  if (existsSync8(path)) {
    const raw = readFileSync4(path, "utf8");
    const trimmed = raw.replace(/\n+$/, "");
    const colored = trimmed.split("\n").map((line) => pc6.magenta(line)).join("\n");
    console.log("");
    console.log(colored);
  } else {
    console.log("");
    console.log(pc6.bold(pc6.magenta("GOR-MOBILE")));
  }
  const subtitle = `Android-aware overlay installer for Claude Code  \xB7  v${GOR_MOBILE_VERSION}`;
  console.log(pc6.dim(subtitle));
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
  console.log(pc7.bold("  What will happen:"));
  for (const b of BULLETS) console.log(`    ${pc7.dim("\u2022")} ${b}`);
  console.log("");
  if (skip || !isTuiOn()) return;
  const proceed = await confirm2({
    message: "Ready to start?",
    initialValue: true
  });
  if (isCancel4(proceed) || proceed !== true) {
    cancel4("Cancelled");
    process.exit(0);
  }
}

// src/ui/statusline-select.ts
import { select as select2, isCancel as isCancel5, cancel as cancel5 } from "@clack/prompts";
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
  if (isCancel5(pick)) {
    cancel5("Cancelled");
    process.exit(0);
  }
  return pick;
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
import { existsSync as existsSync10, readFileSync as readFileSync5, writeFileSync as writeFileSync4 } from "fs";
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
  return existsSync10(CODEX_CONFIG_TOML) ? readFileSync5(CODEX_CONFIG_TOML, "utf8") : "";
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

// src/commands/init.ts
var GLOBAL_STEPS = 4;
function dryLog(msg) {
  console.log(`    ${pc8.dim("[dry-run]")} ${msg}`);
}
function totalSteps(ctx) {
  return GLOBAL_STEPS + ctx.targets.length + 1;
}
function runStep(ctx, stepNum, title) {
  sectionHeader(stepNum, totalSteps(ctx), title);
}
async function step1Deps(ctx) {
  runStep(ctx, 1, "Base dependencies");
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
async function step2AndroidBinary(ctx) {
  runStep(ctx, 2, "Google Android CLI");
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
    "  adb/gradle directly. It also ships a skill (via `android init`)",
    "  into each agent's skills folder.",
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
    progressItem(1, 1, "android CLI", "skip", `dry-run: ${displayCmd}`);
    return;
  }
  const install = ctx.opts.yes ? true : await confirmStep("Install the Android CLI now? (required to continue)", true);
  if (!install) {
    progressItem(1, 1, "android CLI", "fail", "declined \u2014 gor-mobile requires the Android CLI");
    throw new Error("user declined Android CLI install \u2014 gor-mobile cannot continue");
  }
  let res = process.platform === "darwin" && which("brew") !== null ? await installAndroidCliViaBrew() : { installed: false, error: void 0 };
  if (!res.installed) {
    res = await installAndroidCli();
  }
  if (!res.installed) {
    progressItem(1, 1, "android CLI", "fail", res.error ?? "install failed");
    throw new Error(`Android CLI install failed: ${res.error ?? "unknown error"}`);
  }
  progressItem(1, 1, "android CLI", "ok", androidCliPath() ?? "installed");
  await ensureAndroidCliCurrent({
    skip: ctx.opts.skipAndroidUpdate,
    dryRun: ctx.opts.dryRun
  });
}
async function step3AstIndex(ctx) {
  runStep(ctx, 3, "ast-index CLI (code search)");
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
  runStep(ctx, 4, "Rules pack");
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
  const alreadyCloned = existsSync11(join7(GOR_MOBILE_RULES_DIR, ".git"));
  if (alreadyCloned) {
    await execa4("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], { reject: false });
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
function templateSkillCount() {
  const src = join7(gorMobileRoot(), "templates", "skills");
  return existsSync11(src) ? readdirSync3(src).filter((n) => !n.startsWith(".")).length : 0;
}
function templateAgentCount(target) {
  const sub = target.agentFormat === "toml" ? "agents-codex" : "agents";
  const src = join7(gorMobileRoot(), "templates", sub);
  return existsSync11(src) ? readdirSync3(src).filter((f) => f.endsWith(`.${target.agentFormat}`)).length : 0;
}
async function statusLineFor(ctx, idx, total) {
  const choice = await statusLineSelect(Boolean(ctx.opts.yes));
  if (choice === "skip") {
    progressItem(idx, total, "status line", "skip", "not installed");
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
      progressItem(idx, total, "status line", "skip", "kept your existing statusLine");
      return;
    }
  }
  installStatusLine(choice, { force });
  const label = choice === "cat" ? "Cat" : "Classic";
  progressItem(idx, total, "status line", "ok", label);
}
async function codexStatusLineFor(ctx, idx, total) {
  if (ctx.opts.yes || !isTuiOn()) {
    progressItem(idx, total, "status line", "skip", "non-interactive");
    return;
  }
  const st = codexStatusLineState();
  if (st.foreign) {
    const replace = await confirmStep(
      "~/.codex/config.toml already has a status_line. Replace it with the gor-mobile default?",
      false
    );
    if (!replace) {
      progressItem(idx, total, "status line", "skip", "kept your existing status_line");
      return;
    }
    installCodexStatusLine({ force: true });
    progressItem(idx, total, "status line", "ok", "replaced in config.toml");
    return;
  }
  const install = await confirmStep(
    "Install the recommended Codex status line (model \xB7 context \xB7 usage limits \xB7 task)?",
    true
  );
  if (!install) {
    progressItem(idx, total, "status line", "skip", "not installed");
    return;
  }
  installCodexStatusLine();
  progressItem(idx, total, "status line", "ok", CODEX_CONFIG_TOML);
}
async function targetSection(ctx, target, stepNum) {
  runStep(ctx, stepNum, `${target.label} integration`);
  const counts = { skills: 0, agents: 0, hooks: 0 };
  ctx.perTarget.set(target.id, counts);
  const steps = target.supportsStatusLine ? 6 : 5;
  if (ctx.opts.dryRun) {
    dryLog(`merge SessionStart + UserPromptSubmit \u2192 ${target.hooksFile}`);
    dryLog(`install ${templateSkillCount()} skills \u2192 ${target.skillsDir}`);
    dryLog(`install agents (${target.agentFormat}) \u2192 ${target.agentsDir}`);
    dryLog(`write managed section \u2192 ${target.instructionsFile}`);
    dryLog("android init (stock android-cli skill for detected agents)");
    if (target.statusLineKind === "claude-command") {
      showStatusLinePreviews();
      dryLog("status line: choose Classic / Cat / Skip");
    } else if (target.statusLineKind === "codex-config") {
      dryLog(`status line: tui.status_line = [${CODEX_STATUS_LINE_ITEMS.join(", ")}]`);
    }
    counts.hooks = 2;
    counts.skills = templateSkillCount();
    counts.agents = templateAgentCount(target);
    return;
  }
  installSessionStartHook(target);
  installUserPromptSubmitHook(target);
  counts.hooks = 2;
  progressItem(1, steps, "hooks (SessionStart + UserPromptSubmit)", "ok", target.hooksFile);
  if (target.id === "claude") cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  const skillsRes = installSkills(target);
  counts.skills = skillsRes.installed.length;
  if (skillsRes.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite issues in ${skillsRes.missingPrefix.length} skill(s)`);
  }
  progressItem(
    2,
    steps,
    `${counts.skills} gor-mobile-* skills`,
    skillsRes.missingPrefix.length > 0 ? "warn" : "ok",
    target.skillsDir
  );
  if (target.id === "claude") cleanupLegacyAgents();
  const agents = installAgents(target);
  counts.agents = agents.length;
  progressItem(3, steps, `${counts.agents} review agents (${target.agentFormat})`, "ok", target.agentsDir);
  writeManagedSection(target.instructionsFile, join7(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  progressItem(4, steps, "managed instructions section", "ok", target.instructionsFile);
  const androidRes = await runAndroidInit(target);
  if (androidRes.ran && androidRes.skillInstalled) {
    ctx.androidInitRan = true;
    progressItem(5, steps, "android init (android-cli skill)", "ok", `${target.skillsDir}/android-cli/`);
  } else if (!androidRes.ran) {
    progressItem(5, steps, "android init", "warn", "android CLI not on PATH");
  } else {
    ctx.androidInitRan = androidRes.ran;
    progressItem(5, steps, "android init", "warn", androidRes.error ?? "stock android-cli skill not placed here");
  }
  if (target.statusLineKind === "claude-command") {
    await statusLineFor(ctx, 6, steps);
  } else if (target.statusLineKind === "codex-config") {
    await codexStatusLineFor(ctx, 6, steps);
  }
}
async function stepSummary(ctx, stepNum) {
  runStep(ctx, stepNum, "Summary");
  if (ctx.opts.skipSanity) {
    log.info("Skipped (--skip-sanity)");
    return;
  }
  for (const target of ctx.targets) {
    const c = ctx.perTarget.get(target.id) ?? { skills: 0, agents: 0, hooks: 0 };
    log.info(
      `${target.label}: ${c.skills} skills \xB7 ${c.agents} agents \xB7 ${c.hooks} hooks \u2192 ${target.home}`
    );
  }
  log.info(`Rules pack: v${ctx.rulesVersion}`);
}
async function cmdInit(opts = {}) {
  if (opts.noTui || opts.tui === false) forceNoTui();
  await welcome(Boolean(opts.yes));
  const mode = opts.advanced ? "advanced" : opts.yes ? "quickstart" : await modeSelect({ yes: Boolean(opts.yes), advanced: Boolean(opts.advanced) });
  if (opts.dryRun) {
    log.info("DRY RUN \u2014 no changes will be made");
  }
  let targets;
  try {
    targets = await resolveTargets(opts);
  } catch (err) {
    log.err(`init failed: ${err.message}`);
    process.exit(1);
  }
  const ctx = {
    mode,
    opts,
    rulesUrl: opts.rules ?? DEFAULT_RULES_URL,
    rulesVersion: "?",
    targets,
    perTarget: /* @__PURE__ */ new Map(),
    androidInitRan: false
  };
  try {
    await step1Deps(ctx);
    await step2AndroidBinary(ctx);
    await step3AstIndex(ctx);
    await step4Rules(ctx);
    if (!ctx.opts.dryRun) copyHookTemplates();
    let step = GLOBAL_STEPS;
    for (const target of ctx.targets) {
      step++;
      await targetSection(ctx, target, step);
    }
    await stepSummary(ctx, totalSteps(ctx));
  } catch (err) {
    if (isCancel6(err)) {
      cancel6("Cancelled");
      process.exit(130);
    }
    log.err(`init failed: ${err.message}`);
    process.exit(1);
  }
  if (ctx.androidInitRan) {
    log.info(
      "Browse Google's skill catalog \u2014 run 'gor-mobile android-skills' to install optional skills."
    );
  }
  const totals = [...ctx.perTarget.values()].reduce(
    (acc, c) => ({
      skills: acc.skills + c.skills,
      agents: acc.agents + c.agents,
      hooks: acc.hooks + c.hooks
    }),
    { skills: 0, agents: 0, hooks: 0 }
  );
  finalOutro({
    skills: totals.skills,
    agents: totals.agents,
    hooks: totals.hooks,
    rulesVersion: ctx.rulesVersion
  });
  void GOR_MOBILE_VERSION;
}

// src/commands/doctor.ts
import { existsSync as existsSync12, readFileSync as readFileSync6, readdirSync as readdirSync4 } from "fs";
import { join as join8 } from "path";
import { execa as execa5 } from "execa";
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
  if (existsSync12(path)) {
    log.ok(`${label} \u2192 ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}
function checkHooks(target) {
  if (!existsSync12(target.hooksFile)) {
    log.warn(`No ${target.hooksFile}`);
    return;
  }
  for (const hookType of ["SessionStart", "UserPromptSubmit"]) {
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
  if (!existsSync12(target.instructionsFile)) {
    log.warn(`${target.instructionsFile} does not exist`);
    return;
  }
  if (readFileSync6(target.instructionsFile, "utf8").includes(SECTION_BEGIN)) {
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
  if (!existsSync12(GOR_MOBILE_RULES_DIR)) {
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
async function verboseHookEmulation(target) {
  const hooks = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync12(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    const result = await execa5("bash", [path], {
      reject: false,
      input: JSON.stringify({
        cwd: process.cwd(),
        session_id: "gor-mobile-doctor",
        prompt: "gor-mobile doctor"
      }),
      env: {
        ...process.env,
        GORM_FORCE_MOBILE: "1",
        GORM_SKILLS_DIR: target.skillsDir
      }
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
function verboseSkillsFrontmatter(target) {
  if (!existsSync12(target.skillsDir)) {
    log.warn(`${target.skillsDir} missing`);
    return;
  }
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync4(target.skillsDir)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join8(target.skillsDir, entry, "SKILL.md");
    if (!existsSync12(skillMd)) continue;
    count++;
    const content = readFileSync6(skillMd, "utf8");
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
    log.warn(`android CLI v${smoke.version} is below floor \u2014 run 'gor-mobile repair' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}
function verboseContractLint(target) {
  const skill = join8(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (!existsSync12(skill)) {
    log.warn("bridge skill missing \u2014 cannot lint contract");
    return;
  }
  const text = readFileSync6(skill, "utf8");
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
function doctorTargets(target) {
  if (target) return targetSpecs(parseTargetFlag(target));
  const gm = detectGorMobileTargets();
  if (gm.length > 0) return targetSpecs(gm);
  const installed = detectInstalledTargets();
  return targetSpecs(installed.length > 0 ? installed : ["claude"]);
}
function checkTarget(target) {
  log.step(`${target.label} integration`);
  checkFile(target.hooksFile, target.hooksKind === "codex-hooks-json" ? "hooks.json" : "settings.json");
  checkHooks(target);
  checkFile(target.agentsDir, "agents/");
  if (androidCliSkillInstalled(target.skillsDir)) {
    log.ok(`android-cli skill installed in ${target.skillsDir}`);
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const bridgePath = join8(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync12(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing \u2014 run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join8(target.skillsDir, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync12(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing \u2014 run 'gor-mobile repair'");
  }
  checkInstructionsSection(target);
  if (target.statusLineKind === "claude-command") checkStatusLine();
  else if (target.statusLineKind === "codex-config") checkCodexStatusLine();
}
async function cmdDoctor(opts = {}) {
  const targets = doctorTargets(opts.target);
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
  checkFile(
    join8(GOR_MOBILE_HOME, "templates", "detect-mobile-context.sh"),
    "mobile-context detector"
  );
  for (const target of targets) {
    checkTarget(target);
  }
  log.step("Rules pack");
  checkRulesPack();
  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");
  if (opts.verbose) {
    for (const target of targets) {
      log.step(`Hooks emulation (verbose) \u2014 ${target.label}`);
      await verboseHookEmulation(target);
      log.step(`Skills frontmatter (verbose) \u2014 ${target.label}`);
      verboseSkillsFrontmatter(target);
      verboseContractLint(target);
    }
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
import { existsSync as existsSync13 } from "fs";
function unregisterManaged() {
  if (!existsSync13(CLAUDE_MCP)) return;
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
function repairTargets(target) {
  if (target) return targetSpecs(parseTargetFlag(target));
  const gm = detectGorMobileTargets();
  if (gm.length > 0) return targetSpecs(gm);
  const installed = detectInstalledTargets();
  return targetSpecs(installed.length > 0 ? installed : ["claude"]);
}
async function cmdRepair(opts = {}) {
  const targets = repairTargets(opts.target);
  const snippet = join9(gorMobileRoot(), "templates", "claude-md-snippet.md");
  copyHookTemplates();
  for (const target of targets) {
    log.step(`Repairing ${target.label} (${target.home})`);
    const ss = installSessionStartHook(target);
    log.ok(
      ss.collapsed > 1 ? `SessionStart hook refreshed (collapsed ${ss.collapsed} \u2192 1)` : "SessionStart hook refreshed"
    );
    const ups = installUserPromptSubmitHook(target);
    log.ok(
      ups.collapsed > 1 ? `UserPromptSubmit hook refreshed (collapsed ${ups.collapsed} \u2192 1)` : "UserPromptSubmit hook refreshed"
    );
    if (target.statusLineKind === "claude-command") {
      const sl = statusLineState();
      if (sl.managed && sl.variant) {
        installStatusLine(sl.variant, { force: true });
        log.ok(`Status line (${sl.variant === "cat" ? "Cat" : "Classic"}) refreshed`);
      }
    } else if (target.statusLineKind === "codex-config") {
      if (codexStatusLineState().managed) {
        installCodexStatusLine({ force: true });
        log.ok("Codex status line refreshed (tui.status_line)");
      }
    }
    if (target.id === "claude") {
      const legacyCmds = cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
      for (const f of legacyCmds) log.ok(`Removed legacy command ${f}`);
      const legacyAgents = cleanupLegacyAgents();
      for (const f of legacyAgents) log.ok(`Removed legacy agent ${f}`);
    }
    const skills = installSkills(target);
    if (skills.missingPrefix.length > 0) {
      log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s):`);
      for (const m of skills.missingPrefix) {
        log.warn(`  ${m} (missing 'name: gor-mobile-' prefix)`);
      }
    }
    log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs \u2192 ${target.skillsDir})`);
    const agents = installAgents(target);
    log.ok(`Agents refreshed (${agents.length} in ${target.agentsDir})`);
    if (target.supportsMcpPrune) {
      try {
        unregisterManaged();
        log.ok("Managed MCP entries pruned from ~/.claude/mcp.json");
      } catch (err) {
        log.warn(`MCP cleanup failed: ${err.message}`);
      }
    }
    const androidRes = await runAndroidInit(target);
    if (!androidRes.ran) {
      log.info("android CLI not on PATH \u2014 skipping 'android init'");
    } else if (androidRes.skillInstalled) {
      log.ok("android-cli skill refreshed via 'android init'");
    } else if (androidRes.error) {
      log.warn(`'android init' failed: ${androidRes.error}`);
    } else {
      log.info(`stock android-cli skill not present in ${target.skillsDir} (android init covers detected agents)`);
    }
    writeManagedSection(target.instructionsFile, snippet);
    log.ok(`Managed instructions section refreshed (${target.instructionsFile})`);
  }
  await ensureAndroidCliCurrent({ skip: opts.skipAndroidUpdate });
  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}

// src/commands/uninstall.ts
import { existsSync as existsSync14, readdirSync as readdirSync5, readFileSync as readFileSync7, rmSync as rmSync4 } from "fs";
import { join as join10 } from "path";
import { confirm as confirm3, isCancel as isCancel7 } from "@clack/prompts";
function uninstallTargets(target) {
  if (target) return targetSpecs(parseTargetFlag(target));
  const installed = detectInstalledTargets();
  return targetSpecs(installed.length > 0 ? installed : ["claude"]);
}
function removeTarget(target) {
  log.step(`Removing gor-mobile from ${target.label} (${target.home})`);
  removeSessionStartHook(target);
  removeUserPromptSubmitHook(target);
  log.ok("Hooks removed");
  if (target.statusLineKind === "claude-command") {
    removeStatusLine();
    log.ok("Status line removed (only if managed)");
  } else if (target.statusLineKind === "codex-config") {
    removeCodexStatusLine();
    log.ok("Codex status line removed (only if managed)");
  }
  if (target.id === "claude") {
    cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  }
  if (existsSync14(target.skillsDir)) {
    for (const entry of readdirSync5(target.skillsDir)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync4(join10(target.skillsDir, entry), { recursive: true, force: true });
      }
    }
  }
  log.ok(`Skills removed (${target.skillsDir})`);
  if (existsSync14(target.agentsDir)) {
    const ext = `.${target.agentFormat}`;
    for (const entry of readdirSync5(target.agentsDir)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(ext)) {
        rmSync4(join10(target.agentsDir, entry), { force: true });
      }
    }
    if (target.id === "claude") {
      const legacyCr = join10(target.agentsDir, "code-reviewer.md");
      if (existsSync14(legacyCr)) {
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
  removeManagedSection(target.instructionsFile);
  log.ok(`Managed instructions section cleaned (${target.instructionsFile})`);
}
async function cmdUninstall(opts = {}) {
  if (!opts.yes) {
    const proceed = await confirm3({
      message: "Remove gor-mobile hooks, skills, agents, templates, rules pack, config, and managed instruction sections?",
      initialValue: false
    });
    if (isCancel7(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }
  const targets = uninstallTargets(opts.target);
  for (const target of targets) {
    removeTarget(target);
  }
  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync14(GOR_MOBILE_HOME)) {
    rmSync4(GOR_MOBILE_HOME, { recursive: true, force: true });
  }
  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync14(GOR_MOBILE_CONFIG)) rmSync4(GOR_MOBILE_CONFIG);
  if (existsSync14(GOR_MOBILE_CONFIG_DIR)) {
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
    if (!isCancel7(removeAndroid) && removeAndroid === true) {
      log.step("Removing Android CLI");
      const res = await uninstallAndroidCli();
      for (const p of res.removed) log.ok(`removed ${p}`);
      for (const e of res.errors) log.warn(e);
      if (res.errors.length === 0) log.ok("Android CLI removed");
    }
  }
}

// src/commands/rules.ts
import { existsSync as existsSync15, rmSync as rmSync5 } from "fs";
async function rulesList() {
  if (!existsSync15(GOR_MOBILE_RULES_DIR)) {
    log.warn("No rules pack installed. Run: gor-mobile rules use <url>");
    return;
  }
  const m = readManifest();
  const cfg = existsSync15(GOR_MOBILE_CONFIG) ? readConfig() : {};
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
  if (existsSync15(GOR_MOBILE_RULES_DIR)) {
    log.info(`Backing up existing pack to ${backup}`);
    if (existsSync15(backup)) rmSync5(backup, { recursive: true, force: true });
    const { renameSync } = await import("fs");
    renameSync(GOR_MOBILE_RULES_DIR, backup);
  }
  try {
    if (existsSync15(target)) {
      log.info(`Copying local pack from ${target}`);
      copyFromLocal(target);
    } else {
      log.info(`Cloning ${target}`);
      await cloneOrPull(target, DEFAULT_RULES_REF);
    }
  } catch (err) {
    log.err(`Install failed \u2014 restoring backup: ${err.message}`);
    if (existsSync15(GOR_MOBILE_RULES_DIR)) {
      rmSync5(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
    }
    if (existsSync15(backup)) {
      const { renameSync } = await import("fs");
      renameSync(backup, GOR_MOBILE_RULES_DIR);
    }
    process.exitCode = 1;
    return;
  }
  saveConfig(target);
  log.ok(`Rules pack installed at ${GOR_MOBILE_RULES_DIR}`);
  if (existsSync15(backup)) rmSync5(backup, { recursive: true, force: true });
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
import { execa as execa6 } from "execa";
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
    const res = await execa6(cli, ["docs", q], { stdio: "inherit", reject: false });
    if (res.exitCode === 0) return;
    log.warn("android docs returned nothing; falling back to web search");
  }
  const encoded = encodeURIComponent(q);
  console.log(`Native android docs unavailable for this query.`);
  console.log(``);
  console.log(`Open: https://developer.android.com/search?q=${encoded}`);
}

// src/commands/self-update.ts
import { existsSync as existsSync16 } from "fs";
import { join as join11 } from "path";
import { execa as execa7 } from "execa";
async function cmdSelfUpdate() {
  const root = gorMobileRoot();
  if (existsSync16(join11(root, ".git"))) {
    log.step(`git pull in ${root}`);
    await execa7("git", ["-C", root, "pull", "--ff-only"], { stdio: "inherit" });
    log.step("npm install");
    await execa7("npm", ["install", "--production=false"], { cwd: root, stdio: "inherit" });
    log.step("npm run build");
    await execa7("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    log.ok("CLI updated");
    return;
  }
  if (has("brew")) {
    const res = await execa7("brew", ["list", "gor-mobile"], { reject: false });
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
import { existsSync as existsSync17 } from "fs";
import { execa as execa8 } from "execa";
async function cmdAndroid(args) {
  const cli = androidCliPath();
  if (cli) {
    const res = await execa8(cli, args, { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }
  const first = args[0];
  if (first && ["build", "assemble", "assembleDebug", "assembleRelease"].includes(first) && existsSync17("./gradlew")) {
    log.info(`Falling back to ./gradlew ${first}`);
    const res = await execa8("./gradlew", [first], { stdio: "inherit", reject: false });
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
import { existsSync as existsSync18 } from "fs";
import { join as join12 } from "path";
import { cancel as cancel7, isCancel as isCancel8, multiselect as multiselect2, spinner } from "@clack/prompts";
function isInstalled(name) {
  return existsSync18(join12(CLAUDE_SKILLS_DIR, name, "SKILL.md"));
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
  const picked = await multiselect2({
    message: "Select Android skills to keep installed (space to toggle, enter to confirm):",
    options,
    initialValues: preselected,
    required: false
  });
  if (isCancel8(picked)) {
    cancel7("Cancelled");
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
import { existsSync as existsSync19 } from "fs";
import { join as join13 } from "path";
import { execa as execa9 } from "execa";
async function cmdUpdate() {
  log.step("Updating rules pack");
  if (existsSync19(join13(GOR_MOBILE_RULES_DIR, ".git"))) {
    const res = await execa9(
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
    const list = await execa9("brew", ["list", "gor-mobile"], { reject: false });
    if (list.exitCode === 0) {
      log.step("Checking for brew update");
      await execa9("brew", ["update"], { reject: false });
      const info = await execa9("brew", ["info", "--json=v2", "gor-mobile"], { reject: false });
      const versions = await execa9("brew", ["list", "--versions", "gor-mobile"], { reject: false });
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

// src/commands/enable.ts
import { existsSync as existsSync20, writeFileSync as writeFileSync5 } from "fs";
import { join as join14 } from "path";
function cmdEnable() {
  const marker = join14(process.cwd(), ".gor-mobile.json");
  if (existsSync20(marker)) {
    log.ok(`Already enabled \u2014 ${marker} exists`);
    return;
  }
  writeFileSync5(marker, "{}\n");
  log.ok(`gor-mobile enabled for this repo \u2192 ${marker}`);
  log.info("Commit this file so the whole team's sessions activate gor-mobile here.");
}

// src/cli.ts
var program = new Command();
program.name("gor-mobile").description("Android-aware overlay installer for Claude Code and Codex").version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");
program.command("version").description("Print version").action(() => {
  console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
});
program.command("init").description("Run the install wizard (Android CLI, hooks, skills, MCP)").option("--dry-run", "print planned actions; no filesystem changes").option("-y, --yes", "assume yes to all prompts (non-interactive)").option("--skip-sanity", "skip final summary step").option("--no-tui", "force plain-text prompts").option("--advanced", "confirm each step and allow URL override").option("--rules <url>", "custom rules-pack git URL").option("--skip-android-update", "do not auto-update the Android CLI").option("--target <targets>", "comma-separated agents to install into (claude,codex)").action(async (opts) => {
  await cmdInit(opts);
});
program.command("doctor").description("Check environment (deps, hooks, MCP)").option("-v, --verbose", "dump hook payload + skill frontmatter").option("--target <targets>", "comma-separated agents to check (claude,codex)").action(async (opts) => {
  await cmdDoctor(opts);
});
program.command("repair").description("Restore managed files in ~/.claude/ and ~/.codex/").option("--skip-android-update", "do not auto-update the Android CLI").option("--target <targets>", "comma-separated agents to repair (claude,codex)").action(async (opts) => {
  await cmdRepair(opts);
});
program.command("enable").description("Mark the current repo as a gor-mobile (mobile) project").action(() => {
  cmdEnable();
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
program.command("uninstall").description("Remove everything gor-mobile installed").option("-y, --yes", "skip confirmation").option("--target <targets>", "comma-separated agents to uninstall from (claude,codex)").action(async (opts) => {
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