import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { SECTION_BEGIN, SECTION_END } from "../constants.js";
import { ensureParentDir } from "./paths.js";

function readCurrent(file: string): string {
  if (!existsSync(file)) return "";
  return readFileSync(file, "utf8");
}

function stripManagedSection(content: string): string {
  const lines = content.split("\n");
  const out: string[] = [];
  let inside = false;
  for (const line of lines) {
    if (line === SECTION_BEGIN) {
      inside = true;
      continue;
    }
    if (line === SECTION_END) {
      inside = false;
      continue;
    }
    if (!inside) out.push(line);
  }
  return out.join("\n");
}

// Write our managed snippet between the markers in `file` (a global-instructions
// markdown — ~/.claude/CLAUDE.md or ~/.codex/AGENTS.md). Content outside the
// markers is preserved; the marker mechanics are identical for both targets.
export function writeManagedSection(file: string, snippetPath: string): void {
  if (!existsSync(snippetPath)) {
    throw new Error(`snippet not found: ${snippetPath}`);
  }
  ensureParentDir(file);
  const existing = readCurrent(file);
  const stripped = stripManagedSection(existing);
  const snippet = readFileSync(snippetPath, "utf8");

  const prefix = stripped.length > 0 && !stripped.endsWith("\n") ? `${stripped}\n` : stripped;
  const next = `${prefix}\n${SECTION_BEGIN}\n${snippet.endsWith("\n") ? snippet : `${snippet}\n`}${SECTION_END}\n`;
  writeFileSync(file, next);
}

export function removeManagedSection(file: string): void {
  if (!existsSync(file)) return;
  const stripped = stripManagedSection(readCurrent(file));
  writeFileSync(file, stripped);
}

export function hasManagedSection(file: string): boolean {
  if (!existsSync(file)) return false;
  return readFileSync(file, "utf8").includes(SECTION_BEGIN);
}
