import { intro, confirm, isCancel, cancel } from "@clack/prompts";
import pc from "picocolors";
import { renderBanner } from "./banner.js";
import { isTuiOn } from "./tui-mode.js";

const BULLETS = [
  "Check base deps (git, curl, node) and detect Google Android CLI.",
  "Clone the architecture rules pack into ~/.gor-mobile/rules/.",
  "Merge SessionStart + UserPromptSubmit hooks into ~/.claude/settings.json.",
  "Install 14 gor-mobile-* skills into ~/.claude/skills/.",
  "Install 2 review agents (Sonnet + Opus) into ~/.claude/agents/.",
  "Register the google-dev-knowledge MCP server in ~/.claude/mcp.json.",
  "Write a managed section into ~/.claude/CLAUDE.md."
];

export async function welcome(skip: boolean): Promise<void> {
  renderBanner();

  if (!isTuiOn() || skip) {
    console.log(pc.bold("What will happen:"));
    for (const b of BULLETS) console.log(`  • ${b}`);
    console.log("");
    return;
  }

  intro(pc.bold(pc.magenta("gor-mobile init")));
  console.log(pc.bold("  What will happen:"));
  for (const b of BULLETS) console.log(`    • ${b}`);
  console.log("");

  const proceed = await confirm({
    message: "Ready to start?",
    initialValue: true
  });
  if (isCancel(proceed) || proceed !== true) {
    cancel("Cancelled");
    process.exit(0);
  }
}
