import { execa } from "execa";
import { androidCliPath } from "../helpers/deps.js";
import { log } from "../ui/log.js";

export async function cmdDocs(query: string[]): Promise<void> {
  const q = query.join(" ").trim();
  if (!q) {
    log.err("Usage: gor-mobile docs <query>");
    process.exitCode = 1;
    return;
  }

  const cli = androidCliPath();
  if (cli) {
    log.info(`→ android docs "${q}"`);
    const res = await execa(cli, ["docs", q], { stdio: "inherit", reject: false });
    if (res.exitCode === 0) return;
    log.warn("android docs returned nothing; falling back to MCP");
  }

  const encoded = encodeURIComponent(q);
  console.log(`Native android docs unavailable for this query.`);
  console.log(``);
  console.log(`Inside Claude Code, ask the google-dev-knowledge MCP server directly:`);
  console.log(`  $ claude > use google-dev-knowledge to find "${q}"`);
  console.log(``);
  console.log(`Or open: https://developer.android.com/search?q=${encoded}`);
}
