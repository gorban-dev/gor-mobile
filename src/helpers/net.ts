import { execa } from "execa";

/**
 * Lightweight connectivity probe. Returns true if dl.google.com is reachable.
 * Transport-level only (no `-f`): any HTTP response ⇒ online; resolve/connect/
 * timeout failures ⇒ offline. curl is a guaranteed dependency (doctor checks it).
 */
export async function isOnline(): Promise<boolean> {
  try {
    const res = await execa(
      "curl",
      ["-sS", "--max-time", "3", "-o", "/dev/null", "-I", "https://dl.google.com"],
      { reject: false, timeout: 5_000 }
    );
    return res.exitCode === 0;
  } catch {
    return false;
  }
}