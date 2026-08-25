import { join } from "node:path";
import { execa } from "execa";
import { HOME } from "../constants.js";
import { which } from "./deps.js";

export const DEBROID_REPO_URL = "https://github.com/PatilShreyas/debroid";
export const DEBROID_INSTALL_CMD =
  "curl -fsSL https://raw.githubusercontent.com/PatilShreyas/debroid/main/install.sh | bash";

// Capability contract, not a version pin (same model as the android CLI):
// the integration relies on these command names existing; the binary itself
// ships always-latest.
export const DEBROID_CONTRACT = [
  "launch",
  "attach",
  "break",
  "catch-exception",
  "pause-state",
  "inspect",
  "set-var",
  "resume"
];

export function debroidPath(): string | null {
  return which("debroid");
}

/** present=false → binary absent (missing is meaningless then). */
export async function debroidContract(): Promise<{ present: boolean; missing: string[] }> {
  if (!debroidPath()) return { present: false, missing: [] };
  const res = await execa("debroid", ["--help"], { reject: false });
  const text = `${res.stdout ?? ""}\n${res.stderr ?? ""}`;
  const missing = DEBROID_CONTRACT.filter((c) => !text.includes(c));
  return { present: true, missing };
}

/** Debroid ships its own agent skill; init links it into project skills. */
export function debroidSkillSourceDir(): string {
  return join(HOME, ".debroid", "skills", "debroid-cli");
}
