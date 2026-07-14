import type { ManagedSettings } from "../types.js";
import { readJsonSafe, writeJson } from "./paths.js";

// Disabling the upstream superpowers plugin per-project removes the duplicate
// skill set inside mobile repos (gor-mobile ships its own gor-mobile-* copies).
// This is scoped to the repo's settings.local.json — non-mobile sessions keep
// superpowers enabled.
export const SUPERPOWERS_KEY = "superpowers@claude-plugins-official";

// Short-name → marketplace-qualified key for the optional `--plugins` enables.
// A name already containing '@' is used verbatim.
const PLUGIN_ALIASES: Record<string, string> = {
  superpowers: SUPERPOWERS_KEY,
  figma: "figma@claude-plugins-official",
  "swagger-android": "swagger-android@gor-dev-plugins",
  "yandex-tracker": "yandex-tracker@gor-dev-plugins"
};

export function resolvePluginKey(name: string): string {
  const t = name.trim();
  return t.includes("@") ? t : (PLUGIN_ALIASES[t] ?? t);
}

interface LocalSettings extends ManagedSettings {
  enabledPlugins?: Record<string, boolean>;
}

/**
 * Merge enabledPlugins overrides into `file` (a settings.local.json), preserving
 * every other key. Returns the plugin keys touched so the caller can record them
 * for a clean uninstall.
 */
export function applyEnabledPlugins(
  file: string,
  enable: string[],
  disable: string[]
): string[] {
  const settings = readJsonSafe<LocalSettings>(file, {});
  const plugins = settings.enabledPlugins ?? {};
  const touched: string[] = [];
  for (const name of disable) {
    const key = resolvePluginKey(name);
    plugins[key] = false;
    touched.push(key);
  }
  for (const name of enable) {
    const key = resolvePluginKey(name);
    plugins[key] = true;
    touched.push(key);
  }
  settings.enabledPlugins = plugins;
  writeJson(file, settings);
  return touched;
}

/** Remove the given plugin keys from settings.local.json (uninstall path). */
export function removeEnabledPlugins(file: string, keys: string[]): void {
  const settings = readJsonSafe<LocalSettings>(file, {});
  if (!settings.enabledPlugins) return;
  for (const key of keys) delete settings.enabledPlugins[key];
  if (Object.keys(settings.enabledPlugins).length === 0) {
    delete settings.enabledPlugins;
  }
  writeJson(file, settings);
}
