import { existsSync } from "node:fs";
import { CLAUDE_SETTINGS } from "../constants.js";
import type { ManagedSettings } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

interface EnvSettings extends ManagedSettings {
  env?: Record<string, string>;
}

/** Read one key out of ~/.claude/settings.json `env`. */
export function claudeEnvValue(name: string): string | null {
  const settings = readJsonSafe<EnvSettings>(CLAUDE_SETTINGS, {});
  const value = settings.env?.[name];
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * Set one key in ~/.claude/settings.json `env`, preserving everything else.
 * User scope is not a preference: measured on Claude Code 2.1.220, `${VAR}`
 * in a project .mcp.json expands from THIS file and not from the repo's
 * .claude/settings.local.json.
 */
export function setClaudeEnv(name: string, value: string): void {
  const settings = readJsonSafe<EnvSettings>(CLAUDE_SETTINGS, {});
  settings.env = { ...(settings.env ?? {}), [name]: value };
  writeJson(CLAUDE_SETTINGS, settings);
}

/** Drop one key; remove `env` entirely once it empties (uninstall path). */
export function deleteClaudeEnv(name: string): void {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe<EnvSettings>(CLAUDE_SETTINGS, {});
  if (!settings.env || !(name in settings.env)) return;
  delete settings.env[name];
  if (Object.keys(settings.env).length === 0) delete settings.env;
  writeJson(CLAUDE_SETTINGS, settings);
}
