import { join } from "node:path";
import {
  CLAUDE_COMMANDS_DIR,
  DEV_KNOWLEDGE_MCP_NAME,
  GOR_MOBILE_VERSION,
  LEGACY_PROJECT_MARKER_NAME,
  PROJECT_MARKER_NAME,
  gorMobileRoot
} from "../constants.js";
import {
  ensureAndroidCliCurrent,
  provisionProjectAndroidSkill,
  runAndroidInit
} from "../helpers/android-cli.js";
import { writeManagedSection } from "../helpers/claude-md-section.js";
import { codexMcpState, installCodexDevKnowledgeMcp } from "../helpers/codex-mcp.js";
import { resolveDevKnowledgeKey } from "../helpers/dev-knowledge.js";
import { applyEnabledPlugins, SUPERPOWERS_KEY } from "../helpers/enabled-plugins.js";
import {
  cleanupLegacyAgents,
  cleanupLegacyCommands,
  copyHookTemplates,
  installAgents,
  installSkills
} from "../helpers/install-assets.js";
import {
  cleanLegacyProjectMcp,
  LEGACY_PROJECT_MCP_FILE,
  malformedMcpMessage,
  registerLocalMcp,
  removeApprovedMcpServers
} from "../helpers/mcp-register.js";
import {
  findProjectRoot,
  migrateProjectMarker,
  readProjectMarker,
  removeLocalExclude,
  writeProjectMarker
} from "../helpers/project.js";
import { migrateStateLayout } from "../helpers/state-artifacts.js";
import {
  CLEAR_CONTEXT_ON_PLAN_ACCEPT,
  enableClearContextOnPlanAccept,
  installAstIndexGuardHook,
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { installStatusLine, statusLineState } from "../helpers/settings-statusline.js";
import {
  codexStatusLineState,
  installCodexStatusLine
} from "../helpers/codex-statusline.js";
import {
  TARGETS,
  agentHomeExists,
  projectClaudeSpec,
  type TargetSpec
} from "../targets.js";
import { log } from "../ui/log.js";

function refreshHooks(target: TargetSpec): void {
  const ss = installSessionStartHook(target);
  log.ok(
    ss.collapsed > 1
      ? `SessionStart hook refreshed (collapsed ${ss.collapsed} → 1)`
      : "SessionStart hook refreshed"
  );
  const ups = installUserPromptSubmitHook(target);
  log.ok(
    ups.collapsed > 1
      ? `UserPromptSubmit hook refreshed (collapsed ${ups.collapsed} → 1)`
      : "UserPromptSubmit hook refreshed"
  );
  const guard = installAstIndexGuardHook(target);
  log.ok(
    guard.collapsed > 1
      ? `PreToolUse guard hook refreshed (collapsed ${guard.collapsed} → 1)`
      : "PreToolUse guard hook refreshed"
  );
}

async function repairProject(root: string): Promise<void> {
  const spec = projectClaudeSpec(root);
  log.step(`Repairing project (${spec.home})`);

  refreshHooks(spec);

  const skills = installSkills(spec);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s):`);
    for (const m of skills.missingPrefix) log.warn(`  ${m} (missing 'name: gor-mobile-' prefix)`);
  }
  log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs → ${spec.skillsDir})`);

  const agents = installAgents(spec);
  log.ok(`Agents refreshed (${agents.length} in ${spec.agentsDir})`);

  const android = await provisionProjectAndroidSkill(spec.skillsDir);
  if (android.installed) log.ok(`android-cli skill refreshed → ${spec.skillsDir}/android-cli/`);
  else if (!android.ran) log.info("android CLI not on PATH — skipped android-cli skill");
  else log.warn(`android-cli skill not placed: ${android.error ?? "stock skill missing"}`);

  // Re-assert the superpowers override; existing extra enables in the file are
  // preserved (applyEnabledPlugins only sets keys, never clears others).
  applyEnabledPlugins(spec.hooksFile, [], [SUPERPOWERS_KEY]);
  log.ok("Duplicate superpowers plugin kept disabled for this repo");

  const marker = readProjectMarker(root);
  const mcpRes = registerLocalMcp(root, marker.managed_mcp ?? []);
  if (mcpRes.written) {
    log.ok(`${DEV_KNOWLEDGE_MCP_NAME} refreshed → ${mcpRes.path} (local scope)`);
  } else if (mcpRes.malformed) {
    log.warn(malformedMcpMessage(mcpRes.path));
  }

  // Installs before 0.3.6 kept the server in <repo>/.mcp.json.
  const legacyMcp = cleanLegacyProjectMcp(root, marker.managed_mcp ?? []);
  if (legacyMcp.malformed) {
    log.warn(malformedMcpMessage(legacyMcp.path));
  } else if (legacyMcp.removed.length > 0) {
    removeApprovedMcpServers(spec.hooksFile, legacyMcp.removed);
    await removeLocalExclude(root, [LEGACY_PROJECT_MCP_FILE]);
    log.ok(
      legacyMcp.fileDeleted
        ? `Removed ${LEGACY_PROJECT_MCP_FILE} (server now lives in local scope)`
        : `Dropped ${legacyMcp.removed.join(", ")} from ${LEGACY_PROJECT_MCP_FILE}`
    );
  }

  const stateMigration = migrateStateLayout(root);
  if (stateMigration.migrated.length > 0) {
    log.ok(`Migrated ${stateMigration.migrated.length} checkpoint(s) → .gor-mobile/state/<plan>/progress.md`);
  }
  for (const s of stateMigration.skipped) {
    log.warn(`Left legacy ${s} in place — a workspace checkpoint already exists for that plan`);
  }

  const enabledNow = enableClearContextOnPlanAccept(spec.hooksFile);
  const managedSettings = enabledNow
    ? [...new Set([...(marker.managed_settings ?? []), CLEAR_CONTEXT_ON_PLAN_ACCEPT])]
    : (marker.managed_settings ?? []);
  if (enabledNow) log.ok(`Enabled ${CLEAR_CONTEXT_ON_PLAN_ACCEPT} (plan-approval "clear context" option)`);
  writeProjectMarker(root, {
    ...marker,
    version: GOR_MOBILE_VERSION,
    managed_settings: managedSettings,
    managed_mcp: mcpRes.written
      ? [...new Set([...(marker.managed_mcp ?? []), DEV_KNOWLEDGE_MCP_NAME])]
      : (marker.managed_mcp ?? []),
    artifact_ttl_days: typeof marker.artifact_ttl_days === "number" ? marker.artifact_ttl_days : 30
  });
  log.ok(`Marker refreshed (v${GOR_MOBILE_VERSION})`);

  // Pre-0.3.5 layout: marker at the repo root. The refreshed one is already
  // under .gor-mobile/, so this drops the stray file and its ignore line.
  if (migrateProjectMarker(root)) {
    log.ok(`Moved ${LEGACY_PROJECT_MARKER_NAME} → ${PROJECT_MARKER_NAME}`);
    await removeLocalExclude(root, [LEGACY_PROJECT_MARKER_NAME]);
  }
}

async function repairCodex(target: TargetSpec): Promise<void> {
  log.step(`Repairing ${target.label} (${target.home})`);

  refreshHooks(target);

  if (target.statusLineKind === "codex-config" && codexStatusLineState().managed) {
    installCodexStatusLine({ force: true });
    log.ok("Codex status line refreshed (tui.status_line)");
  }

  const cx = codexMcpState();
  if (!cx.foreign) {
    // A literal key already in the managed table is one of the sources
    // resolveDevKnowledgeKey reads, so re-writing the block keeps it: the
    // http_headers shape survives because the key is found, not by accident.
    installCodexDevKnowledgeMcp(resolveDevKnowledgeKey().key, { force: cx.managed });
    log.ok(`${DEV_KNOWLEDGE_MCP_NAME} refreshed in config.toml`);
  }

  const skills = installSkills(target);
  if (skills.missingPrefix.length > 0) {
    log.warn(`Frontmatter rewrite failed in ${skills.missingPrefix.length} skill(s)`);
  }
  log.ok(`Skills refreshed (${skills.installed.length} gor-mobile-* dirs → ${target.skillsDir})`);

  const agents = installAgents(target);
  log.ok(`Agents refreshed (${agents.length} in ${target.agentsDir})`);

  const androidRes = await runAndroidInit(target);
  if (!androidRes.ran) log.info("android CLI not on PATH — skipping 'android init'");
  else if (androidRes.skillInstalled) log.ok("android-cli skill refreshed via 'android init'");
  else if (androidRes.error) log.warn(`'android init' failed: ${androidRes.error}`);

  writeManagedSection(target.instructionsFile, join(gorMobileRoot(), "templates", target.instructionsSnippet));
  log.ok(`Managed instructions section refreshed (${target.instructionsFile})`);
}

export async function cmdRepair(
  opts: { skipAndroidUpdate?: boolean } = {}
): Promise<void> {
  // Machine: refresh the shared hook scripts + snippet, sweep pre-0.1 bash-CLI
  // leftovers from ~/.claude that never carried a managed marker.
  copyHookTemplates();
  log.ok("Hook scripts refreshed → ~/.gor-mobile/templates");
  for (const f of cleanupLegacyCommands(CLAUDE_COMMANDS_DIR)) log.ok(`Removed legacy command ${f}`);
  for (const f of cleanupLegacyAgents()) log.ok(`Removed legacy agent ${f}`);

  // The Claude status line is the one user-level artifact `setup` leaves in
  // ~/.claude; re-point a managed entry at the current GOR_MOBILE_HOME. A
  // foreign status line is left untouched.
  const sl = statusLineState();
  if (sl.managed && sl.variant) {
    installStatusLine(sl.variant, { force: true });
    log.ok(`Claude status line (${sl.variant === "cat" ? "Cat" : "Classic"}) refreshed`);
  }

  const root = findProjectRoot();
  if (root) {
    await repairProject(root);
  } else {
    log.info("Not inside a gor-mobile repo — skipped project refresh (cd into one and run 'gor-mobile init').");
  }

  if (agentHomeExists("codex")) {
    await repairCodex(TARGETS.codex);
  }

  await ensureAndroidCliCurrent({ skip: opts.skipAndroidUpdate });

  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}
