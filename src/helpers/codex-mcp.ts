import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  CODEX_CONFIG_TOML,
  DEV_KNOWLEDGE_API_KEY_ENV,
  DEV_KNOWLEDGE_MCP_NAME,
  DEV_KNOWLEDGE_MCP_URL,
  MANAGED_TAG
} from "../constants.js";
import { ensureParentDir } from "./paths.js";

const MARKER = `# ${MANAGED_TAG}`;
const HEADER = `[mcp_servers.${DEV_KNOWLEDGE_MCP_NAME}]`;
const TABLE_RE = /^\s*\[/;
const LITERAL_RE = /^\s*http_headers\s*=/;

function readConfig(): string {
  return existsSync(CODEX_CONFIG_TOML)
    ? readFileSync(CODEX_CONFIG_TOML, "utf8")
    : "";
}

// [header, end) — end is the next table header or EOF.
function findTable(lines: string[]): { header: number; end: number } | null {
  const header = lines.findIndex((l) => l.trim().startsWith(HEADER));
  if (header === -1) return null;
  let end = lines.length;
  for (let i = header + 1; i < lines.length; i++) {
    if (TABLE_RE.test(lines[i]!)) {
      end = i;
      break;
    }
  }
  return { header, end };
}

export interface CodexMcpState {
  present: boolean;
  managed: boolean;
  foreign: boolean;
  /** true when the block carries the key itself rather than a variable name. */
  hasLiteralKey: boolean;
}

export function codexMcpState(): CodexMcpState {
  const absent = { present: false, managed: false, foreign: false, hasLiteralKey: false };
  const content = readConfig();
  if (!content) return absent;
  const lines = content.split("\n");
  const table = findTable(lines);
  if (!table) return absent;
  const managed = lines[table.header]!.includes(MANAGED_TAG);
  let hasLiteralKey = false;
  for (let i = table.header + 1; i < table.end; i++) {
    if (LITERAL_RE.test(lines[i]!)) hasLiteralKey = true;
  }
  return { present: true, managed, foreign: !managed, hasLiteralKey };
}

// Two shapes, exactly one present. A literal header is the only way for Codex
// to see the key without a shell export — it has no settings.env equivalent.
// env_http_headers is the fallback for users who export the variable themselves.
function blockLines(key: string | null): string[] {
  return [
    `${HEADER} ${MARKER}`,
    `url = "${DEV_KNOWLEDGE_MCP_URL}"`,
    key
      ? `http_headers = { "X-Goog-Api-Key" = "${key}" }`
      : `env_http_headers = { "X-Goog-Api-Key" = "${DEV_KNOWLEDGE_API_KEY_ENV}" }`
  ];
}

/**
 * Write the managed table. Refuses (returns false) when a FOREIGN table with
 * the same name exists and force is not set — the user may have wired OAuth
 * by hand.
 */
export function installCodexDevKnowledgeMcp(
  key: string | null,
  opts: { force?: boolean } = {}
): boolean {
  const content = readConfig();
  const lines = content.length ? content.split("\n") : [];
  const table = findTable(lines);

  if (!table) {
    const base = content.replace(/\n*$/, "");
    const sep = base.length ? "\n\n" : "";
    ensureParentDir(CODEX_CONFIG_TOML);
    writeFileSync(CODEX_CONFIG_TOML, `${base}${sep}${blockLines(key).join("\n")}\n`);
    return true;
  }

  if (!lines[table.header]!.includes(MANAGED_TAG) && !opts.force) return false;

  lines.splice(table.header, table.end - table.header, ...blockLines(key));
  ensureParentDir(CODEX_CONFIG_TOML);
  writeFileSync(CODEX_CONFIG_TOML, lines.join("\n"));
  return true;
}

/** Remove the table, and only when it is ours. */
export function removeCodexDevKnowledgeMcp(): void {
  const content = readConfig();
  if (!content) return;
  const lines = content.split("\n");
  const table = findTable(lines);
  if (!table || !lines[table.header]!.includes(MANAGED_TAG)) return;
  lines.splice(table.header, table.end - table.header);
  writeFileSync(CODEX_CONFIG_TOML, lines.join("\n"));
}
