// The execution side against the fake Magic Hour (tests/fake-magichour.mjs): jobs posted, polled, downloaded, charged,
// cached and resumed, and what the executor does when the provider errors, the upload fails, the download is empty, a
// job is slow, or the cap runs out halfway. Real files come back; the ledger is a temporary one. No credits, no network
// beyond 127.0.0.1, no model call. Run: node V2/tests/execution.test.mjs
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, copyFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { startFake } from "./fake-magichour.mjs";

let fails = 0; const ok = (c, m) => { console.log(`${c ? "ok  " : "FAIL"} ${m}`); if (!c) fails++; };
const note = (m) => console.log(`note ${m}`);

const fake = await startFake();
const LEDGER = join(mkdtempSync(join(tmpdir(), "ledger-")), "ledger.json"); writeFileSync(LEDGER, JSON.stringify({ total: 0, runs: { other: 0 }, inflight: {} }));
process.env.MAGIC_HOUR_BASE = fake.url; process.env.MAGIC_HOUR_API_KEY = "test"; process.env.CLEANED_LEDGER = LEDGER; process.env.CLEANED_CAP = "1000";
const { execute } = await import("../backend/agent/execute.js");
const ledger = () => JSON.parse(readFileSync(LEDGER, "utf8"));
const probe = (f, what) => execFileSync("ffprobe", ["-v", "error", "-select_streams", what, "-show_entries", "stream=codec_type", "-of", "csv=p=0", f]).toString().trim();

const session = (id) => { const dir = mkdtempSync(join(tmpdir(), `sess-${id}-`)); mkdirSync(join(dir, "materials"), { recursive: true }); copyFileSync(fake.fixtures.photo, join(dir, "materials", "photo.png")); copyFileSync(fake.fixtures.face, join(dir, "materials", "face.png")); copyFileSync(fake.fixtures.clip, join(dir, "materials", "clip.mp4")); return dir; };
const step = (tool, inputs, produces, params = {}, group = "make") => ({ group, tool, inputs, produces, params: { seconds: 0, aspect: "", resolution: "", prompt_or_change: "", extra: "", ...params }, why: "test", state: "proposed" });
const run = async (steps, dir, id) => { const said = []; const plan = { shape: "tree", steps, turn: 0 }; await execute(plan, dir, { id, say: (m) => said.push(m) }); return { plan, said, log: existsSync(join(dir, "exec.json")) ? JSON.parse(readFileSync(join(dir, "exec.json"), "utf8")) : { jobs: {}, pending: {}, calls: [] } }; };
const chain = () => [step("image", [], "pic.png", { prompt_or_change: "a lighthouse at dawn", aspect: "16:9" }), step("image-to-video", ["pic.png"], "clip.mp4", { seconds: 5, prompt_or_change: "slow waves" }, "animate"), step("crop", ["clip.mp4"], "square.mp4", { aspect: "1:1" }, "change-form")];

// A. The happy chain: a picture, a clip from it, a code crop of the clip.
{
  const dir = session("happy"); const { plan, said, log } = await run(chain(), dir, "happy"); const [pic, clip, sq] = plan.steps;
  ok(plan.steps.every((s) => s.state === "done"), `three steps done (${plan.steps.map((s) => s.state).join(", ")})`);
  ok(existsSync(join(dir, pic.output)) && probe(join(dir, pic.output), "v") === "video", `the picture is a real file (${pic.output})`);
  ok(existsSync(join(dir, clip.output)) && probe(join(dir, clip.output), "v") === "video", `the clip is a real file (${clip.output})`);
  ok(probe(join(dir, clip.output), "a") === "", "the generated clip's invented sound is dropped unless the step says keep");
  ok(pic.credits_spent === 5 && clip.credits_spent === 120 && sq.credits_spent === 0, `credits per step: ${pic.credits_spent}, ${clip.credits_spent}, ${sq.credits_spent}`);
  ok(fake.jobs.length === 2 && /image-generator/.test(fake.jobs[0].endpoint) && /image-to-video/.test(fake.jobs[1].endpoint), "two jobs posted, in order");
  ok(fake.jobs[0].body.style?.prompt === "a lighthouse at dawn" && fake.jobs[0].body.image_count === 1 && fake.jobs[0].body.model === "flux-2-klein", `the image body carries the prompt, one image, the free model (${fake.jobs[0].body.model})`);
  ok(/^api-assets\//.test(fake.jobs[1].body.assets?.image_file_path) && fake.jobs[1].body.end_seconds === 5, "the clip body names the uploaded picture and 5 seconds");
  const ups = Object.values(fake.uploads); ok(ups.length === 1 && ups[0].bytes > 1000, `one upload, the picture, ${ups[0]?.bytes} bytes`);
  ok(Object.keys(log.jobs).length === 3 && Object.keys(log.pending).length === 0 && log.calls.length === 2 && log.calls.every((c) => c.credits && c.id), "exec.json: three job records (two paid, one by code), nothing pending, two charges with ids");
  const L = ledger(); ok(L.runs["session-happy"] === 125 && (L.inflight["session-happy"] ?? 0) === 0, `the ledger books 125 for the session and nothing in flight (${JSON.stringify(L.runs)})`);
  ok(said.some((m) => /\(5 credits\)/.test(m)) && said.some((m) => /\(120 credits\)/.test(m)) && said.some((m) => /0 credits, by code/.test(m)), "the user is told each step's cost");
  ok(pic.facts?.kind === "picture" && clip.facts?.kind === "clip" && Math.abs(clip.facts.seconds - 5) < 0.7, "measured facts on the outputs agree with the steps");

  // B. The same plan again in the same session: every paid step is a cache hit, nothing posted, nothing charged.
  const before = fake.jobs.length; const again = await run(chain(), dir, "happy");
  ok(again.plan.steps.slice(0, 2).every((s) => s.state === "done" && s.cached && s.credits_spent === 0), "a second run returns both paid steps from the cache at 0 credits");
  ok(fake.jobs.length === before && ledger().runs["session-happy"] === 125, "no new job, no new charge");
  ok(again.said.filter((m) => /\(cached\)/.test(m)).length === 2, "the user is told they were cached");
}

// C. The provider errors the clip job: the step fails, the charge is 0, the picture's charge stands; a later run posts anew.
{
  const dir = session("err"); fake.script.push({ match: /image-to-video/, error: "content moderation: the prompt was blocked" });
  const { plan, log } = await run(chain(), dir, "err"); const [pic, clip, sq] = plan.steps;
  ok(pic.state === "done" && clip.state === "failed" && /error.*blocked/.test(clip.error), `the clip step fails with the provider's words (${clip.error.slice(0, 80)})`);
  ok(sq.state === "waiting", `the crop that needed the clip is left "${sq.state}"`);
  ok(ledger().runs["session-err"] === 5 && log.calls.length === 2 && log.calls[1].error && !log.calls[1].credits, "only the picture is charged; the failed call is recorded with no credits");
  ok(Object.keys(log.pending).length === 1, `the errored job's id stays under pending (${Object.keys(log.pending)[0]})`);
  note("an errored job is left pending; the next run polls it, reads the error, and only then posts anew");
  const n = fake.jobs.length; const re = await run(chain(), dir, "err");
  ok(re.plan.steps.every((s) => s.state === "done") && fake.jobs.length === n + 1 && ledger().runs["session-err"] === 125 && Object.keys(re.log.pending).length === 0, "the rerun resumes the errored job, posts the clip anew, finishes, and clears pending");
  ok(re.plan.steps[0].cached, "the picture is not paid for twice");
}

// D. A crash mid-poll: the job id was recorded, the process died. The next run resumes it: no second post, one charge.
{
  const dir = session("resume"); const id = fake.seed({ endpoint: "/v1/image-to-video", kind: "video", credits: 120 });
  writeFileSync(join(dir, "exec.json"), JSON.stringify({ jobs: {}, pending: { "t0-s0-image-to-video": { id, kind: "video", credits: 120, at: new Date().toISOString(), endpoint: "/v1/image-to-video" } }, calls: [] }));
  const n = fake.jobs.length; const { plan, log, said } = await run([step("image-to-video", ["photo.png"], "clip.mp4", { seconds: 5, prompt_or_change: "waves" }, "animate")], dir, "resume"); const s = plan.steps[0];
  ok(s.state === "done" && existsSync(join(dir, s.output)) && fake.jobs.length === n, "the pending job is resumed: the file arrives and nothing new is posted");
  ok(log.calls.length === 1 && log.calls[0].resumed && log.calls[0].credits === 120 && ledger().runs["session-resume"] === 120, "the charge taken earlier is booked once, marked resumed");
  ok(Object.keys(log.pending).length === 0 && log.jobs["t0-s0-image-to-video"]?.id === id, "pending is cleared and the record names the resumed job");
  note(`the resumed step shows credits_spent ${s.credits_spent} and the user hears "${said.find((m) => /image-to-video/.test(m))}" while the ledger took 120: the charge belongs to the earlier process, but the node does not say so (T-051)`);
}

// E. The cap runs out halfway: the picture is made, the clip is refused, nothing is posted for it.
{
  const L = ledger(); const spent = Object.entries(L.runs).filter(([k]) => k !== "other").reduce((a, [, v]) => a + v, 0); L.runs.other = 1000 - spent - 100; writeFileSync(LEDGER, JSON.stringify(L));   // 100 of headroom under the 1000 cap, whatever the earlier scenarios booked: 5 fits, 120 does not
  const dir = session("cap"); const n = fake.jobs.length; const { plan, log } = await run(chain(), dir, "cap"); const [pic, clip] = plan.steps;
  ok(pic.state === "done" && clip.state === "failed" && /credit cap/.test(clip.error), "the picture is made, the clip is refused by the cap");
  ok(fake.jobs.length === n + 1 && Object.keys(log.pending).length === 0 && ledger().runs["session-cap"] === 5, "one job posted, nothing pending, 5 booked");
  const L2 = ledger(); L2.runs.other = 0; writeFileSync(LEDGER, JSON.stringify(L2));
}

// F. A slow job: queued on the first look, complete on the second. The poll loop waits and comes back.
{
  const dir = session("slow"); fake.script.push({ match: /image-generator/, polls: 1 }); const t0 = Date.now();
  const { plan } = await run([step("image", [], "pic.png", { prompt_or_change: "a slow one" })], dir, "slow");
  const j = fake.jobs.at(-1); ok(plan.steps[0].state === "done" && j.looks === 2 && Date.now() - t0 >= 2500, `the job is polled twice and finishes (${Math.round((Date.now() - t0) / 100) / 10} s)`);
}

// G. The download is empty: the charge was taken, the file is useless. The step fails and the money is counted.
{
  const dir = session("tiny"); fake.script.push({ match: /image-generator/, tiny: true });
  const { plan, log } = await run([step("image", [], "pic.png", { prompt_or_change: "a broken one" })], dir, "tiny"); const s = plan.steps[0];
  ok(s.state === "failed" && /empty download/.test(s.error), `an output under 1 KB fails the step (${s.error.slice(0, 60)})`);
  ok(ledger().runs["session-tiny"] === 5 && log.calls[0].credits === 5, "the 5 credits the provider charged are booked although no usable file came back");
  ok(Object.keys(log.pending).length === 1 && !log.jobs["t0-s0-image"], "the job stays pending with no record: a rerun would poll it again");
  note("credits spent, no file, state \"failed\": the case T-051 calls \"broken\", told apart from a refusal that spent nothing");
}

// H. The upload of an input fails: no job is posted, nothing is charged, the reservation is released.
{
  const dir = session("upload"); fake.script.push({ match: /upload-urls/, uploadStatus: 500 }); const n = fake.jobs.length;
  const { plan, log } = await run([step("image-to-video", ["photo.png"], "clip.mp4", { seconds: 5, prompt_or_change: "waves" }, "animate")], dir, "upload"); const s = plan.steps[0];
  ok(s.state === "failed" && /upload PUT 500/.test(s.error), `the step fails with the upload's status (${s.error.slice(0, 60)})`);
  ok(fake.jobs.length === n && (ledger().runs["session-upload"] ?? 0) === 0 && (ledger().inflight["session-upload"] ?? 0) === 0 && log.calls[0]?.error, "no job posted, nothing booked, nothing left in flight, the error recorded");
}

// I. The generic paid path: a photo face swap with one face found → all-faces mode, both files uploaded, 10 credits.
{
  const dir = session("swap"); const n = Object.keys(fake.uploads).length;
  const { plan } = await run([step("face-swap-photo", ["photo.png", "face.png"], "swapped.png", { prompt_or_change: "put my face on it" }, "change-identity")], dir, "swap"); const s = plan.steps[0];
  const j = fake.jobs.findLast((x) => /face-swap-photo/.test(x.endpoint));
  ok(s.state === "done" && s.credits_spent === 10 && j && j.body.assets.face_swap_mode === "all-faces" && /^api-assets\//.test(j.body.assets.target_file_path) && /^api-assets\//.test(j.body.assets.source_file_path) && j.body.assets.target_file_path !== j.body.assets.source_file_path, "face swap posts the target and the face as two uploaded paths in all-faces mode for 10 credits");
  ok(Object.keys(fake.uploads).length - n >= 2 && fake.jobs.some((x) => /face-detection/.test(x.endpoint)), "both pictures are uploaded and faces are detected first (free)");
}

// J. Music and captions: duration drives the charge; the clip's own length drives the subtitle job.
{
  const dir = session("sound");
  const { plan } = await run([step("music", [], "bed.mp3", { seconds: 15, prompt_or_change: "calm piano" }), step("captions", ["clip.mp4"], "subbed.mp4", { prompt_or_change: "english" }, "speech")], dir, "sound"); const [m, c] = plan.steps;
  ok(m.state === "done" && m.credits_spent === 15 && probe(join(dir, m.output), "a") === "audio", "15 seconds of music cost 15 and the file has sound");
  ok(fake.jobs.findLast((x) => /music/.test(x.endpoint)).body.duration === 15 && fake.jobs.findLast((x) => /music/.test(x.endpoint)).body.style.instrumental === true, "the music body asks for 15 s, instrumental");
  const cj = fake.jobs.findLast((x) => /subtitle/.test(x.endpoint)); ok(c.state === "done" && c.credits_spent === 24 && cj.body.end_seconds === 5, `captions run to the clip's 5 s and cost 24 (${c.credits_spent})`);
}

ok(fake.requests.every((r) => !/magichour\.ai/.test(r.path)), `${fake.requests.length} requests, all to the fake`);
await fake.close();
console.log(fails ? `\n${fails} FAILED` : "\nall ok");
process.exit(fails ? 1 : 0);
