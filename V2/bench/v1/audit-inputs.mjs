// Did the references the planner wired in reach the tool? For every step of a bench run, the planned inputs against the
// inputs the job log says were sent (sessions/<id>/exec.json), per tool: dropped, sent, and the cases where a tool can
// only use part of what it was given (image-to-video's first picture, a face swap's order). Usage: node … [--run real-1]
import { readFileSync, existsSync } from "node:fs";
import { join, dirname, basename } from "node:path";
import { fileURLToPath } from "node:url";
const HERE = dirname(fileURLToPath(import.meta.url)), V2 = join(HERE, "..", "..");
const arg = (k, d) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = join(HERE, "results", arg("--run", "real-1"));
const grades = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8"));
const T = {}, cases = [];
for (const g of grades) {
  const r = JSON.parse(readFileSync(join(DIR, g.id + ".json"), "utf8")), ex = join(V2, r.sessionDir, "exec.json");
  const jobs = existsSync(ex) ? JSON.parse(readFileSync(ex, "utf8")).jobs || {} : {};
  r.turns.forEach((t, ti) => (t.plan?.steps || []).forEach((s, i) => {
    const ran = t.ran?.[i]; if (!ran || ran.state !== "done" || !s.inputs.length) return;
    const job = jobs[`t${ti}-s${i}-${s.tool}`] || Object.entries(jobs).find(([k]) => k.startsWith(`t${ti}-s${i}-`))?.[1];
    const k = (T[s.tool] ??= { steps: 0, planned: 0, sent: 0, dropped: 0, nolog: 0 }); k.steps++; k.planned += s.inputs.length;
    if (!job) { k.nolog++; return; }
    const sent = (job.inputs || []).map((x) => basename(String(x))), want = s.inputs.map((x) => basename(x));
    const lost = want.filter((w) => !sent.some((x) => x === w || x.replace(/\.[a-z0-9]+$/i, "") === w.replace(/\.[a-z0-9]+$/i, "")));
    k.sent += sent.length; k.dropped += lost.length;
    if (lost.length) cases.push(`${g.id} t${ti + 1} step ${i + 1} ${s.tool}: planned [${want.join(", ")}] sent [${sent.join(", ")}] → dropped ${lost.join(", ")}${g.pass ? "" : " (item failed)"}`);
    if (s.tool === "image-to-video" && sent.length > 2) cases.push(`${g.id} step ${i + 1} image-to-video: ${sent.length} pictures; only the first (and an end frame) are used`);
  }));
}
console.log("tool".padEnd(18), "steps planned-inputs sent dropped no-log");
for (const [k, v] of Object.entries(T).sort((a, b) => b[1].dropped - a[1].dropped)) console.log(k.padEnd(18), String(v.steps).padStart(5), String(v.planned).padStart(8), String(v.sent).padStart(6), String(v.dropped).padStart(6), String(v.nolog).padStart(6));
console.log(`\n${cases.length} cases:\n${cases.join("\n")}`);
