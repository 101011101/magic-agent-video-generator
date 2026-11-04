// Find one reference picture on Wikimedia Commons: search (several queries), download candidates, VLM pick against criteria.
// Usage: node V3/compose/find-ref.mjs --out <dir> --name <id> --criteria "…" --q "query filetype:bitmap" [--q …]
import { writeFileSync, mkdirSync, copyFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const out = resolve(opt("--out")), name = opt("--name"), criteria = opt("--criteria"), UA = { "user-agent": "magic-agent-v3/0.1 (research; contact: tanjiav@gmail.com)" };
mkdirSync(join(out, "cands"), { recursive: true });
const cands = [];
for (const q of all("--q")) { const d = await fetch(`https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search&gsrsearch=${encodeURIComponent(q)}&gsrnamespace=6&gsrlimit=10&prop=imageinfo&iiprop=url|mime|extmetadata&iiurlwidth=1280`, { headers: UA }).then((r) => r.json()).catch(() => ({}));
  for (const p of Object.values(d.query?.pages || {})) { const ii = p.imageinfo?.[0]; if (ii && /image\/(jpeg|png)/.test(ii.mime) && !cands.some((c) => c.title === p.title) && cands.length < 24) cands.push({ title: p.title, thumb: ii.thumburl, page: `https://commons.wikimedia.org/wiki/${encodeURIComponent(p.title)}`, license: ii.extmetadata?.LicenseShortName?.value || "", desc: (ii.extmetadata?.ImageDescription?.value || "").replace(/<[^>]+>/g, "").slice(0, 100) }); } }
const files = [];
for (const [i, c] of cands.entries()) { try { const r = await fetch(c.thumb, { headers: UA, signal: AbortSignal.timeout(20000) }); if (!r.ok) continue; const f = join(out, "cands", `${name}-${i}.jpg`); writeFileSync(f, Buffer.from(await r.arrayBuffer())); files.push({ ...c, file: f }); } catch {} }
if (!files.length) { console.log(JSON.stringify({ name, usable: false, why: "no candidates downloaded" })); process.exit(0); }
const pick = await jsonCall({ name: "v3-find-ref-pick-v1", effort: "medium", images: files.map((f) => f.file), schema: S.obj({ index: S.int, why: S.str, usable: S.bool }), prompt: `Pick the ONE photo (1–${files.length}) that best fits: ${criteria}. It must be a real photograph (not a drawing, diagram, map, screenshot or collage), sharp, with the subject large and clear. usable=false if none fits. The photos, in order: ${files.map((f, i) => `${i + 1} = ${f.title} (${f.license}; ${f.desc})`).join("; ")}.` });
const f = files[pick.index - 1]; if (f && pick.usable) copyFileSync(f.file, join(out, `${name}.jpg`));
const res = { name, usable: pick.usable, why: pick.why, candidates: files.length, chosen: f ? { title: f.title, license: f.license, page: f.page, file: pick.usable ? join(out, `${name}.jpg`) : null } : null };
writeFileSync(join(out, `${name}.json`), JSON.stringify(res, null, 1)); console.log(JSON.stringify(res));
