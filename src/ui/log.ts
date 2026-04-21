import pc from "picocolors";

function isTty(): boolean {
  return Boolean(process.stderr.isTTY) && !process.env.NO_COLOR;
}

function prefix(symbol: string, color: (s: string) => string): string {
  return isTty() ? color(symbol) : symbol;
}

export const log = {
  info(msg: string): void {
    console.error(`  ${prefix("i", pc.cyan)} ${msg}`);
  },
  ok(msg: string): void {
    console.error(`  ${prefix("✓", pc.green)} ${msg}`);
  },
  warn(msg: string): void {
    console.error(`  ${prefix("!", pc.yellow)} ${msg}`);
  },
  err(msg: string): void {
    console.error(`  ${prefix("✗", pc.red)} ${msg}`);
  },
  step(title: string): void {
    const label = isTty() ? pc.bold(pc.magenta(`▸ ${title}`)) : `▸ ${title}`;
    console.error(`\n${label}`);
  },
  muted(msg: string): void {
    console.error(`  ${isTty() ? pc.dim(msg) : msg}`);
  },
  raw(msg: string): void {
    console.error(msg);
  }
};
