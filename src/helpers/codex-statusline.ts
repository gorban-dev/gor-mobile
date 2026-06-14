import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { CODEX_CONFIG_TOML, MANAGED_TAG } from "../constants.js";
import { ensureParentDir } from "./paths.js";

// Codex renders its TUI footer from `tui.status_line` — an ordered array of
// built-in item ids — plus the boolean `tui.status_line_use_colors`. Unlike
// Claude's command-backed statusLine there is no script and no `_managed_by`
// field, so we tag our two lines with a trailing `# gor-mobile` comment (valid
// TOML) and edit config.toml surgically, preserving everything else.
//
// Default item set mirrors a real enabled Codex config: model+reasoning,
// context used, the 5h / weekly usage limits, and live task progress.
export const CODEX_STATUS_LINE_ITEMS = [
  "model-with-reasoning",
  "context-used",
  "five-hour-limit",
  "weekly-limit",
  "task-progress"
];

const MARKER = `# ${MANAGED_TAG}`;
const TUI_HEADER_RE = /^\s*\[tui\]\s*$/;
const TABLE_RE = /^\s*\[/;
const SL_RE = /^\s*status_line\s*=/;
const COLORS_RE = /^\s*status_line_use_colors\s*=/;

function statusLineLine(): string {
  const arr = CODEX_STATUS_LINE_ITEMS.map((i) => `"${i}"`).join(", ");
  return `status_line = [${arr}] ${MARKER}`;
}
const COLORS_LINE = `status_line_use_colors = true ${MARKER}`;

function readConfig(): string {
  return existsSync(CODEX_CONFIG_TOML) ? readFileSync(CODEX_CONFIG_TOML, "utf8") : "";
}

// Locate the `[tui]` table's body — [header+1, end) where `end` is the next
// table header (a `[tui.sub]` subtable or a different table) or EOF.
function findTuiBody(lines: string[]): { header: number; end: number } | null {
  const header = lines.findIndex((l) => TUI_HEADER_RE.test(l));
  if (header === -1) return null;
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (TABLE_RE.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return { header, end };
}

export interface CodexStatusLineState {
  present: boolean;
  managed: boolean;
  foreign: boolean;
}

export function codexStatusLineState(): CodexStatusLineState {
  const content = readConfig();
  if (!content) return { present: false, managed: false, foreign: false };
  const lines = content.split("\n");
  const body = findTuiBody(lines);
  if (!body) return { present: false, managed: false, foreign: false };
  for (let i = body.header + 1; i < body.end; i++) {
    if (SL_RE.test(lines[i]!)) {
      const managed = lines[i]!.includes(MANAGED_TAG);
      return { present: true, managed, foreign: !managed };
    }
  }
  return { present: false, managed: false, foreign: false };
}

// Write our managed status line into config.toml. Refuses (returns false) when
// a FOREIGN status_line exists and force is not set — never clobber the user's
// own footer without consent.
export function installCodexStatusLine(opts: { force?: boolean } = {}): boolean {
  const content = readConfig();
  const sl = statusLineLine();

  const lines = content.length ? content.split("\n") : [];
  const body = findTuiBody(lines);

  if (!body) {
    const base = content.replace(/\n*$/, "");
    const sep = base.length ? "\n\n" : "";
    const next = `${base}${sep}[tui]\n${sl}\n${COLORS_LINE}\n`;
    ensureParentDir(CODEX_CONFIG_TOML);
    writeFileSync(CODEX_CONFIG_TOML, next);
    return true;
  }

  let slIdx = -1;
  let colorsIdx = -1;
  let lastBareKey = body.header;
  for (let i = body.header + 1; i < body.end; i++) {
    const line = lines[i]!;
    if (SL_RE.test(line)) slIdx = i;
    else if (COLORS_RE.test(line)) colorsIdx = i;
    if (line.trim() && !TABLE_RE.test(line)) lastBareKey = i;
  }

  const slForeign = slIdx !== -1 && !lines[slIdx]!.includes(MANAGED_TAG);
  if (slForeign && !opts.force) return false;
  const colorsForeign = colorsIdx !== -1 && !lines[colorsIdx]!.includes(MANAGED_TAG);

  // Drop the lines we are about to rewrite (managed always; foreign only under
  // force). Delete high→low so earlier indices stay valid, and track the insert
  // anchor as lines above it disappear.
  const del: number[] = [];
  if (slIdx !== -1 && (!slForeign || opts.force)) del.push(slIdx);
  if (colorsIdx !== -1 && (!colorsForeign || opts.force)) del.push(colorsIdx);
  del.sort((a, b) => b - a).forEach((i) => {
    lines.splice(i, 1);
    if (i <= lastBareKey) lastBareKey--;
  });

  const insert = [sl];
  // Skip our colors line only when a foreign one must stay (avoids a duplicate
  // key, which TOML forbids).
  if (!(colorsForeign && !opts.force)) insert.push(COLORS_LINE);
  lines.splice(lastBareKey + 1, 0, ...insert);

  ensureParentDir(CODEX_CONFIG_TOML);
  writeFileSync(CODEX_CONFIG_TOML, lines.join("\n"));
  return true;
}

export function removeCodexStatusLine(): void {
  const content = readConfig();
  if (!content) return;
  const lines = content.split("\n");
  const body = findTuiBody(lines);
  if (!body) return;
  const kept: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const inBody = i > body.header && i < body.end;
    const isOurs =
      inBody &&
      (SL_RE.test(lines[i]!) || COLORS_RE.test(lines[i]!)) &&
      lines[i]!.includes(MANAGED_TAG);
    if (isOurs) continue;
    kept.push(lines[i]!);
  }
  writeFileSync(CODEX_CONFIG_TOML, kept.join("\n"));
}
