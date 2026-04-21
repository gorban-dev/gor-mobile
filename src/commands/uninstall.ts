import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { confirm, isCancel } from "@clack/prompts";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_COMMANDS_DIR,
  CLAUDE_SKILLS_DIR,
  GOR_MOBILE_CONFIG,
  GOR_MOBILE_CONFIG_DIR,
  GOR_MOBILE_HOME
} from "../constants.js";
import { removeClaudeMdSection } from "../helpers/claude-md-section.js";
import { cleanupLegacyCommands } from "../helpers/install-assets.js";
import { unregisterManaged } from "../helpers/mcp-register.js";
import {
  removeSessionStartHook,
  removeUserPromptSubmitHook
} from "../helpers/settings-merge.js";
import { log } from "../ui/log.js";

interface UninstallOptions {
  yes?: boolean;
}

export async function cmdUninstall(opts: UninstallOptions = {}): Promise<void> {
  if (!opts.yes) {
    const proceed = await confirm({
      message:
        "Remove gor-mobile hooks, skills, agents, templates, rules pack, config, and managed CLAUDE.md section?",
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
  if (existsSync(CLAUDE_SKILLS_DIR)) {
    const { readdirSync } = await import("node:fs");
    for (const entry of readdirSync(CLAUDE_SKILLS_DIR)) {
      if (entry.startsWith("gor-mobile-")) {
        rmSync(join(CLAUDE_SKILLS_DIR, entry), { recursive: true, force: true });
      }
    }
  }

  log.step("Removing agents/");
  if (existsSync(CLAUDE_AGENTS_DIR)) {
    const { readdirSync } = await import("node:fs");
    for (const entry of readdirSync(CLAUDE_AGENTS_DIR)) {
      if (entry.startsWith("gor-mobile-") && entry.endsWith(".md")) {
        rmSync(join(CLAUDE_AGENTS_DIR, entry), { force: true });
      }
    }
    const legacyCr = join(CLAUDE_AGENTS_DIR, "code-reviewer.md");
    if (existsSync(legacyCr)) {
      const head = readFileSync(legacyCr, "utf8").split("\n").slice(0, 20).join("\n");
      if (/^name: code-reviewer/m.test(head)) {
        rmSync(legacyCr);
      }
    }
  }

  log.step("Removing MCP entries");
  unregisterManaged();

  log.step("Cleaning CLAUDE.md managed section");
  removeClaudeMdSection();

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
}
