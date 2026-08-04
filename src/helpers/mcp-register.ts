import { existsSync, readFileSync, realpathSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  CLAUDE_JSON,
  CLAUDE_MCP,
  DEV_KNOWLEDGE_API_KEY_ENV,
  DEV_KNOWLEDGE_MCP_NAME,
  DEV_KNOWLEDGE_MCP_URL,
  MANAGED_TAG
} from "../constants.js";
import type { McpConfig, McpServer } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

export function unregisterManaged(): void {
  if (!existsSync(CLAUDE_MCP)) return;
  const cfg = readJsonSafe<McpConfig>(CLAUDE_MCP, {});
  if (!cfg.mcpServers) return;
  const filtered: Record<string, McpServer> = {};
  for (const [name, server] of Object.entries(cfg.mcpServers)) {
    if ((server._managed_by ?? "") !== MANAGED_TAG) {
      filtered[name] = server;
    }
  }
  cfg.mcpServers = filtered;
  writeJson(CLAUDE_MCP, cfg);
}

/**
 * Where installs before v0.3.6 registered the server: a project-scoped file at
 * the repo root. Nothing writes it anymore — the name survives so init, repair
 * and uninstall can take that file (and its ignore line) back out.
 */
export const LEGACY_PROJECT_MCP_FILE = ".mcp.json";

/** One wording for every command that can meet an unparseable MCP config. */
export function malformedMcpMessage(path: string): string {
  return `${path} is not valid JSON — left untouched; fix it and re-run`;
}

interface ProjectEntry {
  mcpServers?: Record<string, McpServer>;
  [key: string]: unknown;
}

interface ClaudeJson {
  projects?: Record<string, ProjectEntry>;
  [key: string]: unknown;
}

/**
 * Claude Code keys `projects` by the symlink-resolved path (/private/var/…,
 * not /var/…), so an unresolved key is simply never read back.
 */
function projectKey(root: string): string {
  try {
    return realpathSync(root);
  } catch {
    return root;
  }
}

// No _managed_by field goes into this entry: Claude Code parses it, and an
// unknown key risks the server. Ownership lives in
// .gor-mobile/marker.json -> managed_mcp instead.
function devKnowledgeEntry(): McpServer {
  return {
    type: "http",
    url: DEV_KNOWLEDGE_MCP_URL,
    headers: { "X-Goog-Api-Key": `\${${DEV_KNOWLEDGE_API_KEY_ENV}}` }
  };
}

export interface RegisterResult {
  /** the file was rewritten (or, for unregister, had our entry taken out). */
  written: boolean;
  path: string;
  /** the config is on disk but does not parse — nothing was written. */
  malformed?: boolean;
}

type JsonRead<T> = { malformed: true; config: null } | { malformed: false; config: T };

/**
 * Parse a config we merge into. readJsonSafe cannot be used here: it maps a
 * parse error onto the same fallback as "file absent", and writing a fresh
 * config over a typo would drop everything the file holds — for ~/.claude.json
 * that is every project's history and settings. A non-object root (array,
 * scalar, null) counts as malformed for the same reason.
 */
function readObjectJson<T extends object>(path: string): JsonRead<T> {
  if (!existsSync(path)) return { malformed: false, config: {} as T };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { malformed: true, config: null };
    }
    return { malformed: false, config: parsed as T };
  } catch {
    return { malformed: true, config: null };
  }
}

/**
 * Merge the Developer Knowledge server into Claude Code's local scope —
 * ~/.claude.json, `projects["<repo>"].mcpServers`. Local scope keeps the repo
 * itself clean (nothing lands in the working tree) and needs no approval step.
 * `owned` carries marker.managed_mcp — a same-named entry we do not own is left
 * alone and the call reports written: false.
 */
export function registerLocalMcp(root: string, owned: string[] = []): RegisterResult {
  const read = readObjectJson<ClaudeJson>(CLAUDE_JSON);
  if (read.malformed) return { written: false, path: CLAUDE_JSON, malformed: true };
  const cfg = read.config;
  const projects = cfg.projects ?? {};
  const key = projectKey(root);
  const entry = projects[key] ?? {};
  const servers = entry.mcpServers ?? {};
  if (servers[DEV_KNOWLEDGE_MCP_NAME] && !owned.includes(DEV_KNOWLEDGE_MCP_NAME)) {
    return { written: false, path: CLAUDE_JSON };
  }
  servers[DEV_KNOWLEDGE_MCP_NAME] = devKnowledgeEntry();
  entry.mcpServers = servers;
  projects[key] = entry;
  cfg.projects = projects;
  writeJson(CLAUDE_JSON, cfg);
  return { written: true, path: CLAUDE_JSON };
}

/** Drop the named servers from this repo's local scope. */
export function unregisterLocalMcp(root: string, names: string[]): RegisterResult {
  if (!existsSync(CLAUDE_JSON)) return { written: false, path: CLAUDE_JSON };
  const read = readObjectJson<ClaudeJson>(CLAUDE_JSON);
  if (read.malformed) return { written: false, path: CLAUDE_JSON, malformed: true };
  const cfg = read.config;
  const servers = cfg.projects?.[projectKey(root)]?.mcpServers;
  if (!servers) return { written: false, path: CLAUDE_JSON };
  let touched = false;
  for (const name of names) {
    if (name in servers) {
      delete servers[name];
      touched = true;
    }
  }
  // The project entry stays: Claude Code owns it and keeps an empty
  // mcpServers object there itself.
  if (!touched) return { written: false, path: CLAUDE_JSON };
  writeJson(CLAUDE_JSON, cfg);
  return { written: true, path: CLAUDE_JSON };
}

export interface LocalMcpState {
  present: boolean;
  /** present and listed in marker.managed_mcp — ours to refresh. */
  owned: boolean;
  /** ~/.claude.json does not parse — present/owned say nothing about it. */
  malformed: boolean;
}

export function localMcpState(root: string, owned: string[] = []): LocalMcpState {
  const read = readObjectJson<ClaudeJson>(CLAUDE_JSON);
  if (read.malformed) return { present: false, owned: false, malformed: true };
  const present = Boolean(
    read.config.projects?.[projectKey(root)]?.mcpServers?.[DEV_KNOWLEDGE_MCP_NAME]
  );
  return {
    present,
    owned: present && owned.includes(DEV_KNOWLEDGE_MCP_NAME),
    malformed: false
  };
}

/** Server names still sitting in a pre-0.3.6 `<repo>/.mcp.json`. */
export function legacyProjectMcpServers(root: string): string[] {
  const read = readObjectJson<McpConfig>(join(root, LEGACY_PROJECT_MCP_FILE));
  if (read.malformed) return [];
  return Object.keys(read.config.mcpServers ?? {});
}

export interface LegacyMcpCleanup {
  path: string;
  /** names taken out of the pre-0.3.6 <repo>/.mcp.json. */
  removed: string[];
  /** the file held nothing else and was deleted. */
  fileDeleted: boolean;
  malformed: boolean;
}

/**
 * Take gor-mobile's servers back out of the pre-0.3.6 `<repo>/.mcp.json`.
 * Only `names` (marker.managed_mcp) are touched — a server the user added by
 * hand keeps the file alive and stays in it.
 */
export function cleanLegacyProjectMcp(root: string, names: string[]): LegacyMcpCleanup {
  const path = join(root, LEGACY_PROJECT_MCP_FILE);
  const base: LegacyMcpCleanup = { path, removed: [], fileDeleted: false, malformed: false };
  if (!existsSync(path)) return base;
  const read = readObjectJson<McpConfig>(path);
  if (read.malformed) return { ...base, malformed: true };
  const cfg = read.config;
  const servers = cfg.mcpServers ?? {};
  const removed = names.filter((n) => n in servers);
  if (removed.length === 0) return base;
  for (const name of removed) delete servers[name];
  const nothingLeft =
    Object.keys(servers).length === 0 &&
    Object.keys(cfg).filter((k) => k !== "mcpServers").length === 0;
  if (nothingLeft) {
    rmSync(path, { force: true });
    return { ...base, removed, fileDeleted: true };
  }
  cfg.mcpServers = servers;
  writeJson(path, cfg);
  return { ...base, removed };
}

/**
 * Pre-0.3.6 project scope needed the server pre-approved in
 * settings.local.json. Local scope does not, so this only cleans the leftover.
 */
export function removeApprovedMcpServers(hooksFile: string, names: string[]): void {
  const settings = readJsonSafe<Record<string, unknown>>(hooksFile, {});
  if (!Array.isArray(settings.enabledMcpjsonServers)) return;
  const kept = (settings.enabledMcpjsonServers as string[]).filter(
    (n) => !names.includes(n)
  );
  if (kept.length === 0) delete settings.enabledMcpjsonServers;
  else settings.enabledMcpjsonServers = kept;
  writeJson(hooksFile, settings);
}