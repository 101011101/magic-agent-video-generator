# `packages/runtime/src/math`

Pure 2D affine math: matrices, bounding boxes, and quad geometry used by the transform system, hit testing, camera, and canvas interactions.

## Parts

| Part | Role |
| --- | --- |
| `index.ts` | Barrel. Re-exports `common`, `matrix2d`, `aabb`. |
| `common.ts` | `DEG_TO_RAD`, `RAD_TO_DEG`, `degToRad()`, `radToDeg()`, `clamp(value, min, max)`. |
| `matrix2d.ts` | `Mat2D` type `{a,b,c,d,e,f}` (same layout as `CanvasRenderingContext2D` / `DOMMatrix`). Builders: `identity2D()`, `translate2D()`, `rotate2D(deg)`, `scale2D()`, `skew2D(degX, degY)`. `compose2D(x, y, rotation, scaleX, scaleY, pivotX, pivotY, skewX, skewY)` = `T(pos+pivot) · R · SkewX · SkewY · S · T(-pivot)`. `multiply2D(p, q)` = `p × q`. `decompose2D(m)` -> `Decomposed2D` `{x, y, rotation, scaleX, scaleY, skewX, skewY}` by column QR; folds a negative determinant into `scaleY`; `skewY` is always 0. |
| `aabb.ts` | `AABB` `{minX,minY,maxX,maxY}`, `Point`, `Rect` `{x,y,width,height}`, `Quad` `[TL,TR,BR,BL]`. `aabbFromTransformedRect(mat, w, h)`, `aabbsIntersect(a, b)`, `rectToQuad(mat, w, h)`, `transformPoint(mat, px, py)`, `invert2D(m)`, `pointInQuad(px, py, q)` (ray casting), `quadsIntersect(a, b)` (vertex containment only), `quadContainsQuad(outer, inner)`, `quadCenter(q)`. |

## How it works

- All angles at the API boundary are degrees; `common.ts` converts to radians inside.
- A node's local matrix is built from `translate2D`/`rotate2D`/`skew2D`/`scale2D` and chained with `multiply2D` (see `packages/runtime/src/systems/transform.ts`).
- A node's rect `[0,0]→[w,h]` goes through its world matrix with `rectToQuad` (exact corners) or `aabbFromTransformedRect` (axis-aligned bounds for culling and overlap).
- Pointer positions go from screen to local space with `invert2D` + `transformPoint`; `pointInQuad` decides hits.
- `decompose2D` turns an edited world/parent-space matrix back into authored `Position`/`Rotation`/`Scale`/`Skew` values after a drag.
- `quadsIntersect` tests only vertex containment; edge-crossing without contained vertices is not detected (per source comment).
- `compose2D` is exported but no caller was found in the repo.

## Interfaces

- Depends on: nothing outside this dir (no imports from other runtime modules).
- Used by (runtime):
  - `packages/runtime/src/systems/transform.ts` -> `multiply2D`, `translate2D`, `rotate2D`, `skew2D`, `scale2D`, `aabbFromTransformedRect`, `aabbsIntersect`, `Mat2D`. See [../systems/README.md](../systems/README.md).
  - `packages/runtime/src/queries/interaction.ts` -> `decompose2D`, `identity2D`, `invert2D`, `multiply2D`, `rectToQuad`, `rotate2D`, `scale2D`, `skew2D`, `transformPoint`, `translate2D`, `Quad`.
  - `packages/runtime/src/queries/hit-test.ts` -> `aabbFromTransformedRect`, `invert2D`, `multiply2D`, `transformPoint`.
  - `packages/runtime/src/queries/camera.ts` -> `invert2D`, `transformPoint`, `Rect`. See [../queries/README.md](../queries/README.md).
  - `packages/runtime/src/actions/{camera,frame,group}.ts` -> `clamp`, `transformPoint`, `aabbFromTransformedRect`. See [../actions/README.md](../actions/README.md).
  - `packages/runtime/src/systems/playback.ts`, `utils/text.ts`, `utils/color.ts` -> `clamp`.
  - `packages/runtime/src/traits/world.ts`, `systems/render.ts` -> `Quad` type.
- Used by (app, via `@diffusionstudio/runtime`):
  - `apps/web/src/engine/input/interactions.ts`, `input/snapping.ts`, `input/input-system.ts` (`pointInQuad`), `hud/hud-system.ts`, `group.tsx`, `clip-path.ts`, `align.ts`, `placement.ts`, `object-mask/media.ts` -> matrix, quad, and `decompose2D` helpers.
- Re-exported from `packages/runtime/src/index.ts`.

Up: [../README.md](../README.md)
