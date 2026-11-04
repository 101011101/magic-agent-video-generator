// The same judge as V2/backend/keyref2/judge.mjs, on a V3 run: 8 frames at 1,3,…,15 s of our clip and the MCP's flower clip,
// flower-judge (0–100 + must-haves) per film and flower-pair (random order). Writes V3/runs/<label>/judge.json.
// Usage: node V3/compose/judge.mjs v3-flower-1
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { V2 } from "../../V2/backend/lib/env.js";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { frameAt } from "../../V2/backend/keyref2/keyref.js";
import { V3 } from "./paths.mjs";

// Usage: node V3/compose/judge.mjs <label> [--item <bench item json>] [--mcp <the MCP's clip>] [--mcp-transcript "<text>"]   (defaults: the flower item and clip)
const argv = process.argv.slice(2), opt = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d);
const label = argv[0] && !argv[0].startsWith("--") ? argv[0] : "v3-flower-1", dir = join(V3, "runs", label), out = join(dir, "judge"); mkdirSync(out, { recursive: true });
const rec = JSON.parse(readFileSync(join(dir, "compose.json"), "utf8"));
const item = JSON.parse(readFileSync(opt("--item", join(V2, "bench/mcp/flower/items/I94a.json")), "utf8"));
const otherName = opt("--other-name", "mcp");   // --other <clip> --other-name <name>: compare against any clip, not only the MCP's
const films = { [otherName]: opt("--other", opt("--mcp", join(V2, "sessions/mcp-mf1-I94a/assets/01-create_video_from_text.mp4"))), [label]: join(dir, rec.outputs.clip) };
const secs = item.spec?.seconds || 16, T = Array.from({ length: Math.floor(secs / 2) }, (_, i) => 2 * i + 1).filter((t) => t < secs);
const ours = rec.attempts?.find((a) => a.key === rec.outputs.chosen), tr = { [label]: ours?.transcript ? ours.transcript.map((g) => `[${g.from}-${g.to} s] "${g.text}"`).join(" ") || "(no speech)" : null, [otherName]: opt("--mcp-transcript", opt("--other-transcript", null)) };
const sound = (k) => tr[k] ? `\nSOUND (transcribed with timestamps; you cannot hear it): ${tr[k]}` : "";
const frames = Object.fromEntries(Object.entries(films).map(([k, f]) => [k, T.map((t) => frameAt(f, t, join(out, `${k}-t${String(t).padStart(2, "0")}.jpg`)))]));
const JUDGE = S.obj({ score: S.int, summary: S.str, must_haves: S.arr(S.obj({ item: S.str, met: S.enum(["yes", "partly", "no"]), why: S.str })) });
const judge = (k) => jsonCall({ name: "flower-judge", effort: "medium", images: frames[k], schema: JUDGE, prompt: `You are judging a finished ${secs}-second video against its brief. The attached images are ${T.length} frames of it, in order, at ${T.map((t) => `${t} s`).join(", ")}.
BRIEF: ${item.turns[0].text}
Judge each must-have strictly from the frames (yes / partly / no, with a short why), then score the video 0–100 as a deliverable for this brief (story in order, consistency of people and objects, visual quality, exact text and speech where asked)${sound(k)}, and summarise in one sentence.
MUST-HAVES:
${item.must_haves.map((m) => `- ${m}`).join("\n")}` });
const res = { method: "8 frames at 1,3,…,15 s; must-haves of V2/bench/mcp/flower/items/I94a.json; flower-judge (effort medium) per film; flower-pair (effort medium), random order; the same judge keyref-1 and keyref2 were scored with", frames: Object.fromEntries(Object.entries(frames).map(([k, v]) => [k, v.map((f) => f.replace(`${dir}/`, ""))])), films, scores: {}, pairs: {} };
for (const k of Object.keys(films)) { res.scores[k] = await judge(k); console.log(`${k}: ${res.scores[k].score} · ${res.scores[k].summary}`); }
const first = Math.random() < 0.5 ? label : otherName, second = first === label ? otherName : label;
const r = await jsonCall({ name: "flower-pair", effort: "medium", images: [...frames[first], ...frames[second]], schema: S.obj({ why: S.str, strength: S.enum(["slight", "clear", "decisive"]), winner: S.enum(["first", "second"]) }), prompt: `Two videos were made for the same brief. Images 1–${T.length} are frames of the FIRST video and images ${T.length + 1}–${2 * T.length} frames of the SECOND, each at ${T.map((t) => `${t} s`).join(", ")}.
BRIEF: ${item.turns[0].text}
MUST-HAVES:
${item.must_haves.map((m) => `- ${m}`).join("\n")}
${tr[first] || tr[second] ? `FIRST video sound: ${tr[first] || "(not transcribed)"}\nSECOND video sound: ${tr[second] || "(not transcribed)"}\n` : ""}Which video is the better deliverable for this brief? Say why in two sentences, how strong the preference is (slight, clear, decisive), and the winner (first or second).` });
res.pairs[`${label} vs ${otherName}`] = { ...r, first, second, winner_side: r.winner === "first" ? first : second };
console.log(`pair: ${res.pairs[`${label} vs ${otherName}`].winner_side} (${r.strength}; ${first} shown first) · ${r.why}`);
res.transcripts = tr;
res.earlier = label.includes("flower") ? { "keyref-1": 70, keyref2: 44, mcp_then: "87–88", note: "the same judge's scores from 2026-11-01/02 (V2/backend/keyref2/judge.mjs)" } : null;
writeFileSync(join(out, "judge.json"), JSON.stringify(res, null, 2)); console.log(`wrote ${join(out, "judge.json")}`);
