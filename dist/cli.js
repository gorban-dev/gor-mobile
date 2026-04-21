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
var GOR_MOBILE_VERSION = "0.1.0";
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
var DEFAULT_RULES_REF = "main";
function gorMobileRoot() {
  if (process.env.GOR_MOBILE_ROOT) return process.env.GOR_MOBILE_ROOT;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}

// src/commands/doctor.ts
import { existsSync as existsSync4, readFileSync as readFileSync2 } from "fs";
import { execa as execa2 } from "execa";

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
function ensureSettingsFile() {
  ensureParentDir(CLAUDE_SETTINGS);
  if (!existsSync2(CLAUDE_SETTINGS)) {
    writeJson(CLAUDE_SETTINGS, {});
  }
  return readJsonSafe(CLAUDE_SETTINGS, {});
}
function upsertHook(hookType, matcher, command) {
  const settings = ensureSettingsFile();
  settings.hooks = settings.hooks ?? {};
  const previous = (settings.hooks[hookType] ?? []).filter(
    (entry) => (entry._managed_by ?? "") !== MANAGED_TAG
  );
  const next = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(CLAUDE_SETTINGS, settings);
}
function removeHook(hookType) {
  if (!existsSync2(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  if (!settings.hooks || !settings.hooks[hookType]) return;
  const remaining = settings.hooks[hookType].filter(
    (entry) => (entry._managed_by ?? "") !== MANAGED_TAG
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
  upsertHook("SessionStart", "startup|clear|compact|resume", cmd);
}
function removeSessionStartHook() {
  removeHook("SessionStart");
}
function installUserPromptSubmitHook() {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  upsertHook("UserPromptSubmit", "", cmd);
}
function removeUserPromptSubmitHook() {
  removeHook("UserPromptSubmit");
}
function hasManagedHook(hookType) {
  const settings = readJsonSafe(CLAUDE_SETTINGS, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.some((e) => (e._managed_by ?? "") === MANAGED_TAG);
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

// src/helpers/rules-pack.ts
import { existsSync as existsSync3, cpSync, rmSync } from "fs";
import { join as join3 } from "path";
import { execa } from "execa";
function manifestPath() {
  return join3(GOR_MOBILE_RULES_DIR, "manifest.json");
}
function readManifest() {
  if (!existsSync3(manifestPath())) return null;
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
  if (existsSync3(join3(GOR_MOBILE_RULES_DIR, ".git"))) {
    await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
      reject: false
    });
    return;
  }
  if (existsSync3(GOR_MOBILE_RULES_DIR)) {
    rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  ensureDir(join3(GOR_MOBILE_RULES_DIR, ".."));
  await execa("git", [
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
  if (existsSync3(GOR_MOBILE_RULES_DIR)) {
    rmSync(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
  }
  cpSync(source, GOR_MOBILE_RULES_DIR, { recursive: true });
}
async function pullCurrent() {
  if (!existsSync3(join3(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout \u2014 cannot pull");
  }
  await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "pull", "--ff-only"], {
    stdio: "inherit"
  });
}
async function diffAgainstUpstream() {
  if (!existsSync3(join3(GOR_MOBILE_RULES_DIR, ".git"))) {
    throw new Error("Current pack is not a git checkout");
  }
  await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "fetch", "origin"], {
    reject: false
  });
  const { stdout } = await execa(
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
      if (!existsSync3(join3(GOR_MOBILE_RULES_DIR, rel))) {
        errors.push(`missing rule file: ${rel}`);
      }
    }
  }
  return { ok: errors.length === 0, errors, manifest: m };
}
async function gitBranchAndRev() {
  if (!existsSync3(join3(GOR_MOBILE_RULES_DIR, ".git"))) return {};
  const branch = await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--abbrev-ref", "HEAD"], { reject: false });
  const rev = await execa("git", ["-C", GOR_MOBILE_RULES_DIR, "rev-parse", "--short", "HEAD"], { reject: false });
  return { branch: branch.stdout.trim(), rev: rev.stdout.trim() };
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

// src/commands/doctor.ts
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
  if (existsSync4(path)) {
    log.ok(`${label} \u2192 ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}
function checkHooks() {
  if (!existsSync4(CLAUDE_SETTINGS)) {
    log.warn(`No ${CLAUDE_SETTINGS}`);
    return;
  }
  if (hasManagedHook("SessionStart")) {
    log.ok("SessionStart hook registered");
  } else {
    log.warn("SessionStart hook NOT registered \u2014 run 'gor-mobile repair'");
  }
  if (hasManagedHook("UserPromptSubmit")) {
    log.ok("UserPromptSubmit hook registered");
  } else {
    log.warn("UserPromptSubmit hook NOT registered \u2014 run 'gor-mobile repair'");
  }
}
function checkClaudeMdSection() {
  if (!existsSync4(CLAUDE_CLAUDE_MD)) {
    log.warn(`${CLAUDE_CLAUDE_MD} does not exist`);
    return;
  }
  if (readFileSync2(CLAUDE_CLAUDE_MD, "utf8").includes(SECTION_BEGIN)) {
    log.ok("CLAUDE.md managed section present");
  } else {
    log.warn("CLAUDE.md managed section missing \u2014 run 'gor-mobile repair'");
  }
}
function checkRulesPack() {
  if (!existsSync4(GOR_MOBILE_RULES_DIR)) {
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
    if (!existsSync4(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    const result = await execa2("bash", [path], { reject: false });
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
  if (!existsSync4(CLAUDE_SKILLS_DIR)) {
    log.warn(`${CLAUDE_SKILLS_DIR} missing`);
    return;
  }
  const { readdirSync: readdirSync2 } = __require("fs");
  const { join: join9 } = __require("path");
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync2(CLAUDE_SKILLS_DIR)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join9(CLAUDE_SKILLS_DIR, entry, "SKILL.md");
    if (!existsSync4(skillMd)) continue;
    count++;
    const content = readFileSync2(skillMd, "utf8");
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
async function cmdDoctor(opts = {}) {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), false);
  log.step("Claude Code integration");
  checkFile(CLAUDE_SETTINGS, "settings.json");
  checkHooks();
  checkFile(CLAUDE_AGENTS_DIR, "agents/");
  checkFile(CLAUDE_MCP, "mcp.json");
  checkClaudeMdSection();
  log.step("Rules pack");
  checkRulesPack();
  log.step("Config");
  checkFile(GOR_MOBILE_CONFIG, "config.json");
  if (opts.verbose) {
    log.step("Hooks emulation (verbose)");
    await verboseHookEmulation();
    log.step("Skills frontmatter (verbose)");
    verboseSkillsFrontmatter();
  }
  console.error("");
  log.info("If anything is missing, run: gor-mobile repair");
  if (!opts.verbose) {
    log.info("Run 'gor-mobile doctor --verbose' for hook-payload dump.");
  }
}

// src/commands/repair.ts
import { join as join5 } from "path";

// src/helpers/claude-md-section.ts
import { existsSync as existsSync5, readFileSync as readFileSync3, writeFileSync as writeFileSync2 } from "fs";
function readCurrent() {
  if (!existsSync5(CLAUDE_CLAUDE_MD)) return "";
  return readFileSync3(CLAUDE_CLAUDE_MD, "utf8");
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
  if (!existsSync5(snippetPath)) {
    throw new Error(`snippet not found: ${snippetPath}`);
  }
  ensureParentDir(CLAUDE_CLAUDE_MD);
  const existing = readCurrent();
  const stripped = stripManagedSection(existing);
  const snippet = readFileSync3(snippetPath, "utf8");
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
  if (!existsSync5(CLAUDE_CLAUDE_MD)) return;
  const stripped = stripManagedSection(readCurrent());
  writeFileSync2(CLAUDE_CLAUDE_MD, stripped);
}

// src/helpers/install-assets.ts
import {
  cpSync as cpSync2,
  chmodSync,
  copyFileSync,
  existsSync as existsSync6,
  readdirSync,
  readFileSync as readFileSync4,
  rmSync as rmSync2,
  statSync,
  writeFileSync as writeFileSync3
} from "fs";
import { basename, join as join4 } from "path";
function copyHookTemplates() {
  ensureDir(GOR_MOBILE_TEMPLATES_DIR);
  const names = ["session-start-hook.sh", "user-prompt-submit-hook.sh"];
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
  ).replace(/all 5 tasks/g, "all tasks").replace(/docs\/superpowers\/specs\//g, ".gor-mobile/specs/").replace(/docs\/superpowers\/plans\//g, ".gor-mobile/plans/");
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
  if (!existsSync6(skillsDir)) return { installed, missingPrefix };
  for (const name of readdirSync(skillsDir)) {
    const srcDir = join4(skillsDir, name);
    if (!statSync(srcDir).isDirectory()) continue;
    const dstDir = join4(CLAUDE_SKILLS_DIR, `gor-mobile-${name}`);
    cpSync2(srcDir, dstDir, { recursive: true });
    const skillMd = join4(dstDir, "SKILL.md");
    if (existsSync6(skillMd)) {
      let body = transformSkillBody(readFileSync4(skillMd, "utf8"));
      const overlayPath = join4(overlaysDir, `${name}.md`);
      if (existsSync6(overlayPath)) {
        body += "\n" + readFileSync4(overlayPath, "utf8");
      }
      writeFileSync3(skillMd, body);
      if (!/^name: gor-mobile-/m.test(body)) {
        missingPrefix.push(skillMd);
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
  if (!existsSync6(src)) return copied;
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
    const head = readFileSync4(file, "utf8").split("\n").slice(0, 10).join("\n");
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
    const head = readFileSync4(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
    if (/^name: code-reviewer/m.test(head)) {
      rmSync2(legacyCr);
      removed.push(basename(legacyCr));
    }
  }
  return removed;
}

// src/helpers/mcp-register.ts
import { existsSync as existsSync7 } from "fs";
function ensureMcpFile() {
  if (!existsSync7(CLAUDE_MCP)) {
    writeJson(CLAUDE_MCP, { mcpServers: {} });
  }
  return readJsonSafe(CLAUDE_MCP, { mcpServers: {} });
}
function registerGoogleDevKnowledge() {
  const cfg = ensureMcpFile();
  if (cfg.mcpServers?.["google-dev-knowledge"]) {
    return { already: true };
  }
  cfg.mcpServers = cfg.mcpServers ?? {};
  const server = {
    _managed_by: MANAGED_TAG,
    command: "npx",
    args: ["-y", "@anthropic/mcp-google-dev-knowledge@latest"]
  };
  cfg.mcpServers["google-dev-knowledge"] = server;
  writeJson(CLAUDE_MCP, cfg);
  return { already: false };
}
function unregisterManaged() {
  if (!existsSync7(CLAUDE_MCP)) return;
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
  installSessionStartHook();
  log.ok("SessionStart hook refreshed");
  installUserPromptSubmitHook();
  log.ok("UserPromptSubmit hook refreshed");
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
    const mcp = registerGoogleDevKnowledge();
    if (mcp.already) log.info("MCP google-dev-knowledge already registered");
    else log.ok("MCP google-dev-knowledge registered");
  } catch (err) {
    log.warn(`MCP register failed: ${err.message}`);
  }
  writeClaudeMdSection(join5(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  log.ok("CLAUDE.md managed section refreshed");
  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}

// src/commands/uninstall.ts
import { existsSync as existsSync8, readFileSync as readFileSync5, rmSync as rmSync3 } from "fs";
import { join as join6 } from "path";
import { confirm, isCancel } from "@clack/prompts";
async function cmdUninstall(opts = {}) {
  if (!opts.yes) {
    const proceed = await confirm({
      message: "Remove gor-mobile hooks, skills, agents, templates, rules pack, config, and managed CLAUDE.md section?",
      initialValue: false
    });
    if (isCancel(proceed) || proceed !== true) {
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
  log.step("Removing legacy commands/ (signature-matched)");
  cleanupLegacyCommands(CLAUDE_COMMANDS_DIR);
  log.step("Removing skills/");
  if (existsSync8(CLAUDE_SKILLS_DIR)) {
    const { readdirSync: readdirSync2 } = await import("fs");
    for (const entry of readdirSync2(CLAUDE_SKILLS_DIR)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync3(join6(CLAUDE_SKILLS_DIR, entry), { recursive: true, force: true });
      }
    }
  }
  log.step("Removing agents/");
  if (existsSync8(CLAUDE_AGENTS_DIR)) {
    const { readdirSync: readdirSync2 } = await import("fs");
    for (const entry of readdirSync2(CLAUDE_AGENTS_DIR)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(".md")) {
        rmSync3(join6(CLAUDE_AGENTS_DIR, entry), { force: true });
      }
    }
    const legacyCr = join6(CLAUDE_AGENTS_DIR, "code-reviewer.md");
    if (existsSync8(legacyCr)) {
      const head = readFileSync5(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
      if (/^name: code-reviewer/m.test(head)) {
        rmSync3(legacyCr);
      }
    }
  }
  log.step("Removing MCP entries");
  unregisterManaged();
  log.step("Cleaning CLAUDE.md managed section");
  removeClaudeMdSection();
  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync8(GOR_MOBILE_HOME)) {
    rmSync3(GOR_MOBILE_HOME, { recursive: true, force: true });
  }
  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync8(GOR_MOBILE_CONFIG)) rmSync3(GOR_MOBILE_CONFIG);
  if (existsSync8(GOR_MOBILE_CONFIG_DIR)) {
    try {
      rmSync3(GOR_MOBILE_CONFIG_DIR, { recursive: false });
    } catch {
    }
  }
  log.ok("gor-mobile artifacts removed");
}

// src/commands/rules.ts
import { existsSync as existsSync9, rmSync as rmSync4 } from "fs";
async function rulesList() {
  if (!existsSync9(GOR_MOBILE_RULES_DIR)) {
    log.warn("No rules pack installed. Run: gor-mobile rules use <url>");
    return;
  }
  const m = readManifest();
  const cfg = existsSync9(GOR_MOBILE_CONFIG) ? readConfig() : {};
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
  if (existsSync9(GOR_MOBILE_RULES_DIR)) {
    log.info(`Backing up existing pack to ${backup}`);
    if (existsSync9(backup)) rmSync4(backup, { recursive: true, force: true });
    const { renameSync } = await import("fs");
    renameSync(GOR_MOBILE_RULES_DIR, backup);
  }
  try {
    if (existsSync9(target)) {
      log.info(`Copying local pack from ${target}`);
      copyFromLocal(target);
    } else {
      log.info(`Cloning ${target}`);
      await cloneOrPull(target, DEFAULT_RULES_REF);
    }
  } catch (err) {
    log.err(`Install failed \u2014 restoring backup: ${err.message}`);
    if (existsSync9(GOR_MOBILE_RULES_DIR)) {
      rmSync4(GOR_MOBILE_RULES_DIR, { recursive: true, force: true });
    }
    if (existsSync9(backup)) {
      const { renameSync } = await import("fs");
      renameSync(backup, GOR_MOBILE_RULES_DIR);
    }
    process.exitCode = 1;
    return;
  }
  saveConfig(target);
  log.ok(`Rules pack installed at ${GOR_MOBILE_RULES_DIR}`);
  if (existsSync9(backup)) rmSync4(backup, { recursive: true, force: true });
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
import { execa as execa3 } from "execa";
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
    const res = await execa3(cli, ["docs", q], { stdio: "inherit", reject: false });
    if (res.exitCode === 0) return;
    log.warn("android docs returned nothing; falling back to MCP");
  }
  const encoded = encodeURIComponent(q);
  console.log(`Native android docs unavailable for this query.`);
  console.log(``);
  console.log(`Inside Claude Code, ask the google-dev-knowledge MCP server directly:`);
  console.log(`  $ claude > use google-dev-knowledge to find "${q}"`);
  console.log(``);
  console.log(`Or open: https://developer.android.com/search?q=${encoded}`);
}

// src/commands/self-update.ts
import { existsSync as existsSync10 } from "fs";
import { join as join7 } from "path";
import { execa as execa4 } from "execa";
async function cmdSelfUpdate() {
  const root = gorMobileRoot();
  if (existsSync10(join7(root, ".git"))) {
    log.step(`git pull in ${root}`);
    await execa4("git", ["-C", root, "pull", "--ff-only"], { stdio: "inherit" });
    log.step("npm install");
    await execa4("npm", ["install", "--production=false"], { cwd: root, stdio: "inherit" });
    log.step("npm run build");
    await execa4("npm", ["run", "build"], { cwd: root, stdio: "inherit" });
    log.ok("CLI updated");
    return;
  }
  if (has("brew")) {
    const res = await execa4("brew", ["list", "gor-mobile"], { reject: false });
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
import { existsSync as existsSync11 } from "fs";
import { execa as execa5 } from "execa";
async function cmdAndroid(args) {
  const cli = androidCliPath();
  if (cli) {
    const res = await execa5(cli, args, { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }
  const first = args[0];
  if (first && ["build", "assemble", "assembleDebug", "assembleRelease"].includes(first) && existsSync11("./gradlew")) {
    log.info(`Falling back to ./gradlew ${first}`);
    const res = await execa5("./gradlew", [first], { stdio: "inherit", reject: false });
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

// src/commands/update.ts
import { existsSync as existsSync12 } from "fs";
import { join as join8 } from "path";
import { execa as execa6 } from "execa";
async function cmdUpdate() {
  log.step("Updating rules pack");
  if (existsSync12(join8(GOR_MOBILE_RULES_DIR, ".git"))) {
    const res = await execa6(
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
    const list = await execa6("brew", ["list", "gor-mobile"], { reject: false });
    if (list.exitCode === 0) {
      log.step("Checking for brew update");
      await execa6("brew", ["update"], { reject: false });
      const info = await execa6("brew", ["info", "--json=v2", "gor-mobile"], { reject: false });
      const versions = await execa6("brew", ["list", "--versions", "gor-mobile"], { reject: false });
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
program.name("gor-mobile").description("Android-aware overlay installer for Claude Code").version(`gor-mobile ${GOR_MOBILE_VERSION}`, "-v, --version", "print version");
program.command("version").description("Print version").action(() => {
  console.log(`gor-mobile ${GOR_MOBILE_VERSION}`);
});
program.command("init").description("Run the install wizard (Android CLI, hooks, skills, MCP)").option("--dry-run", "print planned actions; no filesystem changes").option("-y, --yes", "assume yes to all prompts (non-interactive)").option("--skip-sanity", "skip final summary step").option("--no-tui", "force plain-text prompts").option("--advanced", "confirm each step and allow URL override").option("--rules <url>", "custom rules-pack git URL").action(() => {
  console.error("init: not yet ported to TS (next commit).");
  console.error("For now, use the bash wizard: ./bin/gor-mobile.bash.bak init");
  process.exit(1);
});
program.command("doctor").description("Check environment (deps, hooks, MCP)").option("-v, --verbose", "dump hook payload + skill frontmatter").action(async (opts) => {
  await cmdDoctor(opts);
});
program.command("repair").description("Restore managed files in ~/.claude/").action(async () => {
  await cmdRepair();
});
program.command("update").description("Pull latest rules + repair managed files").action(async () => {
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