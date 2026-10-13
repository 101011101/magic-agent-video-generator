# `docs/guides/motion`

Motion guidance: which easing curve to use for each kind of move, and the pixel-snapping limit that makes slow moves stutter.

## Parts

| Part | Role |
| --- | --- |
| `easings.md` | Table of six `cubicBezier` values in mirrored pairs: `snappyOut (0,0.6,0.4,1)`, `expoOut (0,1,0,1)`, `snappyIn (0.6,0,1,0.4)`, `expoIn (1,0,1,0)`, `outIn (0,0.7,1,0.3)`, `inOut (0.7,0,0.3,1)`, each with its use case. Rule for cuts: ease in to exit, ease out to reveal, so velocity peaks at the cut. Section **Pixel snapping**: no sub-pixel rendering; a move below ~1 px per frame jumps instead of glides; check `travel px / duration frames` for position, scale, and rotation; carry slow holds with opacity, blur, color, or a counter. |

## How it works

- The agent reads this page before it animates anything (`docs/skills/editor.md`, Best practices). It picks a curve from weight, energy, and continuity, never linear or default.
- Across a cut it alternates an `*In` curve for the exit with an `*Out` curve for the entrance.
- Before it commits a slow drift it divides pixel travel by frame count; below ~1 px/frame it moves further, shortens the duration, or switches to a non-positional property.
- Complementary rules live in `docs/brand/video.md` (house-style anchors: Entrance, Settle, Travel, Exit; 400 ms enter, 200 ms exit, 100 ms stagger).

## Interfaces

- Depends on: `cubicBezier(...)` easing syntax from the JSX animation layer, see [../../reference/jsx/README.md](../../reference/jsx/README.md) (`animations.md`, `keyframes.md`).
- Used by: `docs/skills/editor.md` links it twice (Best practices, Docs list); no code or test references it. Unclear from source whether any package exports these named curves.

Up: [../README.md](../README.md)
