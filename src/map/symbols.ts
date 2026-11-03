/**
 * Hand-crafted SVG symbols for the illustrated map (all original artwork).
 * Symbols are drawn around (0, 0) in map units.
 */

export const INK = '#3b2a1a';
export const SEA = '#b9c3a9';

/**
 * Decoration glyphs (trees, mountains, dunes, rocks, waves) live in
 * glyphs.ts and are baked into plain paths; only the fort is a <symbol>.
 */
const SYMBOLS_EXTRA = `
  <!-- Round stone fort that carries the army badge -->
  <symbol id="fort" overflow="visible">
    <ellipse cx="2" cy="5" rx="17" ry="6" fill="${INK}" fill-opacity=".22"/>
    <circle r="15.5" fill="#bfa47a" stroke="${INK}" stroke-width="1.3"/>
    <circle r="15.5" fill="none" stroke="#8e7350" stroke-width="3.2" stroke-dasharray="3.4 2.7" stroke-opacity=".9"/>
    <circle r="12.4" fill="#d9c49a" stroke="${INK}" stroke-width=".9"/>
    <path d="M-10,6 A12,12 0 0 0 10,6" fill="none" stroke="#9c8058" stroke-width="2" stroke-opacity=".7"/>
  </symbol>
`;

/** Classic 16-point compass rose (original drawing). */
export function compassRose(r: number): string {
  const pts: string[] = [];
  for (let i = 0; i < 16; i++) {
    const a = (i * Math.PI) / 8 - Math.PI / 2;
    const len = i % 4 === 0 ? r : i % 2 === 0 ? r * 0.68 : r * 0.46;
    const w = i % 4 === 0 ? r * 0.12 : r * 0.08;
    const tip = [Math.cos(a) * len, Math.sin(a) * len];
    const l = [Math.cos(a - Math.PI / 2) * w, Math.sin(a - Math.PI / 2) * w];
    const rr = [Math.cos(a + Math.PI / 2) * w, Math.sin(a + Math.PI / 2) * w];
    const f = (p: number[]) => `${p[0].toFixed(1)},${p[1].toFixed(1)}`;
    const dark = i % 4 === 0 ? '#6a2f22' : i % 2 === 0 ? '#3e4f45' : '#7a6447';
    // Each ray is split in a dark and a light half for the engraved look.
    pts.push(
      `<path d="M0,0 L${f(l)} L${f(tip)} Z" fill="#f2e6c8" stroke="${INK}" stroke-width=".8"/>` +
        `<path d="M0,0 L${f(rr)} L${f(tip)} Z" fill="${dark}" stroke="${INK}" stroke-width=".8"/>`,
    );
  }
  // Draw minor rays first so the cardinal rays sit on top.
  const order = [1, 3, 5, 7, 9, 11, 13, 15, 2, 6, 10, 14, 0, 4, 8, 12];
  const ticks = Array.from({ length: 64 }, (_, i) => {
    const a = (i * Math.PI) / 32;
    const r1 = r * 0.84;
    const r2 = i % 4 === 0 ? r * 0.92 : r * 0.88;
    return `M${(Math.cos(a) * r1).toFixed(1)},${(Math.sin(a) * r1).toFixed(1)} L${(Math.cos(a) * r2).toFixed(1)},${(Math.sin(a) * r2).toFixed(1)}`;
  }).join(' ');
  return `
    <circle r="${r * 0.95}" fill="#efe2c0" fill-opacity=".55" stroke="${INK}" stroke-width="1.2"/>
    <circle r="${r * 0.84}" fill="none" stroke="${INK}" stroke-width=".8"/>
    <path d="${ticks}" stroke="${INK}" stroke-width=".8"/>
    <circle r="${r * 0.5}" fill="none" stroke="${INK}" stroke-width=".6" stroke-dasharray="2 2"/>
    ${order.map((i) => pts[i]).join('')}
    <circle r="${r * 0.07}" fill="#c9a24a" stroke="${INK}" stroke-width=".8"/>
    <text y="${-r * 1.06}" text-anchor="middle" class="compass-n" font-size="${r * 0.26}">N</text>
    <path d="M0,${-r * 1.3} l${r * 0.06},${r * 0.1} l${-r * 0.12},0 Z" fill="${INK}"/>`;
}

export function symbolDefs(): string {
  return SYMBOLS_EXTRA;
}
