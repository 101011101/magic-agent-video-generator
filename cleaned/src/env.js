// Paths and keys. Keys come from the process env, else the repository root .env.
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");
export const REPO = join(ROOT, "..");
export const CACHE = join(ROOT, ".cache");
export const RUNS = join(ROOT, "runs");

export function key(name) {
  if (process.env[name]) return process.env[name].trim();
  const f = join(REPO, ".env");
  const m = existsSync(f) && readFileSync(f, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error(`${name} not set (env or ${f})`);
}
