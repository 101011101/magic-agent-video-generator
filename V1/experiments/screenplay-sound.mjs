// Add sound notes to a run's approved screenplay (text unchanged). Saves run.json → screenplay_sound and screenplay.sound.txt.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { RUNS } from "../src/env.js";
import { addSound } from "../src/screenplay.js";
const name = process.argv[2], f = join(RUNS, name, "run.json"), r = JSON.parse(readFileSync(f, "utf8"));
const sp = await addSound(r.screenplay_approved);
const same = sp.scenes.every((s, i) => s.beats.every((b, j) => b.text === r.screenplay_approved.scenes[i].beats[j].text));
r.screenplay_sound = sp; writeFileSync(f, JSON.stringify(r, null, 2));
writeFileSync(join(RUNS, name, "screenplay.sound.txt"), sp.scenes.map((s, i) => `${i + 1}. ${s.inside ? "INT." : "EXT."} ${s.place.toUpperCase()} — ${s.time.toUpperCase()}\n   [AMBIENCE: ${s.ambience}]${s.music ? `\n   [MUSIC: ${s.music}]` : ""}\n${s.beats.map((b) => (b.kind === "dialogue" ? `            ${b.who.toUpperCase()}: ${b.text}` : `${b.text}${b.sfx ? `   [SFX: ${b.sfx}]` : ""}`)).join("\n")}`).join("\n\n"));
console.log(`approved text unchanged: ${same} · effects: ${sp.scenes.reduce((n, s) => n + s.beats.filter((b) => b.sfx).length, 0)} · music cues: ${sp.scenes.filter((s) => s.music).length}/${sp.scenes.length}`);
