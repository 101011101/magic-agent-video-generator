# `packages/sam2`

`@diffusionstudio/sam2`: SAM 2.1 video object segmentation and tracking in the browser. Loads five fixed-shape ONNX graphs on ONNX Runtime WebGPU, decodes frames with mediabunny, and returns one logit mask per frame. Weights come from pinned Hugging Face repos and are cached in OPFS.

## Parts

| Part | Role |
| --- | --- |
| [src/](src/README.md) | All runtime code. Exports: `.` (`src/index.ts`), `./mask` (`src/mask.ts`), `./models` (`src/constants.ts`). |
| [scripts/](scripts/README.md) | `export.py`: `uv run` script that exports a `transformers` SAM 2.1 checkpoint to the five ONNX graphs (fp16 compute, fp32 I/O) and `constants.json`. Usage: `export.py <model-size> <image-size> <memory-frames> <out-dir>`. |
| `src/constants.ts` | Model catalogue `SAM2_MODELS` (`tiny` 512 px, `small`, `base-plus`, `large` at 1024 px), each with a commit-pinned `repo` URL and file sizes. `DEFAULT_SAM2_MODEL = 'tiny'`. `sam2Model`, `sam2ModelOfRepo`, `downloadSize`. Pipeline sizes: `HIDDEN_DIM = 256`, `MEM_DIM = 64`, `MEMORY_FRAMES = 7`, `MAX_POINTERS = 16`, `DECODED_MASK_SIZE = 256`; `geometryOf(imageSize)`. |
| `src/load.ts` | `loadSam2(id, { onProgress })`: one model per page. Fetches files, checks `constants.json`, builds sessions, returns `Sam2Video`. Loading another model disposes or aborts the previous one. `Sam2Progress` phases `download` / `compile`. |
| `src/weights.ts` | `fetchModelFiles`: OPFS cache under a per-revision folder, resumable range downloads, whole when size matches the catalogue. `cachedSam2Models` lists fully cached models. Prunes revisions no longer offered. |
| `src/sessions.ts` | ONNX Runtime glue. `configureRuntime` sets wasm path and `high-performance` WebGPU. `createSession(model, gpuOutputs)` keeps listed outputs on the GPU. Tensor helpers `gpuTensor`, `floatTensor`, `intTensor`, `floats`, `gpuBuffer`, `disposeOutputs`. `runtimeDevice` shares the runtime's `GPUDevice`. |
| `src/tracker.ts` | `Sam2Video`: the pipeline. `seed(frame, rotation, points, index, correct?)`, `hold(frame)`, `preview(points)`, `seedHeld`, `track(frame, rotation, index, total)`, `rewind`, `reset`, `dispose`. Types `Sam2Point` (label 1 object, 0 background, 2/3 box corners), `Sam2Correction`. Reliability gates `RELIABLE_IOU = 0.25` (remember), `PLAUSIBLE_IOU = 0.15` (report). |
| `src/memory.ts` | `MemoryBank`: GPU-resident memory for attention. Slot 0 is the prompted frame; slots 1..`MEMORY_FRAMES - 1` hold the newest tracked frames; `MAX_POINTERS` (16) object pointers (seed plus up to 15 recent). `assemble(index, total)` lays out slots and returns normalized temporal distances. |
| `src/gpu.ts`, `src/shaders.ts` | WGSL compute passes. `FramePreprocessor` resizes, rotates and normalizes a `VideoFrame` into `pixel_values`. `TokenTransposer` rewrites `[C,H,W]` feature maps into `[H*W,1,C]` tokens. `createStorageBuffer`. `Rotation` type. |
| `src/video.ts` | Frame I/O over mediabunny `VideoSampleSink`. `holdFrame(model, { track, timestamp })`. `trackObject(model, { track, timestamps, seedIndex, points, correct?, signal?, onMask })`: seed, then forward, then backward in batches of `REVERSE_BATCH = 12`. |
| `src/mask.ts` | `Sam2Mask { logits, size, score, iou }`. `packMask` inverts the decoder's 2x bilinear upsample back to the model grid. `clearMask`, `maskIsEmpty`. Brush editing: `Sam2Stroke`, `paintMask`, `paintStroke` raise or lower logits under a capsule. `GIVEN_LOGIT = 10`. |
| `src/onnx.ts` | `readFloat16Initializer(model, name)`: reads one tensor (`pos_embed`) straight from the protobuf bytes. |
| `src/env.d.ts` | Type for `*.wasm?url` imports. |

## How it works

- Load: `loadSam2` -> `configureRuntime` -> `fetchModelFiles` (OPFS or network, progress reported) -> `createSession` x5 (`visionEncoder`, `maskDecoder`, `memoryEncoder`, `memoryAttention`, `pointerTpos`) -> `readFloat16Initializer('pos_embed')` -> `new Sam2Video(...)`.
- Per frame: `FramePreprocessor.run(frame, rotation)` writes `pixel_values` on the GPU -> `visionEncoder` produces `feats0`, `feats1`, `feats2`, `feats2_no_mem` (GPU-resident).
- Seed: `maskDecoder` runs on `feats2_no_mem` with point prompts -> `Sam2Mask`. Optional `correct` (brush strokes) replaces the mask; `memoryEncoder` encodes the frame plus mask into memory tokens; `MemoryBank.condition` stores it as slot 0.
- Track: `TokenTransposer` builds current tokens; `MemoryBank.assemble` orders memories and yields distances; `pointerTpos` encodes them; `memoryAttention` conditions `feats2` on the bank; `maskDecoder` runs with a padding prompt. Masks with `iou >= 0.25` and `score > 0` enter the bank (`push`); below `0.15` the mask is returned empty.
- `trackObject` drives this over a mediabunny track: decodes the seed sample, runs `seed`, iterates forward with the next decode overlapped, calls `rewind`, then walks backward in batches so keyframes are not re-decoded per frame. Frames identical to the previous sample reuse its mask. `onMask(index, mask)` fires per frame; `signal` aborts.
- Interactive prompting: `holdFrame` encodes once; `preview(points)` reruns only the decoder, so hover and click feel immediate.
- Output masks are model-grid logits. The app quantizes and stores them as `.mask` files through `packages/assets` (`encodeMaskFile`, `MaskRecipe.model` names the pinned `repo`).

## Interfaces

- Depends on: `onnxruntime-web/webgpu` (+ bundled `ort-wasm-simd-threaded.asyncify.wasm`), `mediabunny` (`VideoSampleSink`, `InputVideoTrack`), WebGPU (`navigator.gpu`, `GPUDevice`, WGSL), OPFS (`navigator.storage`), `fetch` with range requests. No `@diffusionstudio/*` dependency. Weights: `huggingface.co/diffusionstudio/sam2.1-{tiny,small,base-plus,large}-video-onnx-fp16` at pinned commits.
- Used by [../../apps/web/README.md](../../apps/web/README.md) only:
  - `src/engine/object-mask/tracking.ts` (`loadSam2`, `holdFrame`, `trackObject`, `model.preview`, `paintMask`), `brush.ts` (`paintMask`, `paintStroke`), `store.ts` (`SAM2_MODELS`, `DEFAULT_SAM2_MODEL`), `frame.ts`, `overlay.ts` and `commit.tsx` (`geometryOf`, `Sam2Mask`; `commit.tsx` writes `.mask` assets).
  - `src/components/canvas/object-mask-bar.tsx` (`SAM2_MODELS`, `downloadSize`, `sam2Model`; `cachedSam2Models` by lazy import).
  - `src/dapi/handlers/media-segment.ts` (`media segment` agent tool; type `Sam2Point`).
- Produces data consumed by [../assets/README.md](../assets/README.md) (`src/mask.ts` file format) and drawn by [../runtime/README.md](../runtime/README.md) (`src/media/mask.ts`).

Up: [../README.md](../README.md)
