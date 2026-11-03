/**
 * Procedural placement of the illustrated map decorations: mountain ranges,
 * forests, deserts (dunes), rocks and sea waves.
 *
 * Runs at build time (scripts/build-geometry.ts) together with the geometry,
 * so the browser only has to stamp pre-computed symbols. Everything is seeded
 * and therefore identical on every build.
 */

import type { LonLat } from './geo/coastlines';
import { bboxOf, pointInMultiPolygon, project, unproject, type MultiPolygon, type Pair } from './geometry';
import { fbm, mulberry32 } from './noise';

/** [x, y, scale, variant] */
export type Glyph = [number, number, number, number];

export interface Decor {
  mountains: Glyph[];
  conifers: Glyph[];
  trees: Glyph[];
  dunes: Glyph[];
  rocks: Glyph[];
  waves: Glyph[];
}

// Rough mountain ranges as lon/lat polylines.
const RANGES: LonLat[][] = [
  [[-153, 63], [-146, 62.5], [-140, 61]], // Alaska Range
  [[-130, 62], [-125, 57], [-120, 52], [-115, 47], [-110, 43], [-107, 38], [-106, 34]], // Rockies
  [[-121, 47], [-121.5, 42], [-119, 37]], // Cascades / Sierra Nevada
  [[-107, 29], [-104, 25], [-101, 21], [-97, 17.5]], // Sierra Madre
  [[-85, 34], [-80, 37.5], [-77, 40.5], [-73, 44]], // Appalachians
  [[-73, 8], [-77, 1], [-77.5, -8], [-73, -14], [-69, -19], [-68.5, -27], [-70, -34], [-71, -41], [-72.5, -48]], // Andes
  [[-48, -15], [-44, -19]], // Brazilian highlands
  [[-1.5, 42.8], [2.5, 42.5]], // Pyrenees
  [[6, 45], [8.5, 46.3], [11, 46.8], [14, 47]], // Alps
  [[10, 44], [13, 42.5], [15.5, 41]], // Apennines
  [[18, 49.3], [22, 49], [25, 47.5], [26, 45.6]], // Carpathians
  [[20, 42], [22, 41.5], [24, 42]], // Balkans
  [[7.5, 60.5], [11, 63], [14.5, 66], [18.5, 68.8]], // Scandinavian mountains
  [[40, 43.3], [44, 42.6], [47.5, 41.5]], // Caucasus
  [[32, 37.3], [36, 38], [40, 39]], // Anatolia / Taurus
  [[58.5, 51], [59, 55], [59.5, 59], [60, 63], [63, 66.5]], // Urals
  [[45.5, 35], [49, 33], [52, 30], [56, 28]], // Zagros
  [[66, 35], [70, 36.2]], // Hindu Kush
  [[73, 35], [78, 33], [82, 30.5], [86, 28.5], [90, 28], [95, 28.5]], // Himalaya
  [[72, 40.5], [78, 41.5], [84, 42.5], [89, 43]], // Tian Shan
  [[84, 50], [89, 49.5], [94, 48], [99, 46.5]], // Altai
  [[100, 52], [106, 51.5]], // Sayan
  [[127, 68], [131, 65], [135, 62]], // Verkhoyansk
  [[145, 64], [153, 66]], // Chersky
  [[158, 56], [159.5, 59.5]], // Kamchatka
  [[100, 30], [102, 26], [104, 23]], // Hengduan
  [[37.5, 13], [38.5, 9], [39, 6]], // Ethiopian highlands
  [[29, 1], [30, -3]], // Rwenzori
  [[29.5, -29.5], [31, -26]], // Drakensberg
  [[-8, 31], [-4, 32.5], [0, 33.8], [5, 35], [9, 35.6]], // Atlas
  [[146, -17], [148, -21], [150, -27], [150.5, -32], [147.5, -36.8]], // Great Dividing Range
  [[118, -23], [121, -23.5]], // Hamersley
  [[138, 36.5], [140, 39]], // Japanese Alps
  [[144, -5.5], [139, -4.4]], // New Guinea highlands
  [[170, -43.8], [168.5, -45]], // Southern Alps
  [[-48, 72], [-40, 75], [-35, 70]], // Greenland ice ridges
];

// Deserts as lon/lat ellipses: [lon, lat, radiusLon, radiusLat].
const DESERTS: [number, number, number, number][] = [
  [8, 23, 20, 6.5],
  [46, 22, 7, 4.5],
  [105, 43, 9, 3],
  [20, -23, 4.5, 4],
  [128, -25, 11, 5],
  [-115, 38, 3.5, 3],
  [71, 27, 3, 2],
  [83, 39, 6, 2],
  [60, 41, 5, 2.5],
  [-69.5, -23, 1.2, 4],
];

const inDesert = ([lon, lat]: LonLat) =>
  DESERTS.some(([cx, cy, rx, ry]) => ((lon - cx) / rx) ** 2 + ((lat - cy) / ry) ** 2 < 1);

export function generateDecor(land: MultiPolygon, exclusions: Pair[]): Decor {
  const rnd = mulberry32(1337);
  const decor: Decor = { mountains: [], conifers: [], trees: [], dunes: [], rocks: [], waves: [] };

  const nearExclusion = ([x, y]: Pair, r: number) =>
    exclusions.some(([ex, ey]) => Math.abs(ex - x) < r * 1.3 && Math.abs(ey - y) < r);
  /** Point is on land and a few units away from the coast (keeps glyphs off the waterline). */
  const solidLand = ([x, y]: Pair, m: number) =>
    pointInMultiPolygon([x, y], land) &&
    pointInMultiPolygon([x + m, y], land) &&
    pointInMultiPolygon([x - m, y], land) &&
    pointInMultiPolygon([x, y + m], land) &&
    pointInMultiPolygon([x, y - m], land);

  // Occupancy grid so glyphs don't pile on top of each other.
  const occupied = new Set<string>();
  const CELL = 7;
  const cellKey = (x: number, y: number) => `${Math.floor(x / CELL)},${Math.floor(y / CELL)}`;
  const occupy = (x: number, y: number) => occupied.add(cellKey(x, y));
  const isFree = (x: number, y: number) => !occupied.has(cellKey(x, y));

  // --- Mountains along ranges ---------------------------------------------
  for (const range of RANGES) {
    const pts = range.map(project);
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      const len = Math.hypot(bx - ax, by - ay);
      const steps = Math.max(1, Math.round(len / 11));
      for (let s = 0; s <= steps; s++) {
        const t = s / steps;
        // Two staggered rows give the range some depth.
        for (const row of [-1, 1]) {
          const nx = -(by - ay) / len;
          const ny = (bx - ax) / len;
          const off = row * (4 + rnd() * 5);
          const x = ax + (bx - ax) * t + nx * off + (rnd() - 0.5) * 6;
          const y = ay + (by - ay) * t + ny * off + (rnd() - 0.5) * 5;
          if (row === 1 && rnd() < 0.35) continue;
          if (!solidLand([x, y], 4) || nearExclusion([x, y], 26) || !isFree(x, y)) continue;
          decor.mountains.push([round(x), round(y), round(0.8 + rnd() * 0.6), Math.floor(rnd() * 3)]);
          occupy(x, y);
        }
      }
    }
  }

  // --- Forests, dunes, rocks: jittered grid over land ---------------------
  const bb = bboxOf(land);
  const STEP = 10;
  for (let gy = bb.minY; gy < bb.maxY; gy += STEP) {
    for (let gx = bb.minX; gx < bb.maxX; gx += STEP) {
      const x = gx + rnd() * STEP;
      const y = gy + rnd() * STEP;
      if (!isFree(x, y)) continue;
      const lonlat = unproject([x, y]);
      const [, lat] = lonlat;
      if (!solidLand([x, y], 3.5)) continue;
      if (nearExclusion([x, y], 25)) continue;

      if (inDesert(lonlat)) {
        if (rnd() < 0.28) {
          decor.dunes.push([round(x), round(y), round(0.8 + rnd() * 0.5), Math.floor(rnd() * 2)]);
          occupy(x, y);
        }
        continue;
      }
      // Ice caps / high arctic: only the odd rock.
      if (lat > 72 || (lat > 60 && lonlat[0] < -15 && lonlat[0] > -60)) {
        if (rnd() < 0.03) decor.rocks.push([round(x), round(y), round(0.7 + rnd() * 0.4), 0]);
        continue;
      }
      // Forest density follows low-frequency noise -> natural clumps.
      const density = fbm(x / 70, y / 70, 3);
      const tundra = lat > 64 ? 0.45 : 1;
      if (density > 0.47 && rnd() < (density - 0.38) * 2.2 * tundra) {
        const boreal = lat > 47 || lat < -40;
        const glyph: Glyph = [round(x), round(y), round(0.85 + rnd() * 0.55), Math.floor(rnd() * 3)];
        (boreal ? decor.conifers : decor.trees).push(glyph);
        occupy(x, y);
      } else if (rnd() < 0.035) {
        decor.rocks.push([round(x), round(y), round(0.6 + rnd() * 0.5), Math.floor(rnd() * 2)]);
        occupy(x, y);
      }
    }
  }

  // --- Waves in open sea ---------------------------------------------------
  for (let i = 0; i < 520; i++) {
    const x = rnd() * project([194, 0])[0];
    const y = rnd() * project([0, -58])[1];
    if (pointInMultiPolygon([x, y], land)) continue;
    // Keep a clear band around coasts (they get ripple lines instead).
    let nearCoast = false;
    for (const [dx, dy] of [[14, 0], [-14, 0], [0, 12], [0, -12], [10, 10], [-10, -10], [10, -10], [-10, 10]]) {
      if (pointInMultiPolygon([x + dx, y + dy], land)) nearCoast = true;
    }
    if (nearCoast) continue;
    decor.waves.push([round(x), round(y), round(0.7 + rnd() * 0.6), Math.floor(rnd() * 2)]);
  }

  return decor;
}

const round = (v: number) => Math.round(v * 10) / 10;
