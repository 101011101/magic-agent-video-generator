# `packages/sam2/scripts`

Offline Python exporter that turns a SAM 2.1 checkpoint into the five fixed-shape fp16 ONNX graphs plus `constants.json` that `packages/sam2/src` loads in the browser.

## Parts

| Part | Role |
|---|---|
| `export.py` | Single script. Run with `uv run packages/sam2/scripts/export.py <model-size> <image-size> <memory-frames> <out-dir>`. Inline PEP 723 header pins `torch==2.14.0`, `transformers==5.17.0`, `onnx==1.23.0`, `onnxslim==0.1.96`, `numpy`. Not run at build time; its output is published to Hugging Face repos listed in `src/constants.ts`. |

Key symbols in `export.py`:

| Symbol | Role |
|---|---|
| `load(checkpoint, image_size)` | Loads `facebook/sam2.1-hiera-<size>` via `transformers.Sam2VideoModel`. Rewrites config so every sub-module uses `image_size`; feature grid is `image_size // 16`. Replaces `backbone._get_pos_embed` with a precomputed constant so the graph has no CPU `If` nodes. |
| `VisionEncoder(nn.Module)` | Graph 1. Input `pixel_values [1,3,S,S]`. Outputs `feats0`, `feats1`, `feats2`, `feats2_no_mem` (feats2 + `no_memory_embedding`), `vision_pos_embed` (registered buffer). |
| `MaskDecoder(nn.Module)` | Graph 2. Prompt encoder + mask decoder in one. Inputs `feats0`, `feats1`, `feats2_cond`, `input_points` (dynamic axis `num_points`), `input_labels`. Reimplements the video predictor's mask choice: multimask when ≤ `multimask_max_pt_num` real points, single-mask stability check via `dynamic_multimask_stability_delta/thresh`, `NO_OBJ_SCORE` fill when `object_score_logits <= 0`. Outputs `low_res_mask` (fixed `MASK_SIZE=256`), `high_res_mask [1,1,S,S]`, `iou`, `object_score_logits`, `object_pointer` (blends `object_pointer_proj` with `no_object_pointer` by presence). |
| `MemoryEncoder(nn.Module)` | Graph 3. Inputs `feats2`, `high_res_mask`, `object_score_logits`, scalar `binarize`. `binarize > 0.5` thresholds mask (prompted frame); else sigmoid. Applies `sigmoid_scale_for_mem_enc` / `sigmoid_bias_for_mem_enc`, adds `occlusion_spatial_embedding_parameter` when occluded. Outputs `memory_tokens`, `memory_pos` as `[H*W, 1, 64]`. |
| `MemoryAttention(nn.Module)` | Graph 4. Inputs `current_vision_features`, `current_vision_position_embeddings` (`[f*f,1,256]`), `memory`, `memory_pos` (`[rows,1,64]`, `rows = memory_frames*f*f + MAX_POINTERS*4`). Output `conditioned_feats [1,256,f,f]`. `num_object_pointer_tokens = MAX_POINTERS * (hidden_dim // mem_dim)`. |
| `PointerTpos(nn.Module)` | Graph 5. Input `normalized_diffs [MAX_POINTERS]`. Output `pointer_pos` = `temporal_positional_encoding_projection_layer(get_1d_sine_pe(...))`. |
| `export_fp32(model, memory_frames, out)` | Calls `torch.onnx.export` (opset 17, `dynamo=False`) once per module with fixed dummy shapes. |
| `to_fp16(model)` | Converts every float initializer, `Constant`, `ConstantOfShape` and `Cast` target to fp16, except inputs in `FLOAT32_INPUTS = {('Resize',1),('Resize',2)}`. Inserts a `Cast` to fp16 on each graph input and a `Cast` back to fp32 on each output, so graph I/O stays fp32. |
| `to_half(array)` | `np.clip(-65504, 65504).astype(float16)`. |
| `dedupe_constants(model)` | Moves `Constant` nodes to initializers, SHA-1 hashes each, keeps one copy per distinct tensor, renames inputs. Removes duplicated RoPE tables per attention block. |
| `main(model_size, image_size, memory_frames, out)` | Pipeline: `load` → `export_fp32` to temp dir → per graph `onnxslim.slim` → `to_fp16` → `dedupe_constants` → `onnx.checker.check_model` → save to `<out>/onnx/<name>.onnx`. Writes `<out>/constants.json` with `model`, `image_size`, `memory_frames`, `image_mean`, `image_std`, `memory_temporal_positional_encoding` (`[num_maskmem, mem_dim]`). |
| `MASK_SIZE = 256`, `MAX_POINTERS = 16` | Must equal `DECODED_MASK_SIZE` and `MAX_POINTERS` in `src/constants.ts`. |

## How it works

- Author runs `export.py` locally with `uv`. Order of graphs in memory: constants folded in fp32 first (positional encodings at full precision), then stored as halves.
- `load` freezes the backbone position embedding so ONNX has no shape-dependent control flow.
- Five `nn.Module` wrappers split `Sam2VideoModel` along the runtime's per-frame pipeline: encode frame → (attend to memory) → decode mask → encode memory.
- Every wrapper has fixed tensor shapes; only `input_points`/`input_labels` have a dynamic `num_points` axis. This lets `src/load.ts` enable `enableGraphCapture` for the vision encoder and memory attention.
- `to_fp16` keeps `Resize` scale/size inputs fp32 because the ONNX spec types them so.
- `constants.json` carries values the runtime cannot read from the graphs: image normalization and the temporal position table.
- Output layout `<out>/onnx/*.onnx` + `<out>/constants.json` matches the `files` paths in `SAM2_MODELS` (`src/constants.ts`).

## Interfaces

- Depends on: Python ≥ 3.10, `torch`, `transformers` (`Sam2VideoModel`, `Sam2VideoConfig`, `NO_OBJ_SCORE`, `get_1d_sine_pe`), `onnx`, `onnxslim`, `numpy`; checkpoints `facebook/sam2.1-hiera-{tiny,small,base-plus,large}` from Hugging Face.
- Used by: nothing in the repo at build or run time. Its outputs are the model files that [`../src/README.md`](../src/README.md) fetches from the pinned Hugging Face repos in `packages/sam2/src/constants.ts` (`SAM2_MODELS[].repo`, `files`).
- Contract with `packages/sam2/src`: `<image-size>` must equal `Sam2Model.imageSize`; `<memory-frames>` must equal `MEMORY_FRAMES = 7`; `MASK_SIZE` = `DECODED_MASK_SIZE = 256`; `MAX_POINTERS = 16`; graph input/output names match those in `src/load.ts` and `src/tracker.ts`. `src/load.ts` throws if `constants.json` `image_size` / `memory_frames` disagree.
- Not referenced by `.github/workflows/*`.

Up: [../README.md](../README.md)
