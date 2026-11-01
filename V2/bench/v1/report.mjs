// Bench v1 report: plain text from a graded results folder. Headline numbers, a table per group, failure reasons
// counted, each tool's record, and every item below the mean with what went wrong. Writes report.md in the folder.
// Usage: node V2/bench/v1/report.mjs --dir V2/bench/v1/results/<stamp>
import { readFileSync, writeFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
const arg = (k, d = null) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : d; };
const DIR = arg("--dir"); const G = JSON.parse(readFileSync(join(DIR, "grades.json"), "utf8"));
const R = Object.fromEntries(readdirSync(DIR).filter((f) => /^[A-J]\d\d[a-z]\.json$/.test(f)).map((f) => { const r = JSON.parse(readFileSync(join(DIR, f), "utf8")); return [r.id, r]; }));
const NAMES = { A: "Single images", B: "Image edits", C: "Faces and characters", D: "Short video", E: "Editing the user's video", F: "Sound", G: "Composed pieces", H: "Ads and reels", I: "Longer stories (film)", J: "Conversation" };
const mean = (xs) => (xs.length ? Math.round(xs.reduce((a, b) => a + b, 0) / xs.length) : 0), pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "—");
const made = (g) => g.outputs?.length > 0;
const spent = G.reduce((a, g) => a + (g.spent || 0), 0), M = mean(G.map((g) => g.score));
const L = [];
L.push(`# Bench v1 · ${DIR.split("/").pop()}`, "");
L.push(`${G.length} items · ${G.filter((g) => g.pass).length} pass (${pct(G.filter((g) => g.pass).length, G.length)}) · mean score ${M}/100 · something made in ${G.filter(made).length} · ${spent} credits · ${Math.round(G.reduce((a, g) => a + (g.seconds || 0), 0) / 60)} min of item time`, "");
L.push("| Group | Items | Made | Pass | Mean score | Credits |", "|---|---|---|---|---|---|");
for (const k of Object.keys(NAMES)) { const gs = G.filter((g) => g.group === k); if (!gs.length) continue; L.push(`| ${k}. ${NAMES[k]} | ${gs.length} | ${gs.filter(made).length} | ${gs.filter((g) => g.pass).length} (${pct(gs.filter((g) => g.pass).length, gs.length)}) | ${mean(gs.map((g) => g.score))} | ${gs.reduce((a, g) => a + (g.spent || 0), 0)} |`); }
// the conversation, on its own
const ck = (name) => { const cs = G.flatMap((g) => (g.checks || []).filter((c) => c.name.startsWith(name))); return `${cs.filter((c) => c.pass).length}/${cs.length}`; };
L.push("", `Conversation: asked when it had to ${ck("asks first")} · asked nothing when it need not ${ck("asks nothing")} · stopped asking within 3 rounds ${ck("stops asking")} · refused when it should ${ck("refuses")} · did not refuse wrongly ${ck("does not refuse")} · said when beyond the free tier ${ck("says it is beyond")} · reply right where the answer is words ${ck("reply meets")}`);
// failure reasons
const tagN = {}; for (const g of G) for (const t of g.tags || []) tagN[t] = (tagN[t] || 0) + 1;
L.push("", "## Why items fail", "", ...Object.entries(tagN).sort((a, b) => b[1] - a[1]).map(([t, n]) => `- ${t}: ${n}`));
// tools
const T = {}; for (const r of Object.values(R)) for (const t of r.turns || []) { for (const s of t.plan?.steps || []) (T[s.tool] ??= { planned: 0, done: 0, failed: 0, placeholder: 0, credits: 0, errors: {} }).planned++; for (const s of t.ran || []) { const x = T[s.tool]; if (s.simulated) x.placeholder++; else if (s.state === "done" || s.state === "flagged") x.done++; else if (s.state === "failed") { x.failed++; const e = (s.error || "").replace(/[0-9a-f]{8,}/g, "…").slice(0, 90); x.errors[e] = (x.errors[e] || 0) + 1; } x.credits += s.credits || 0; } }
L.push("", "## Tools", "", "| Tool | Planned | Made | Failed | Placeholder (not wired) | Credits |", "|---|---|---|---|---|---|", ...Object.entries(T).sort((a, b) => b[1].planned - a[1].planned).map(([k, x]) => `| ${k} | ${x.planned} | ${x.done} | ${x.failed} | ${x.placeholder} | ${x.credits} |`));
const errs = Object.entries(T).flatMap(([k, x]) => Object.entries(x.errors).map(([e, n]) => `- ${k} ×${n}: ${e}`)); if (errs.length) L.push("", "Step errors:", ...errs);
// below the mean
L.push("", `## Below the mean (${M})`, "");
for (const g of G.filter((g) => g.score < M).sort((a, b) => a.score - b.score)) { const r = R[g.id]; L.push(`- **${g.id}** ${g.title} · ${g.score} · ${(g.tags || []).join(", ")}`, `  asked: "${r?.turns?.[0]?.text?.slice(0, 140)}" → ${(g.tools || []).join(" | ")}${g.judge ? ` · judge: ${g.judge.summary}` : g.reply ? ` · reply: ${g.reply.summary}` : ""}`); }
writeFileSync(join(DIR, "report.md"), L.join("\n") + "\n"); console.log(L.join("\n"));
