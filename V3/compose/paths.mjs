import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
export const V3 = join(dirname(fileURLToPath(import.meta.url)), "..");
