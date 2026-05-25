// Single source of truth for what gor-mobile relies on in the Google `android` CLI.
// We pin a CAPABILITY CONTRACT (command names), not a binary version — Google
// ships android CLI as always-latest/self-updating, so a version pin is neither
// possible (cask is `version :latest`) nor aligned with their design.

/** Minimum android CLI version gor-mobile expects. Drift below this → brew upgrade. */
export const ANDROID_CLI_FLOOR = "1.0.0";

export interface ContractCommand {
  /** argv prefix that identifies the command, e.g. ["studio", "find-usages"]. */
  command: string[];
  /** gor-mobile workflow phase this serves (orchestration value-add). */
  phase: "research" | "plan" | "execute" | "verify" | "debug" | "meta";
  /** one-line purpose — feeds the thin bridge-skill text. */
  purpose: string;
  /** true if the command may be absent without a hard problem (e.g. needs running IDE). */
  conditional?: boolean;
}

export const ANDROID_CONTRACT: ContractCommand[] = [
  { command: ["describe"], phase: "plan", purpose: "JSON metadata: build targets + APK paths" },
  { command: ["info"], phase: "plan", purpose: "SDK location / environment" },
  { command: ["run"], phase: "execute", purpose: "deploy + launch APK (replaces adb install)" },
  { command: ["sdk", "list"], phase: "execute", purpose: "installed vs available SDK packages" },
  { command: ["sdk", "install"], phase: "execute", purpose: "pull a missing platform" },
  { command: ["screen", "capture"], phase: "verify", purpose: "device screenshot (PNG)" },
  { command: ["screen", "resolve"], phase: "verify", purpose: "annotated-label → tap coords" },
  { command: ["layout"], phase: "verify", purpose: "UI tree as JSON" },
  { command: ["emulator", "list"], phase: "execute", purpose: "list AVDs" },
  { command: ["emulator", "start"], phase: "execute", purpose: "boot an AVD" },
  { command: ["docs", "search"], phase: "research", purpose: "search authoritative Android docs" },
  { command: ["docs", "fetch"], phase: "research", purpose: "fetch a doc article" },
  { command: ["skills", "list"], phase: "meta", purpose: "browse Google's optional skill catalog" },
  { command: ["skills", "add"], phase: "meta", purpose: "install an optional Google skill" },
  { command: ["skills", "remove"], phase: "meta", purpose: "remove an optional Google skill" },
  { command: ["init"], phase: "meta", purpose: "install the stock android-cli skill" },
  // studio group — conditional: needs a running Android Studio (Quail+) instance.
  { command: ["studio", "analyze-file"], phase: "debug", purpose: "IDE-level file inspection", conditional: true },
  { command: ["studio", "render-compose-preview"], phase: "debug", purpose: "render a Compose preview", conditional: true },
  { command: ["studio", "find-declaration"], phase: "plan", purpose: "semantic declaration lookup (after ast-index)", conditional: true },
  { command: ["studio", "find-usages"], phase: "plan", purpose: "semantic usage lookup (after ast-index)", conditional: true },
  { command: ["studio", "version-lookup"], phase: "research", purpose: "latest Maven/Android versions", conditional: true }
];

/** Flat, de-duplicated list of top-level commands that must exist (non-conditional). */
export function requiredTopLevelCommands(): string[] {
  return [...new Set(ANDROID_CONTRACT.filter((c) => !c.conditional).map((c) => c.command[0]!))];
}