// Paths and keys. Keys come from the process env, else the repository root .env (never committed).
import { readFileSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const V2 = join(dirname(fileURLToPath(import.meta.url)), "..", "..");   // V2/
export const REPO = join(V2, "..");
export const CACHE = join(V2, ".cache");      // text-call cache (gitignored)
export const RUNS = join(V2, "runs");         // raw results, one folder per run label
export const RESULTS = join(V2, "results");   // organised results, one HTML page per run

export function key(name) {
  if (process.env[name]) return process.env[name].trim();
  const f = join(REPO, ".env");
  const m = existsSync(f) && readFileSync(f, "utf8").match(new RegExp(`^${name}=(.+)$`, "m"));
  if (m) return m[1].trim().replace(/^["']|["']$/g, "");
  throw new Error(`${name} not set (env or ${f})`);
}
