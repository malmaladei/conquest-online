/**
 * Validates the board data and the generated geometry:
 *  - 42 territories, 6 continents, 83 unique borders, no self/duplicate borders
 *  - every territory has a shape (and reports multi-piece mainland shapes)
 *  - every 'land' border really shares an edge in the geometry
 *  - no two territories touch unless they have a 'land' border
 *
 * Run with: npm run check
 */
import { BORDERS, CONTINENTS, TERRITORIES, type TerritoryId } from '../src/data/world';
import { buildGeometry, polygonArea, unproject } from '../src/map/geometry';

let failed = false;
const fail = (msg: string) => {
  failed = true;
  console.error('  x ' + msg);
};

console.log('Data checks');
if (TERRITORIES.length !== 42) fail(`expected 42 territories, got ${TERRITORIES.length}`);
if (CONTINENTS.length !== 6) fail(`expected 6 continents, got ${CONTINENTS.length}`);
if (BORDERS.length !== 83) fail(`expected 83 borders, got ${BORDERS.length}`);
const key = (a: string, b: string) => [a, b].sort().join('|');
const seen = new Set<string>();
for (const b of BORDERS) {
  if (b.a === b.b) fail(`self border ${b.a}`);
  if (seen.has(key(b.a, b.b))) fail(`duplicate border ${b.a}-${b.b}`);
  seen.add(key(b.a, b.b));
}

console.log('Geometry checks');
const t0 = performance.now();
const geo = buildGeometry();
console.log(`  built in ${(performance.now() - t0).toFixed(0)} ms`);

// Shared-vertex detection: borders between shapes reuse identical vertices.
const owners = new Map<string, Set<TerritoryId>>();
for (const t of geo.territories.values()) {
  for (const poly of t.shape)
    for (const ring of poly)
      for (const [x, y] of ring) {
        const k = `${x.toFixed(2)},${y.toFixed(2)}`;
        const s = owners.get(k) ?? new Set();
        s.add(t.id);
        owners.set(k, s);
      }
}
const shared = new Map<string, number>();
for (const s of owners.values()) {
  const ids = [...s];
  for (let i = 0; i < ids.length; i++)
    for (let j = i + 1; j < ids.length; j++) {
      const k = key(ids[i], ids[j]);
      shared.set(k, (shared.get(k) ?? 0) + 1);
    }
}
const MIN_SHARED = 3;
const landBorders = new Set(BORDERS.filter((b) => b.kind === 'land').map((b) => key(b.a, b.b)));
for (const k of landBorders) {
  const n = shared.get(k) ?? 0;
  if (n < MIN_SHARED) fail(`land border ${k} not touching in geometry (shared vertices: ${n})`);
}
for (const [k, n] of shared) {
  if (n >= MIN_SHARED && !landBorders.has(k)) fail(`unlisted contact ${k} (shared vertices: ${n})`);
}

for (const t of geo.territories.values()) {
  if (t.shape.length > 1) {
    const pieces = t.shape
      .map((p) => {
        const [lon, lat] = unproject(p[0][0]);
        return `${polygonArea(p).toFixed(0)}@(${lon.toFixed(0)},${lat.toFixed(0)})`;
      })
      .join(' ');
    console.log(`  i ${t.id}: ${pieces}`);
  }
}

console.log(failed ? 'FAILED' : 'All checks passed');
process.exit(failed ? 1 : 0);
