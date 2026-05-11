import { join } from "node:path";
import { CLAUDE_COMMANDS_DIR, gorMobileRoot } from "../constants.js";
import { runAndroidInit } from "../helpers/android-cli.js";
import { writeClaudeMdSection } from "../helpers/claude-md-section.js";
import {
  cleanupLegacyAgents,
  cleanupLegacyCommands,
  copyHookTemplates,
  installAgents,
  installSkills
} from "../helpers/install-assets.js";
import { unregisterManaged } from "../helpers/mcp-register.js";
import {
  installSessionStartHook,
  installUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { log } from "../ui/log.js";

export async function cmdRepair(): Promise<void> {
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
    unregisterManaged();
    log.ok("Managed MCP entries pruned from ~/.claude/mcp.json");
  } catch (err) {
    log.warn(`MCP cleanup failed: ${(err as Error).message}`);
  }

  const androidRes = await runAndroidInit();
  if (!androidRes.ran) {
    log.info("android CLI not on PATH — skipping 'android init'");
  } else if (androidRes.skillInstalled) {
    log.ok("android-cli skill refreshed via 'android init'");
  } else if (androidRes.error) {
    log.warn(`'android init' failed: ${androidRes.error}`);
  } else {
    log.warn("'android init' ran but ~/.claude/skills/android-cli/SKILL.md missing");
  }

  writeClaudeMdSection(join(gorMobileRoot(), "templates", "claude-md-snippet.md"));
  log.ok("CLAUDE.md managed section refreshed");

  log.ok("Done. Run 'gor-mobile doctor' to verify.");
}
