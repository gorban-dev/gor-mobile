import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import {
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_CONFIG_DIR,
  GOR_MOBILE_HOME
} from "../constants.js";
import { uninstallAndroidCli } from "../helpers/android-cli.js";
import { removeManagedSection } from "../helpers/claude-md-section.js";
import { androidCliPath } from "../helpers/deps.js";
import { cleanupLegacyCommands } from "../helpers/install-assets.js";
import { CLAUDE_COMMANDS_DIR } from "../constants.js";
import { unregisterManaged } from "../helpers/mcp-register.js";
import {
  removeAstIndexGuardHook,
  removeSessionStartHook,
  removeUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { removeStatusLine } from "../helpers/settings-statusline.js";
import { removeCodexStatusLine } from "../helpers/codex-statusline.js";
import {
  detectInstalledTargets,
  parseTargetFlag,
  targetSpecs,
  type TargetSpec
} from "../targets.js";
import { log } from "../ui/log.js";

interface UninstallOptions {
  yes?: boolean;
  target?: string;
}

function uninstallTargets(target?: string): TargetSpec[] {
  if (target) return targetSpecs(parseTargetFlag(target));
  const installed = detectInstalledTargets();
  return targetSpecs(installed.length > 0 ? installed : ["claude"]);
}

function removeTarget(target: TargetSpec): void {
  log.step(`Removing gor-mobile from ${target.label} (${target.home})`);

  removeSessionStartHook(target);
  removeUserPromptSubmitHook(target);
  removeAstIndexGuardHook(target);
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

  removeManagedSection(target.instructionsFile);
  log.ok(`Managed instructions section cleaned (${target.instructionsFile})`);
}

export async function cmdUninstall(opts: UninstallOptions = {}): Promise<void> {
  if (!opts.yes) {
    const proceed = await confirm({
      message:
        "Remove gor-mobile hooks, skills, agents, templates, rules pack, config, and managed instruction sections?",
      initialValue: false
    });
    if (isCancel(proceed) || proceed !== true) {
      log.info("Aborted");
      return;
    }
  }

  const targets = uninstallTargets(opts.target);
  for (const target of targets) {
    removeTarget(target);
  }

  log.step(`Removing ${GOR_MOBILE_HOME} (templates, rules)`);
  if (existsSync(GOR_MOBILE_HOME)) {
    rmSync(GOR_MOBILE_HOME, { recursive: true, force: true });
  }

  log.step(`Removing ${GOR_MOBILE_CONFIG}`);
  if (existsSync(GOR_MOBILE_CONFIG)) rmSync(GOR_MOBILE_CONFIG);
  if (existsSync(GOR_MOBILE_CONFIG_DIR)) {
    try {
      rmSync(GOR_MOBILE_CONFIG_DIR, { recursive: false });
    } catch {
      // dir not empty — leave it
    }
  }

  log.ok("gor-mobile artifacts removed");

  const cli = androidCliPath();
  if (cli && !opts.yes) {
    const removeAndroid = await confirm({
      message:
        "Also uninstall the Android CLI (launcher + ~/.android/cli cache + android-cli skill)?",
      initialValue: false
    });
    if (!isCancel(removeAndroid) && removeAndroid === true) {
      log.step("Removing Android CLI");
      const res = await uninstallAndroidCli();
      for (const p of res.removed) log.ok(`removed ${p}`);
      for (const e of res.errors) log.warn(e);
      if (res.errors.length === 0) log.ok("Android CLI removed");
    }
  }
}
