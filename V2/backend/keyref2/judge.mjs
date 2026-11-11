// The flower comparison judge, replicated: 8 frames at 1, 3, …, 15 s per film; the must-haves of bench/mcp/flower/items/I94a.json;
// "flower-judge" (effort medium: score 0–100, summary, each must-have yes/partly/no) per film, and "flower-pair" (the
// candidate against the MCP's film, order drawn at random and recorded). Writes runs/<label>/judge/judge.json.
// Usage: node V2/backend/keyref2/judge.mjs keyref2-1
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { V2, RUNS } from "../lib/env.js";
import { jsonCall, S } from "../lib/llm.js";
import { frameAt } from "./keyref.js";

const label = process.argv[2] || "keyref2-1", out = join(RUNS, label, "judge"); mkdirSync(out, { recursive: true });
const item = JSON.parse(readFileSync(join(V2, "bench/mcp/flower/items/I94a.json"), "utf8"));
const films = { mcp: "sessions/mcp-mf1-I94a/assets/01-create_video_from_text.mp4", "keyref-1": "runs/keyref-1/clips/film.mp4", [label]: JSON.parse(readFileSync(join(RUNS, label, "keyref.json"), "utf8")).outputs.film.replace(/^/, `runs/${label}/`) };
const T = [1, 3, 5, 7, 9, 11, 13, 15];
const frames = Object.fromEntries(Object.entries(films).map(([k, f]) => [k, T.map((t) => { const o = join(out, `${k}-t${String(t).padStart(2, "0")}.jpg`); frameAt(join(V2, f), t, o); return o; })]));

const JUDGE = S.obj({ score: S.int, summary: S.str, must_haves: S.arr(S.obj({ item: S.str, met: S.enum(["yes", "partly", "no"]), why: S.str })) });
const judge = (k) => jsonCall({ name: "flower-judge", effort: "medium", images: frames[k], schema: JUDGE, prompt: `You are judging a finished 16-second video ad against its brief. The attached images are 8 frames of it, in order, at ${T.map((t) => `${t} s`).join(", ")}.
BRIEF: ${item.turns[0].text}
Judge each must-have strictly from the frames (yes / partly / no, with a short why), then score the video 0–100 as a deliverable for this brief (story in order, consistency of people and objects, visual quality, exact brand text), and summarise in one sentence.
MUST-HAVES:
${item.must_haves.map((m) => `- ${m}`).join("\n")}` });

const res = { method: "8 frames at 1,3,…,15 s; must-haves of bench/mcp/flower/items/I94a.json; flower-judge (effort medium) per film; flower-pair (effort medium), random order", frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.map((f) => f.replace(`${V2}/`, ""))])), films, scores: {}, pairs: {} };
for (const k of Object.keys(films)) { res.scores[k] = await judge(k); console.log(`${k}: ${res.scores[k].score} · ${res.scores[k].summary}`); }

async function pair(a, b) {
  const first = Math.random() < 0.5 ? a : b, second = first === a ? b : a;
  const r = await jsonCall({ name: "flower-pair", effort: "medium", images: [...frames[first], ...frames[second]], schema: S.obj({ why: S.str, strength: S.enum(["slight", "clear", "decisive"]), winner: S.enum(["first", "second"]) }), prompt: `Two videos were made for the same brief. Images 1–8 are frames of the FIRST video and images 9–16 frames of the SECOND, each at ${T.map((t) => `${t} s`).join(", ")}.
BRIEF: ${item.turns[0].text}
MUST-HAVES:
${item.must_haves.map((m) => `- ${m}`).join("\n")}
Which video is the better deliverable for this brief? Say why in two sentences, how strong the preference is (slight, clear, decisive), and the winner (first or second).` });
  return { ...r, first, second, winner_side: r.winner === "first" ? first : second };
}
res.pairs[`${label} vs mcp`] = await pair(label, "mcp");
res.pairs["keyref-1 vs mcp"] = await pair("keyref-1", "mcp");
for (const [k, p] of Object.entries(res.pairs)) console.log(`${k}: ${p.winner_side} (${p.strength}; order ${p.first} first) · ${p.why}`);
try { res.original = JSON.parse(readFileSync("/private/tmp/claude-501/-Users-arviny-Downloads-Code-magic-agent-video-generator/36e97784-3ab6-4fc6-89a9-ec2e0e525f60/scratchpad/flower-judge.json", "utf8")); } catch { res.original = { note: "the first comparison (keyref-1 70, MCP 88, MCP clear pairwise win) was recorded in the session scratchpad" }; }
writeFileSync(join(out, "judge.json"), JSON.stringify(res, null, 2));
console.log(`wrote ${join(out, "judge.json")}`);
