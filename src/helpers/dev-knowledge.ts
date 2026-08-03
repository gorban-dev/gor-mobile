import {
  DEV_KNOWLEDGE_API_KEY_ENV,
  DEV_KNOWLEDGE_CREDENTIALS_URL,
  DEV_KNOWLEDGE_DOCS_URL,
  DEV_KNOWLEDGE_ENABLE_API_URL,
  DEV_KNOWLEDGE_KEY_SHAPE
} from "../constants.js";
import { agentHomeExists } from "../targets.js";
import { confirmStep, passwordPrompt } from "../ui/confirm-step.js";
import { log } from "../ui/log.js";
import { note } from "../ui/note.js";
import { isTuiOn } from "../ui/tui-mode.js";
import { claudeEnvValue, setClaudeEnv } from "./claude-env.js";
import {
  codexDevKnowledgeKey,
  codexMcpState,
  installCodexDevKnowledgeMcp
} from "./codex-mcp.js";
import { openUrl } from "./open-url.js";

export type KeySource = "environment" | "claude-settings" | "codex-config" | "none";

export const KEY_SOURCE_LABEL: Record<KeySource, string> = {
  environment: `$${DEV_KNOWLEDGE_API_KEY_ENV}`,
  "claude-settings": "~/.claude/settings.json env",
  "codex-config": "~/.codex/config.toml",
  none: "not set"
};

export interface ResolvedKey {
  key: string | null;
  source: KeySource;
}

// Only the source label is ever printed; the value stays out of every log line.
const KEY_SHAPE_HINT =
  "Google API keys are letters, digits, '-' and '_' only";

/**
 * Environment wins: an exported value is what the harnesses would see anyway.
 * Then ~/.claude/settings.json env, then the literal in our own Codex table —
 * the last one is what a user gets when they paste the key into config.toml by
 * hand, and it must survive a repair.
 */
export function resolveDevKnowledgeKey(): ResolvedKey {
  const fromEnv = process.env[DEV_KNOWLEDGE_API_KEY_ENV];
  if (fromEnv && fromEnv.trim().length > 0) {
    return { key: fromEnv.trim(), source: "environment" };
  }
  const fromClaude = claudeEnvValue(DEV_KNOWLEDGE_API_KEY_ENV);
  if (fromClaude && fromClaude.trim().length > 0) {
    return { key: fromClaude.trim(), source: "claude-settings" };
  }
  const fromCodex = codexDevKnowledgeKey();
  if (fromCodex && fromCodex.trim().length > 0) {
    return { key: fromCodex.trim(), source: "codex-config" };
  }
  return { key: null, source: "none" };
}

/** Write the key into every harness config gor-mobile manages. */
export function persistDevKnowledgeKey(key: string): void {
  const trimmed = key.trim();
  if (trimmed.length === 0) return;
  if (!DEV_KNOWLEDGE_KEY_SHAPE.test(trimmed)) {
    log.warn(`Not storing that API key — ${KEY_SHAPE_HINT}`);
    return;
  }
  setClaudeEnv(DEV_KNOWLEDGE_API_KEY_ENV, trimmed);
  if (agentHomeExists("codex")) {
    installCodexDevKnowledgeMcp(trimmed, { force: codexMcpState().managed });
  }
}

/**
 * Masked prompt. Returns null on empty input or a non-interactive run — a
 * secret is never taken from argv, so there is no flag to fall back to. A value
 * that is not key-shaped is refused here, once, rather than escaped downstream:
 * a quote in it would corrupt the user's whole ~/.codex/config.toml.
 */
export async function captureDevKnowledgeKey(): Promise<string | null> {
  if (!isTuiOn()) return null;
  const entered = (await passwordPrompt("Developer Knowledge API key (Enter to skip)")).trim();
  if (entered.length === 0) return null;
  if (!DEV_KNOWLEDGE_KEY_SHAPE.test(entered)) {
    log.warn(`That does not look like an API key — ${KEY_SHAPE_HINT}. Ignored.`);
    return null;
  }
  return entered;
}

const GUIDE_LINES = [
  "Firebase / Google Cloud / Maps / Play docs come from Google's Developer",
  "Knowledge MCP server. It needs an API key:",
  "",
  "  1. Enable the Developer Knowledge API — click Enable:",
  `     ${DEV_KNOWLEDGE_ENABLE_API_URL}`,
  "",
  "  2. Create credentials → API key, then Select API restrictions →",
  '     "Developer Knowledge API":',
  `     ${DEV_KNOWLEDGE_CREDENTIALS_URL}`,
  "",
  "  3. Paste it into this wizard, or re-run later: gor-mobile mcp",
  "",
  "Via gcloud instead:",
  "  gcloud services enable developerknowledge.googleapis.com --project=PROJECT_ID",
  '  gcloud services api-keys create --project=PROJECT_ID --display-name="DK API Key"',
  "  gcloud services api-keys update KEY_NAME \\",
  "    --api-target=service=developerknowledge.googleapis.com",
  "",
  "Reusing this key for model calls (GEMINI_API_KEY) also requires allowing",
  "the Generative Language API, or those calls get blocked.",
  "",
  `Docs: ${DEV_KNOWLEDGE_DOCS_URL}`
];

export function printDevKnowledgeGuide(): void {
  note(GUIDE_LINES.join("\n"), "Google Developer Knowledge — API key needed");
}

/** Offer to open the two Cloud Console pages. Silent when the TUI is off. */
export async function offerDevKnowledgeLinks(): Promise<void> {
  if (!isTuiOn()) return;
  const pages: Array<[string, string]> = [
    ["Open the Developer Knowledge API page in your browser?", DEV_KNOWLEDGE_ENABLE_API_URL],
    ["Open the API-key creation page?", DEV_KNOWLEDGE_CREDENTIALS_URL]
  ];
  for (const [question, url] of pages) {
    if (!(await confirmStep(question, true))) continue;
    if (!openUrl(url)) log.warn(`No browser opener found — visit ${url}`);
  }
}