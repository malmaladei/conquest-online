/**
 * Pre-computes all map geometry + decoration placement into
 * src/map/generated/map.json so the browser doesn't have to run the
 * (comparatively slow) polygon clipping on every page load.
 *
 * Runs automatically before `npm run dev` / `npm run build`.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

import { generateDecor } from '../src/map/decor';
import { buildGeometry, multiPolygonToPath, simplifyMultiPolygon } from '../src/map/geometry';
import type { GeneratedMap } from '../src/map/types';

const t0 = performance.now();
const geo = buildGeometry();

// Keep decorations away from badges (anchor) and labels (just below the anchor).
const exclusions = [...geo.territories.values()].flatMap((t) => [
  t.anchor,
  [t.anchor[0], t.anchor[1] + 30] as [number, number],
]);
const decor = generateDecor(geo.land, exclusions);

const out: GeneratedMap = {
  width: geo.width,
  height: geo.height,
  landPath: geo.landPath,
  // The wide, soft coastal ripple strokes are the most expensive thing to
  // rasterise; a simplified outline looks the same at their width.
  ripplePath: multiPolygonToPath(simplifyMultiPolygon(geo.land, 1.6, 30)),
  territories: [...geo.territories.values()].map((t) => ({
    id: t.id,
    continent: t.continent,
    path: t.path,
    anchor: [Math.round(t.anchor[0] * 10) / 10, Math.round(t.anchor[1] * 10) / 10],
    bbox: t.bbox,
  })),
  continents: [...geo.continents.values()].map((c) => ({ id: c.id, path: c.path })),
  seaLanes: geo.seaLanes.map((l) => ({
    a: l.border.a,
    b: l.border.b,
    points: l.points.map(([x, y]) => [Math.round(x * 10) / 10, Math.round(y * 10) / 10]),
    wraps: l.wraps,
  })),
  decor,
};

const file = resolve(dirname(fileURLToPath(import.meta.url)), '../src/map/generated/map.json');
mkdirSync(dirname(file), { recursive: true });
writeFileSync(file, JSON.stringify(out));
const counts = Object.entries(decor).map(([k, v]) => `${k}=${v.length}`).join(' ');
console.log(`map.json written in ${(performance.now() - t0).toFixed(0)} ms (${counts})`);
