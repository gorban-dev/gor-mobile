import { existsSync, readdirSync } from "node:fs";
import pc from "picocolors";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_CLAUDE_MD,
  CLAUDE_SETTINGS,
  CLAUDE_SKILLS_DIR
} from "../constants.js";
import { hasManagedSection } from "./claude-md-section.js";
import { hasManagedHooksInFile } from "./settings-merge.js";
import { log } from "../ui/log.js";

export interface LegacyFinding {
  label: string;
  path: string;
}

// v0.1.x–v0.2.x installed the Claude footprint globally (~/.claude). The new
// model keeps only the status line there, so ANY of these is a legacy install.
// Codex is intentionally excluded: its user-level layout is still current.
export function legacyClaudeFootprint(): LegacyFinding[] {
  const findings: LegacyFinding[] = [];
  if (existsSync(CLAUDE_SKILLS_DIR)) {
    const skills = readdirSync(CLAUDE_SKILLS_DIR).filter((e) =>
      e.startsWith("gor-mobile-")
    );
    if (skills.length > 0) {
      findings.push({
        label: `${skills.length} gor-mobile-* skills`,
        path: CLAUDE_SKILLS_DIR
      });
    }
  }
  if (existsSync(CLAUDE_AGENTS_DIR)) {
    const agents = readdirSync(CLAUDE_AGENTS_DIR).filter(
      (e) => e.startsWith("gor-mobile-") && e.endsWith(".md")
    );
    if (agents.length > 0) {
      findings.push({
        label: `${agents.length} gor-mobile-* agents`,
        path: CLAUDE_AGENTS_DIR
      });
    }
  }
  if (hasManagedHooksInFile(CLAUDE_SETTINGS)) {
    findings.push({ label: "managed hooks", path: CLAUDE_SETTINGS });
  }
  if (hasManagedSection(CLAUDE_CLAUDE_MD)) {
    findings.push({ label: "managed CLAUDE.md section", path: CLAUDE_CLAUDE_MD });
  }
  return findings;
}

function printBanner(findings: LegacyFinding[]): void {
  console.error("");
  console.error(pc.yellow("┌─ gor-mobile: legacy v0.2.x install detected ─┐"));
  for (const f of findings) {
    console.error(pc.yellow(`│ ${f.label} → ${f.path}`));
  }
  console.error(
    pc.yellow(
      "│ Since v0.3.0 the Claude workflow installs per-project. Run 'gor-mobile migrate',"
    )
  );
  console.error(
    pc.yellow(
      "│ then 'gor-mobile setup' once and 'gor-mobile init' in each mobile repo."
    )
  );
  console.error(pc.yellow("└───────────────────────────────────────────────┘"));
  console.error("");
}

/**
 * Legacy notice for every command. `block: true` (init/doctor/repair/update)
 * refuses to run on top of the old layout so the two never mix; the rest only
 * warn. Returns true when the caller must abort.
 */
export function legacyGate(opts: { block: boolean }): boolean {
  const findings = legacyClaudeFootprint();
  if (findings.length === 0) return false;
  printBanner(findings);
  if (opts.block) {
    log.err("blocked: migrate the legacy install first (gor-mobile migrate)");
    return true;
  }
  return false;
}
