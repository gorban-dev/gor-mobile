import pc from "picocolors";

function progressStrip(current: number, total: number): string {
  const chars: string[] = [];
  for (let i = 1; i <= total; i++) {
    if (i < current) chars.push(pc.green("●"));
    else if (i === current) chars.push(pc.magenta("▸"));
    else chars.push(pc.dim("○"));
  }
  return chars.join("");
}

export function sectionHeader(n: number, total: number, title: string): void {
  console.log("");
  const strip = progressStrip(n, total);
  const lead = pc.bold(pc.magenta(`${n}/${total}`));
  console.log(`  ${strip}  ${lead}  ${pc.bold(title)}`);
}
