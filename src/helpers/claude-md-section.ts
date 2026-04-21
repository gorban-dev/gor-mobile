import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  CLAUDE_CLAUDE_MD,
  SECTION_BEGIN,
  SECTION_END
} from "../constants.js";
import { ensureParentDir } from "./paths.js";

function readCurrent(): string {
  if (!existsSync(CLAUDE_CLAUDE_MD)) return "";
  return readFileSync(CLAUDE_CLAUDE_MD, "utf8");
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

export function writeClaudeMdSection(snippetPath: string): void {
  if (!existsSync(snippetPath)) {
    throw new Error(`snippet not found: ${snippetPath}`);
  }
  ensureParentDir(CLAUDE_CLAUDE_MD);
  const existing = readCurrent();
  const stripped = stripManagedSection(existing);
  const snippet = readFileSync(snippetPath, "utf8");

  const prefix = stripped.length > 0 && !stripped.endsWith("\n") ? `${stripped}\n` : stripped;
  const next = `${prefix}\n${SECTION_BEGIN}\n${snippet.endsWith("\n") ? snippet : `${snippet}\n`}${SECTION_END}\n`;
  writeFileSync(CLAUDE_CLAUDE_MD, next);
}

export function removeClaudeMdSection(): void {
  if (!existsSync(CLAUDE_CLAUDE_MD)) return;
  const stripped = stripManagedSection(readCurrent());
  writeFileSync(CLAUDE_CLAUDE_MD, stripped);
}

export function hasClaudeMdSection(): boolean {
  if (!existsSync(CLAUDE_CLAUDE_MD)) return false;
  return readFileSync(CLAUDE_CLAUDE_MD, "utf8").includes(SECTION_BEGIN);
}
