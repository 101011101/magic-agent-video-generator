// Bible relook: one LLM call rewrites named bible looks so they state the object's kind and real size.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "../../state-manager/src/paths.js";
import { jsonCall } from "../../state-manager/src/llm.js";

export const RELOOK_TEMPLATE = "current/tests/creative-director/templates/v6b-bible-relook.md";

export async function relook({ bible, names, story }) {
  const entries = bible.filter((b) => names.includes(b.name));
  const prompt = readFileSync(join(REPO, RELOOK_TEMPLATE), "utf8")
    .replace("{{entries}}", () => entries.map((b) => `- ${b.name} (${b.kind}): ${b.look}`).join("\n")).replace("{{story}}", () => story);
  const schema = { type: "object", additionalProperties: false, required: ["looks"], properties: { looks: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["name", "look"], properties: { name: { type: "string", enum: names }, look: { type: "string" } } } } } };
  return (await jsonCall({ name: "relook", schema, prompt, effort: "medium" })).looks;
}

// Fixtures: props that are a fixed part of one location. They go into that location's plate, not into a separate reference.
export const FIXTURES_TEMPLATE = "current/tests/creative-director/templates/v6c-fixtures.md";
export async function fixtures({ bible, story }) {
  const props = bible.filter((b) => b.kind === "prop"), locs = bible.filter((b) => b.kind === "location").map((b) => b.name);
  if (!props.length || !locs.length) return {};
  const prompt = readFileSync(join(REPO, FIXTURES_TEMPLATE), "utf8")
    .replace("{{props}}", () => props.map((b) => `- ${b.name}: ${b.look}`).join("\n")).replace("{{locations}}", () => locs.join(", ")).replace("{{story}}", () => story);
  const schema = { type: "object", additionalProperties: false, required: ["props"], properties: { props: { type: "array", items: {
    type: "object", additionalProperties: false, required: ["name", "fixture", "home"],
    properties: { name: { type: "string", enum: props.map((b) => b.name) }, fixture: { type: "boolean" }, home: { type: ["string", "null"], enum: [...locs, null] } } } } } };
  const out = (await jsonCall({ name: "fixtures", schema, prompt, effort: "medium" })).props;
  return Object.fromEntries(out.filter((p) => p.fixture && p.home).map((p) => [p.name, p.home]));
}
