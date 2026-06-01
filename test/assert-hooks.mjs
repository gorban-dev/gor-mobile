import { readFileSync } from "node:fs";

// Stand-alone oracle for the hook-idempotency regression. Reads a settings.json
// path from argv and asserts each managed hook event collapsed to a single
// tagged entry while leaving unrelated third-party hooks untouched. Mirrors the
// identity rule in src/helpers/settings-merge.ts (tagged OR command points at
// our template) so the test fails loudly if that rule regresses.
const settingsPath = process.argv[2];
if (!settingsPath) {
  console.error("usage: assert-hooks.mjs <settings.json>");
  process.exit(2);
}

const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

const MARKERS = {
  SessionStart: "templates/session-start-hook.sh",
  UserPromptSubmit: "templates/user-prompt-submit-hook.sh"
};

let failures = 0;
function check(cond, msg) {
  console.log(`  ${cond ? "ok  " : "FAIL"} ${msg}`);
  if (!cond) failures++;
}

for (const [event, marker] of Object.entries(MARKERS)) {
  const entries = settings.hooks?.[event] ?? [];
  const isManaged = (e) =>
    (e._managed_by ?? "") === "gor-mobile" ||
    (e.hooks ?? []).some(
      (h) => typeof h.command === "string" && h.command.includes(marker)
    );
  const managed = entries.filter(isManaged);
  const tagged = managed.filter((e) => (e._managed_by ?? "") === "gor-mobile");
  const thirdParty = entries.filter((e) => !isManaged(e));

  check(managed.length === 1, `${event}: exactly one managed entry (got ${managed.length})`);
  check(tagged.length === 1, `${event}: surviving managed entry is tagged (got ${tagged.length})`);
  check(thirdParty.length === 1, `${event}: unrelated third-party hook preserved (got ${thirdParty.length})`);
}

if (failures > 0) {
  console.log(`\n${failures} assertion(s) failed`);
  process.exit(1);
}
console.log("\nall assertions passed");
