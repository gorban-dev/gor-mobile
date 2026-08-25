import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { execa } from "execa";
import {
  CLAUDE_JSON,
  CLAUDE_SETTINGS,
  DEV_KNOWLEDGE_MCP_NAME,
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_HOME,
  GOR_MOBILE_RULES_DIR,
  GOR_MOBILE_TEMPLATES_DIR,
  GOR_MOBILE_VERSION,
  LEGACY_PROJECT_MARKER_NAME,
  PROJECT_MARKER_NAME,
  SECTION_BEGIN,
  WORKFLOW_SIZE_GUIDELINE_MIN_CLAUDE_VERSION,
  WORKFLOWS_MIN_CLAUDE_VERSION,
  gorMobileRoot
} from "../constants.js";
import { androidCliSkillInstalled, smokeTestContract } from "../helpers/android-cli.js";
import { ANDROID_CONTRACT } from "../android-contract.js";
import { codexMcpState } from "../helpers/codex-mcp.js";
import { KEY_SOURCE_LABEL, resolveDevKnowledgeKey } from "../helpers/dev-knowledge.js";
import { SDD_SCRIPT_NAMES } from "../helpers/install-assets.js";
import {
  LEGACY_PROJECT_MCP_FILE,
  legacyProjectMcpServers,
  localMcpState
} from "../helpers/mcp-register.js";
import {
  codexCompanionAllowEntry,
  countManagedHooks,
  sddScriptsAllowEntry,
  WORKFLOW_PERMISSION_ENTRIES
} from "../helpers/settings-merge.js";
import { statusLineState } from "../helpers/settings-statusline.js";
import { codexStatusLineState } from "../helpers/codex-statusline.js";
import { androidCliPath, which } from "../helpers/deps.js";
import { astIndexPath } from "../helpers/ast-index.js";
import { DEBROID_CONTRACT, DEBROID_INSTALL_CMD, debroidContract, debroidPath } from "../helpers/debroid.js";
import { runAstIndexUpdate } from "../helpers/ast-index-freshness.js";
import { readJsonSafe } from "../helpers/paths.js";
import {
  findProjectRoot,
  legacyProjectMarkerPath,
  readProjectMarker
} from "../helpers/project.js";
import { artifactInventory } from "../helpers/state-artifacts.js";
import { readManifest } from "../helpers/rules-pack.js";
import {
  TARGETS,
  agentHomeExists,
  projectClaudeSpec,
  type TargetSpec
} from "../targets.js";
import type { ManagedSettings } from "../types.js";
import { log } from "../ui/log.js";

interface DoctorOptions {
  verbose?: boolean;
}

function reportDep(name: string, path: string | null, required: boolean): void {
  if (path) {
    log.ok(`${name} → ${path}`);
  } else if (required) {
    log.err(`${name} not found (required)`);
  } else {
    log.warn(`${name} not found (optional)`);
  }
}

function checkFile(path: string, label: string): boolean {
  if (existsSync(path)) {
    log.ok(`${label} → ${path}`);
    return true;
  }
  log.warn(`${label} missing (${path})`);
  return false;
}

function checkHooks(target: TargetSpec): void {
  if (!existsSync(target.hooksFile)) {
    log.warn(`No ${target.hooksFile}`);
    return;
  }
  for (const hookType of ["SessionStart", "UserPromptSubmit", "PreToolUse"] as const) {
    const n = countManagedHooks(hookType, target);
    if (n === 0) {
      log.warn(`${hookType} hook NOT registered — run 'gor-mobile repair'`);
    } else if (n > 1) {
      log.warn(`${hookType} has ${n} duplicate managed entries — run 'gor-mobile repair'`);
    } else {
      log.ok(`${hookType} hook registered`);
    }
  }
}

function checkInstructionsSection(target: TargetSpec): void {
  if (!existsSync(target.instructionsFile)) {
    log.warn(`${target.instructionsFile} does not exist`);
    return;
  }
  if (readFileSync(target.instructionsFile, "utf8").includes(SECTION_BEGIN)) {
    log.ok("managed instructions section present");
  } else {
    log.warn("managed instructions section missing — run 'gor-mobile repair'");
  }
}

function checkStatusLine(): void {
  const st = statusLineState();
  if (st.managed) {
    log.ok(`Status line: ${st.variant === "cat" ? "Cat" : "Classic"} (managed)`);
    if (!which("jq")) {
      log.warn("  → status line needs jq to render — brew install jq");
    }
  } else if (st.foreign) {
    log.info("Status line: custom (not managed by gor-mobile)");
  }
}

function checkCodexStatusLine(): void {
  const st = codexStatusLineState();
  if (st.managed) {
    log.ok("Status line: managed (tui.status_line in config.toml)");
  } else if (st.foreign) {
    log.info("Status line: custom (not managed by gor-mobile)");
  }
}

function checkRulesPack(): void {
  if (!existsSync(GOR_MOBILE_RULES_DIR)) {
    log.warn(`Rules pack not installed (${GOR_MOBILE_RULES_DIR}) — run 'gor-mobile setup'`);
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

function checkHookTemplates(): void {
  const scripts = [
    "session-start-hook.sh",
    "user-prompt-submit-hook.sh",
    "ast-index-guard-hook.sh",
    "claude-md-snippet.md"
  ];
  let ok = true;
  for (const f of scripts) {
    if (!existsSync(join(GOR_MOBILE_TEMPLATES_DIR, f))) {
      ok = false;
      log.warn(`hook template missing: ${f} — run 'gor-mobile setup'`);
    }
  }
  if (ok) log.ok(`Hook scripts present (${GOR_MOBILE_TEMPLATES_DIR})`);
}

function checkSddScripts(): void {
  let ok = true;
  for (const name of SDD_SCRIPT_NAMES) {
    if (!existsSync(join(GOR_MOBILE_HOME, "scripts", name))) {
      ok = false;
      log.warn(`SDD script missing: scripts/${name} — run 'gor-mobile setup'`);
    }
  }
  if (ok) log.ok(`SDD scripts present (${GOR_MOBILE_HOME}/scripts)`);
}

async function verboseHookEmulation(target: TargetSpec): Promise<void> {
  const hooks: Array<[string, string]> = [
    ["session-start-hook.sh", "SessionStart"],
    ["user-prompt-submit-hook.sh", "UserPromptSubmit"],
    ["ast-index-guard-hook.sh", "PreToolUse"]
  ];
  for (const [file, label] of hooks) {
    const path = `${GOR_MOBILE_HOME}/templates/${file}`;
    if (!existsSync(path)) {
      log.warn(`[${label}] template missing: ${path}`);
      continue;
    }
    // The guard is a deny-gate, not a context injector: silent exit 0 on a
    // benign probe is its success shape, so skip the additionalContext parse.
    const input =
      label === "PreToolUse"
        ? JSON.stringify({
            tool_name: "Grep",
            cwd: process.cwd(),
            tool_input: { pattern: "gor-mobile doctor probe" }
          })
        : JSON.stringify({
            cwd: process.cwd(),
            session_id: "gor-mobile-doctor",
            prompt: "gor-mobile doctor"
          });
    const result = await execa("bash", [path], {
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
      // Deny path: an indexed repo + bare-identifier pattern must exit 2.
      // Exit 0 here means the guard is INERT — it would silently allow every
      // structural grep it exists to catch. Missing jq or a missing ast-index
      // binary both fail open by design; the warning names them so a correct
      // fail-open is not misread as a broken hook.
      const probeDir = mkdtempSync(join(tmpdir(), "gorm-guard-probe-"));
      try {
        mkdirSync(join(probeDir, ".claude", "rules"), { recursive: true });
        writeFileSync(join(probeDir, ".claude", "rules", "ast-index.md"), "");
        const deny = await execa("bash", [path], {
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
            `[${label}] guard is INERT — structural probe exited ${deny.exitCode}, expected 2 (jq or ast-index missing, or hook broken)`
          );
        }
      } finally {
        rmSync(probeDir, { recursive: true, force: true });
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
        String(ctx)
          .split("\n")
          .slice(0, 30)
          .map((l) => `    ${l}`)
          .join("\n")
      );
      console.error("    --- end ---");
    } catch {
      log.warn(`[${label}] hook output is not valid JSON`);
      console.error(result.stdout);
    }
  }
}

function verboseSkillsFrontmatter(target: TargetSpec): void {
  if (!existsSync(target.skillsDir)) {
    log.warn(`${target.skillsDir} missing`);
    return;
  }
  let count = 0;
  let bad = 0;
  for (const entry of readdirSync(target.skillsDir)) {
    if (!entry.startsWith("gor-mobile-")) continue;
    const skillMd = join(target.skillsDir, entry, "SKILL.md");
    if (!existsSync(skillMd)) continue;
    count++;
    const content = readFileSync(skillMd, "utf8");
    if (!/^name: gor-mobile-/m.test(content)) {
      bad++;
      log.warn(`  ${skillMd} missing 'name: gor-mobile-' prefix`);
    }
  }
  if (bad === 0) {
    log.ok(`Skills frontmatter OK (${count} SKILL.md files, all prefixed)`);
  } else {
    log.warn(`Skills frontmatter: ${bad} of ${count} missing prefix — run 'gor-mobile repair'`);
  }
}

async function checkAndroidContract(): Promise<void> {
  const smoke = await smokeTestContract();
  if (smoke.version === null) {
    log.warn("android CLI version unreadable — run 'gor-mobile setup'");
    return;
  }
  if (smoke.missing.length > 0) {
    log.err(`android CLI missing contract commands: ${smoke.missing.join(", ")} — update gor-mobile`);
  } else if (smoke.belowFloor) {
    log.warn(`android CLI v${smoke.version} is below floor — run 'gor-mobile setup' to upgrade`);
  } else {
    log.ok(`android CLI contract OK (v${smoke.version}, ${ANDROID_CONTRACT.length} commands)`);
  }
}

function verboseContractLint(target: TargetSpec): void {
  const skill = join(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (!existsSync(skill)) {
    log.warn("bridge skill missing — cannot lint contract");
    return;
  }
  const text = readFileSync(skill, "utf8");
  const mentioned = new Set<string>();
  const re = /`android ([a-z-]+(?: [a-z-]+)?)/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) mentioned.add(m[1]!);
  const known = new Set(ANDROID_CONTRACT.map((c) => c.command.join(" ")));
  const knownTopLevel = new Set(ANDROID_CONTRACT.map((c) => c.command[0]!));
  const stray = [...mentioned].filter((cmd) => !known.has(cmd) && !knownTopLevel.has(cmd.split(" ")[0]!));
  if (stray.length === 0) log.ok(`bridge skill ↔ contract in sync (${mentioned.size} cmds referenced)`);
  else log.warn(`bridge skill references commands NOT in contract: ${stray.join(", ")}`);
}

type SemVer = [number, number, number];

function parseSemVer(text: string): SemVer | null {
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(text);
  return m ? [Number(m[1]), Number(m[2]), Number(m[3])] : null;
}

function versionBelow(a: SemVer, b: SemVer): boolean {
  return a[0] !== b[0] ? a[0] < b[0] : a[1] !== b[1] ? a[1] < b[1] : a[2] < b[2];
}

function warnIfDisableWorkflows(file: string, scope: string): void {
  const settings = readJsonSafe<Record<string, unknown>>(file, {});
  if (settings["disableWorkflows"] === true) {
    log.warn(`disableWorkflows=true in ${file} — workflows are OFF for ${scope}`);
  }
}

async function checkClaudeWorkflowsSupport(): Promise<void> {
  const res = await execa("claude", ["--version"], { reject: false });
  const m = /(\d+)\.(\d+)\.(\d+)/.exec(res.stdout ?? "");
  if (res.exitCode !== 0 || !m) {
    log.warn("claude CLI version unreadable — cannot verify workflows support");
    return;
  }
  const version = parseSemVer(m[0])!;
  const floor = parseSemVer(WORKFLOWS_MIN_CLAUDE_VERSION)!;
  if (versionBelow(version, floor)) {
    log.warn(`Claude Code v${m[0]} < ${WORKFLOWS_MIN_CLAUDE_VERSION} — /gor-review workflow will not load`);
  } else {
    log.ok(`Claude Code v${m[0]} supports workflows (≥ ${WORKFLOWS_MIN_CLAUDE_VERSION})`);
    const guidelineFloor = parseSemVer(WORKFLOW_SIZE_GUIDELINE_MIN_CLAUDE_VERSION)!;
    if (versionBelow(version, guidelineFloor)) {
      log.warn(
        `workflowSizeGuideline is honored only since ${WORKFLOW_SIZE_GUIDELINE_MIN_CLAUDE_VERSION} — the size guideline init wrote is inert on this version`
      );
    }
  }
  warnIfDisableWorkflows(CLAUDE_SETTINGS, "this user");
  const root = findProjectRoot();
  if (root) {
    warnIfDisableWorkflows(join(root, ".claude", "settings.json"), "this project");
    warnIfDisableWorkflows(join(root, ".claude", "settings.local.json"), "this project");
  }
}

/** Shipped workflow filenames, from the templates dir (fallback for an unreadable dir). */
function expectedWorkflows(): string[] {
  try {
    return readdirSync(join(gorMobileRoot(), "templates", "workflows")).filter(
      (name) => name.startsWith("gor-") && name.endsWith(".js")
    );
  } catch {
    return ["gor-review.js", "gor-execute.js"];
  }
}

function checkWorkflows(target: TargetSpec): void {
  if (!target.workflowsDir) return;
  for (const name of expectedWorkflows()) {
    const p = join(target.workflowsDir, name);
    if (!existsSync(p)) {
      log.warn(`workflow ${name} missing — run 'gor-mobile repair'`);
      continue;
    }
    const head = readFileSync(p, "utf8").slice(0, 2048);
    if (/export const meta = \{/.test(head)) log.ok(`workflow ${name} installed`);
    else log.warn(`workflow ${name} has no meta header — run 'gor-mobile repair'`);
  }
  const settings = readJsonSafe<ManagedSettings>(target.hooksFile, {});
  const allow = settings.permissions?.allow ?? [];
  const expected = [...WORKFLOW_PERMISSION_ENTRIES, sddScriptsAllowEntry()];
  const missing = expected.filter((e) => !allow.includes(e));
  if (missing.length > 0) {
    log.warn(`workflow allowlist incomplete (${missing.length} missing) — run 'gor-mobile repair'`);
  } else {
    log.ok("workflow permission allowlist present");
  }
  const codexEntry = codexCompanionAllowEntry();
  if (codexEntry && !allow.includes(codexEntry)) {
    log.warn("codex companion allowlist entry stale or missing (plugin updated?) — run 'gor-mobile repair'");
  }
}

// Skills/agents/hooks integrity for one target. Skips the managed-instructions
// and status-line checks when the target does not carry them (project Claude).
function checkTarget(target: TargetSpec): void {
  checkFile(target.hooksFile, target.hooksKind === "codex-hooks-json" ? "hooks.json" : "settings file");
  checkHooks(target);
  checkFile(target.agentsDir, "agents/");
  if (androidCliSkillInstalled(target.skillsDir)) {
    log.ok(`android-cli skill installed in ${target.skillsDir}`);
  } else if (androidCliPath()) {
    log.warn("android-cli skill missing — run 'gor-mobile repair'");
  }
  const bridgePath = join(target.skillsDir, "gor-mobile-using-android-cli", "SKILL.md");
  if (existsSync(bridgePath)) {
    log.ok("gor-mobile-using-android-cli bridge skill installed");
  } else if (androidCliPath()) {
    log.warn("gor-mobile-using-android-cli skill missing — run 'gor-mobile repair'");
  }
  const astIndexSkillPath = join(target.skillsDir, "gor-mobile-ast-index", "SKILL.md");
  if (existsSync(astIndexSkillPath)) {
    log.ok("gor-mobile-ast-index skill installed");
  } else {
    log.warn("gor-mobile-ast-index skill missing — run 'gor-mobile repair'");
  }
  if (target.instructionsFile) checkInstructionsSection(target);
  if (target.statusLineKind === "claude-command") checkStatusLine();
  else if (target.statusLineKind === "codex-config") checkCodexStatusLine();
  checkWorkflows(target);
}

function checkProject(root: string): TargetSpec {
  const marker = readProjectMarker(root);
  const legacy = existsSync(legacyProjectMarkerPath(root));
  log.ok(
    `${legacy ? LEGACY_PROJECT_MARKER_NAME : PROJECT_MARKER_NAME} → platform=${marker.platform ?? "?"}, v${marker.version ?? "?"} (${root})`
  );
  if (legacy) {
    log.warn(
      `marker still at the repo root — run 'gor-mobile repair' to move it to ${PROJECT_MARKER_NAME}`
    );
  }
  if (marker.version && marker.version !== GOR_MOBILE_VERSION) {
    log.warn(`installed v${marker.version} ≠ CLI v${GOR_MOBILE_VERSION} — run 'gor-mobile init' to refresh`);
  }
  const inv = artifactInventory(root);
  const ttl = typeof marker.artifact_ttl_days === "number" ? marker.artifact_ttl_days : 30;
  if (inv.legacyCheckpoints > 0) {
    log.warn(
      `${inv.legacyCheckpoints} legacy flat checkpoint(s) in .gor-mobile/state — run 'gor-mobile repair' to migrate`
    );
  }
  if (inv.plans + inv.specs + inv.workspaces > 0) {
    const oldest = inv.oldestDays !== null ? `, oldest ${inv.oldestDays}d` : "";
    const sweep = ttl === 0 ? "retention off" : `retention ${ttl}d, swept at session start`;
    log.ok(
      `plan artifacts: ${inv.plans} plan(s), ${inv.specs} spec(s), ${inv.workspaces} workspace(s)${oldest} (${sweep})`
    );
  }
  const spec = projectClaudeSpec(root);
  const mcp = localMcpState(root, marker.managed_mcp ?? []);
  if (mcp.malformed) {
    log.warn(`${CLAUDE_JSON} is not valid JSON — fix it, then run 'gor-mobile mcp'`);
  } else if (!mcp.present) {
    log.warn(`${DEV_KNOWLEDGE_MCP_NAME} missing from local scope — run 'gor-mobile mcp'`);
  } else if (!mcp.owned) {
    // Hand-configured: repair leaves it alone, so "run repair" would be advice
    // that can never come true. Mirrors the Codex branch below.
    log.info(`${DEV_KNOWLEDGE_MCP_NAME}: custom entry (not managed by gor-mobile)`);
  } else {
    log.ok(`${DEV_KNOWLEDGE_MCP_NAME} configured in local scope (${CLAUDE_JSON})`);
  }
  // Only ours is worth reporting: a .mcp.json holding somebody else's servers
  // is the team's file, and repair will not touch it.
  const staleLegacy = legacyProjectMcpServers(root).filter((n) =>
    (marker.managed_mcp ?? []).includes(n)
  );
  if (staleLegacy.length > 0) {
    log.warn(
      `${LEGACY_PROJECT_MCP_FILE} still registers ${staleLegacy.join(", ")} — run 'gor-mobile repair' to clear the pre-0.3.6 entry`
    );
  }
  checkTarget(spec);
  return spec;
}

export async function cmdDoctor(opts: DoctorOptions = {}): Promise<void> {
  log.step("Environment");
  reportDep("brew", which("brew"), false);
  reportDep("git", which("git"), true);
  reportDep("curl", which("curl"), true);
  reportDep("node", which("node"), true);
  reportDep("android", androidCliPath(), true);
  if (!androidCliPath()) {
    log.info("  → run 'gor-mobile setup' to install the android CLI (hard-mandatory)");
  } else {
    await checkAndroidContract();
  }
  reportDep("ast-index", astIndexPath(), false);
  const dRoot = findProjectRoot();
  if (dRoot && astIndexPath()) {
    const delta = await runAstIndexUpdate(dRoot);
    if (delta && delta.changed + delta.deleted > 0) {
      log.warn(
        `ast-index was stale (${delta.changed} changed, ${delta.deleted} deleted) — refreshed just now`
      );
    } else if (delta) {
      log.ok("ast-index database is fresh");
    }
  }
  if (!astIndexPath()) {
    log.info(
      "  → install: brew tap defendend/ast-index && brew install ast-index"
    );
  }
  reportDep("debroid", debroidPath(), false);
  if (debroidPath()) {
    const dc = await debroidContract();
    if (dc.missing.length > 0) {
      log.warn(`debroid missing contract commands: ${dc.missing.join(", ")} — update via '${DEBROID_INSTALL_CMD}'`);
    } else {
      log.ok(`debroid contract OK (${DEBROID_CONTRACT.length} commands)`);
    }
  } else {
    log.info("  → debroid = runtime Android debugging for agents (optional) — run 'gor-mobile setup'");
  }
  reportDep("jq", which("jq"), false);
  if (!which("jq")) {
    log.info(
      "  → jq powers the status line AND the ast-index guard hook (guard fails open without it) — brew install jq"
    );
  }
  await checkClaudeWorkflowsSupport();
  const dk = resolveDevKnowledgeKey();
  if (dk.key) {
    log.ok(`Developer Knowledge API key → ${KEY_SOURCE_LABEL[dk.source]}`);
  } else {
    log.warn("Developer Knowledge API key not set — run 'gor-mobile mcp'");
  }

  log.step("Machine (~/.gor-mobile)");
  checkHookTemplates();
  checkSddScripts();
  checkRulesPack();
  checkFile(GOR_MOBILE_CONFIG, "config.json");

  const emulationTargets: TargetSpec[] = [];

  const root = findProjectRoot();
  log.step("Project (this repo)");
  if (root) {
    emulationTargets.push(checkProject(root));
  } else {
    log.info(`No ${PROJECT_MARKER_NAME} in the current directory tree.`);
    log.info("  → cd into a mobile repo and run 'gor-mobile init' to install the workflow.");
  }

  if (agentHomeExists("codex")) {
    log.step("Codex integration (user-level)");
    checkTarget(TARGETS.codex);
    const cx = codexMcpState();
    if (!cx.present) {
      log.warn(`${DEV_KNOWLEDGE_MCP_NAME} missing from config.toml — run 'gor-mobile mcp'`);
    } else if (cx.foreign) {
      log.info(`${DEV_KNOWLEDGE_MCP_NAME}: custom entry (not managed by gor-mobile)`);
    } else {
      log.ok(
        `${DEV_KNOWLEDGE_MCP_NAME} registered (${cx.hasLiteralKey ? "http_headers" : "env_http_headers"})`
      );
    }
    emulationTargets.push(TARGETS.codex);
  }

  if (opts.verbose) {
    for (const target of emulationTargets) {
      log.step(`Hooks emulation (verbose) — ${target.label}`);
      await verboseHookEmulation(target);
      log.step(`Skills frontmatter (verbose) — ${target.label}`);
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
