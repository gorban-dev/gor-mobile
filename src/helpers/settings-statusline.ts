import { existsSync } from "node:fs";
import { CLAUDE_SETTINGS, GOR_MOBILE_HOME, MANAGED_TAG } from "../constants.js";
import type { ManagedSettings, StatusLineEntry } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

export type StatusLineVariant = "command" | "cat";

const SCRIPT_FILE: Record<StatusLineVariant, string> = {
  command: "statusline-command.sh",
  cat: "statusline-cat.sh"
};

// Path-independent marker: both variants live in templates/ and share this
// prefix, so a managed statusLine is recognizable even when the absolute path
// embeds a different $HOME / GOR_MOBILE_HOME. Mirrors the hook-dedup identity.
const STATUSLINE_MARKER = "templates/statusline-";

function isManaged(sl: StatusLineEntry | undefined): boolean {
  if (!sl) return false;
  if ((sl._managed_by ?? "") === MANAGED_TAG) return true;
  return typeof sl.command === "string" && sl.command.includes(STATUSLINE_MARKER);
}

function variantOf(sl: StatusLineEntry | undefined): StatusLineVariant | null {
  if (!sl || typeof sl.command !== "string") return null;
  if (sl.command.includes(SCRIPT_FILE.cat)) return "cat";
  if (sl.command.includes(SCRIPT_FILE.command)) return "command";
  return null;
}

export interface StatusLineState {
  present: boolean;
  managed: boolean;
  foreign: boolean;
  variant: StatusLineVariant | null;
}

export function statusLineState(): StatusLineState {
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  const sl = settings.statusLine;
  const present = Boolean(sl);
  const managed = isManaged(sl);
  return { present, managed, foreign: present && !managed, variant: managed ? variantOf(sl) : null };
}

// Write our managed statusLine for `variant`. Refuses (returns false) when a
// FOREIGN statusLine exists and force is not set — never clobber the user's own.
export function installStatusLine(
  variant: StatusLineVariant,
  opts: { force?: boolean } = {}
): boolean {
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  if (settings.statusLine && !isManaged(settings.statusLine) && !opts.force) {
    return false;
  }
  settings.statusLine = {
    type: "command",
    command: `bash ${GOR_MOBILE_HOME}/templates/${SCRIPT_FILE[variant]}`,
    _managed_by: MANAGED_TAG
  };
  writeJson(CLAUDE_SETTINGS, settings);
  return true;
}

export function removeStatusLine(): void {
  if (!existsSync(CLAUDE_SETTINGS)) return;
  const settings = readJsonSafe<ManagedSettings>(CLAUDE_SETTINGS, {});
  if (isManaged(settings.statusLine)) {
    delete settings.statusLine;
    writeJson(CLAUDE_SETTINGS, settings);
  }
}