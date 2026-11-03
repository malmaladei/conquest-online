/**
 * Voronoi seeds that carve the mainland masses into territories.
 *
 * Each mainland territory owns one or more seed points ([lon, lat]). The
 * territory shape is the union of its seeds' Voronoi cells, clipped to land.
 * Adding/moving seeds is the way to reshape borders; afterwards run
 * `npm run check` to verify the classic adjacencies still hold.
 */

import type { TerritoryId } from '../../data/world';
import type { LonLat } from './coastlines';

export const SEEDS: Partial<Record<TerritoryId, LonLat[]>> = {
  // North America
  'alaska': [[-153, 64], [-160, 60], [-145, 67], [-150, 61], [-138, 60.5], [-132, 57]],
  'northwest-territory': [[-122, 66], [-105, 65], [-135, 68], [-90, 66.5], [-115, 63]],
  'alberta': [[-117, 56], [-126, 57], [-112, 53]],
  'ontario': [[-95, 53], [-88, 50], [-101, 57], [-92, 58]],
  'quebec': [[-72, 52], [-68, 57], [-74, 48], [-63, 53]],
  'western-us': [[-113, 42], [-120, 38], [-105, 37], [-112, 47], [-121, 45]],
  'eastern-us': [[-87, 38], [-80, 36], [-94, 34], [-83, 30], [-75, 42], [-90, 43]],
  'central-america': [[-102, 23], [-95, 18], [-88, 15], [-106, 28], [-82, 10], [-111, 28]],

  // South America
  'venezuela': [[-70, 7], [-62, 6], [-74, 3], [-55, 4]],
  'peru': [[-75, -8], [-68, -15], [-64, -19], [-77, -2]],
  'brazil': [[-50, -8], [-42, -12], [-56, -14], [-50, -23], [-60, -6]],
  'argentina': [[-65, -32], [-69, -43], [-60, -28], [-70, -51], [-71, -30]],

  // Europe
  'scandinavia': [[15, 63], [24, 67], [9, 60.5], [17, 58], [27, 63], [16, 67], [12.5, 57.5], [24, 61], [7.2, 58.9]],
  'northern-europe': [[10, 51.5], [18, 52], [13, 48.5], [22, 52], [9, 54.5], [13.5, 53], [18.5, 53.5], [9.2, 56.3]],
  'western-europe': [[2, 47], [-4, 40], [-6, 38], [-1, 43], [4, 49.5]],
  'southern-europe': [[12, 43], [21, 42], [16, 45.5], [15, 40], [25, 42.5], [22, 39]],
  'ukraine': [[32, 50], [40, 55], [42, 62], [47, 50], [33, 57], [48, 65], [27, 49], [25.5, 57.5], [33, 63]],

  // Africa
  'north-africa': [[-8, 25], [0, 20], [8, 28], [-12, 15], [5, 12], [-5, 32], [14, 21], [10, 33], [-10, 10], [-6, 34], [2, 35], [8, 36]],
  'egypt': [[30, 26], [25, 27], [32, 21], [22, 30]],
  'east-africa': [[38, 8], [36, 0], [45, 5], [31, 13], [37, -7], [26, 12], [38.5, 14]],
  'congo': [[20, 0], [15, -5], [23, -7], [18, 6]],
  'south-africa': [[25, -28], [18, -20], [29, -20], [35, -16], [20, -30]],

  // Asia
  'middle-east': [[44, 33], [36, 38.5], [47, 24], [55, 31], [32, 39], [40, 28], [52, 20], [43, 40.5], [60, 28], [47, 15], [53, 17]],
  'afghanistan': [[65, 35], [61, 42], [68, 46], [57, 47], [73, 41]],
  'ural': [[60, 58], [68, 62], [75, 53], [62, 66], [57, 52]],
  'siberia': [[85, 62], [92, 70], [88, 53], [100, 63], [80, 68], [97, 74]],
  'yakutsk': [[125, 66], [115, 70], [140, 68], [130, 61], [148, 70]],
  'irkutsk': [[105, 56], [115, 58], [108, 62], [122, 55]],
  'kamchatka': [[158, 64], [168, 67], [150, 63], [138, 54], [180, 66], [133, 50], [160, 57], [145, 60]],
  'mongolia': [[103, 46], [114, 45], [124, 46], [95, 48], [128, 42]],
  'china': [[82, 41], [95, 35], [108, 30], [115, 25], [88, 33], [114, 36], [80, 46]],
  'india': [[78, 22], [77, 14], [84, 25], [70, 26], [88, 24]],
  'siam': [[100, 17], [105, 14], [101, 6], [96, 21], [105, 21]],

  // Oceania
  'western-australia': [[122, -25], [130, -20], [127, -29], [120, -31], [132, -14]],
  'eastern-australia': [[145, -25], [146, -33], [142, -18], [140, -29], [138, -34]],
};

/**
 * Optional manual label/badge anchor overrides ([lon, lat]). Otherwise the
 * pole of inaccessibility of the largest polygon piece is used.
 */
export const ANCHOR_OVERRIDES: Partial<Record<TerritoryId, LonLat>> = {
  'greenland': [-41, 73],
  'japan': [138.5, 37],
  'indonesia': [113.5, -1],
  'great-britain': [-2.6, 54.6],
  'western-europe': [1, 45.6],
  'southern-europe': [20.5, 42.6],
  'kamchatka': [160, 66],
  'northwest-territory': [-115, 65],
  'central-america': [-101, 21.5],
  'madagascar': [46.5, -19.5],
  'new-guinea': [142, -5.5],
  'iceland': [-18.8, 64.9],
  'eastern-us': [-85, 37],
  'middle-east': [44, 30],
};

/**
 * Optional intermediate waypoints for sea lanes, keyed "a|b" (same order as in
 * BORDERS). Without an entry a lane goes straight between the closest coast
 * points of the two territories.
 */
export const SEA_LANE_VIA: Record<string, LonLat[]> = {
  'greenland|ontario': [[-80, 61.5], [-68, 62]],
};
