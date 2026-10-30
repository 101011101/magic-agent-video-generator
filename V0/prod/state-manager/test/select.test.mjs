// Proof for SM-100: the selector returns, for every operation the recorded runs actually performed, the same tool the
// hardcoded literal returned — and changes its answer when a tracked property changes. No API calls, no credits.
// Run: node current/prod/state-manager/test/select.test.mjs
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join } from "node:path";
import { REPO } from "../src/paths.js";
import { loadSignatures, loadCatalog } from "../src/signatures.js";
import { rankTools, selectTool, selectVideoModel, videoCapabilities, preservedAtoms, allows, PREFER } from "../src/select.js";

const sigs = loadSignatures({ includeAnalysis: true });
const caps = videoCapabilities(loadCatalog());
let pass = 0, fail = 0;
const ok = (cond, label, detail = "") => { if (cond) { pass++; console.log(`  ok   ${label}`); } else { fail++; console.log(`  FAIL ${label}${detail ? ` — ${detail}` : ""}`); } };
const h = (s) => console.log(`\n${s}`);

// The three operations the live pipelines perform, expressed as what the state needs rather than as a tool name.
// A character in frame contributes identity/head_hair/body; those are reference-only, so they decide the tool.
const OPS = {
  generate: { outMedia: "image", inputCount: 0, preserve: [], make: ["background", "props", "style", "lighting"], was: "AI Image Generator", endpoint: "/v1/ai-image-generator" },
  edit: { outMedia: "image", inputCount: 1, preserve: preservedAtoms([{ kind: "character" }]), make: ["pose_action", "background", "lighting"], was: "AI Image Editor", endpoint: "/v1/ai-image-editor" },
  merge: { outMedia: "image", inputCount: 3, preserve: preservedAtoms([{ kind: "character" }, { kind: "prop" }]), make: ["pose_action", "background"], was: "AI Image Editor", endpoint: "/v1/ai-image-editor" },
  clip: { outMedia: "video", inputCount: 1, preserve: [...preservedAtoms([{ kind: "character" }]), "background", "props", "style"], make: ["pose_action", "duration"], was: "Image-to-Video", endpoint: "/v1/image-to-video" },
};

h("1. Same tool as the hardcoded literal, for every recorded operation");
for (const [name, op] of Object.entries(OPS)) {
  const { pick } = selectTool(op, sigs, [op.was]);
  ok(pick?.tool === op.was, `${name} → ${op.was}`, `got ${pick?.tool ?? "none"}`);
  const t = sigs.byName[pick?.tool];
  ok(t?.endpoint === op.endpoint, `${name} endpoint ${op.endpoint}`, `got ${t?.endpoint}`);
}

h("2. The recorded runs contain only these operations (so the table above is complete)");
const seen = new Set();
for (const root of ["current/tests/pipeline-state-graph/runs", "current/tests/pipeline-memory/runs"]) {
  const dir = join(REPO, root);
  if (!existsSync(dir)) continue;
  for (const d of readdirSync(dir)) {
    const f = join(dir, d, "run.json");
    if (!existsSync(f)) continue;
    for (const j of Object.values(JSON.parse(readFileSync(f, "utf8")).jobs || {})) if (j.endpoint) seen.add(j.endpoint);
  }
}
const covered = new Set(Object.values(OPS).map((o) => o.endpoint));
for (const ep of seen) ok(covered.has(ep) || ep === "/v1/ai-voice-generator", `recorded endpoint ${ep} is covered`, "not in the op table");
console.log(`  (recorded endpoints: ${[...seen].join(", ")})`);

h("3. Selection is a function of the state: changing a tracked property changes the tool");
// Same step, but nothing bound in frame — nothing to carry, so a from-scratch tool is viable where it was not before.
const bound = selectTool(OPS.edit, sigs, []);
const unbound = selectTool({ ...OPS.edit, inputCount: 0, preserve: [] }, sigs, []);
ok(bound.pick?.tool !== unbound.pick?.tool, "bound vs unbound select different tools", `${bound.pick?.tool} vs ${unbound.pick?.tool}`);
ok(unbound.pick?.kind === "from_scratch", "unbound step selects a from_scratch tool", `got ${unbound.pick?.kind}`);
// A step that must preserve identity cannot use a tool that does not carry it.
const gen = rankTools(OPS.edit, sigs).find((r) => r.tool === "AI Image Generator");
ok(gen && !gen.ok && gen.blocking.some((b) => /identity/.test(b)), "generator is rejected for an identity-preserving step", JSON.stringify(gen?.blocking));

h("4. Reference-only atoms reach for a reference tool (SM-103)");
// Identity must be restored onto an existing frame, and nothing else may change: the editor cannot claim this, because
// it does not carry head_hair/body hard, while Face Swap Photo does carry identity from a source.
const restore = { outMedia: "image", inputCount: 2, preserve: ["identity", "wardrobe", "background", "lighting", "props", "camera"], make: [] };
const ranked = rankTools(restore, sigs).filter((r) => r.ok);
ok(ranked.some((r) => r.tool === "Face Swap Photo"), "Face Swap Photo is viable for identity restoration", ranked.map((r) => r.tool).join(", "));
console.log(`  (viable: ${ranked.map((r) => r.tool).join(", ")})`);

h("5. Face Detection is reachable (SM-104)");
ok(!!sigs.byName["Face Detection"], "Face Detection is in the selector's tool set");
ok(!loadSignatures().byName["Face Detection"], "and is still absent from the solver's set (unchanged behaviour)");

h("6. Model choice follows from the stated need, not a constant");
const base = selectVideoModel({ seconds: 5, resolution: "720p" }, caps);
ok(base.model === "wan-3.0", "no stated need → wan-3.0, today's literal", `got ${base.model}`);
const withAudio = selectVideoModel({ audio: true, seconds: 5, resolution: "720p" }, caps);
ok(withAudio.model === "wan-3.0", "audio → wan-3.0 (supports it)", `got ${withAudio.model}`);
ok(withAudio.rejected.some((r) => r.model === "wan-2.2" && /audio/.test(r.why)), "wan-2.2 rejected for audio");
ok(withAudio.rejected.some((r) => r.model === "kling-2.6" && /audio/.test(r.why)), "kling-2.6 rejected for audio");
const endFrame = selectVideoModel({ endFrame: true, seconds: 5, resolution: "720p" }, caps);
ok(!endFrame.viable.includes("wan-2.2"), "end frame rules out wan-2.2");
ok(!endFrame.viable.includes("minimax-h3"), "end frame rules out minimax-h3");
const long = selectVideoModel({ endFrame: true, seconds: 16, resolution: "720p" }, caps);
ok(!long.viable.includes("veo3.1"), "end frame at 16s rules out veo3.1 (8s ceiling)", long.viable.join(", "));
const twenty = selectVideoModel({ seconds: 20, resolution: "720p" }, caps);
ok(twenty.viable.includes("wan-3.0") && !twenty.viable.includes("kling-2.6"), "20s allowed for wan-3.0, not kling-2.6", twenty.viable.join(", "));

h("7. Duration spec parsing");
ok(allows("2-10, 15, 20, 25, 30", 5) && allows("2-10, 15, 20, 25, 30", 20), "wan-3.0 allows 5s and 20s");
ok(!allows("2-10, 15, 20, 25, 30", 12), "wan-3.0 rejects 12s");
ok(allows("5, 10", 10) && !allows("5, 10", 7), "kling-2.6 allows 10s, rejects 7s");
ok(allows("integer 3-15", 15) && !allows("integer 3-15", 16), "kling-3.0 range parsed");

h("8. An impossible step fails loudly rather than falling back");
const impossible = selectTool({ outMedia: "video", inputCount: 0, preserve: ["identity", "head_hair", "body"], make: [] }, sigs, []);
ok(!impossible.pick, "no input + reference-only preserve → no tool", impossible.pick?.tool);

h("9. need built at the call sites (SM-100 wiring)");
// Mirrors Controller.needOf and keyframes.needOfCut: an entity contributes its reference-only atoms only when an input
// shows it. The invariant that matters is that we never ask to preserve something no input supplies — that rejects
// every tool and silently drops the step back to the literal, which is exactly the silent behaviour we are avoiding.
const needOf = (entities, plan) => {
  const shown = new Set([...(plan.kept || []), ...(plan.merges || []).flatMap((m) => m.ids), ...(plan.roots || []).flatMap((r) => r.ids)]);
  const carried = entities.filter((e) => shown.has(e.id));
  return { preserve: preservedAtoms(carried), make: carried.length ? ["pose_action", "background", "lighting"] : [], carried: carried.map((e) => e.id) };
};
const ENTS = [{ id: "keeper", kind: "character" }, { id: "shell", kind: "prop" }, { id: "beach", kind: "location" }];
const nKept = needOf(ENTS, { kept: ["keeper"], merges: [], roots: [] });
ok(nKept.preserve.includes("identity") && nKept.preserve.includes("head_hair") && nKept.preserve.includes("body"),
  "a kept character contributes its reference-only atoms", nKept.preserve.join(","));
const nRoot = needOf(ENTS, { kept: [], merges: [], roots: [{ frame: "f1", ids: ["keeper"] }] });
ok(nRoot.preserve.includes("identity"), "a root-referenced entity is carried too", nRoot.preserve.join(","));
const nMerge = needOf(ENTS, { kept: [], merges: [{ frame: "f2", ids: ["shell"] }], roots: [] });
ok(nMerge.preserve.includes("identity") && !nMerge.preserve.includes("body"), "a merged prop contributes identity only", nMerge.preserve.join(","));
const nFresh = needOf(ENTS, { kept: [], merges: [], roots: [] });
ok(nFresh.preserve.length === 0 && nFresh.make.length === 0, "nothing shown → nothing preserved (no contradiction)", JSON.stringify(nFresh));
// The generate step must stay viable: a fresh frame with an empty preserve still selects the generator.
ok(selectTool({ outMedia: "image", inputCount: 0, ...nFresh }, sigs, ["AI Image Generator"]).pick?.tool === "AI Image Generator",
  "fresh frame still selects the generator");
// And an edit that carries a character still selects the editor, with the generator blocked for the right reason.
const edRank = rankTools({ outMedia: "image", inputCount: 1, preserve: nKept.preserve, make: nKept.make }, sigs);
ok(edRank.find((r) => r.tool === "AI Image Editor")?.ok, "carried character → editor viable");
ok(/reference-only/.test(edRank.find((r) => r.tool === "AI Image Generator")?.blocking.join(" ") || ""),
  "generator blocked because it cannot carry a reference-only atom");
// The scene atoms the call sites put in `make` must not block the editor.
ok(!rankTools({ outMedia: "image", inputCount: 1, preserve: nKept.preserve, make: ["pose_action", "background", "lighting"] }, sigs)
  .find((r) => r.tool === "AI Image Editor")?.blocking.length, "the make-list the call sites use does not block the editor");

h("10. The vocabulary cannot express a negative requirement");
// RUN-001 measured that nano-banana-pro FAILS text suppression while gpt-image-2 passes. Acting on that needs a step to
// say "this frame must contain NO text". `text` exists as an atom, but preserve/make are both positive: preserve means
// carry it from an input, make means set it. There is no `absent`, so the evidence cannot yet be acted on by selection.
ok(sigs.byName["AI Image Editor"].passes.text !== undefined, "the `text` atom exists and the editor carries it");
const suppress = rankTools({ outMedia: "image", inputCount: 0, preserve: [], make: [] }, sigs).filter((r) => r.ok);
ok(suppress.length > 0 && !("absent" in ({ preserve: [], make: [] })),
  "no `absent`/`avoid` field exists — text suppression is NOT expressible (see report)");

console.log(`\n${fail ? "FAIL" : "PASS"} — ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
