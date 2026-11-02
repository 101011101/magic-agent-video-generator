// A film the pipeline made, as a bench record: the agent arm of a film pair. Reads the run folder (run.json, the ledger)
// and writes film/agent/<item>.json in the shape bench/v1/run.mjs writes, pointing at the run's finished film, so
// bench/v1/grade.mjs and bench/mcp/compare.mjs read it like any item. The turn also carries `stages`: the run's whole
// pathway (story, roots, screenplay, stills with their prompts and attempts, clips with their frames, sound, film) for
// the comparison page; the grader reads plan and ran only.
// Usage: node V2/bench/mcp/film/record.mjs --item I91a --run bench-cabin [--items V2/bench/mcp/film/items] [--out agent: the arm's folder under film/ (agent = the chain, direct = direct generation)]
import { readFileSync, writeFileSync, existsSync, readdirSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "../../..");
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const id = arg("--item"), label = arg("--run"), OUT = join(HERE, arg("--out", "agent")); if (!id || !label) throw new Error("--item <id> --run <label>"); mkdirSync(OUT, { recursive: true });
const itemsDir = arg("--items", join(HERE, "items")), itemFile = [join(itemsDir, `${id}.json`), join(V2, "bench/v1/items", `${id}.json`)].find(existsSync); if (!itemFile) throw new Error(`no item ${id}`);
const item = JSON.parse(readFileSync(itemFile, "utf8")), run = JSON.parse(readFileSync(join(V2, "runs", label, "run.json"), "utf8"));
const R = join(V2, "runs", label), has = (f) => existsSync(join(R, f)), rel = (f) => (f ? `runs/${label}/${f}` : null);
const film = run.build?.film || (has("clips/film-music.mp4") ? "clips/film-music.mp4" : has("clips/film.mp4") ? "clips/film.mp4" : null);
const credits = JSON.parse(readFileSync(join(V2, "runs", "ledger.json"), "utf8")).runs[label] || 0;
const painted = run.build?.painted || {}, attempts = run.build?.attempts || {}, plan = run.build?.plan || [], made = run.build?.made || {}, seqs = run.build?.sequences || {};
const flagged = Object.values(painted).filter((p) => p.accepted || p.flag).length, stills = Object.keys(painted).length, nseq = Object.keys(seqs).length, clips = Object.keys(made).length;
const note = `stills ${stills}, clips ${clips}, sequences ${nseq}${flagged ? `, ${flagged} accepted with a flag` : ""}; ${JSON.stringify(run.models || {})}`;

// the pathway, stage by stage, credits from the run's call log by key prefix (root-, still-, clip-/seq-)
const calls = run.calls || [], creditsBy = (re) => calls.filter((c) => re.test(c.key || "")).reduce((a, c) => a + (c.credits || 0), 0);
const stages = [
  { stage: "story", credits: 0, text: [run.story?.title, run.story?.kind ? `kind: ${run.story.kind}` : "", run.story?.style ? `style: ${run.story.style}` : "", run.story?.story || ""].filter(Boolean).join("\n"), note: run.research?.subject ? `research: ${run.research.subject}` : null },
  { stage: "assets", credits: creditsBy(/^root-/), items: Object.entries(run.bank || {}).map(([k, b]) => ({ id: k, file: rel(b.file), prompt: b.prompt || null, note: b.source || null })), text: run.voices ? Object.entries(run.voices).map(([k, v]) => `voice ${k}: ${v}`).join("\n") : "" },
  { stage: "screenplay", credits: 0, file: has("screenplay.txt") ? rel("screenplay.txt") : null, text: has("screenplay.txt") ? readFileSync(join(R, "screenplay.txt"), "utf8") : JSON.stringify(run.script || {}, null, 1) },
  { stage: "keyframes", credits: creditsBy(/^(still|anchor)-/), items: [...Object.entries(run.build?.anchors || {}).map(([k, a]) => ({ id: `@${k}`, file: rel(a.file), prompt: a.prompt || null, note: ["anchor: a hard constraint painted as a reference", a.model, a.lettering ? "lettered" : "", a.why].filter(Boolean).join("; ") })), ...plan.map((p) => { const P = painted[p.id] || {}; return { id: p.id, file: rel(P.file), prompt: p.prompt || P.prompt || null, inputs: (p.images || []).map((im) => { const m = /^(?:plate|prop|portrait|style|env|crop):(.+)$/.exec(im); const f = m && run.bank?.[m[1]]?.file ? rel(run.bank[m[1]].file) : m && /\.(png|jpe?g)$/i.test(m[1]) ? rel(m[1]) : m && painted[m[1]]?.file ? rel(painted[m[1]].file) : null; return { name: im, path: f }; }),
    note: [p.mode, P.attempt > 1 ? `attempt ${P.attempt}` : "", P.bad ? "flagged bad" : "", P.flag ? `flag: ${P.flag}` : "", P.accepted ? "accepted with a flag" : "", P.check && P.check.ok === false ? "the check failed" : ""].filter(Boolean).join("; "), attempts: (attempts[p.id] || []).map((a) => rel(a.file)).filter((f) => f && f !== rel(P.file)) }; })] },
  { stage: "clips", credits: creditsBy(/^(clip|seq)-/), items: [...Object.entries(made).map(([n, c]) => ({ id: `clip ${n}`, file: rel(c.clip), prompt: c.prompt || null, inputs: [...[...new Set([c.start, c.end].filter(Boolean))].map((f) => ({ name: f.split("/").pop(), path: rel(f) })), ...(c.anchors || []).map((a) => ({ name: `@${a.name}`, path: rel(a.file) }))], note: [`${c.mode} @ ${c.model}`, c.qa?.seconds ? `${c.qa.seconds} s` : "", c.qa?.first_vs_start != null ? `first frame match ${c.qa.first_vs_start}` : "", c.identity?.note ? `identity: ${c.identity.note}` : "", c.heard ? `heard: "${c.heard}"` : ""].filter(Boolean).join("; ") })),
    ...Object.entries(seqs).map(([k, c]) => ({ id: `sequence ${k}`, file: rel(c.clip), prompt: c.prompt || null, inputs: (c.frames || []).map((f) => ({ name: f.split("/").pop(), path: rel(f) })), note: [`${c.mode || "seq"} @ ${c.model || ""}`, c.shots ? `shots ${c.shots.join(", ")}` : "", c.seconds ? `${c.seconds} s${c.speed && c.speed !== 1 ? ` at ${c.speed}×` : ""}` : "", c.identity?.note ? `identity: ${c.identity.note}` : "", c.heard ? `heard: "${c.heard}"` : ""].filter(Boolean).join("; ") }))] },
  { stage: "sound", credits: creditsBy(/^(music|voice|tts|narration)-/), items: has("sound") ? readdirSync(join(R, "sound")).filter((f) => /\.(mp3|wav|m4a)$/i.test(f)).map((f) => ({ id: f, file: rel(`sound/${f}`) })) : [], text: run.build?.narration ? `narration: ${typeof run.build.narration === "string" ? run.build.narration : JSON.stringify(run.build.narration)}` : "" },
  { stage: "film", credits: 0, items: ["film-raw.mp4", "film.mp4", "film-music.mp4", "film-narrated.mp4"].filter((f) => has(`clips/${f}`)).map((f) => ({ id: f, file: rel(`clips/${f}`) })) },
];
const kept = stages.filter((g) => g.items?.length || g.text || g.file);   // a direct run has no assets, screenplay or keyframes: those stages are left out
const rec = { id, item, session: label, sessionDir: `runs/${label}`, baseline: run.build?.mode === "direct" ? "agent-direct" : "agent-pipeline", simulated: false, started: run.started_at || new Date().toISOString(),
  turns: [{ text: item.turns[0].text, materials: item.turns[0].materials || [], dialog: [], agent: run.build?.mode === "direct" ? `Direct generation on the ${run.models?.tier || "free"} tier: story → one text-to-video generation${Object.keys(made).length > 1 ? `s (${Object.keys(made).length}, each continuing from the previous last frame)` : ""} on ${run.models?.video} @${run.models?.vres}, audio by the model. ${note}` : `The film pipeline on the ${run.models?.tier || "free"} tier: story → assets → screenplay → keyframes → clips → film. ${note}`, firstQuestions: [],
    plan: { shape: "film", say: "", refuse: "", tier_move: null, estimate: null, steps: [{ tool: "film", model: run.models?.video || null, resolution: run.models?.vres || null, inputs: [], produces: film ? film.split("/").pop() : "film.mp4", params: { models: run.models || null }, credits }] },
    ran: [{ tool: "film", state: film ? "done" : "failed", output: film, credits, cached: false, simulated: false, note, error: film ? null : "the run has no finished film", seconds: null }], stages: kept, spent: credits, seconds: null }],
  spent: credits, seconds: null };
writeFileSync(join(OUT, `${id}.json`), JSON.stringify(rec, null, 2));
console.log(`${id} ← runs/${label}: ${film || "NO FILM"} · ${credits} credits · ${note} · stages: ${stages.map((s) => `${s.stage}${s.items ? ` ${s.items.length}` : ""} (${s.credits} cr)`).join(", ")}`);
