import { existsSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
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

export const PROJECT_MCP_FILE = ".mcp.json";

/** One wording for every command that can meet an unparseable .mcp.json. */
export function malformedMcpMessage(path: string): string {
  return `${path} is not valid JSON — left untouched; fix it and re-run`;
}

function projectMcpPath(root: string): string {
  return join(root, PROJECT_MCP_FILE);
}

// No _managed_by field goes into this file: Claude Code parses it, and an
// unknown key risks every server the user has. Ownership lives in
// .gor-mobile/marker.json -> managed_mcp instead.
function devKnowledgeEntry(): McpServer {
  return {
    type: "http",
    url: DEV_KNOWLEDGE_MCP_URL,
    headers: { "X-Goog-Api-Key": `\${${DEV_KNOWLEDGE_API_KEY_ENV}}` }
  };
}

export interface RegisterResult {
  /** the file was rewritten (or, for unregister, rewritten/deleted). */
  written: boolean;
  path: string;
  /** .mcp.json is on disk but does not parse — nothing was written or deleted. */
  malformed?: boolean;
}

type ProjectMcpRead =
  | { malformed: true; config: null }
  | { malformed: false; config: McpConfig };

/**
 * Parse <root>/.mcp.json explicitly. readJsonSafe cannot be used here: it maps
 * a parse error onto the same fallback as "file absent", and this file is
 * hand-authored and team-owned — writing a fresh config over a typo would drop
 * every server in it. A non-object root (array, scalar, null) counts as
 * malformed for the same reason.
 */
function readProjectMcp(path: string): ProjectMcpRead {
  if (!existsSync(path)) return { malformed: false, config: {} };
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf8"));
    if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return { malformed: true, config: null };
    }
    return { malformed: false, config: parsed as McpConfig };
  } catch {
    return { malformed: true, config: null };
  }
}

/**
 * Merge the Developer Knowledge server into <root>/.mcp.json, preserving every
 * other server. `owned` carries marker.managed_mcp — a same-named entry we do
 * not own is left alone and the call reports written: false. An unparseable
 * file also reports written: false, plus malformed: true so the caller can tell
 * the two apart.
 */
export function registerProjectMcp(root: string, owned: string[] = []): RegisterResult {
  const path = projectMcpPath(root);
  const read = readProjectMcp(path);
  if (read.malformed) return { written: false, path, malformed: true };
  const cfg = read.config;
  const servers = cfg.mcpServers ?? {};
  if (servers[DEV_KNOWLEDGE_MCP_NAME] && !owned.includes(DEV_KNOWLEDGE_MCP_NAME)) {
    return { written: false, path };
  }
  servers[DEV_KNOWLEDGE_MCP_NAME] = devKnowledgeEntry();
  cfg.mcpServers = servers;
  writeJson(path, cfg);
  return { written: true, path };
}

/** Drop the named servers; delete the file once nothing of ours is left. */
export function unregisterProjectMcp(root: string, names: string[]): RegisterResult {
  const path = projectMcpPath(root);
  if (!existsSync(path)) return { written: false, path };
  const read = readProjectMcp(path);
  if (read.malformed) return { written: false, path, malformed: true };
  const cfg = read.config;
  if (!cfg.mcpServers) return { written: false, path };
  for (const name of names) delete cfg.mcpServers[name];
  const nothingLeft =
    Object.keys(cfg.mcpServers).length === 0 &&
    Object.keys(cfg).filter((k) => k !== "mcpServers").length === 0;
  if (nothingLeft) {
    rmSync(path, { force: true });
    return { written: true, path };
  }
  writeJson(path, cfg);
  return { written: true, path };
}

export interface ProjectMcpState {
  present: boolean;
  approved: boolean;
  /** present and listed in marker.managed_mcp — ours to refresh. */
  owned: boolean;
  /** .mcp.json does not parse — present/owned say nothing about it. */
  malformed: boolean;
}

export function projectMcpState(
  root: string,
  hooksFile: string,
  owned: string[] = []
): ProjectMcpState {
  const read = readProjectMcp(projectMcpPath(root));
  const present = !read.malformed && Boolean(read.config.mcpServers?.[DEV_KNOWLEDGE_MCP_NAME]);
  const settings = readJsonSafe<{ enabledMcpjsonServers?: string[] }>(hooksFile, {});
  return {
    present,
    approved: (settings.enabledMcpjsonServers ?? []).includes(DEV_KNOWLEDGE_MCP_NAME),
    owned: present && owned.includes(DEV_KNOWLEDGE_MCP_NAME),
    malformed: read.malformed
  };
}

/**
 * Pre-approve project-scoped servers in settings.local.json. Without this the
 * server sits at "Pending approval". The setting only takes effect once the
 * workspace itself is trusted (hasTrustDialogAccepted in ~/.claude.json),
 * which the user answers on their first `claude` run in the repo.
 */
export function approveProjectMcpServers(hooksFile: string, names: string[]): void {
  const settings = readJsonSafe<Record<string, unknown>>(hooksFile, {});
  const current = Array.isArray(settings.enabledMcpjsonServers)
    ? (settings.enabledMcpjsonServers as string[])
    : [];
  settings.enabledMcpjsonServers = [...new Set([...current, ...names])];
  writeJson(hooksFile, settings);
}

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