// Simulated tools (T-044): every node of a plan runs perfectly, in dependency order, and writes a placeholder SVG to
// assets/<produces>.svg naming the node, its tool and model and what it took. Returns the plan with `output` and
// state "done" on every node it ran (or only the stale set when `only` is given). The real executor will share
// order(), the memory layout and the propagation; only the call differs.
import { writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";

const COLOR = { make: "#5b8def", compose: "#8e6cf0", animate: "#2bb3a3", "change-identity": "#e0772b", "change-content": "#e2a72e", "change-form": "#6fa8dc", speech: "#c25b9a", find: "#9aa0a6", inspect: "#9aa0a6" };
const esc = (x) => String(x ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/"/g, "&quot;");

// Topological order by produces → inputs (a node waits for every node whose produces it names).
export function order(steps) {
  const by = {}; steps.forEach((s, i) => (by[s.produces] = i));
  const deps = steps.map((s) => s.inputs.map((x) => by[x]).filter((j) => j !== undefined && j !== steps.indexOf(s)));
  const out = [], done = new Set(); let guard = 0;
  while (out.length < steps.length && guard++ < steps.length * 2) for (let i = 0; i < steps.length; i++) if (!done.has(i) && deps[i].every((j) => done.has(j))) { out.push(i); done.add(i); }
  for (let i = 0; i < steps.length; i++) if (!done.has(i)) out.push(i);   // a cycle or a dangling input: run it last
  return out;
}

// Every node reachable from `index` along produces → inputs, excluding itself.
export function dependents(steps, index) {
  const out = new Set(); let grew = true;
  const names = new Set([steps[index].produces]);
  while (grew) { grew = false; steps.forEach((s, i) => { if (!out.has(i) && i !== index && s.inputs.some((x) => names.has(x))) { out.add(i); names.add(s.produces); grew = true; } }); }
  return [...out];
}

export function placeholder(step, i) {
  const w = step.params?.aspect === "9:16" ? 540 : 960, h = step.params?.aspect === "9:16" ? 960 : step.params?.aspect === "1:1" ? 960 : step.params?.aspect === "4:5" ? 1200 : 540;
  const c = COLOR[step.group] || "#9aa0a6"; const kind = /\.(mp4|mov)$/i.test(step.produces) ? "clip" : /\.(mp3|wav)$/i.test(step.produces) ? "sound" : "picture";
  const lines = [`${step.tool}${step.model ? ` · ${step.model}` : ""}${step.resolution ? ` ${step.resolution}` : ""}`, ...(step.inputs.length ? [`takes ${step.inputs.join(", ")}`] : ["takes nothing"]), (step.params?.prompt_or_change || "").slice(0, 90)];
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" font-family="-apple-system,Helvetica,Arial,sans-serif">
<rect width="100%" height="100%" fill="${c}" opacity=".16"/><rect x="12" y="12" width="${w - 24}" height="${h - 24}" rx="28" fill="none" stroke="${c}" stroke-width="4" stroke-dasharray="${kind === "clip" ? "18 10" : "0"}"/>
<text x="${w / 2}" y="${h / 2 - 30}" text-anchor="middle" font-size="${Math.round(w / 16)}" font-weight="700" fill="${c}">${esc(step.produces)}</text>
<text x="${w / 2}" y="${h / 2 + 12}" text-anchor="middle" font-size="${Math.round(w / 34)}" fill="#333">${esc(lines[0])}</text>
<text x="${w / 2}" y="${h / 2 + 44}" text-anchor="middle" font-size="${Math.round(w / 38)}" fill="#555">${esc(lines[1])}</text>
<text x="${w / 2}" y="${h / 2 + 74}" text-anchor="middle" font-size="${Math.round(w / 44)}" fill="#777">${esc(lines[2])}</text>
<text x="20" y="${h - 20}" font-size="${Math.round(w / 48)}" fill="#999">simulated · node ${i + 1} · ${kind}${step.params?.seconds ? ` · ${step.params.seconds} s` : ""}</text></svg>`;
}

// Run the plan into `dir/assets`. `only` restricts to a set of indices (the stale set) and keeps other outputs.
export function simulate(plan, dir, { only = null } = {}) {
  const sub = plan.dir ? `assets/${plan.dir}` : "assets"; mkdirSync(join(dir, sub), { recursive: true });
  for (const i of order(plan.steps)) {
    const s = plan.steps[i]; if (only && !only.includes(i)) continue; if (s.state === "skipped" || s.state === "paused") continue;
    const name = `${s.produces.replace(/\.[a-z0-9]+$/i, "")}.svg`; writeFileSync(join(dir, sub, name), placeholder(s, i));
    s.output = `${sub}/${name}`; s.state = "done"; s.ran_at = Date.now(); s.simulated = true;
  }
  return plan;
}
