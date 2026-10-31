// Custom tools: common edits done by code, no Magic Hour call, zero credits. One file per tool, each exporting `tool`
// with the catalogue fields (id, group, takes, makes, needs, guarantees, explain) and `run({ inputs, params, out })`.
// The agent's catalogue imports this list; the executor dispatches to run() for any tool marked custom.
import { tool as textOverlay } from "./text-overlay.js";
import { tool as write } from "./write.js";
import { tool as check } from "./check.js";

export const CUSTOM_TOOLS = [textOverlay, write, check];
export const customTool = (id) => CUSTOM_TOOLS.find((t) => t.id === id);
