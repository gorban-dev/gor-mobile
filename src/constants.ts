import { homedir } from "node:os";
import { join, resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";

export const GOR_MOBILE_VERSION = "0.2.7";
export const GOR_MOBILE_NAME = "gor-mobile";

export const HOME = homedir();

export const GOR_MOBILE_HOME =
  process.env.GOR_MOBILE_HOME ?? join(HOME, ".gor-mobile");

export const GOR_MOBILE_RULES_DIR = join(GOR_MOBILE_HOME, "rules");
export const GOR_MOBILE_TEMPLATES_DIR = join(GOR_MOBILE_HOME, "templates");

const XDG_CONFIG_HOME =
  process.env.XDG_CONFIG_HOME ?? join(HOME, ".config");

export const GOR_MOBILE_CONFIG_DIR = join(XDG_CONFIG_HOME, "gor-mobile");
export const GOR_MOBILE_CONFIG = join(GOR_MOBILE_CONFIG_DIR, "config.json");

export const CLAUDE_DIR = join(HOME, ".claude");
export const CLAUDE_SETTINGS = join(CLAUDE_DIR, "settings.json");
export const CLAUDE_CLAUDE_MD = join(CLAUDE_DIR, "CLAUDE.md");
export const CLAUDE_MCP = join(CLAUDE_DIR, "mcp.json");
export const CLAUDE_COMMANDS_DIR = join(CLAUDE_DIR, "commands");
export const CLAUDE_AGENTS_DIR = join(CLAUDE_DIR, "agents");
export const CLAUDE_SKILLS_DIR = join(CLAUDE_DIR, "skills");

// Codex CLI (~/.codex by default; CODEX_HOME overrides — mirrors the binary's
// own resolution). gor-mobile installs the same workflow here when the user
// opts into the `codex` target. Hooks live in a dedicated hooks.json (same
// JSON schema as Claude's settings.json `hooks`), global instructions in
// AGENTS.md, and agents are TOML rather than Markdown.
export const CODEX_DIR = process.env.CODEX_HOME ?? join(HOME, ".codex");
export const CODEX_SKILLS_DIR = join(CODEX_DIR, "skills");
export const CODEX_AGENTS_DIR = join(CODEX_DIR, "agents");
export const CODEX_AGENTS_MD = join(CODEX_DIR, "AGENTS.md");
export const CODEX_HOOKS_JSON = join(CODEX_DIR, "hooks.json");
export const CODEX_CONFIG_TOML = join(CODEX_DIR, "config.toml");

export const MANAGED_TAG = "gor-mobile";
export const SECTION_BEGIN = "<!-- BEGIN gor-mobile managed section -->";
export const SECTION_END = "<!-- END gor-mobile managed section -->";

export const DEFAULT_RULES_URL =
  "https://github.com/gorban-dev/gor-mobile-rules-default.git";
export const DEFAULT_RULES_REF = "main";

/**
 * Resolve install root — location of the checked-out/installed gor-mobile
 * package, which holds templates/ and rules-default/ next to dist/.
 *
 * Honors GOR_MOBILE_ROOT env var (set by install.sh / brew formula).
 * Otherwise climbs up from this module: dist/cli.mjs → ../
 */
export function gorMobileRoot(): string {
  if (process.env.GOR_MOBILE_ROOT) return process.env.GOR_MOBILE_ROOT;
  const here = dirname(fileURLToPath(import.meta.url));
  return resolve(here, "..");
}
