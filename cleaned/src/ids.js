// I0 IDs: before anything is generated, every thing the story mentions gets one id, and every mention of it (noun, alias,
// pronoun) points to that id. The state manager reads only the id'd copy; the LLMs keep the original text.
//   1. tag      (LLM, per chunk, in order) mentions → ids, carrying the running table so "the old woman" and "she" reuse
//               "grandmother". Returns the chunk with each mention followed by {id}.
//   2. coverage (LLM, per chunk) nouns or pronouns that refer to a thing but have no id. Re-tagged once if any.
//   3. links    (LLM twice) which ids are physically connected (a house and its rooms, a cottage door seen inside and out):
//               one call proposes pairs, a second checks each against the text ("does x belong to y?"). Only confirmed pairs
//               get a constraint. Ordinary props (a needle, scissors) are not linked.
import { jsonCall, S } from "./llm.js";

const ID = { type: "string", pattern: "^[a-z][a-z0-9-]*$" };
const KINDS = ["character", "group", "prop", "place", "part"];
const chunks = (story) => story.split(/\n\s*\n/).map((p) => p.trim()).filter(Boolean)
  .reduce((out, p) => { const last = out.at(-1); if (last && (last + p).length < 600) out[out.length - 1] = `${last}\n\n${p}`; else out.push(p); return out; }, []);
const tableText = (table) => (table.length ? table.map((t) => `- ${t.id} (${t.kind}): ${t.name}; aliases: ${t.aliases.join(", ") || "none"}`).join("\n") : "(empty)");

async function tagChunk(chunk, table, i, note = "") {
  return jsonCall({ name: "ids-tag", effort: "medium",
    schema: S.obj({ mentions: S.arr(S.obj({ text: S.str, ids: S.arr(ID) })), new_ids: S.arr(S.obj({ id: ID, name: S.str, kind: S.enum(KINDS) })), tagged: S.str }),
    prompt: `Give every PHYSICAL thing this story text mentions an id: characters, animals, objects, food, places, rooms, buildings, and
parts of things (a door, a bed's head, a wolf's belly). Every noun, alias and pronoun that refers to a thing gets the id of that
thing. Mentions that mean the same thing get the same id ("the old woman", "she", "Grandmother" → grandmother). A plural pronoun
for several things gets all their ids ("they" → red, grandmother); never make a new id for a temporary set. Sounds, voices, light,
feelings and other things you cannot draw as an object get no id. Reuse ids from the table; add a new id (short, lowercase,
hyphens) only for a thing not in it. kind "group" only for things that always appear together (six stones).
mentions: each mention in order, exactly as written, with its id(s). new_ids: things added to the table by this chunk.
tagged: the text unchanged except that every mention is followed by {id} or {id,id}, e.g. "They{red,grandmother} opened the door{cottage-door}."
${note ? `\nThe last pass missed these; tag them too: ${note}\n` : ""}
Id table so far:
${tableText(table)}

Text (chunk ${i + 1}):
${chunk}` });
}

async function coverage(tagged) {
  return jsonCall({ name: "ids-coverage", effort: "medium", schema: S.obj({ untagged: S.arr(S.str) }),
    prompt: `In this text every mention of a thing (noun, alias or pronoun referring to a character, animal, object, food, place, room,
building or part of one) should be followed by {id}. List every such mention that has no {id} after it, exactly as written.
Abstract words (fear, time, idea) do not need one. Return [] if none.\n\n${tagged}` });
}

export async function assignIds(story) {
  const table = [], parts = [];
  for (const [i, c] of chunks(story).entries()) {
    let r = await tagChunk(c, table, i);
    let miss = (await coverage(r.tagged)).untagged;
    if (miss.length) { r = await tagChunk(c, table, i, miss.join("; ")); miss = (await coverage(r.tagged)).untagged; }
    for (const n of r.new_ids) if (!table.some((t) => t.id === n.id)) table.push({ ...n, aliases: [] });
    for (const m of r.mentions) if (m.ids.length === 1) { const t = table.find((x) => x.id === m.ids[0]); if (t && m.text !== t.name && !t.aliases.includes(m.text)) t.aliases.push(m.text); }
    parts.push({ text: c, tagged: r.tagged, untagged: miss });
  }
  return { table, chunks: parts };
}

// Physical links: propose, then check each pair against the text. Returns confirmed links with the constraint each needs.
export async function linkIds(story, table) {
  const ids = table.map((t) => t.id), ID_ENUM = S.enum(ids);
  const prop = await jsonCall({ name: "ids-link-propose", effort: "high",
    schema: S.obj({ pairs: S.arr(S.obj({ a: ID_ENUM, b: ID_ENUM, relation: S.enum(["part-of", "inside", "same-thing-other-view"]), why: S.str })) }),
    prompt: `Which of these PLACES and STRUCTURES are the same physical object, so pictures of them must agree spatially? Only: a room inside
a building; a door, window or wall that belongs to a building and is seen from inside and outside; the same building seen from
two places (a cottage seen from the woods and its inside). Never pair characters, their body parts or clothes, worn or carried
items, plants or small objects: those are not spatial structures.
Ids:\n${tableText(table)}\n\nStory:\n${story}` });
  const links = [];
  for (const p of prop.pairs) {
    const name = (id) => table.find((t) => t.id === id)?.name || id;
    const v = await jsonCall({ name: "ids-link-check", effort: "medium",
      schema: S.obj({ belongs: S.bool, evidence: S.str, constraint: S.str }),
      prompt: `Does "${name(p.a)}" (${p.a}) physically belong to "${name(p.b)}" (${p.b}) as ${p.relation}, according to this story?
belongs: true only if the text supports it. evidence: the words that show it, or "". constraint: if true, one sentence on what their
pictures must agree on (side, wall, colour, material, size), else "".\n\nStory:\n${story}` });
    links.push({ ...p, ...v });
  }
  return links;
}

// Role of every id: an ASSET moves, is carried or acts (characters, animals, handheld props) and is tracked frame to frame;
// a FIXTURE stays where it is (bed, table, shelf, door, flowers) and belongs to one place's ground plan; a PLACE is a setting;
// a PART belongs to another id (a wolf's ears, a bed's head); NONE is not drawable. Fixtures name their place, parts their parent.
export async function classifyIds(story, table) {
  const ids = table.map((t) => t.id), places = table.filter((t) => t.kind === "place").map((t) => t.id);
  const r = await jsonCall({ name: "ids-classify", effort: "medium",
    schema: S.obj({ roles: S.obj(Object.fromEntries(ids.map((id) => [id, S.obj({
      role: S.enum(["asset", "fixture", "place", "part", "none"]), kind: S.enum(["character", "group", "prop", "none"]),
      place: S.enum([...places, "none"]), parent: S.enum([...ids, "none"]), inside: S.enum([...ids, "none"]) })]))) }),
    prompt: `Classify every id of this story.
role: asset = a character or animal, or a thing that is moved, carried, worn or handed over in the story (tracked frame to frame);
fixture = a thing that stays where it is in one place (furniture, a door, a window, plants, a hearth); place = a setting where
scenes happen; part = a part of another id (a wolf's ears, a bed's head); none = not something to draw.
kind (assets only): character (a person or animal that acts), group (several things that always appear together), prop; else none.
place (fixtures only): the place it belongs to; else none. parent (parts only): the id it is part of; else none.
Clothes a character wears all story long are a PART of that character (one part even if named twice: hood and cloak); clothes
taken off, swapped or handed to someone else are assets.
inside (assets only): the asset it is packed in, inside or on when it first appears (a cake in a basket); else none.
Ids:\n${table.map((t) => `- ${t.id} (${t.kind}): ${t.name}; aliases: ${t.aliases.join(", ") || "none"}`).join("\n")}\n\nStory:\n${story}` });
  return table.map((t) => ({ ...t, ...r.roles[t.id] }));
}
