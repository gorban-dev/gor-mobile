import { existsSync } from "node:fs";
import { execa } from "execa";
import { androidCliPath } from "../helpers/deps.js";
import { log } from "../ui/log.js";

export async function cmdAndroid(args: string[]): Promise<void> {
  const cli = androidCliPath();
  if (cli) {
    const res = await execa(cli, args, { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }

  const first = args[0];
  if (
    first &&
    ["build", "assemble", "assembleDebug", "assembleRelease"].includes(first) &&
    existsSync("./gradlew")
  ) {
    log.info(`Falling back to ./gradlew ${first}`);
    const res = await execa("./gradlew", [first], { stdio: "inherit", reject: false });
    process.exit(res.exitCode ?? 0);
  }

  if (!first) {
    log.err("Usage: gor-mobile android <subcommand> [args...]");
    process.exit(1);
  }

  log.err("Android CLI not installed and no gradle fallback available.");
  log.info("Install Google Android CLI from: https://developer.android.com/tools/agents");
  process.exit(1);
}
