import pc from "picocolors";

export const STEP_LABELS = [
  "deps",
  "android",
  "rules",
  "hooks",
  "skills",
  "agents",
  "mcp",
  "claude-md",
  "summary"
] as const;

function breadcrumb(current: number, labels: readonly string[]): string {
  const sep = pc.dim(" › ");
  return labels
    .map((label, i) => {
      const step = i + 1;
      if (step < current) return pc.green(`✓ ${label}`);
      if (step === current) return pc.bold(pc.magenta(`▸ ${label}`));
      return pc.dim(label);
    })
    .join(sep);
}

export function sectionHeader(n: number, total: number, title: string): void {
  console.log("");
  const labels = STEP_LABELS.length === total ? STEP_LABELS : (Array.from({ length: total }, (_, i) => String(i + 1)));
  console.log(`  ${breadcrumb(n, labels)}`);
  const lead = pc.bold(pc.magenta(`${n}/${total}`));
  console.log(`  ${lead}  ${pc.bold(title)}`);
}
