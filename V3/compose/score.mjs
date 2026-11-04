// Score any clips against one item's must-haves with the same judge, plus pairwise verdicts. Usage:
// node V3/compose/score.mjs --item <item.json> --out <dir> --clip name=path [--clip …] [--pair a,b …]  → <dir>/scores.json and frames
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve } from "node:path";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { frameAt } from "../../V2/backend/keyref2/keyref.js";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const item = JSON.parse(readFileSync(resolve(opt("--item")), "utf8")), out = resolve(opt("--out")); mkdirSync(out, { recursive: true });
const clips = Object.fromEntries(all("--clip").map((c) => { const i = c.indexOf("="); return [c.slice(0, i), resolve(c.slice(i + 1))]; }));
const secs = item.spec?.seconds || 16, T = Array.from({ length: Math.floor(secs / 2) }, (_, i) => 2 * i + 1).filter((t) => t < secs);
const frames = Object.fromEntries(Object.entries(clips).map(([k, f]) => [k, T.map((t) => frameAt(f, t, join(out, `${k}-t${String(t).padStart(2, "0")}.jpg`)))]));
const JUDGE = S.obj({ score: S.int, summary: S.str, must_haves: S.arr(S.obj({ item: S.str, met: S.enum(["yes", "partly", "no"]), why: S.str })) });
const res = { item: item.id, clips, frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.map((f) => f.replace(`${out}/`, ""))])), scores: {}, pairs: {} };
for (const k of Object.keys(clips)) { res.scores[k] = await jsonCall({ name: "flower-judge", effort: "medium", images: frames[k], schema: JUDGE, prompt: `You are judging a finished ${secs}-second video against its brief. The attached images are ${T.length} frames of it, in order, at ${T.map((t) => `${t} s`).join(", ")}.\nBRIEF: ${item.turns[0].text}\nJudge each must-have strictly from the frames (yes / partly / no, with a short why), then score the video 0–100 as a deliverable for this brief (story in order, consistency of people and objects, visual quality, logic of the space), and summarise in one sentence.\nMUST-HAVES:\n${item.must_haves.map((m) => `- ${m}`).join("\n")}` }); console.log(`${k}: ${res.scores[k].score} · ${res.scores[k].summary}`); }
for (const p of all("--pair")) { const [x, y] = p.split(","); const first = Math.random() < 0.5 ? x : y, second = first === x ? y : x;
  const r = await jsonCall({ name: "flower-pair", effort: "medium", images: [...frames[first], ...frames[second]], schema: S.obj({ why: S.str, strength: S.enum(["slight", "clear", "decisive"]), winner: S.enum(["first", "second"]) }), prompt: `Two videos were made for the same brief. Images 1–${T.length} are frames of the FIRST video and images ${T.length + 1}–${2 * T.length} frames of the SECOND, each at ${T.map((t) => `${t} s`).join(", ")}.\nBRIEF: ${item.turns[0].text}\nMUST-HAVES:\n${item.must_haves.map((m) => `- ${m}`).join("\n")}\nWhich video is the better deliverable for this brief? Say why in two sentences, how strong the preference is (slight, clear, decisive), and the winner (first or second).` });
  res.pairs[p] = { ...r, first, second, winner_side: r.winner === "first" ? first : second }; console.log(`${p}: ${res.pairs[p].winner_side} (${r.strength}; ${first} first) · ${r.why}`); }
writeFileSync(join(out, "scores.json"), JSON.stringify(res, null, 2)); console.log(`wrote ${join(out, "scores.json")}`);
