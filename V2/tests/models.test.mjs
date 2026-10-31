// The model registry and what follows from it: costs, grids, the reference cap per still model, clip-mode support, tiers.
// No model calls, no credits. Run: node V2/tests/models.test.mjs
import { STILLS, VIDEOS, TIERS, WIDTH, stillCost, videoCost, grid, maxImages, supports, profile, describe } from "../backend/lib/models.js";
import { COST } from "../backend/lib/jobs.js";
import { GRID } from "../backend/composer/screenplay/screenplay.js";
import { State, MAX_REFS } from "../backend/composer/state/state.js";

let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };

// Integrity: every still model prices every resolution it lists; every video model has a sorted grid and a rate per resolution.
for (const [k, m] of Object.entries(STILLS)) ok(m.resolutions.every((r) => Number.isFinite(m.cost[r]) && WIDTH[r]) && Number.isInteger(m.inputs) && (m.generate || m.edit), `still ${k}: every listed resolution priced, inputs ${m.inputs}`);
for (const [k, m] of Object.entries(VIDEOS)) ok(m.grid.every((s, i, a) => Number.isInteger(s) && (i === 0 || s > a[i - 1])) && m.resolutions.every((r) => Number.isFinite(m.rate[r]) && WIDTH[r]), `video ${k}: sorted grid of ${m.grid.length} lengths, a rate per resolution`);
for (const [k, t] of Object.entries(TIERS)) ok(STILLS[t.still]?.resolutions.includes(t.res) && VIDEOS[t.video]?.resolutions.includes(t.vres), `tier ${k}: ${t.still} makes ${t.res}, ${t.video} makes ${t.vres}`);

// Costs, from the sheet and the ledger.
ok(stillCost("nano-banana-pro", "2k") === 200 && stillCost("flux-2-klein", "640px") === 5 && stillCost("qwen-image-2.1", "2k") === 20, "still prices: nano-banana-pro 2k 200, klein 640px 5, qwen 2k 20");
ok(videoCost(30, "wan-3.0", "720p") === 2880 && videoCost(30, "minimax-h3", "480p") === 720 && videoCost(10, "kling-3.0", "720p", true) === 720 && videoCost(10, "kling-3.0", "720p", false) === 480 && videoCost(10, "seedance-1.5", "720p", true) === 1200, "clip prices: wan 30 s 720p 2,880; minimax 30 s 480p 720; kling audio extra; seedance audio doubles");
ok(COST.image === 200 && COST.still("flux-2-klein", "2k") === 10 && COST.video(10, "wan-3.0") === 960 && COST.video(10, "minimax-h3", true, "480p") === 240, "jobs.COST reads the registry and keeps the paid-tier constant");
let threw = false; try { stillCost("krea-2", "2k"); } catch { threw = true; } ok(threw, "a resolution the model does not make is refused");

// Grids: the screenplay's GRID is the registry's.
ok(GRID["wan-3.0"].join() === grid("wan-3.0").join() && GRID["ltx-2.5"].length === 60 && GRID["minimax-h3"][0] === 1 && GRID["kling-3.0"][0] === 3, "GRID is derived from the registry (ltx 1–60, minimax from 1, kling from 3)");

// The reference cap follows the still model's input cap.
ok(maxImages("nano-banana-pro") === MAX_REFS && maxImages("flux-2-klein") === 4 && maxImages("qwen-image-2.1") === 3 && maxImages("krea-2") === 2, `maxImages: nano ${maxImages("nano-banana-pro")}, klein ${maxImages("flux-2-klein")}, qwen ${maxImages("qwen-image-2.1")}, krea ${maxImages("krea-2")}`);
{
  const elements = [{ id: "a", kind: "character", name: "A", look: "x" }, { id: "b", kind: "character", name: "B", look: "y" }, { id: "room", kind: "place", name: "the room", look: "a room" }];
  const bank = { a: { file: "refs/a.jpg" }, b: { file: "refs/b.jpg" }, room: { file: "roots/room.png" } };
  const P = (id, third, depth = "near") => ({ id, visible: "in frame", third, depth, facing: "f", distance: "d", pose: "p", hands: "h", doing: "w" });
  const shot = (n, start, size, stands, people) => ({ n, start, seconds: 4, size, cut_reason: "x", moment: "m", action: [], lines: [], sfx: [], vo: [], changes: [], camera: { same_as: 0, stands, height: "eye", looks_at: "them", behind: [] }, first: { people, props: [] }, last: { people, props: [] } });
  const script = { title: "t", music: { cue: "", arc: [] }, scenes: [{ n: 1, place: "room", start: 0, seconds: 12, inside: true, time: "DAY", continuous: false, tone: "t", ambience: "a", captions: [], line: { between: "a and b", camera_side: "s" }, blocking: [], shots: [shot(1, 0, "wide", "at the wall", [P("a", "left", "mid"), P("b", "right", "mid")]), shot(2, 4, "close", "by a", [P("a", "centre"), { ...P("b", "right"), visible: "off right" }]), shot(3, 8, "medium", "by b", [P("a", "left"), P("b", "right")])] }] };
  const run = { path: (f) => "/tmp/" + f, save() {} }, mk = (stillModel) => new State({ log: { places: {}, style_ref: "roots/room.png" }, run, script, elements, bank, features: { a: "tall", b: "short" }, voices: {}, stillModel });
  const roomy = mk("nano-banana-pro"), tight = mk("qwen-image-2.1"), tiny = mk("krea-2");
  const r1 = roomy.refs(roomy.stills[2]), r2 = tight.refs(tight.stills[2]), r3 = tiny.refs(tiny.stills[2]);
  ok(r1.length <= MAX_REFS + 1 && r1[1].ref === "prev:s1-2" && r1.some((x) => x.ref.startsWith("style:")), `nano-banana-pro: master, previous frame, carriers, style sheet outside the cap: ${r1.map((x) => x.ref).join(", ")}`);
  ok(r2.length === 3 && r2[1].ref === "prev:s1-2" && r2[2].ref.startsWith("portrait:") && !r2.some((x) => x.ref.startsWith("style:")), `qwen (3 images): master, previous frame, one portrait, never the style sheet: ${r2.map((x) => x.ref).join(", ")}`);
  ok(r3.length === 2 && r3[1].ref === "prev:s1-2", `krea (2 images): master and the previous frame only: ${r3.map((x) => x.ref).join(", ")}`);
}

// Clip-mode support per video model.
ok(supports("wan-3.0", "seq").ok && supports("minimax-h3", "seq", "480p").ok && !supports("minimax-h3", "seq", "4k").ok, "wan and minimax take references; minimax makes no 4k");
ok(!supports("wan-2.2", "pinned").ok && supports("wan-2.2", "start").ok, "wan-2.2 takes no end frame: pinned refused, start allowed");
ok(supports("ltx-2.5", "seq").ok && /not documented/.test(supports("ltx-2.5", "seq").why), "ltx references are undocumented: allowed with a warning");
ok(!supports("kling-2.6", "pinned", "720p").ok && supports("kling-2.6", "pinned", "1080p").ok, "kling-2.6 honours an end frame only at 1080p");

// Profiles.
const free = profile({ tier: "free" }), mixed = profile({ tier: "free", res: "2k", vres: "720p" });
ok(free.still === "flux-2-klein" && free.res === "640px" && free.video === "minimax-h3" && free.vres === "480p", `free tier: ${describe(free)}`);
ok(mixed.res === "2k" && mixed.vres === "720p" && mixed.still === "flux-2-klein", "flags override the tier");
threw = false; try { profile({ tier: "free", vres: "4k" }); } catch { threw = true; } ok(threw, "a resolution the tier's model cannot make is refused at the profile");
threw = false; try { profile({ tier: "gold" }); } catch { threw = true; } ok(threw, "an unknown tier is refused");

console.log(fails ? `${fails} FAILED` : "all passed"); process.exit(fails ? 1 : 0);
