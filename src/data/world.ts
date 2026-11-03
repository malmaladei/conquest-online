/**
 * Static game-board data: continents, territories and adjacencies.
 *
 * This file is intentionally free of any rendering concerns so that future
 * game logic (server or client) can import it directly. Geometry lives in
 * `src/map/geo/*`.
 *
 * Layout follows the classic 42-territory world division
 * (6 continents, 83 borders, including sea connections).
 */

export type ContinentId =
  | 'north-america'
  | 'south-america'
  | 'europe'
  | 'africa'
  | 'asia'
  | 'australia';

export type TerritoryId =
  // North America (9)
  | 'alaska'
  | 'northwest-territory'
  | 'greenland'
  | 'alberta'
  | 'ontario'
  | 'quebec'
  | 'western-us'
  | 'eastern-us'
  | 'central-america'
  // South America (4)
  | 'venezuela'
  | 'peru'
  | 'brazil'
  | 'argentina'
  // Europe (7)
  | 'iceland'
  | 'great-britain'
  | 'scandinavia'
  | 'northern-europe'
  | 'western-europe'
  | 'southern-europe'
  | 'ukraine'
  // Africa (6)
  | 'north-africa'
  | 'egypt'
  | 'east-africa'
  | 'congo'
  | 'south-africa'
  | 'madagascar'
  // Asia (12)
  | 'ural'
  | 'siberia'
  | 'yakutsk'
  | 'kamchatka'
  | 'irkutsk'
  | 'mongolia'
  | 'japan'
  | 'afghanistan'
  | 'china'
  | 'middle-east'
  | 'india'
  | 'siam'
  // Australia / Oceania (4)
  | 'indonesia'
  | 'new-guinea'
  | 'western-australia'
  | 'eastern-australia';

export interface Continent {
  id: ContinentId;
  name: string;
  /** Classic reinforcement bonus for holding the whole continent (for later game logic). */
  bonus: number;
}

export interface Territory {
  id: TerritoryId;
  name: string;
  continent: ContinentId;
}

/** 'land' = shared border on the map, 'sea' = connection across water (drawn as a dashed lane). */
export type BorderKind = 'land' | 'sea';

export interface Border {
  a: TerritoryId;
  b: TerritoryId;
  kind: BorderKind;
}

export const CONTINENTS: readonly Continent[] = [
  { id: 'north-america', name: 'North America', bonus: 5 },
  { id: 'south-america', name: 'South America', bonus: 2 },
  { id: 'europe', name: 'Europe', bonus: 5 },
  { id: 'africa', name: 'Africa', bonus: 3 },
  { id: 'asia', name: 'Asia', bonus: 7 },
  { id: 'australia', name: 'Oceania', bonus: 2 },
];

export const TERRITORIES: readonly Territory[] = [
  { id: 'alaska', name: 'Alaska', continent: 'north-america' },
  { id: 'northwest-territory', name: 'Northwest Territory', continent: 'north-america' },
  { id: 'greenland', name: 'Greenland', continent: 'north-america' },
  { id: 'alberta', name: 'Alberta', continent: 'north-america' },
  { id: 'ontario', name: 'Ontario', continent: 'north-america' },
  { id: 'quebec', name: 'Quebec', continent: 'north-america' },
  { id: 'western-us', name: 'Western United States', continent: 'north-america' },
  { id: 'eastern-us', name: 'Eastern United States', continent: 'north-america' },
  { id: 'central-america', name: 'Central America', continent: 'north-america' },

  { id: 'venezuela', name: 'Venezuela', continent: 'south-america' },
  { id: 'peru', name: 'Peru', continent: 'south-america' },
  { id: 'brazil', name: 'Brazil', continent: 'south-america' },
  { id: 'argentina', name: 'Argentina', continent: 'south-america' },

  { id: 'iceland', name: 'Iceland', continent: 'europe' },
  { id: 'great-britain', name: 'Great Britain', continent: 'europe' },
  { id: 'scandinavia', name: 'Scandinavia', continent: 'europe' },
  { id: 'northern-europe', name: 'Northern Europe', continent: 'europe' },
  { id: 'western-europe', name: 'Western Europe', continent: 'europe' },
  { id: 'southern-europe', name: 'Southern Europe', continent: 'europe' },
  { id: 'ukraine', name: 'Ukraine', continent: 'europe' },

  { id: 'north-africa', name: 'North Africa', continent: 'africa' },
  { id: 'egypt', name: 'Egypt', continent: 'africa' },
  { id: 'east-africa', name: 'East Africa', continent: 'africa' },
  { id: 'congo', name: 'Congo', continent: 'africa' },
  { id: 'south-africa', name: 'South Africa', continent: 'africa' },
  { id: 'madagascar', name: 'Madagascar', continent: 'africa' },

  { id: 'ural', name: 'Ural', continent: 'asia' },
  { id: 'siberia', name: 'Siberia', continent: 'asia' },
  { id: 'yakutsk', name: 'Yakutsk', continent: 'asia' },
  { id: 'kamchatka', name: 'Kamchatka', continent: 'asia' },
  { id: 'irkutsk', name: 'Irkutsk', continent: 'asia' },
  { id: 'mongolia', name: 'Mongolia', continent: 'asia' },
  { id: 'japan', name: 'Japan', continent: 'asia' },
  { id: 'afghanistan', name: 'Afghanistan', continent: 'asia' },
  { id: 'china', name: 'China', continent: 'asia' },
  { id: 'middle-east', name: 'Middle East', continent: 'asia' },
  { id: 'india', name: 'India', continent: 'asia' },
  { id: 'siam', name: 'Siam', continent: 'asia' },

  { id: 'indonesia', name: 'Indonesia', continent: 'australia' },
  { id: 'new-guinea', name: 'New Guinea', continent: 'australia' },
  { id: 'western-australia', name: 'Western Australia', continent: 'australia' },
  { id: 'eastern-australia', name: 'Eastern Australia', continent: 'australia' },
];

/**
 * All 83 classic borders. Each border is listed exactly once (undirected).
 * `scripts/check-map.ts` verifies that every 'land' border is an actual shared
 * edge in the generated geometry and that no unlisted territories touch.
 */
export const BORDERS: readonly Border[] = [
  // --- North America ---
  { a: 'alaska', b: 'northwest-territory', kind: 'land' },
  { a: 'alaska', b: 'alberta', kind: 'land' },
  { a: 'alaska', b: 'kamchatka', kind: 'sea' },
  { a: 'northwest-territory', b: 'alberta', kind: 'land' },
  { a: 'northwest-territory', b: 'ontario', kind: 'land' },
  { a: 'northwest-territory', b: 'greenland', kind: 'sea' },
  { a: 'greenland', b: 'ontario', kind: 'sea' },
  { a: 'greenland', b: 'quebec', kind: 'sea' },
  { a: 'greenland', b: 'iceland', kind: 'sea' },
  { a: 'alberta', b: 'ontario', kind: 'land' },
  { a: 'alberta', b: 'western-us', kind: 'land' },
  { a: 'ontario', b: 'quebec', kind: 'land' },
  { a: 'ontario', b: 'western-us', kind: 'land' },
  { a: 'ontario', b: 'eastern-us', kind: 'land' },
  { a: 'quebec', b: 'eastern-us', kind: 'land' },
  { a: 'western-us', b: 'eastern-us', kind: 'land' },
  { a: 'western-us', b: 'central-america', kind: 'land' },
  { a: 'eastern-us', b: 'central-america', kind: 'land' },
  { a: 'central-america', b: 'venezuela', kind: 'land' },

  // --- South America ---
  { a: 'venezuela', b: 'peru', kind: 'land' },
  { a: 'venezuela', b: 'brazil', kind: 'land' },
  { a: 'peru', b: 'brazil', kind: 'land' },
  { a: 'peru', b: 'argentina', kind: 'land' },
  { a: 'brazil', b: 'argentina', kind: 'land' },
  { a: 'brazil', b: 'north-africa', kind: 'sea' },

  // --- Europe ---
  { a: 'iceland', b: 'great-britain', kind: 'sea' },
  { a: 'iceland', b: 'scandinavia', kind: 'sea' },
  { a: 'great-britain', b: 'scandinavia', kind: 'sea' },
  { a: 'great-britain', b: 'northern-europe', kind: 'sea' },
  { a: 'great-britain', b: 'western-europe', kind: 'sea' },
  { a: 'scandinavia', b: 'northern-europe', kind: 'sea' },
  { a: 'scandinavia', b: 'ukraine', kind: 'land' },
  { a: 'northern-europe', b: 'western-europe', kind: 'land' },
  { a: 'northern-europe', b: 'southern-europe', kind: 'land' },
  { a: 'northern-europe', b: 'ukraine', kind: 'land' },
  { a: 'western-europe', b: 'southern-europe', kind: 'land' },
  { a: 'western-europe', b: 'north-africa', kind: 'sea' },
  { a: 'southern-europe', b: 'ukraine', kind: 'land' },
  { a: 'southern-europe', b: 'north-africa', kind: 'sea' },
  { a: 'southern-europe', b: 'egypt', kind: 'sea' },
  { a: 'southern-europe', b: 'middle-east', kind: 'land' },
  { a: 'ukraine', b: 'ural', kind: 'land' },
  { a: 'ukraine', b: 'afghanistan', kind: 'land' },
  { a: 'ukraine', b: 'middle-east', kind: 'land' },

  // --- Africa ---
  { a: 'north-africa', b: 'egypt', kind: 'land' },
  { a: 'north-africa', b: 'east-africa', kind: 'land' },
  { a: 'north-africa', b: 'congo', kind: 'land' },
  { a: 'egypt', b: 'east-africa', kind: 'land' },
  { a: 'egypt', b: 'middle-east', kind: 'land' },
  { a: 'east-africa', b: 'congo', kind: 'land' },
  { a: 'east-africa', b: 'south-africa', kind: 'land' },
  { a: 'east-africa', b: 'madagascar', kind: 'sea' },
  { a: 'east-africa', b: 'middle-east', kind: 'sea' },
  { a: 'congo', b: 'south-africa', kind: 'land' },
  { a: 'south-africa', b: 'madagascar', kind: 'sea' },

  // --- Asia ---
  { a: 'ural', b: 'siberia', kind: 'land' },
  { a: 'ural', b: 'china', kind: 'land' },
  { a: 'ural', b: 'afghanistan', kind: 'land' },
  { a: 'siberia', b: 'yakutsk', kind: 'land' },
  { a: 'siberia', b: 'irkutsk', kind: 'land' },
  { a: 'siberia', b: 'mongolia', kind: 'land' },
  { a: 'siberia', b: 'china', kind: 'land' },
  { a: 'yakutsk', b: 'kamchatka', kind: 'land' },
  { a: 'yakutsk', b: 'irkutsk', kind: 'land' },
  { a: 'kamchatka', b: 'irkutsk', kind: 'land' },
  { a: 'kamchatka', b: 'mongolia', kind: 'land' },
  { a: 'kamchatka', b: 'japan', kind: 'sea' },
  { a: 'irkutsk', b: 'mongolia', kind: 'land' },
  { a: 'mongolia', b: 'japan', kind: 'sea' },
  { a: 'mongolia', b: 'china', kind: 'land' },
  { a: 'afghanistan', b: 'china', kind: 'land' },
  { a: 'afghanistan', b: 'india', kind: 'land' },
  { a: 'afghanistan', b: 'middle-east', kind: 'land' },
  { a: 'china', b: 'india', kind: 'land' },
  { a: 'china', b: 'siam', kind: 'land' },
  { a: 'middle-east', b: 'india', kind: 'land' },
  { a: 'india', b: 'siam', kind: 'land' },
  { a: 'siam', b: 'indonesia', kind: 'sea' },

  // --- Australia / Oceania ---
  { a: 'indonesia', b: 'new-guinea', kind: 'sea' },
  { a: 'indonesia', b: 'western-australia', kind: 'sea' },
  { a: 'new-guinea', b: 'western-australia', kind: 'sea' },
  { a: 'new-guinea', b: 'eastern-australia', kind: 'sea' },
  { a: 'western-australia', b: 'eastern-australia', kind: 'land' },
];

// ---------------------------------------------------------------------------
// Lookup helpers (pure, safe to use from game logic)
// ---------------------------------------------------------------------------

export const TERRITORY_BY_ID: ReadonlyMap<TerritoryId, Territory> = new Map(
  TERRITORIES.map((t) => [t.id, t]),
);

export const CONTINENT_BY_ID: ReadonlyMap<ContinentId, Continent> = new Map(
  CONTINENTS.map((c) => [c.id, c]),
);

/** Adjacency list built once from BORDERS (both directions). */
export const NEIGHBOURS: ReadonlyMap<TerritoryId, readonly TerritoryId[]> = (() => {
  const map = new Map<TerritoryId, TerritoryId[]>();
  for (const t of TERRITORIES) map.set(t.id, []);
  for (const { a, b } of BORDERS) {
    map.get(a)!.push(b);
    map.get(b)!.push(a);
  }
  return map;
})();

export function areAdjacent(a: TerritoryId, b: TerritoryId): boolean {
  return NEIGHBOURS.get(a)?.includes(b) ?? false;
}

export function territoriesOf(continent: ContinentId): Territory[] {
  return TERRITORIES.filter((t) => t.continent === continent);
}
