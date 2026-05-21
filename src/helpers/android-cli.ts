import { accessSync, constants, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { CLAUDE_SKILLS_DIR } from "../constants.js";
import { androidCliPath } from "./deps.js";

const DARWIN_ARM64_FALLBACK_URL =
  "https://dl.google.com/android/cli/latest/darwin_arm64/install.sh";

const ANDROID_CLI_INSTALL_URLS: Record<string, string> = {
  "darwin/arm64": DARWIN_ARM64_FALLBACK_URL,
  "darwin/x64": "https://dl.google.com/android/cli/latest/darwin_x86_64/install.sh",
  "linux/x64": "https://dl.google.com/android/cli/latest/linux_x86_64/install.sh",
  "win32/x64": "https://dl.google.com/android/cli/latest/windows_x86_64/install.cmd"
};

function platformKey(): string {
  return `${process.platform}/${process.arch}`;
}

export function androidCliInstallUrl(): string | null {
  return ANDROID_CLI_INSTALL_URLS[platformKey()] ?? null;
}

// Legacy export — kept for the dry-run info card in init.ts that prints
// a representative install command. Resolves to the current platform's
// URL when available, otherwise falls back to the darwin/arm64 URL so
// the dry-run still shows a valid Google URL.
export const ANDROID_CLI_INSTALL_URL: string =
  androidCliInstallUrl() ?? DARWIN_ARM64_FALLBACK_URL;

export interface AndroidInitResult {
  ran: boolean;
  skillInstalled: boolean;
  error?: string;
}

export interface AndroidInstallResult {
  installed: boolean;
  error?: string;
}

export function androidCliSkillPath(): string {
  return join(CLAUDE_SKILLS_DIR, "android-cli", "SKILL.md");
}

export function androidCliSkillInstalled(): boolean {
  return existsSync(androidCliSkillPath());
}

export function androidCliInstallSupported(): boolean {
  return androidCliInstallUrl() !== null;
}

export async function installAndroidCli(): Promise<AndroidInstallResult> {
  const url = androidCliInstallUrl();
  if (!url) {
    return {
      installed: false,
      error: `unsupported platform ${process.platform}/${process.arch}`
    };
  }
  try {
    const cmd =
      process.platform === "win32"
        ? `curl -fsSL ${url} -o "%TEMP%\\gm-android-i.cmd" && "%TEMP%\\gm-android-i.cmd"`
        : `curl -fsSL ${url} | bash`;
    const shell = process.platform === "win32" ? "cmd.exe" : "bash";
    const shellFlag = process.platform === "win32" ? "/c" : "-c";
    const res = await execa(shell, [shellFlag, cmd], {
      stdio: "inherit",
      reject: false,
      timeout: 180_000
    });
    if (res.exitCode !== 0) {
      return { installed: false, error: `installer exit ${res.exitCode}` };
    }
    return { installed: androidCliPath() !== null };
  } catch (err) {
    return { installed: false, error: (err as Error).message };
  }
}

export interface AndroidUpdateResult {
  ran: boolean;
  ok: boolean;
  error?: string;
}

export async function runAndroidUpdate(): Promise<AndroidUpdateResult> {
  const cli = androidCliPath();
  if (!cli) return { ran: false, ok: false };
  try {
    const res = await execa(cli, ["update"], {
      reject: false,
      stdio: "inherit",
      timeout: 180_000
    });
    return {
      ran: true,
      ok: res.exitCode === 0,
      error: res.exitCode === 0 ? undefined : `exit ${res.exitCode}`
    };
  } catch (err) {
    return { ran: true, ok: false, error: (err as Error).message };
  }
}

export interface AndroidSkillsListResult {
  ok: boolean;
  names: string[];
  error?: string;
}

export async function listAndroidSkills(): Promise<AndroidSkillsListResult> {
  const cli = androidCliPath();
  if (!cli) return { ok: false, names: [], error: "android CLI not on PATH" };
  try {
    const res = await execa(cli, ["skills", "list"], {
      reject: false,
      timeout: 60_000
    });
    if (res.exitCode !== 0) {
      return {
        ok: false,
        names: [],
        error: (res.stderr || res.stdout || "").toString().slice(0, 200)
      };
    }
    // `android skills list` writes a progress bar to stderr that
    // sometimes bleeds into stdout as lines like "[==>     ] 12%";
    // also skips bracketed announcements. Drop both.
    const names = res.stdout
      .split("\n")
      .map((s) => s.trim())
      .filter((s) => s.length > 0 && !s.startsWith("["));
    return { ok: true, names };
  } catch (err) {
    return { ok: false, names: [], error: (err as Error).message };
  }
}

export interface AndroidSkillOpResult {
  ok: boolean;
  error?: string;
}

export async function addAndroidSkill(
  name: string
): Promise<AndroidSkillOpResult> {
  const cli = androidCliPath();
  if (!cli) return { ok: false, error: "android CLI not on PATH" };
  try {
    const res = await execa(
      cli,
      ["skills", "add", "--agent=claude-code", `--skill=${name}`],
      { reject: false, timeout: 120_000 }
    );
    return {
      ok: res.exitCode === 0,
      error:
        res.exitCode === 0
          ? undefined
          : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removeAndroidSkill(
  name: string
): Promise<AndroidSkillOpResult> {
  const cli = androidCliPath();
  if (!cli) return { ok: false, error: "android CLI not on PATH" };
  try {
    const res = await execa(
      cli,
      ["skills", "remove", "--agent=claude-code", `--skill=${name}`],
      { reject: false, timeout: 60_000 }
    );
    return {
      ok: res.exitCode === 0,
      error:
        res.exitCode === 0
          ? undefined
          : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export interface AndroidUninstallResult {
  removed: string[];
  errors: string[];
}

function canWrite(path: string): boolean {
  try {
    accessSync(path, constants.W_OK);
    return true;
  } catch {
    return false;
  }
}

export async function uninstallAndroidCli(): Promise<AndroidUninstallResult> {
  const removed: string[] = [];
  const errors: string[] = [];

  const cli = androidCliPath();
  if (cli) {
    if (canWrite(dirname(cli))) {
      try {
        rmSync(cli, { force: true });
        removed.push(cli);
      } catch (err) {
        errors.push(`${cli}: ${(err as Error).message}`);
      }
    } else {
      const res = await execa("sudo", ["rm", "-f", cli], {
        stdio: "inherit",
        reject: false
      });
      if (res.exitCode === 0) removed.push(cli);
      else errors.push(`${cli}: sudo rm exit ${res.exitCode}`);
    }
  }

  const paths = [
    join(homedir(), ".android", "bin", "android-cli"),
    join(homedir(), ".android", "cli"),
    join(CLAUDE_SKILLS_DIR, "android-cli")
  ];
  for (const p of paths) {
    if (!existsSync(p)) continue;
    try {
      rmSync(p, { recursive: true, force: true });
      removed.push(p);
    } catch (err) {
      errors.push(`${p}: ${(err as Error).message}`);
    }
  }

  return { removed, errors };
}

export async function runAndroidInit(): Promise<AndroidInitResult> {
  const cli = androidCliPath();
  if (!cli) return { ran: false, skillInstalled: false };

  const skillPath = androidCliSkillPath();
  try {
    const res = await execa(cli, ["init"], { reject: false, timeout: 30_000 });
    const ok = res.exitCode === 0;
    return {
      ran: true,
      skillInstalled: existsSync(skillPath),
      error: ok
        ? undefined
        : (res.stderr || res.stdout || "").toString().slice(0, 200)
    };
  } catch (err) {
    return {
      ran: true,
      skillInstalled: existsSync(skillPath),
      error: (err as Error).message
    };
  }
}
