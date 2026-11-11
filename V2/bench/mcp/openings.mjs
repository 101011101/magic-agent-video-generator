// The first message each persona types for each item, written once so every side of a comparison gets the same opening.
// openings/<persona>/<id>.json = { id, persona, text, withheld, extras, as_written }; the changer's file carries the brief
// as written plus `change` ({ field, from, to, say }, or null when the item has nothing to change; see changeFor).
// Items whose test is the reply itself (kind none or text, an expected refusal) keep the brief as written under every persona.
// Usage: node V2/bench/mcp/openings.mjs --persona stupid|impatient|dumper|tightwad|changer|all [--only A01a,B07a] [--groups A,B]
//        [--items dir] [--out dir] [--print] [--redo --salt 2]   (--redo rewrites existing files; a new --salt gets a new draft)
import { readFileSync, writeFileSync, mkdirSync, readdirSync, existsSync } from "node:fs";
import { join, dirname, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonCall, S } from "../../backend/lib/llm.js";
import { PERSONAS, changeFor, describeChange } from "./personas.mjs";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const ITEMS = arg("--items", join(V2, "bench/v1/items")), OUT = arg("--out", join(HERE, "openings")), PRINT = process.argv.includes("--print"), REDO = process.argv.includes("--redo"), SALT = arg("--salt", "");
const only = (arg("--only", "") || "").split(",").filter(Boolean), groups = (arg("--groups", "") || "").split(",").filter(Boolean);
const want = arg("--persona", "all"), personas = want === "all" ? Object.keys(PERSONAS).filter((p) => PERSONAS[p].opening || p === "changer") : want.split(",");
for (const p of personas) if (!PERSONAS[p]) throw new Error(`unknown persona ${p}; one of ${Object.keys(PERSONAS).join(", ")}`);
const items = readdirSync(ITEMS).filter((f) => f.endsWith(".json")).map((f) => JSON.parse(readFileSync(join(ITEMS, f), "utf8")))
  .filter((it) => (!only.length || only.includes(it.id)) && (groups.length ? groups.includes(it.group) : it.group !== "I")).sort((a, b) => a.id.localeCompare(b.id));
const asWritten = (it) => ["none", "text"].includes(it.spec?.kind) || !!it.expect?.refuse;

async function opening(p, it) {
  const P = PERSONAS[p], brief = it.turns[0].text, materials = it.turns[0].materials || [];
  if (p === "changer") {
    const c = changeFor(it); if (!c) return { id: it.id, persona: p, text: brief, as_written: true, change: null };
    const o = await jsonCall({ name: "bench-mcp-opening-change-v1", effort: "low", salt: SALT, schema: S.obj({ to: S.str, say: S.str }), prompt: `${P.follow_up}
The request the user made: "${brief}"
The change: ${c.field === "text" ? `one piece of the exact on-screen text changes. It read "${c.from}"; choose a replacement of the same kind and about the same length (a different date, name, number or word that fits the request), put it in "to", and ask for exactly that in the message` : describeChange(c)}.
Return "to" (the replacement text; for a change that is not about text, repeat "${c.to}") and "say" (the user's one-line message).` });
    return { id: it.id, persona: p, text: brief, as_written: true, change: { ...c, to: c.field === "text" ? o.to : c.to, say: o.say } };
  }
  if (asWritten(it)) return { id: it.id, persona: p, text: brief, withheld: [], extras: [], as_written: true };
  const o = await jsonCall({ name: "bench-mcp-opening-v1", effort: "low", salt: SALT, schema: S.obj({ text: S.str, withheld: S.arr(S.str), extras: S.arr(S.str) }), prompt: `A benchmark item has a user's request written in full. Rewrite it as the FIRST MESSAGE this kind of user types into a chat assistant that makes images, video and sound.
THE USER: ${P.opening}
THE REQUEST AS WRITTEN: "${brief}"
ATTACHMENTS (the files are attached to the message automatically; refer to each one in plain words, like "this pic" or "the clip"): ${materials.length ? materials.join(", ") : "none"}
WHAT THE USER KNOWS BUT THE REQUEST LEAVES OUT (what they would answer if asked): ${JSON.stringify(it.answer_sheet)}
Return text (the WHOLE message the user sends, including every sentence you add), withheld (each concrete fact of the request that the message no longer states, as a short plain-words fact; empty if none), extras (the added sentences, repeated from text; empty if none).` });
  return { id: it.id, persona: p, text: o.text, withheld: o.withheld, extras: o.extras, as_written: false };
}

const show = (p, o) => console.log(`${p.padEnd(9)} ${o.id.padEnd(5)} ${o.change ? `[${o.change.field} ${o.change.from} → ${o.change.to}] "${o.change.say}"` : `${o.as_written ? "(as written) " : ""}"${o.text}"${o.withheld?.length ? `\n                · withheld: ${o.withheld.join("; ")}` : ""}${o.extras?.length ? `\n                · extras: ${o.extras.join(" | ")}` : ""}`}`);
for (const p of personas) {
  mkdirSync(join(OUT, p), { recursive: true });
  const q = [...items]; let written = 0;
  await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const it = q.shift(), f = join(OUT, p, `${it.id}.json`);
    let o; if (existsSync(f) && !REDO) o = JSON.parse(readFileSync(f, "utf8")); else { o = await opening(p, it); writeFileSync(f, JSON.stringify(o, null, 2)); written++; }
    if (PRINT) show(p, o); } }));
  console.log(`${p}: ${items.length} openings in ${relative(V2, join(OUT, p))} (${written} written now)`);
}
