# `assets`

Brand media embedded in the repo's top-level `README.md`; no code. Pure asset folder: the root README should carry it as one row.

## Parts

| Part | Role |
|---|---|
| `banner.png` | Header banner. Used at `README.md:3`. |
| `desktop-screenshot.png` | Screenshot of the desktop editor. Used at `README.md:24`. |
| `launch-video.gif` | Launch video preview. Used at `README.md:124`. |
| `raise-announcement.gif` | Funding announcement preview. Used at `README.md:124`. |

## How it works

- `README.md` references each file by relative path `assets/<name>` in `<img>` tags.
- No build step reads this directory. Not shipped in the desktop app or web bundle.
- Distinct from `apps/desktop/assets` (app icons, DMG background, installer spinner) and `apps/web/src/assets` (in-app images such as `desktop-app-banner.png`).

## Interfaces

- Depends on: nothing.
- Used by: root `README.md` only ([../README.md](../README.md)).

Up: [../README.md](../README.md)
