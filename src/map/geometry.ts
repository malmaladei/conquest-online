/**
 * Builds all map geometry (in SVG user units) from the hand-authored geo data.
 *
 * Pipeline:
 *  1. Project [lon, lat] to x/y (plain equirectangular, like most board maps).
 *  2. "Hand-ink" every outline: subdivide segments and displace the points by a
 *     coherent noise field. Because the displacement only depends on the
 *     position, shared borders between two shapes wobble identically and stay
 *     perfectly aligned.
 *  3. Partition the mainlands with a seeded Voronoi diagram; each territory is
 *     the union of its seeds' cells clipped to land, plus any pinned islands.
 *
 * This module has no DOM dependencies, so it also runs in Node
 * (see scripts/check-map.ts).
 */

import { Delaunay } from 'd3-delaunay';
import * as polygonClipping from 'polyclip-ts';
import polylabel from 'polylabel';

import {
  BORDERS,
  CONTINENTS,
  TERRITORIES,
  type Border,
  type ContinentId,
  type TerritoryId,
} from '../data/world';
import { ISLANDS, MAINLANDS, type LonLat } from './geo/coastlines';
import { ANCHOR_OVERRIDES, SEA_LANE_VIA, SEEDS } from './geo/seeds';
import { fbm } from './noise';

export type Pair = [number, number];
export type Ring = Pair[];
export type Polygon = Ring[];
export type MultiPolygon = Polygon[];

// ---------------------------------------------------------------------------
// Projection
// ---------------------------------------------------------------------------

/** Longitude at the left edge (Alaska side) and right edge (Kamchatka side). */
const LON_WEST = -172;
const LON_EAST = 194;
const LAT_NORTH = 84;
const LAT_SOUTH = -58;
/** SVG units per degree of longitude. */
const SCALE = 6.5;
/**
 * Extra vertical stretch: makes the board less letterboxed on 16:9 / 16:10
 * screens and gives the crowded mid-latitudes (Europe) more room.
 */
const Y_STRETCH = 1.2;

export const MAP_WIDTH = (LON_EAST - LON_WEST) * SCALE;
export const MAP_HEIGHT = (LAT_NORTH - LAT_SOUTH) * SCALE * Y_STRETCH;

export function project([lon, lat]: LonLat): Pair {
  return [(lon - LON_WEST) * SCALE, (LAT_NORTH - lat) * SCALE * Y_STRETCH];
}

export function unproject([x, y]: Pair): LonLat {
  return [x / SCALE + LON_WEST, LAT_NORTH - y / (SCALE * Y_STRETCH)];
}

// ---------------------------------------------------------------------------
// Hand-inked roughening
// ---------------------------------------------------------------------------

/**
 * Subdivide every segment of a ring into ~`step`-long pieces and displace all
 * points by the coherent noise field. Subdivision points are placed at
 * symmetric parameters so a segment walked in either direction produces the
 * same points (keeps shared borders identical).
 */
function roughenRing(ring: Pair[], step: number, amp: number): Pair[] {
  const out: Pair[] = [];
  const n = ring.length;
  for (let i = 0; i < n; i++) {
    const a = ring[i];
    const b = ring[(i + 1) % n];
    if (a[0] === b[0] && a[1] === b[1]) continue;
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
    const parts = Math.max(1, Math.ceil(len / step));
    for (let k = 0; k < parts; k++) {
      const t = k / parts;
      // Build from the lexicographically smaller endpoint for direction symmetry.
      const swap = a[0] > b[0] || (a[0] === b[0] && a[1] > b[1]);
      const p0 = swap ? b : a;
      const p1 = swap ? a : b;
      const tt = swap ? 1 - t : t;
      out.push(displace([p0[0] + (p1[0] - p0[0]) * tt, p0[1] + (p1[1] - p0[1]) * tt], amp));
    }
  }
  return out;
}

function displace([x, y]: Pair, amp: number): Pair {
  const dx = (fbm(x / 22, y / 22, 3) - 0.5) * 2 * amp;
  const dy = (fbm(x / 22 + 41.3, y / 22 - 17.9, 3) - 0.5) * 2 * amp;
  return [x + dx, y + dy];
}

const closeRing = (r: Pair[]): Ring => [...r, r[0]];

// ---------------------------------------------------------------------------
// Geometry helpers
// ---------------------------------------------------------------------------

export function ringArea(ring: Ring): number {
  let a = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    a += (ring[j][0] + ring[i][0]) * (ring[j][1] - ring[i][1]);
  }
  return Math.abs(a / 2);
}

export function polygonArea(poly: Polygon): number {
  return poly.reduce((s, ring, i) => s + (i === 0 ? ringArea(ring) : -ringArea(ring)), 0);
}

export function multiPolygonToPath(mp: MultiPolygon): string {
  let d = '';
  for (const poly of mp) {
    for (const ring of poly) {
      d += 'M' + ring.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join('L') + 'Z';
    }
  }
  return d;
}

/** Douglas–Peucker simplification of a closed ring (tolerance in map units). */
export function simplifyRing(ring: Ring, tolerance: number): Ring {
  if (ring.length < 8) return ring;
  const keep = new Uint8Array(ring.length);
  keep[0] = keep[ring.length - 1] = 1;
  const stack: [number, number][] = [[0, ring.length - 1]];
  const t2 = tolerance * tolerance;
  while (stack.length) {
    const [a, b] = stack.pop()!;
    const [ax, ay] = ring[a];
    const [bx, by] = ring[b];
    const dx = bx - ax;
    const dy = by - ay;
    const len2 = dx * dx + dy * dy || 1e-9;
    let maxD = -1;
    let idx = -1;
    for (let i = a + 1; i < b; i++) {
      const [px, py] = ring[i];
      const t = Math.max(0, Math.min(1, ((px - ax) * dx + (py - ay) * dy) / len2));
      const d = (px - ax - t * dx) ** 2 + (py - ay - t * dy) ** 2;
      if (d > maxD) {
        maxD = d;
        idx = i;
      }
    }
    if (maxD > t2 && idx > 0) {
      keep[idx] = 1;
      stack.push([a, idx], [idx, b]);
    }
  }
  return ring.filter((_, i) => keep[i]);
}

export function simplifyMultiPolygon(mp: MultiPolygon, tolerance: number, minArea = 0): MultiPolygon {
  return mp
    .map((poly) => poly.map((ring) => simplifyRing(ring, tolerance)).filter((r) => r.length >= 4 && ringArea(r) >= minArea))
    .filter((poly) => poly.length > 0);
}

export interface BBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function bboxOf(mp: MultiPolygon): BBox {
  const b = { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity };
  for (const poly of mp)
    for (const [x, y] of poly[0]) {
      if (x < b.minX) b.minX = x;
      if (y < b.minY) b.minY = y;
      if (x > b.maxX) b.maxX = x;
      if (y > b.maxY) b.maxY = y;
    }
  return b;
}

/** Ray-casting point-in-polygon for a multipolygon (respects holes). */
export function pointInMultiPolygon([x, y]: Pair, mp: MultiPolygon): boolean {
  for (const poly of mp) {
    let inside = false;
    for (const ring of poly) {
      let inRing = false;
      for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
        const [xi, yi] = ring[i];
        const [xj, yj] = ring[j];
        if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inRing = !inRing;
      }
      if (ring === poly[0]) inside = inRing;
      else if (inRing) inside = false;
    }
    if (inside) return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Map model
// ---------------------------------------------------------------------------

export interface TerritoryShape {
  id: TerritoryId;
  continent: ContinentId;
  shape: MultiPolygon;
  path: string;
  /** Label / badge anchor in SVG units. */
  anchor: Pair;
  bbox: BBox;
}

export interface ContinentShape {
  id: ContinentId;
  shape: MultiPolygon;
  path: string;
}

export interface SeaLane {
  border: Border;
  /** Polyline points (SVG units); renderer smooths it into a curve. */
  points: Pair[];
  /** True for lanes that leave the map edge (wrap-around connection). */
  wraps?: 'west' | 'east';
}

export interface MapGeometry {
  width: number;
  height: number;
  land: MultiPolygon;
  landPath: string;
  territories: Map<TerritoryId, TerritoryShape>;
  continents: Map<ContinentId, ContinentShape>;
  seaLanes: SeaLane[];
}

const COAST_STEP = 3.2;
const COAST_AMP = 1.8;
const BORDER_STEP = 4;
const BORDER_AMP = 3.2;
/** Fragments smaller than this (in square units) are noise from the partition. */
const MIN_FRAGMENT_AREA = 18;
/** Holes smaller than this inside a territory are artefacts, not lakes. */
const MIN_HOLE_AREA = 150;

type MainlandKey = keyof typeof MAINLANDS;

const MAINLAND_OF_CONTINENT: Record<ContinentId, MainlandKey> = {
  'north-america': 'northAmerica',
  'south-america': 'southAmerica',
  'europe': 'eurasia',
  'asia': 'eurasia',
  'africa': 'africa',
  'australia': 'australia',
};

function mainlandOf(id: TerritoryId): MainlandKey {
  return MAINLAND_OF_CONTINENT[TERRITORIES.find((t) => t.id === id)!.continent];
}

export function buildGeometry(): MapGeometry {
  // --- 1. Mainlands (roughened) -------------------------------------------
  const rough = (key: MainlandKey): MultiPolygon => [
    MAINLANDS[key].map((ring) => closeRing(roughenRing(ring.map(project), COAST_STEP, COAST_AMP))),
  ];
  const mainlands = new Map<MainlandKey, MultiPolygon>();
  const northAmerica = rough('northAmerica');
  const africa = rough('africa');
  mainlands.set('northAmerica', northAmerica);
  mainlands.set('africa', africa);
  // The outlines overlap slightly at Panama and Sinai; subtracting makes the
  // neighbours share one exact border there (Central America–Venezuela, Egypt–Middle East).
  mainlands.set('southAmerica', polygonClipping.difference(rough('southAmerica'), northAmerica));
  mainlands.set('eurasia', polygonClipping.difference(rough('eurasia'), africa));
  mainlands.set('australia', rough('australia'));

  // --- 2. Voronoi partition, one diagram per mainland ---------------------
  // Separate diagrams keep cells from leaking across narrow seas (Red Sea, Gulf of Aden).
  const cellsByTerritory = new Map<TerritoryId, Polygon[]>();
  for (const key of mainlands.keys()) {
    const seedPoints: Pair[] = [];
    const seedOwner: TerritoryId[] = [];
    for (const [id, seeds] of Object.entries(SEEDS) as [TerritoryId, LonLat[]][]) {
      if (mainlandOf(id) !== key) continue;
      for (const s of seeds) {
        seedPoints.push(project(s));
        seedOwner.push(id);
      }
    }
    const voronoi = Delaunay.from(seedPoints).voronoi([-200, -200, MAP_WIDTH + 200, MAP_HEIGHT + 200]);
    seedPoints.forEach((_, i) => {
      const cell = voronoi.cellPolygon(i);
      if (!cell) return;
      // d3 returns a closed ring; drop the duplicate closing point before roughening.
      const ring = closeRing(roughenRing(cell.slice(0, -1) as Pair[], BORDER_STEP, BORDER_AMP));
      const list = cellsByTerritory.get(seedOwner[i]) ?? [];
      list.push([ring]);
      cellsByTerritory.set(seedOwner[i], list);
    });
  }

  // --- 3. Islands --------------------------------------------------------
  const islandsByTerritory = new Map<TerritoryId, Polygon[]>();
  for (const isl of ISLANDS) {
    const poly: Polygon = [closeRing(roughenRing(isl.ring.map(project), COAST_STEP, COAST_AMP))];
    const list = islandsByTerritory.get(isl.territory) ?? [];
    list.push(poly);
    islandsByTerritory.set(isl.territory, list);
  }

  // --- 4. Territories ----------------------------------------------------
  const territories = new Map<TerritoryId, TerritoryShape>();
  for (const t of TERRITORIES) {
    let shape: MultiPolygon = [];
    const cells = cellsByTerritory.get(t.id);
    if (cells && cells.length) {
      const region = polygonClipping.union(cells[0], ...cells.slice(1));
      shape = polygonClipping.intersection(region, mainlands.get(mainlandOf(t.id))!);
    }
    const islands = islandsByTerritory.get(t.id);
    if (islands && islands.length) {
      shape = shape.length ? polygonClipping.union(shape, ...islands) : polygonClipping.union(islands[0], ...islands.slice(1));
    }
    // Drop slivers: tiny fragments, and hairline holes left where the union of
    // a territory's own cells isn't perfectly watertight.
    shape = shape
      .filter((p) => polygonArea(p) >= MIN_FRAGMENT_AREA)
      .map((p) => [p[0], ...p.slice(1).filter((hole) => ringArea(hole) >= MIN_HOLE_AREA)]);
    if (!shape.length) throw new Error(`Territory ${t.id} has no geometry`);

    territories.set(t.id, {
      id: t.id,
      continent: t.continent,
      shape,
      path: multiPolygonToPath(shape),
      anchor: computeAnchor(t.id, shape),
      bbox: bboxOf(shape),
    });
  }

  // Land outline for the coast comes from the roughened landmasses themselves
  // (not the union of territories), so hairline slivers between neighbouring
  // territories can never show up as stray coastline.
  const landParts: MultiPolygon[] = [...mainlands.values(), ...[...islandsByTerritory.values()].flat().map((p) => [p])];
  const land = polygonClipping.union(landParts[0], ...landParts.slice(1));

  // --- 5. Continents -----------------------------------------------------
  const continents = new Map<ContinentId, ContinentShape>();
  for (const c of CONTINENTS) {
    const parts = [...territories.values()].filter((t) => t.continent === c.id).map((t) => t.shape);
    const shape = polygonClipping.union(parts[0], ...parts.slice(1));
    continents.set(c.id, { id: c.id, shape, path: multiPolygonToPath(shape) });
  }

  // --- 6. Sea lanes ------------------------------------------------------
  const seaLanes: SeaLane[] = [];
  for (const border of BORDERS) {
    if (border.kind !== 'sea') continue;
    const a = territories.get(border.a)!;
    const b = territories.get(border.b)!;
    if (border.a === 'alaska' && border.b === 'kamchatka') {
      // Wrap-around lane: leaves the west edge from Alaska and re-enters on the east.
      const ak = project([-168.5, 65.2]);
      const km = project([190.5, 65.6]);
      seaLanes.push({ border, points: [ak, [ak[0] - 4, ak[1] + 6], [-14, ak[1] + 10]], wraps: 'west' });
      seaLanes.push({ border, points: [km, [km[0] + 6, km[1] + 8], [MAP_WIDTH + 14, ak[1] + 10]], wraps: 'east' });
      continue;
    }
    const via = (SEA_LANE_VIA[`${border.a}|${border.b}`] ?? []).map(project);
    const start = via.length ? closestPointTo(a.shape, via[0]) : closestPair(a.shape, b.shape)[0];
    const end = via.length ? closestPointTo(b.shape, via[via.length - 1]) : closestPair(a.shape, b.shape)[1];
    seaLanes.push({ border, points: [start, ...via, end] });
  }

  return {
    width: MAP_WIDTH,
    height: MAP_HEIGHT,
    land,
    landPath: multiPolygonToPath(land),
    territories,
    continents,
    seaLanes,
  };
}

function computeAnchor(id: TerritoryId, shape: MultiPolygon): Pair {
  const override = ANCHOR_OVERRIDES[id];
  if (override) return project(override);
  const largest = shape.reduce((best, p) => (polygonArea(p) > polygonArea(best) ? p : best), shape[0]);
  const p = polylabel(largest, 1);
  return [p[0], p[1]];
}

function allVertices(mp: MultiPolygon): Pair[] {
  const pts: Pair[] = [];
  for (const poly of mp) for (const [x, y] of poly[0]) pts.push([x, y]);
  return pts;
}

function closestPair(a: MultiPolygon, b: MultiPolygon): [Pair, Pair] {
  const pa = allVertices(a);
  const pb = allVertices(b);
  let best = Infinity;
  let res: [Pair, Pair] = [pa[0], pb[0]];
  for (const p of pa)
    for (const q of pb) {
      const d = (p[0] - q[0]) ** 2 + (p[1] - q[1]) ** 2;
      if (d < best) {
        best = d;
        res = [p, q];
      }
    }
  return res;
}

function closestPointTo(mp: MultiPolygon, target: Pair): Pair {
  let best = Infinity;
  let res: Pair = target;
  for (const p of allVertices(mp)) {
    const d = (p[0] - target[0]) ** 2 + (p[1] - target[1]) ** 2;
    if (d < best) {
      best = d;
      res = p;
    }
  }
  return res;
}
