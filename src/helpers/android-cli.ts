import { accessSync, constants, existsSync, rmSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { execa } from "execa";
import { CLAUDE_SKILLS_DIR } from "../constants.js";
import { androidCliPath } from "./deps.js";

export const ANDROID_CLI_INSTALL_URL =
  "https://dl.google.com/android/cli/latest/darwin_arm64/install.sh";

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
  const p = process.platform;
  const a = process.arch;
  if (p === "darwin" && a === "arm64") return true;
  if (p === "linux" && a === "x64") return true;
  return false;
}

export async function installAndroidCli(): Promise<AndroidInstallResult> {
  if (!androidCliInstallSupported()) {
    return {
      installed: false,
      error: `unsupported platform ${process.platform}/${process.arch}`
    };
  }
  try {
    const res = await execa(
      "bash",
      ["-c", `curl -fsSL ${ANDROID_CLI_INSTALL_URL} | bash`],
      { stdio: "inherit", reject: false, timeout: 180_000 }
    );
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
