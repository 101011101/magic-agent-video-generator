// Writes bench v1 items from USER-CASES.md: one call per user case, one item per sub-case, using only the fixtures in
// fixtures/manifest.json. Items are then read and frozen; re-running overwrites only cases named with --only.
// Usage: node V2/bench/v1/items.mjs [--only 1,2,49]
import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { jsonCall, S } from "../../backend/lib/llm.js";
const HERE = dirname(fileURLToPath(import.meta.url));
const only = (process.argv.includes("--only") ? process.argv[process.argv.indexOf("--only") + 1] : "").split(",").filter(Boolean).map(Number);
const md = readFileSync(join(HERE, "..", "USER-CASES.md"), "utf8"), manifest = JSON.parse(readFileSync(join(HERE, "fixtures", "manifest.json"), "utf8"));
mkdirSync(join(HERE, "items"), { recursive: true });
// the cases: "## X. Group" headers, then "N. **Name** [tags] — a) ...; b) ..." (continuation lines indented)
const cases = []; let group = null, gname = null;
for (const line of md.split("\n")) {
  const g = line.match(/^## ([A-J])\. (.+)/); if (g) { group = g[1]; gname = g[2]; continue; }
  const c = line.match(/^(\d+)\. \*\*(.+?)\*\*(.*)/); if (c && group) { cases.push({ n: Number(c[1]), name: c[2], group, gname, text: c[3].trim() }); continue; }
  if (/^\s{3,}\S/.test(line) && cases.length) cases.at(-1).text += " " + line.trim();
}
const fixtures = Object.entries(manifest).map(([f, v]) => `- ${f}: ${v.what}${v.seconds ? ` (${v.seconds} s)` : ""}${v.aspect ? ` [${v.aspect}]` : ""}${v.transcript ? ` — says: "${v.transcript.slice(0, 160)}"` : ""}`).join("\n");
const ITEM = S.obj({
  sub: S.str, title: S.str,
  turns: S.arr(S.obj({ text: S.str, materials: S.arr(S.str) })),
  answer_sheet: S.arr(S.obj({ about: S.str, answer: S.str })),
  must_haves: S.arr(S.str),
  spec: S.obj({ kind: S.enum(["image", "images", "video", "audio", "text", "none"]), aspect: S.enum(["1:1", "4:5", "9:16", "16:9", "any"]), seconds: { type: ["number", "null"] }, exact_text: S.arr(S.str), audio: S.enum(["required", "none", "any"]), outputs: S.int }),
  expect: S.obj({ asks: S.enum(["required", "never", "either"]), asks_about: S.str, refuse: S.bool, beyond_free: S.enum(["no", "maybe", "yes"]) }),
  tests: S.str,
});
const one = async (c) => {
  const out = await jsonCall({ name: "bench-v1-items", effort: "medium", schema: S.obj({ items: S.arr(ITEM) }), prompt: `You are writing benchmark items for an AI agent that makes images, videos and sound from a user's chat messages (it plans tool calls on Magic Hour's free tier: images at 640 px, video at 480p, clips up to 10 s each, music, subtitles, face swap on photos, background removal, upscaling, plus code tools for text overlay, crop/resize, writing and checks). The benchmark grades mainly the OUTPUT.

USER CASE ${c.n} (group ${c.group}, ${c.gname}): ${c.name} ${c.text}

Write ONE item per sub-case listed (a, b, c, d …), in order. Each item:
- sub: the letter. title: 3-8 words.
- turns: the user's message(s), written as a real person would type them (natural, sometimes terse, no jargon). One turn unless the sub-case is about a follow-up, a refer-back, a change of mind or a two-step request; then 2-3 turns, each building on what the agent made. Keep briefs SHORT so videos stay at 5-10 s; ads and reels at most 15 s.
- materials: files the user attaches in that turn, ONLY from this list (use exact names), only when the sub-case says the user brings something:
${fixtures}
- answer_sheet: what this user has in mind, as about/answer pairs, covering anything a sensible agent might ask (style, wording of any text, size or platform, length, which person or picture, language, mood, voice). Where the sub-case says the user leaves it to the agent, answer "your call". It must agree with the message.
- must_haves: 3-6 things a person could check by LOOKING at (or listening to) the final output, specific to this item (e.g. "the headline reads exactly 'Open Saturday'", "the dog is the same golden retriever as in the photo", "everything except the car's colour is unchanged"). For a refusal item, what the agent must say instead.
- spec: kind of the deliverable (images = several pictures, none = nothing should be made); aspect the final output must have ("any" if not fixed); seconds (null if not a clip or sound); exact_text = words that must appear exactly in the output (empty if none); audio required/none/any; outputs = how many deliverables.
- expect: asks = required if the message lacks something only the user can say (which picture, the missing date), never if everything needed is stated or reasonably inferable, either otherwise; asks_about = what it should ask about ("" if never); refuse = true only for the should-be-refused items; beyond_free = yes if it cannot be done on the free tier at all, maybe if unsure (the tags [free?] mean maybe), no otherwise.
- tests: one line, what this item tests.` });
  out.items.forEach((x) => {
    const id = `${c.group}${String(c.n).padStart(2, "0")}${x.sub}`;
    const item = { id, case: c.n, case_name: c.name, group: c.group, group_name: c.gname, ...x, answer_sheet: Object.fromEntries(x.answer_sheet.map((a) => [a.about, a.answer])) };
    const bad = x.turns.flatMap((t) => t.materials).filter((m) => !manifest[m]); if (bad.length) console.log(`  ${id}: unknown fixture ${bad.join(", ")}`);
    writeFileSync(join(HERE, "items", `${id}.json`), JSON.stringify(item, null, 2));
  });
  console.log(`${c.n} ${c.name}: ${out.items.length} items`);
};
const q = cases.filter((c) => !only.length || only.includes(c.n));
await Promise.all(Array.from({ length: 6 }, async () => { while (q.length) { const c = q.shift(); try { await one(c); } catch (e) { console.log(`${c.n} ERROR ${e.message.slice(0, 200)}`); } } }));
