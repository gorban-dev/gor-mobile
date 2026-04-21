import { existsSync } from "node:fs";
import { CLAUDE_SETTINGS, GOR_MOBILE_HOME, MANAGED_TAG } from "../constants.js";
import type { HookEntry, ManagedSettings } from "../types.js";
import { ensureParentDir, readJsonSafe, writeJson } from "./paths.js";

type HookType = "SessionStart" | "UserPromptSubmit";

function ensureSettingsFile(): ManagedSettings {
  ensureParentDir(CLAUDE_SETTINGS);
  if (!existsSync(CLAUDE_SETTINGS)) {
    writeJson(CLAUDE_SETTINGS, {});
  }
  return readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
}

function upsertHook(hookType: HookType, matcher: string, command: string): void {
  const settings = ensureSettingsFile();
  settings.hooks = settings.hooks ?? {};
  const previous = (settings.hooks[hookType] ?? []).filter(
    (entry) => (entry._managed_by ?? "") !== MANAGED_TAG
  );
  const next: HookEntry = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(CLAUDE_SETTINGS, settings);
}

function removeHook(hookType: HookType): void {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
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

export function installSessionStartHook(): void {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/session-start-hook.sh`;
  upsertHook("SessionStart", "startup|clear|compact|resume", cmd);
}

export function removeSessionStartHook(): void {
  removeHook("SessionStart");
}

export function installUserPromptSubmitHook(): void {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  upsertHook("UserPromptSubmit", "", cmd);
}

export function removeUserPromptSubmitHook(): void {
  removeHook("UserPromptSubmit");
}

export function hasManagedHook(hookType: HookType): boolean {
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.some((e) => (e._managed_by ?? "") === MANAGED_TAG);
}
