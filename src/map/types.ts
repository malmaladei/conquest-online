/** Shape of the pre-computed src/map/generated/map.json (see scripts/build-geometry.ts). */

import type { ContinentId, TerritoryId } from '../data/world';
import type { Decor } from './decor';

export type Point = [number, number];

export interface GeneratedTerritory {
  id: TerritoryId;
  continent: ContinentId;
  /** SVG path data. */
  path: string;
  /** Badge / label anchor in map units. */
  anchor: Point;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
}

export interface GeneratedMap {
  width: number;
  height: number;
  landPath: string;
  /** Simplified land outline used for the coastal ripple strokes. */
  ripplePath: string;
  territories: GeneratedTerritory[];
  continents: { id: ContinentId; path: string }[];
  seaLanes: { a: TerritoryId; b: TerritoryId; points: Point[]; wraps?: 'west' | 'east' }[];
  decor: Decor;
}
