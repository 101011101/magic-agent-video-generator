// Custom tools: common edits done by code, no Magic Hour call, zero credits. One file per tool, each exporting `tool`
// with the catalogue fields (id, group, takes, makes, needs, guarantees, explain) and `run({ inputs, params, out })`.
// The agent's catalogue imports this list; the executor dispatches to run() for any tool marked custom.
import { tool as textOverlay } from "./text-overlay.js";
import { tool as write } from "./write.js";
import { tool as check } from "./check.js";
import { tool as crop } from "./crop.js";
import { tool as assemble } from "./assemble.js";
import { tool as trim } from "./trim.js";
import { tool as frame } from "./frame.js";
import { tool as voice } from "./voice.js";
import { tool as place } from "./place.js";
import { tool as compose } from "./compose.js";
import { tool as filter } from "./filter.js";

export const CUSTOM_TOOLS = [textOverlay, write, check, crop, assemble, trim, frame, voice, place, compose, filter];
export const customTool = (id) => CUSTOM_TOOLS.find((t) => t.id === id);
