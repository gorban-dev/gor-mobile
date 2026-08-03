import { existsSync, readFileSync, writeFileSync } from "node:fs";
import {
  CODEX_CONFIG_TOML,
  DEV_KNOWLEDGE_API_KEY_ENV,
  DEV_KNOWLEDGE_KEY_SHAPE,
  DEV_KNOWLEDGE_MCP_NAME,
  DEV_KNOWLEDGE_MCP_URL,
  MANAGED_TAG
} from "../constants.js";
import { ensureParentDir } from "./paths.js";

const MARKER = `# ${MANAGED_TAG}`;
const HEADER = `[mcp_servers.${DEV_KNOWLEDGE_MCP_NAME}]`;
const TABLE_RE = /^\s*\[/;
const LITERAL_RE = /^\s*http_headers\s*=/;
const LITERAL_KEY_RE = /^\s*http_headers\s*=\s*\{\s*"X-Goog-Api-Key"\s*=\s*"([^"]*)"\s*\}\s*$/;

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

/**
 * The literal key out of a MANAGED table's http_headers line, or null when
 * there is no table, the table is foreign, or it carries the env_http_headers
 * shape. This is the third key source: a user who pastes their key into
 * config.toml following Google's snippet must not lose it on the next repair.
 */
export function codexDevKnowledgeKey(): string | null {
  const content = readConfig();
  if (!content) return null;
  const lines = content.split("\n");
  const table = findTable(lines);
  if (!table || !lines[table.header]!.includes(MANAGED_TAG)) return null;
  for (let i = table.header + 1; i < table.end; i++) {
    const found = LITERAL_KEY_RE.exec(lines[i]!);
    if (found) return found[1] ?? null;
  }
  return null;
}

// Two shapes, exactly one present. A literal header is the only way for Codex
// to see the key without a shell export — it has no settings.env equivalent.
// env_http_headers is the fallback for users who export the variable themselves.
// A key that is not key-shaped falls back to env_http_headers rather than
// emitting TOML that would break the whole file.
function blockLines(key: string | null): string[] {
  const literal = key !== null && DEV_KNOWLEDGE_KEY_SHAPE.test(key) ? key : null;
  return [
    `${HEADER} ${MARKER}`,
    `url = "${DEV_KNOWLEDGE_MCP_URL}"`,
    literal
      ? `http_headers = { "X-Goog-Api-Key" = "${literal}" }`
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
  writeFileSync(CODEX_CONFIG_TOML, lines.join("\n").replace(/\n*$/, "") + "\n");
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
  const remaining = lines.join("\n").replace(/\n*$/, "");
  writeFileSync(CODEX_CONFIG_TOML, remaining.length > 0 ? remaining + "\n" : "");
}
