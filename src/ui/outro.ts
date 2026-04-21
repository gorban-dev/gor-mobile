import pc from "picocolors";

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

/**
 * Plain console.log outro — same reasoning as welcome.ts: avoiding clack's
 * group frame keeps the wizard output from turning into a mix of `│`-fenced
 * and plain-indented lines.
 */
export function finalOutro(s: InstallSummary): void {
  const summary = `Installed: ${s.skills} skills · ${s.agents} agents · ${s.hooks} hooks · ${s.mcp} MCP · rules v${s.rulesVersion}`;
  console.log("");
  console.log(`  ${pc.green("✓")} ${pc.bold(summary)}`);
  console.log("");
  console.log(pc.bold("  Next steps:"));
  for (const n of NEXT_STEPS) console.log(`    ${pc.cyan(n)}`);
  console.log("");
}
