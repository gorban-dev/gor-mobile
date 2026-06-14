import { existsSync, readdirSync } from "node:fs";
import {
  CLAUDE_AGENTS_DIR,
  CLAUDE_CLAUDE_MD,
  CLAUDE_DIR,
  CLAUDE_SETTINGS,
  CLAUDE_SKILLS_DIR,
  CODEX_AGENTS_DIR,
  CODEX_AGENTS_MD,
  CODEX_DIR,
  CODEX_HOOKS_JSON,
  CODEX_SKILLS_DIR
} from "./constants.js";
import { hasManagedHooksInFile } from "./helpers/settings-merge.js";

export type TargetId = "claude" | "codex";

export type HooksKind = "claude-settings" | "codex-hooks-json";
export type AgentFormat = "md" | "toml";
export type AndroidAgentFlag = "claude-code" | "codex";
// claude-command: a command-backed `statusLine` in settings.json (Classic/Cat
// scripts). codex-config: built-in `tui.status_line` item list in config.toml.
export type StatusLineKind = "claude-command" | "codex-config";

export interface TargetSpec {
  id: TargetId;
  label: string;
  /** agent home directory (~/.claude or ~/.codex / $CODEX_HOME). */
  home: string;
  skillsDir: string;
  agentsDir: string;
  /** global-instructions markdown file (CLAUDE.md / AGENTS.md). */
  instructionsFile: string;
  /** file that carries the managed hook entries (settings.json / hooks.json). */
  hooksFile: string;
  hooksKind: HooksKind;
  /** on-disk agent template format the target consumes. */
  agentFormat: AgentFormat;
  /** value passed to `android init --agent=<flag>`. */
  androidAgentFlag: AndroidAgentFlag;
  supportsStatusLine: boolean;
  /** which status-line mechanism this target uses (null = none). */
  statusLineKind: StatusLineKind | null;
  supportsMcpPrune: boolean;
}

export const TARGETS: Record<TargetId, TargetSpec> = {
  claude: {
    id: "claude",
    label: "Claude Code",
    home: CLAUDE_DIR,
    skillsDir: CLAUDE_SKILLS_DIR,
    agentsDir: CLAUDE_AGENTS_DIR,
    instructionsFile: CLAUDE_CLAUDE_MD,
    hooksFile: CLAUDE_SETTINGS,
    hooksKind: "claude-settings",
    agentFormat: "md",
    androidAgentFlag: "claude-code",
    supportsStatusLine: true,
    statusLineKind: "claude-command",
    supportsMcpPrune: true
  },
  codex: {
    id: "codex",
    label: "Codex",
    home: CODEX_DIR,
    skillsDir: CODEX_SKILLS_DIR,
    agentsDir: CODEX_AGENTS_DIR,
    instructionsFile: CODEX_AGENTS_MD,
    hooksFile: CODEX_HOOKS_JSON,
    hooksKind: "codex-hooks-json",
    agentFormat: "toml",
    androidAgentFlag: "codex",
    supportsStatusLine: true,
    statusLineKind: "codex-config",
    supportsMcpPrune: false
  }
};

export const ALL_TARGET_IDS: TargetId[] = ["claude", "codex"];

export function targetSpecs(ids: TargetId[]): TargetSpec[] {
  return ids.map((id) => TARGETS[id]);
}

/** A home dir physically exists → the agent is (probably) installed. */
export function agentHomeExists(id: TargetId): boolean {
  return existsSync(TARGETS[id].home);
}

/** Targets whose home directory exists. */
export function detectInstalledTargets(): TargetId[] {
  return ALL_TARGET_IDS.filter(agentHomeExists);
}

function hasGorMobileSkills(skillsDir: string): boolean {
  if (!existsSync(skillsDir)) return false;
  try {
    return readdirSync(skillsDir).some((e) => e.startsWith("gor-mobile-"));
  } catch {
    return false;
  }
}

/** Targets that carry a gor-mobile footprint (managed hook OR gor-mobile-* skills). */
export function detectGorMobileTargets(): TargetId[] {
  return ALL_TARGET_IDS.filter((id) => {
    const spec = TARGETS[id];
    return (
      hasManagedHooksInFile(spec.hooksFile) || hasGorMobileSkills(spec.skillsDir)
    );
  });
}

/** Parse a `--target claude,codex` flag into validated ids. Throws on garbage. */
export function parseTargetFlag(raw: string): TargetId[] {
  const seen = new Set<TargetId>();
  const out: TargetId[] = [];
  for (const part of raw.split(",")) {
    const t = part.trim().toLowerCase();
    if (!t) continue;
    if (t !== "claude" && t !== "codex") {
      throw new Error(`unknown target '${t}' — valid targets: claude, codex`);
    }
    if (!seen.has(t)) {
      seen.add(t);
      out.push(t);
    }
  }
  if (out.length === 0) {
    throw new Error("no valid targets in --target (expected claude and/or codex)");
  }
  return out;
}
