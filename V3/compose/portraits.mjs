// Character portraits from the OpenAI image API (gpt-image-1), one per cast member of a film's story, checked against the look by a VLM.
// Usage: node V3/compose/portraits.mjs --film V3/runs/<label>/film.json --id evan --id maya --id leo  → V3/runs/<label>/refs/portraits/<id>.png
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join, resolve, dirname } from "node:path";
import { jsonCall, S } from "../../V2/backend/lib/llm.js";
import { key } from "../../V2/backend/lib/env.js";
const args = process.argv.slice(2), opt = (k, d) => (args.includes(k) ? args[args.indexOf(k) + 1] : d), all = (k) => args.flatMap((a, i) => (a === k ? [args[i + 1]] : []));
const filmPath = resolve(opt("--film")), film = JSON.parse(readFileSync(filmPath, "utf8")), dir = join(dirname(filmPath), "refs", "portraits"); mkdirSync(dir, { recursive: true });
const rec = { made: {} };
for (const id of all("--id")) {
  const look = film.story.cast.find((c) => c.id === id)?.look; if (!look) { console.log(`${id}: not in the cast`); continue; }
  const prompt = `Photorealistic reference portrait of a high-school student for a film: ${look}. Three-quarter view from the chest up, face clearly lit and in focus, neutral calm expression, plain mid-grey studio background, natural daylight look, no text, no watermark. ${film.story.setting.split(".").slice(-2).join(".")}`;
  const t0 = Date.now();
  const r = await fetch("https://api.openai.com/v1/images/generations", { method: "POST", headers: { authorization: `Bearer ${key("OPENAI_API_KEY")}`, "content-type": "application/json" }, body: JSON.stringify({ model: "gpt-image-2", prompt, size: "1024x1024", quality: "medium", n: 1 }) }).then((x) => x.json());
  if (!r.data?.[0]?.b64_json) { console.log(`${id}: ${JSON.stringify(r).slice(0, 300)}`); continue; }
  const file = join(dir, `${id}.png`); writeFileSync(file, Buffer.from(r.data[0].b64_json, "base64"));
  const chk = await jsonCall({ name: "v3-portrait-check-v1", effort: "low", images: [file], schema: S.obj({ met: S.enum(["yes", "partly", "no"]), evidence: S.str }), prompt: `Does this portrait show exactly: ${look}? yes/partly/no with evidence (hair, garment, the named detail).` });
  rec.made[id] = { file, look, prompt, seconds: Math.round((Date.now() - t0) / 1000), check: chk, source: "openai gpt-image-2 1024x1024 medium" };
  console.log(`${id}: ${chk.met} (${chk.evidence}) · ${rec.made[id].seconds} s · ${file}`);
}
writeFileSync(join(dir, "portraits.json"), JSON.stringify(rec, null, 2));
