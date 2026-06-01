import { existsSync } from "node:fs";
import { CLAUDE_SETTINGS, GOR_MOBILE_HOME, MANAGED_TAG } from "../constants.js";
import type { HookEntry, ManagedSettings } from "../types.js";
import { ensureParentDir, readJsonSafe, writeJson } from "./paths.js";

type HookType = "SessionStart" | "UserPromptSubmit";

// Path-independent fingerprint of each managed hook's command. The absolute
// path in the stored command differs per machine (it embeds $HOME / a custom
// GOR_MOBILE_HOME), but the `templates/<file>.sh` tail is invariant — match on
// it so legacy, untagged entries are still recognized as ours.
const HOOK_MARKER: Record<HookType, string> = {
  SessionStart: "templates/session-start-hook.sh",
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh"
};

// An entry is ours if it carries the managed tag OR its command points at our
// template. The second clause is the load-bearing one: entries written before
// MANAGED_TAG existed (old bash CLI), by a manual edit, a format migration, or
// a broken merge that dropped the tag have no tag yet must still be collapsed —
// otherwise they accumulate and each one re-injects the full hook payload.
function isManagedEntry(entry: HookEntry, hookType: HookType): boolean {
  if ((entry._managed_by ?? "") === MANAGED_TAG) return true;
  const marker = HOOK_MARKER[hookType];
  return (entry.hooks ?? []).some(
    (h) => h.type === "command" && h.command.includes(marker)
  );
}

function ensureSettingsFile(): ManagedSettings {
  ensureParentDir(CLAUDE_SETTINGS);
  if (!existsSync(CLAUDE_SETTINGS)) {
    writeJson(CLAUDE_SETTINGS, {});
  }
  return readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
}

// Replace every managed entry (tagged or legacy-untagged) for this event with a
// single freshly-tagged one. Returns how many prior managed entries were folded
// in, so callers can report `collapsed N → 1` when self-healing duplicates.
function upsertHook(
  hookType: HookType,
  matcher: string,
  command: string
): { collapsed: number } {
  const settings = ensureSettingsFile();
  settings.hooks = settings.hooks ?? {};
  const existing = settings.hooks[hookType] ?? [];
  const previous = existing.filter((entry) => !isManagedEntry(entry, hookType));
  const next: HookEntry = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(CLAUDE_SETTINGS, settings);
  return { collapsed: existing.length - previous.length };
}

function removeHook(hookType: HookType): void {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  if (!settings.hooks || !settings.hooks[hookType]) return;
  const remaining = settings.hooks[hookType].filter(
    (entry) => !isManagedEntry(entry, hookType)
  );
  if (remaining.length === 0) {
    delete settings.hooks[hookType];
  } else {
    settings.hooks[hookType] = remaining;
  }
  writeJson(CLAUDE_SETTINGS, settings);
}

export function installSessionStartHook(): { collapsed: number } {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/session-start-hook.sh`;
  return upsertHook("SessionStart", "startup|clear|compact|resume", cmd);
}

export function removeSessionStartHook(): void {
  removeHook("SessionStart");
}

export function installUserPromptSubmitHook(): { collapsed: number } {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  return upsertHook("UserPromptSubmit", "", cmd);
}

export function removeUserPromptSubmitHook(): void {
  removeHook("UserPromptSubmit");
}

export function countManagedHooks(hookType: HookType): number {
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.filter((e) => isManagedEntry(e, hookType)).length;
}

export function hasManagedHook(hookType: HookType): boolean {
  return countManagedHooks(hookType) > 0;
}
