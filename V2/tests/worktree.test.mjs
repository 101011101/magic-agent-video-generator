// The working tree on a synthetic run record (T-046): hard edges carry a re-run, soft edges only mark; a sequence's
// seconds are its shots'; the remake is priced from the registry, not from the recorded attempts. No model calls.
// Run: node V2/tests/worktree.test.mjs
import { runTree, rerun } from "../backend/agent/worktree.js";
import { isHard } from "../backend/lib/deps.js";

let fails = 0; const ok = (cond, msg) => { console.log(`${cond ? "ok  " : "FAIL"} ${msg}`); if (!cond) fails++; };
const L = {
  models: { tier: "paid", still: "nano-banana-pro", res: "2k", video: "minimax-h3", vres: "480p" },
  story: { title: "Synthetic", story: "A story." },
  script: { scenes: [{ n: 1, place: "room", shots: [{ n: 1, seconds: 3 }, { n: 2, seconds: 3 }] }, { n: 2, place: "room", shots: [{ n: 3, seconds: 4 }, { n: 4, seconds: 2 }] }] },
  elements: [{ id: "room", kind: "place" }, { id: "hero", kind: "character" }],
  bank: { room: { file: "roots/room.png", source: "generated" }, hero: { file: "roots/hero.png", source: "generated" } },
  stills: {
    "s1-1": { scene: 1, shot: 1, size: "wide", file: "stills/s1-1.png", from: "plate" },
    "s1-2": { scene: 1, shot: 2, size: "wide", file: "stills/s1-2-r1.png", from: "edit:s1-1" },
    "s2-1": { scene: 2, shot: 3, size: "close", file: "stills/s2-1.png", from: "plate" },
    "s2-2": { scene: 2, shot: 4, size: "wide", file: "stills/s2-2.png", from: "card" },
  },
  jobs: {
    "root-room": { file: "roots/room.png", endpoint: "/v1/ai-image-generator", credits: 200, inputs: [] },
    "root-hero": { file: "roots/hero.png", endpoint: "/v1/ai-image-generator", credits: 200, inputs: [] },
    "still-s1-1": { file: "stills/s1-1.png", endpoint: "/v1/ai-image-editor", credits: 200, inputs: ["roots/room.png", "roots/hero.png"] },
    "still-s1-2": { file: "stills/s1-2.png", endpoint: "/v1/ai-image-editor", credits: 200, inputs: ["stills/s1-1.png"] },
    "still-s1-2-r1": { file: "stills/s1-2-r1.png", endpoint: "/v1/ai-image-editor", credits: 200, inputs: ["stills/s1-1.png"] },
    "still-s2-1": { file: "stills/s2-1.png", endpoint: "/v1/ai-image-editor", credits: 200, inputs: ["roots/room.png", "stills/s1-2-r1.png", "roots/hero.png"] },
    "seq-1-2": { file: "clips/seq-1-2.mp4", endpoint: "/v1/text-to-video", credits: 144, seconds: 77, inputs: ["stills/s1-1.png", "stills/s1-2-r1.png", "roots/hero.png"] },
    "seq-3-3": { file: "clips/seq-3-3.mp4", endpoint: "/v1/text-to-video", credits: 96, seconds: 61, inputs: ["stills/s2-1.png"] },
  },
  build: { painted: { "s2-2": { card: true, file: "stills/s2-2.png" } }, sequences: { "1-2": { clip: "clips/seq-1-2.mp4", shots: [1, 2], seconds: 6, rendered: 6 }, "3-3": { clip: "clips/seq-3-3.mp4", shots: [3], seconds: 4, rendered: 4 } }, film: { file: "clips/film.mp4" } },
};
const T = runTree(L, "synthetic"), by = Object.fromEntries(T.nodes.map((n) => [n.id, n])), d = (id) => by[id].dependents.filter((x) => x !== id);
ok(T.edges.length > 0 && T.edges.every((e) => e.length === 3 && ["hard", "soft"].includes(e[2])), `every edge carries its kind (${T.edges.filter((e) => e[2] === "hard").length} hard, ${T.edges.filter((e) => e[2] === "soft").length} soft)`);
ok(isHard("image 1") && isHard("pinned still") && isHard("shot") && isHard("input") && !isHard("reference") && !isHard("portrait") && !isHard("prop") && isHard("a role nobody named"), "the role table: image 1, a pinned frame, a shot and an input are hard; a reference, a portrait, a prop picture soft; an unknown role hard");
ok(JSON.stringify(d("still:s1-1").sort()) === JSON.stringify(["clip:seq-1-2.mp4", "film", "still:s1-2"].sort()), `s1-1 → s1-2 (painted into it), the sequence pinned on them, the film; not s2-1, which only took s1-2 as a reference (${d("still:s1-1").join(", ")})`);
ok(by["still:s1-1"].informed.length === 1 && by["still:s1-1"].informed[0] === "still:s2-1", "s1-1 informs s2-1: marked, not remade");
ok(d("asset:hero").length === 0 && by["asset:hero"].informed.length === 3, `the hero sheet: nothing is painted into it; three things took it as a portrait or a reference (${by["asset:hero"].informed.join(", ")})`);
ok(by["clip:seq-1-2.mp4"].seconds === 6 && by["clip:seq-1-2.mp4"].inputs.find((i) => i.id === "asset:hero")?.role === "reference" && by["clip:seq-1-2.mp4"].inputs.find((i) => i.id === "still:s1-1")?.role === "pinned still", "a sequence's seconds are its rendered length, not the job's wall-clock; its frames are pinned, a portrait it took is a soft reference");
ok(by["still:s1-2"].credits === 400 && by["still:s1-2"].remake === 200, "s1-2 spent 400 over two attempts; remaking it is one still, 200");
ok(by["still:s1-1"].rerun_credits === 200 + 200 + 6 * 24, `re-running s1-1 is priced from the registry: two stills and a 6-second sequence = ${by["still:s1-1"].rerun_credits}, not the recorded 744`);
ok(by["still:s2-2"].card === true && by["still:s2-2"].remake === 0, "a title card costs nothing to remake");
const r = rerun(T, "asset:room");
ok(r.ids.length === 7 && r.ids.includes("still:s1-1") && r.ids.includes("still:s2-1") && r.informed.length === 0 && r.credits === 200 + 200 + 200 + 200 + 144 + 96, `the plate's re-run reaches every still painted into it and what they pin (${r.ids.length} nodes, ${r.credits} credits), nothing marked`);
ok(/took it as a reference and would be marked/.test(by["still:s1-1"].explain) && /Nothing depends on it/.test(by["asset:hero"].explain), "the explain line says what is remade and what is marked");
console.log(`\n${fails ? `${fails} FAILED` : "all passed"}`); process.exit(fails ? 1 : 0);
