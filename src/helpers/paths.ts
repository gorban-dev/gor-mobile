import { mkdirSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export function ensureDir(path: string): void {
  mkdirSync(path, { recursive: true });
}

export function ensureParentDir(filePath: string): void {
  mkdirSync(dirname(filePath), { recursive: true });
}

export function readJsonSafe<T>(path: string, fallback: T): T {
  try {
    if (!existsSync(path)) return fallback;
    return JSON.parse(readFileSync(path, "utf8")) as T;
  } catch {
    return fallback;
  }
}

export function writeJson(path: string, data: unknown): void {
  ensureParentDir(path);
  writeFileSync(path, JSON.stringify(data, null, 2) + "\n");
}
