import pc from "picocolors";

type Status = "ok" | "fail" | "warn" | "skip";

const SYMBOLS: Record<Status, string> = {
  ok: pc.green("✓"),
  fail: pc.red("✗"),
  warn: pc.yellow("!"),
  skip: pc.dim("○")
};

function pad(n: number, total: number): string {
  const width = String(total).length;
  return String(n).padStart(width, " ");
}

export function progressItem(
  i: number,
  total: number,
  label: string,
  status: Status,
  note?: string
): void {
  const prefix = pc.dim(`(${pad(i, total)}/${total})`);
  const suffix = note ? pc.dim(` ${note}`) : "";
  console.log(`    ${prefix}  ${label.padEnd(38)} ${SYMBOLS[status]}${suffix}`);
}
