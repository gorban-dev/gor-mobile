import { CODEX_CONFIG_TOML, DEV_KNOWLEDGE_MCP_NAME } from "../constants.js";
import { codexMcpState, installCodexDevKnowledgeMcp } from "../helpers/codex-mcp.js";
import {
  captureDevKnowledgeKey,
  KEY_SOURCE_LABEL,
  offerDevKnowledgeLinks,
  persistDevKnowledgeKey,
  printDevKnowledgeGuide,
  resolveDevKnowledgeKey
} from "../helpers/dev-knowledge.js";
import {
  cleanLegacyProjectMcp,
  LEGACY_PROJECT_MCP_FILE,
  localMcpState,
  malformedMcpMessage,
  registerLocalMcp,
  removeApprovedMcpServers
} from "../helpers/mcp-register.js";
import {
  findProjectRoot,
  readProjectMarker,
  removeLocalExclude,
  writeProjectMarker
} from "../helpers/project.js";
import { agentHomeExists, projectClaudeSpec } from "../targets.js";
import { confirmStep } from "../ui/confirm-step.js";
import { log } from "../ui/log.js";
import { forceNoTui, isTuiOn } from "../ui/tui-mode.js";

export interface McpOptions {
  noTui?: boolean;
  tui?: boolean;
}

export async function cmdMcp(opts: McpOptions = {}): Promise<void> {
  if (opts.noTui || opts.tui === false) forceNoTui();

  log.step(`Documentation sources — ${DEV_KNOWLEDGE_MCP_NAME}`);

  // Project half: register in Claude Code's local scope, idempotently.
  const root = findProjectRoot();
  if (root) {
    const spec = projectClaudeSpec(root);
    const marker = readProjectMarker(root);
    const res = registerLocalMcp(root, marker.managed_mcp ?? []);
    if (res.malformed) {
      log.warn(malformedMcpMessage(res.path));
    } else {
      if (res.written) {
        // No version bump: this command does not refresh skills, agents or
        // hooks, and doctor's upgrade prompt keys on that field.
        writeProjectMarker(root, {
          ...marker,
          managed_mcp: [...new Set([...(marker.managed_mcp ?? []), DEV_KNOWLEDGE_MCP_NAME])]
        });
      }
      const ownedNow = res.written
        ? [...new Set([...(marker.managed_mcp ?? []), DEV_KNOWLEDGE_MCP_NAME])]
        : (marker.managed_mcp ?? []);
      const st = localMcpState(root, ownedNow);
      log.ok(`${res.path} — server ${st.present ? "present" : "missing"} for ${root} (local scope)`);
      if (st.present && !st.owned) {
        log.info(`${DEV_KNOWLEDGE_MCP_NAME} is a custom entry (not managed by gor-mobile) — left as is`);
      }
      const legacyMcp = cleanLegacyProjectMcp(root, marker.managed_mcp ?? []);
      if (legacyMcp.malformed) {
        log.warn(malformedMcpMessage(legacyMcp.path));
      } else if (legacyMcp.removed.length > 0) {
        removeApprovedMcpServers(spec.hooksFile, legacyMcp.removed);
        await removeLocalExclude(root, [LEGACY_PROJECT_MCP_FILE]);
        log.ok(
          legacyMcp.fileDeleted
            ? `Removed ${LEGACY_PROJECT_MCP_FILE} (server now lives in local scope)`
            : `Dropped ${legacyMcp.removed.join(", ")} from ${LEGACY_PROJECT_MCP_FILE}`
        );
      }
    }
  } else {
    log.info("Not inside a gor-mobile repo — skipped the project half (run 'gor-mobile init').");
  }

  // Machine half: the key, then the Codex table.
  const resolved = resolveDevKnowledgeKey();
  let key = resolved.key;
  if (key) {
    log.ok(`API key found (${KEY_SOURCE_LABEL[resolved.source]})`);
    if (isTuiOn() && (await confirmStep("Replace the stored API key?", false))) {
      const next = await captureDevKnowledgeKey();
      if (next) {
        key = next;
        log.ok("API key replaced");
      }
    }
    persistDevKnowledgeKey(key);
  } else {
    printDevKnowledgeGuide();
    const entered = await captureDevKnowledgeKey();
    if (entered) {
      key = entered;
      persistDevKnowledgeKey(entered);
      log.ok("API key stored in ~/.claude/settings.json env");
    } else {
      log.warn("No API key — the server stays configured but will not connect");
    }
  }

  if (agentHomeExists("codex")) {
    const st = codexMcpState();
    if (st.foreign) {
      log.info(`${CODEX_CONFIG_TOML} has an unmanaged entry — left as is`);
    } else {
      installCodexDevKnowledgeMcp(key, { force: st.managed });
      // Read the shape back rather than inferring it from `key`: a key that is
      // not key-shaped is refused by the writer and lands as env_http_headers.
      const written = codexMcpState();
      log.ok(`${CODEX_CONFIG_TOML} — ${written.hasLiteralKey ? "http_headers" : "env_http_headers"}`);
    }
  }

  if (!key) await offerDevKnowledgeLinks();
}
