import { existsSync } from "node:fs";
import { GOR_MOBILE_HOME, MANAGED_TAG } from "../constants.js";
import type { HookEntry, ManagedSettings } from "../types.js";
import type { TargetSpec } from "../targets.js";
import { ensureParentDir, readJsonSafe, writeJson } from "./paths.js";

type HookType = "SessionStart" | "UserPromptSubmit" | "PreToolUse";

// Path-independent fingerprint of each managed hook's command. The absolute
// path in the stored command differs per machine (it embeds $HOME / a custom
// GOR_MOBILE_HOME), but the `templates/<file>.sh` tail is invariant — match on
// it so legacy, untagged entries are still recognized as ours.
const HOOK_MARKER: Record<HookType, string> = {
  SessionStart: "templates/session-start-hook.sh",
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh",
  PreToolUse: "templates/ast-index-guard-hook.sh"
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

function ensureSettingsFile(hooksFile: string): ManagedSettings {
  ensureParentDir(hooksFile);
  if (!existsSync(hooksFile)) {
    writeJson(hooksFile, {});
  }
  return readJsonSafe<ManagedSettings>(hooksFile, {});
}

// Replace every managed entry (tagged or legacy-untagged) for this event with a
// single freshly-tagged one. Returns how many prior managed entries were folded
// in, so callers can report `collapsed N → 1` when self-healing duplicates.
// For Claude the file is settings.json (other keys preserved); for Codex it is
// a dedicated hooks.json — same `{ "hooks": { ... } }` shape either way.
function upsertHook(
  hooksFile: string,
  hookType: HookType,
  matcher: string,
  command: string
): { collapsed: number } {
  const settings = ensureSettingsFile(hooksFile);
  settings.hooks = settings.hooks ?? {};
  const existing = settings.hooks[hookType] ?? [];
  const previous = existing.filter((entry) => !isManagedEntry(entry, hookType));
  const next: HookEntry = {
    _managed_by: MANAGED_TAG,
    matcher,
    hooks: [{ type: "command", command }]
  };
  settings.hooks[hookType] = [...previous, next];
  writeJson(hooksFile, settings);
  return { collapsed: existing.length - previous.length };
}

function removeHook(hooksFile: string, hookType: HookType): void {
  if (!existsSync(hooksFile)) return;
  const settings = readJsonSafe<ManagedSettings>(hooksFile, {});
  if (!settings.hooks || !settings.hooks[hookType]) return;
  const remaining = settings.hooks[hookType].filter(
    (entry) => !isManagedEntry(entry, hookType)
  );
  if (remaining.length === 0) {
    delete settings.hooks[hookType];
  } else {
    settings.hooks[hookType] = remaining;
  }
  writeJson(hooksFile, settings);
}

// session-start-hook.sh branches on GORM_SKILLS_DIR: unset → Claude per-project
// mode (the hook finds the repo root by walking up to .gor-mobile.json and reads
// <root>/.claude/skills); set → Codex user-level, always inject from that folder.
// So the bare command is exactly the project-mode signal.
function sessionStartCommand(target: TargetSpec): string {
  const base = `bash ${GOR_MOBILE_HOME}/templates/session-start-hook.sh`;
  return target.id === "claude"
    ? base
    : `GORM_SKILLS_DIR=${target.skillsDir} ${base}`;
}

export function installSessionStartHook(target: TargetSpec): { collapsed: number } {
  return upsertHook(
    target.hooksFile,
    "SessionStart",
    "startup|clear|compact|resume",
    sessionStartCommand(target)
  );
}

export function removeSessionStartHook(target: TargetSpec): void {
  removeHook(target.hooksFile, "SessionStart");
}

export function installUserPromptSubmitHook(target: TargetSpec): { collapsed: number } {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/user-prompt-submit-hook.sh`;
  return upsertHook(target.hooksFile, "UserPromptSubmit", "", cmd);
}

export function removeUserPromptSubmitHook(target: TargetSpec): void {
  removeHook(target.hooksFile, "UserPromptSubmit");
}

// Codex ships PreToolUse too (stable since codex-cli 0.142, same exit-2 +
// stderr deny contract — developers.openai.com/codex/hooks), but has no Grep
// tool (grep only ever arrives via Bash) and intercepts only simple shell
// commands, so its matcher is Bash-only and the prose contour stays as the
// backstop for the partial coverage.
export function installAstIndexGuardHook(target: TargetSpec): { collapsed: number } {
  const cmd = `bash ${GOR_MOBILE_HOME}/templates/ast-index-guard-hook.sh`;
  const matcher = target.id === "claude" ? "Grep|Bash" : "Bash";
  return upsertHook(target.hooksFile, "PreToolUse", matcher, cmd);
}

export function removeAstIndexGuardHook(target: TargetSpec): void {
  removeHook(target.hooksFile, "PreToolUse");
}

// Claude Code's plan-approval dialog is the one place the harness clears
// context exactly once, at the plan→execute seam ("Yes, clear context …").
// The option is gated by this setting, off by default — the writing-plans
// handoff relies on it, so init/repair enable it in settings.local.json.
// If a future CLI drops the setting, the dialog simply loses the option and
// the overlay's AskUserQuestion fallback still covers the seam.
export const CLEAR_CONTEXT_ON_PLAN_ACCEPT = "showClearContextOnPlanAccept";

/** Returns true if this run turned the setting on (false = already enabled). */
export function enableClearContextOnPlanAccept(file: string): boolean {
  const settings = ensureSettingsFile(file);
  if (settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT] === true) return false;
  settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT] = true;
  writeJson(file, settings);
  return true;
}

export function removeClearContextOnPlanAccept(file: string): void {
  if (!existsSync(file)) return;
  const settings = readJsonSafe<ManagedSettings>(file, {});
  if (!(CLEAR_CONTEXT_ON_PLAN_ACCEPT in settings)) return;
  delete settings[CLEAR_CONTEXT_ON_PLAN_ACCEPT];
  writeJson(file, settings);
}

export function countManagedHooks(hookType: HookType, target: TargetSpec): number {
  const settings = readJsonSafe<ManagedSettings>(target.hooksFile, {});
  const entries = settings.hooks?.[hookType] ?? [];
  return entries.filter((e) => isManagedEntry(e, hookType)).length;
}

export function hasManagedHook(hookType: HookType, target: TargetSpec): boolean {
  return countManagedHooks(hookType, target) > 0;
}

// Path-based probe used by target detection — true if either managed hook event
// has at least one of our entries in the given hooks file.
export function hasManagedHooksInFile(hooksFile: string): boolean {
  const settings = readJsonSafe<ManagedSettings>(hooksFile, {});
  for (const hookType of ["SessionStart", "UserPromptSubmit", "PreToolUse"] as const) {
    const entries = settings.hooks?.[hookType] ?? [];
    if (entries.some((e) => isManagedEntry(e, hookType))) return true;
  }
  return false;
}
