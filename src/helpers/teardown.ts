import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { CLAUDE_COMMANDS_DIR } from "../constants.js";
import { removeManagedSection } from "./claude-md-section.js";
import { cleanupLegacyCommands } from "./install-assets.js";
import { unregisterManaged } from "./mcp-register.js";
import {
  removeAstIndexGuardHook,
  removeSessionStartHook,
  removeUserPromptSubmitHook
} from "./settings-merge.js";
import { removeStatusLine } from "./settings-statusline.js";
import { removeCodexStatusLine } from "./codex-statusline.js";
import type { TargetSpec } from "../targets.js";
import { log } from "../ui/log.js";

export interface TeardownOptions {
  /** leave the status line in place — migrate asks about it separately. */
  keepStatusLine?: boolean;
}

/**
 * Remove the gor-mobile footprint from ONE user-level agent home (~/.claude or
 * ~/.codex): hooks, skills, agents, managed MCP servers (Claude), and the
 * managed instructions section. Shared by `uninstall --machine` and `migrate`.
 * Every operation is a no-op when the artifact is absent, so this is idempotent.
 */
export function teardownUserTarget(
  target: TargetSpec,
  opts: TeardownOptions = {}
): void {
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

  if (existsSync(target.skillsDir)) {
    for (const entry of readdirSync(target.skillsDir)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync(join(target.skillsDir, entry), { recursive: true, force: true });
      }
    }
  }
  log.ok(`Skills removed (${target.skillsDir})`);

  if (existsSync(target.agentsDir)) {
    const ext = `.${target.agentFormat}`;
    for (const entry of readdirSync(target.agentsDir)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(ext)) {
        rmSync(join(target.agentsDir, entry), { force: true });
      }
    }
    if (target.id === "claude") {
      const legacyCr = join(target.agentsDir, "code-reviewer.md");
      if (existsSync(legacyCr)) {
        const head = readFileSync(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
        if (/^name: code-reviewer/m.test(head)) {
          rmSync(legacyCr);
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
