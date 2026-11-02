// A film the pipeline made, as a bench record: the agent arm of a film pair. Reads the run folder (run.json, the ledger)
// and writes film/agent/<item>.json in the shape bench/v1/run.mjs writes, pointing at the run's finished film, so
// bench/v1/grade.mjs and bench/mcp/compare.mjs read it like any item.
// Usage: node V2/bench/mcp/film/record.mjs --item I91a --run bench-cabin [--items V2/bench/mcp/film/items]
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const id = arg("--item"), label = arg("--run"); if (!id || !label) throw new Error("--item <id> --run <label>");
const itemsDir = arg("--items", join(HERE, "items")), itemFile = [join(itemsDir, `${id}.json`), join(V2, "bench/v1/items", `${id}.json`)].find(existsSync); if (!itemFile) throw new Error(`no item ${id}`);
const item = JSON.parse(readFileSync(itemFile, "utf8")), run = JSON.parse(readFileSync(join(V2, "runs", label, "run.json"), "utf8"));
const film = run.build?.film || (existsSync(join(V2, "runs", label, "clips", "film-music.mp4")) ? "clips/film-music.mp4" : existsSync(join(V2, "runs", label, "clips", "film.mp4")) ? "clips/film.mp4" : null);
const credits = JSON.parse(readFileSync(join(V2, "runs", "ledger.json"), "utf8")).runs[label] || 0;
const flagged = Object.values(run.build?.painted || {}).filter((p) => p.accepted || p.flag).length, stills = Object.keys(run.build?.painted || {}).length, seqs = Object.keys(run.build?.sequences || {}).length, clips = Object.keys(run.build?.made || {}).length;
const note = `stills ${stills}, clips ${clips}, sequences ${seqs}${flagged ? `, ${flagged} accepted with a flag` : ""}; ${JSON.stringify(run.models || {})}`;
const rec = { id, item, session: label, sessionDir: `runs/${label}`, baseline: "agent-pipeline", simulated: false, started: run.started_at || new Date().toISOString(),
  turns: [{ text: item.turns[0].text, materials: item.turns[0].materials || [], dialog: [], agent: `The film pipeline on the ${run.models?.tier || "free"} tier: story → assets → screenplay → keyframes → clips → film. ${note}`, firstQuestions: [],
    plan: { shape: "film", say: "", refuse: "", tier_move: null, estimate: null, steps: [{ tool: "film", model: run.models?.video || null, resolution: run.models?.vres || null, inputs: [], produces: film ? film.split("/").pop() : "film.mp4", params: { models: run.models || null }, credits }] },
    ran: [{ tool: "film", state: film ? "done" : "failed", output: film, credits, cached: false, simulated: false, note, error: film ? null : "the run has no finished film", seconds: null }], spent: credits, seconds: null }],
  spent: credits, seconds: null };
writeFileSync(join(HERE, "agent", `${id}.json`), JSON.stringify(rec, null, 2));
console.log(`${id} ← runs/${label}: ${film || "NO FILM"} · ${credits} credits · ${note}`);
