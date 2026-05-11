import { confirm, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import { renderBanner } from "./banner.js";
import { isTuiOn } from "./tui-mode.js";

const BULLETS = [
  "Check base deps (git, curl, node).",
  "Install (via curl) + initialize the Google Android CLI; drops ~/.claude/skills/android-cli/ SKILL.md.",
  "Clone the architecture rules pack into ~/.gor-mobile/rules/.",
  "Merge SessionStart + UserPromptSubmit hooks into ~/.claude/settings.json.",
  "Install 14 gor-mobile-* skills into ~/.claude/skills/.",
  "Install 2 review agents (Sonnet + Opus) into ~/.claude/agents/.",
  "Write a managed section into ~/.claude/CLAUDE.md."
];

/**
 * Banner + 'What will happen' bullets. Intentionally uses plain console.log
 * (not clack's intro()) so the vertical `│` group frame doesn't collide with
 * the breadcrumb/section-header lines printed by the wizard loop below.
 */
export async function welcome(skip: boolean): Promise<void> {
  renderBanner();
  console.log(pc.bold("  What will happen:"));
  for (const b of BULLETS) console.log(`    ${pc.dim("•")} ${b}`);
  console.log("");

  if (skip || !isTuiOn()) return;

  const proceed = await confirm({
    message: "Ready to start?",
    initialValue: true
  });
  if (isCancel(proceed) || proceed !== true) {
    cancel("Cancelled");
    process.exit(0);
  }
}
