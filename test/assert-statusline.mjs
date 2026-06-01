import { readFileSync, existsSync } from "node:fs";

// usage: assert-statusline.mjs <settings.json> <managed|foreign|absent> [variant]
// env GM_HOME (optional): when mode=managed, assert the command points at it.
const [, , settingsPath, mode, variant] = process.argv;
const MARKER = "templates/statusline-";

const settings = existsSync(settingsPath)
  ? JSON.parse(readFileSync(settingsPath, "utf8"))
  : {};
const sl = settings.statusLine;
const present = Boolean(sl);
const cmd = sl && typeof sl.command === "string" ? sl.command : "";
const managed = present && ((sl._managed_by ?? "") === "gor-mobile" || cmd.includes(MARKER));
const foreign = present && !managed;
const vr = cmd.includes("statusline-cat.sh")
  ? "cat"
  : cmd.includes("statusline-command.sh")
    ? "command"
    : null;

const ok = (m) => console.log(`  ok   ${m}`);
const fail = (m) => {
  console.log(`  FAIL ${m}`);
  process.exit(1);
};

if (mode === "managed") {
  managed ? ok(`managed statusLine present (variant ${vr})`) : fail("expected managed statusLine");
  if (variant && vr !== variant) fail(`expected variant ${variant}, got ${vr}`);
  if (process.env.GM_HOME) {
    cmd.includes(process.env.GM_HOME)
      ? ok("command points at current GOR_MOBILE_HOME")
      : fail(`command does not point at current home: ${cmd}`);
  }
} else if (mode === "foreign") {
  foreign ? ok("foreign statusLine preserved") : fail(`expected foreign, present=${present} managed=${managed}`);
} else if (mode === "absent") {
  present ? fail(`expected no statusLine, found ${JSON.stringify(sl)}`) : ok("statusLine absent");
} else {
  fail(`unknown mode ${mode}`);
}