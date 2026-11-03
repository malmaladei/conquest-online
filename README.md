# Conquest — World Map

Illustrated, interactive world board for a browser-based territory-conquest game
(42 territories, 6 continents, classic adjacencies). This repo currently contains
**only the map** — no game logic, multiplayer or backend yet.

Stack: Vite + TypeScript, plain SVG (no framework). All artwork is original and procedurally drawn.

## Run locally

```bash
npm install
npm run dev        # http://localhost:4317
```

Other scripts:

| Command           | What it does                                                         |
| ----------------- | -------------------------------------------------------------------- |
| `npm run build`   | Type-check + production build to `dist/`                             |
| `npm run build:single` | Self-contained single-file build to `dist-single/index.html`   |
| `npm run preview` | Serve the production build on http://localhost:4318                  |
| `npm run check`   | Validate 42 territories / 83 borders against the generated geometry  |
| `npm run geo`     | Regenerate `src/map/generated/map.json` (runs before `dev`/`build`)  |

## Deploy

- `npm run build` → `dist/` (relative asset paths, works from any domain root or sub-path).
- `npm run build:single` → `dist-single/index.html`, one self-contained file (JS, CSS, fonts inlined; also opens via `file://`).
- Docker (nginx on port 80): `docker build -t conquest . && docker run -p 8080:80 conquest`

Handy URL flags: `?demo=4` (start a demo game with 2–4 players),
`?focus=ukraine&zoom=2.5` (zoom on a territory), `&select` (also open its info card).

## Layout

- `src/data/world.ts` — **game data**: continents (+bonus), territories, all 83 borders (`land` / `sea`). No rendering code; import this from game logic.
- `src/map/geo/` — hand-simplified coastlines (lon/lat), islands, Voronoi seeds that carve the territories, label anchors.
- `src/map/geometry.ts` — projection, hand-inked outline wobble, territory partition, sea lanes.
- `src/map/decor.ts` — procedural mountains, forests, dunes, waves.
- `src/map/renderer.ts` — SVG renderer with `setOwnership()`, `select()`, hover/neighbour highlight.
- `src/map/panzoom.ts` — mouse/touch pan, wheel + pinch zoom.
- `src/demo.ts`, `src/ui/` — demo-state generator, info card.

To reshape a border, move/add seeds in `src/map/geo/seeds.ts` and run `npm run check`.
