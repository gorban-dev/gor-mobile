import { outro as clackOutro } from "@clack/prompts";
import pc from "picocolors";
import { isTuiOn } from "./tui-mode.js";

export interface InstallSummary {
  skills: number;
  agents: number;
  hooks: number;
  mcp: number;
  rulesVersion: string;
}

const NEXT_STEPS = [
  "gor-mobile doctor           verify setup",
  "gor-mobile rules list       inspect installed architecture rules",
  "cd <android-project>        open Claude Code; the session-start hook loads workflow"
];

export function finalOutro(s: InstallSummary): void {
  const summary = `Installed: ${s.skills} skills · ${s.agents} agents · ${s.hooks} hooks · ${s.mcp} MCP · rules v${s.rulesVersion}`;
  if (isTuiOn()) {
    const lines = [pc.green(summary), "", pc.bold("Next steps:"), ...NEXT_STEPS.map((n) => `  ${pc.cyan(n)}`)];
    clackOutro(lines.join("\n"));
    return;
  }
  console.log("");
  console.log(pc.bold(summary));
  console.log("");
  console.log(pc.bold("Next steps:"));
  for (const n of NEXT_STEPS) console.log(`  ${pc.cyan(n)}`);
  console.log("");
}
