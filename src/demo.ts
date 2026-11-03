/**
 * Random "mid-game" demo state so the board can be previewed with players.
 * Ownership is grown as contiguous blobs (multi-source random flood fill over
 * the adjacency graph), which looks much more like a real game than a uniform
 * random deal.
 */
import { NEIGHBOURS, TERRITORIES, type TerritoryId } from './data/world';

export interface Player {
  id: number;
  name: string;
  color: string;
}

export const PLAYER_PALETTE: readonly Omit<Player, 'id'>[] = [
  { name: 'Azure', color: '#2f6db3' },
  { name: 'Crimson', color: '#b8352b' },
  { name: 'Verdant', color: '#3b8446' },
  { name: 'Saffron', color: '#cf9418' },
];

export interface DemoState {
  players: Player[];
  owner: Map<TerritoryId, number>;
  armies: Map<TerritoryId, number>;
}

export function generateDemo(playerCount: number, rnd: () => number = Math.random): DemoState {
  const players = PLAYER_PALETTE.slice(0, playerCount).map((p, id) => ({ ...p, id }));
  const owner = new Map<TerritoryId, number>();
  const ids = TERRITORIES.map((t) => t.id);

  // Pick distinct random start territories.
  const shuffled = [...ids].sort(() => rnd() - 0.5);
  const frontier: TerritoryId[][] = players.map((p) => {
    owner.set(shuffled[p.id], p.id);
    return [shuffled[p.id]];
  });

  // Players take turns claiming a random unclaimed neighbour of their blob.
  let progress = true;
  while (owner.size < ids.length && progress) {
    progress = false;
    for (const p of players) {
      const options = frontier[p.id].flatMap((t) => NEIGHBOURS.get(t)!.filter((n) => !owner.has(n)));
      if (!options.length) continue;
      const pick = options[Math.floor(rnd() * options.length)];
      owner.set(pick, p.id);
      frontier[p.id].push(pick);
      progress = true;
    }
  }
  // Safety net: anything unreachable goes to a random player.
  for (const id of ids) if (!owner.has(id)) owner.set(id, Math.floor(rnd() * playerCount));

  // Armies: thin interior, heavier on borders with enemies.
  const armies = new Map<TerritoryId, number>();
  for (const id of ids) {
    const hostile = NEIGHBOURS.get(id)!.filter((n) => owner.get(n) !== owner.get(id)).length;
    const base = hostile ? 2 + Math.floor(rnd() * 5) + hostile : 1 + Math.floor(rnd() * 2);
    armies.set(id, Math.min(30, base + (rnd() < 0.12 ? 6 + Math.floor(rnd() * 10) : 0)));
  }
  return { players, owner, armies };
}
