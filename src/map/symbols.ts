/**
 * Hand-crafted SVG symbols for the illustrated map (all original artwork).
 * Each symbol is drawn around (0, 0) in map units and stamped with <use>.
 */

export const INK = '#3b2a1a';
export const SEA = '#b9c3a9';

const treeCrowns = [
  // Three slightly different deciduous crowns (lumpy cloud shapes).
  'M-5.5,1.5 C-8,1 -8,-3.5 -5,-4 C-5,-7.5 -1,-8.5 0.5,-6.5 C2.5,-8.5 6.5,-7 5.8,-3.6 C8.2,-2.6 7.6,1.4 5,1.8 C3.5,3.4 -3.8,3.4 -5.5,1.5 Z',
  'M-5,2 C-7.6,0.6 -6.6,-4 -3.6,-4.4 C-3,-7.6 2,-8 3,-5.2 C6.6,-5.4 7.4,-1 5,1.2 C4,3.2 -2.6,3.6 -5,2 Z',
  'M-4.6,1.8 C-7,0 -5.4,-3.6 -3,-3.8 C-3.4,-7 1,-8.4 2.6,-6 C5.2,-6.8 7,-3 5,-1 C6.6,1.2 3.4,3.6 0.4,2.8 C-1.2,3.8 -3.6,3.2 -4.6,1.8 Z',
];

function tree(i: number): string {
  return `<symbol id="tree-${i}" overflow="visible">
    <ellipse cx="1.6" cy="4.2" rx="6.4" ry="2" fill="${INK}" opacity=".18"/>
    <path d="M-0.8,1 L-1,5 L1,5 L0.8,1 Z" fill="#6b4a2b" stroke="${INK}" stroke-width=".6"/>
    <path d="${treeCrowns[i]}" fill="#7d8c46" stroke="${INK}" stroke-width=".9" stroke-linejoin="round"/>
    <path d="M-3.6,-3.4 C-2.6,-5.6 0,-6 1.2,-4.6" fill="none" stroke="#b5b56a" stroke-width="1.3" stroke-linecap="round" opacity=".9"/>
    <path d="M1.5,1 C3,0.6 4.4,-0.4 4.8,-1.6" fill="none" stroke="#4f5c2c" stroke-width="1.1" stroke-linecap="round" opacity=".7"/>
  </symbol>`;
}

function conifer(i: number): string {
  const h = [10, 12, 9][i];
  const w = [4.2, 4.6, 4][i];
  return `<symbol id="conifer-${i}" overflow="visible">
    <ellipse cx="1.4" cy="3.6" rx="4.4" ry="1.5" fill="${INK}" opacity=".18"/>
    <path d="M-0.6,1.5 L-0.6,4 L0.6,4 L0.6,1.5 Z" fill="#5d3f24"/>
    <path d="M0,${-h} L${w * 0.55},${-h * 0.55} L${w * 0.3},${-h * 0.55} L${w * 0.85},${-h * 0.15} L${w * 0.45},${-h * 0.15} L${w},2 L${-w},2 L${-w * 0.45},${-h * 0.15} L${-w * 0.85},${-h * 0.15} L${-w * 0.3},${-h * 0.55} L${-w * 0.55},${-h * 0.55} Z"
      fill="#5d7742" stroke="${INK}" stroke-width=".85" stroke-linejoin="round"/>
    <path d="M0,${-h + 1.5} L${-w * 0.5},1.2" fill="none" stroke="#9aa660" stroke-width=".9" opacity=".8"/>
  </symbol>`;
}

function mountain(i: number): string {
  // Peaks with a lit side and a hatched shadow side; variant 2 has a snow cap.
  const shapes = [
    { peak: [0, -13], l: [-11, 3], r: [11, 3], mid: [1.5, 3] },
    { peak: [-1, -11], l: [-10, 3], r: [9, 3], mid: [0.5, 3] },
    { peak: [0.5, -15], l: [-12, 3], r: [12, 3], mid: [2, 3] },
  ][i];
  const [px, py] = shapes.peak;
  const [lx, ly] = shapes.l;
  const [rx, ry] = shapes.r;
  const [mx, my] = shapes.mid;
  const hatch = [0.25, 0.45, 0.65]
    .map((t) => {
      const x1 = px + (rx - px) * t;
      const y1 = py + (ry - py) * t;
      const x2 = px + (mx - px) * (t + 0.15);
      const y2 = py + (my - py) * (t + 0.15);
      return `M${x1.toFixed(1)},${y1.toFixed(1)} L${x2.toFixed(1)},${y2.toFixed(1)}`;
    })
    .join(' ');
  const snow =
    i === 2
      ? `<path d="M${px},${py} L${px - 4},${py + 6} L${px - 1.5},${py + 4.5} L${px + 0.5},${py + 6.5} L${px + 2.5},${py + 4.6} L${px + 4.4},${py + 5.6} Z" fill="#f6efdc" stroke="${INK}" stroke-width=".6" stroke-linejoin="round"/>`
      : '';
  return `<symbol id="mountain-${i}" overflow="visible">
    <ellipse cx="2" cy="3.4" rx="${(rx - lx) * 0.55}" ry="2.2" fill="${INK}" opacity=".16"/>
    <path d="M${lx},${ly} L${px},${py} L${rx},${ry} Z" fill="#cfb183" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
    <path d="M${px},${py} L${rx},${ry} L${mx},${my} Z" fill="#a8865a"/>
    <path d="${hatch}" stroke="${INK}" stroke-width=".7" opacity=".55" fill="none"/>
    <path d="M${px},${py} L${mx},${my}" stroke="${INK}" stroke-width=".7" opacity=".6"/>
    ${snow}
    <path d="M${lx},${ly} L${px},${py} L${rx},${ry}" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/>
  </symbol>`;
}

const SYMBOLS_EXTRA = `
  <symbol id="dune-0" overflow="visible">
    <path d="M-9,2 C-5,-3 -1,-3.5 2,0 C4,-1.6 7,-1.4 9,1.6" fill="none" stroke="${INK}" stroke-width=".9" opacity=".55" stroke-linecap="round"/>
    <path d="M-3,1 C-1.4,-0.6 0.6,-0.6 2,0.4" fill="none" stroke="#b48a52" stroke-width="1.6" opacity=".55" stroke-linecap="round"/>
  </symbol>
  <symbol id="dune-1" overflow="visible">
    <path d="M-8,2 C-4,-2.6 1,-2.6 4,0.6 C5.6,-0.4 7,-0.2 8,1.2" fill="none" stroke="${INK}" stroke-width=".9" opacity=".5" stroke-linecap="round"/>
    <circle cx="-3" cy="3.6" r=".6" fill="${INK}" opacity=".4"/><circle cx="2" cy="4" r=".5" fill="${INK}" opacity=".4"/>
  </symbol>
  <symbol id="rock-0" overflow="visible">
    <ellipse cx="1" cy="2.2" rx="4.6" ry="1.4" fill="${INK}" opacity=".16"/>
    <path d="M-4,2 L-3.4,-1.4 L-1,-3.2 L2.6,-2.6 L4,0.4 L3.4,2 Z" fill="#b39c78" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>
    <path d="M-1,-3.2 L0,-0.2 L4,0.4 M0,-0.2 L-0.6,2" fill="none" stroke="${INK}" stroke-width=".6" opacity=".6"/>
  </symbol>
  <symbol id="rock-1" overflow="visible">
    <ellipse cx="1" cy="2" rx="5" ry="1.4" fill="${INK}" opacity=".16"/>
    <path d="M-4.4,2 L-3,-1 L-0.6,-1.8 L0.6,-0.4 L2.4,-2 L4.4,0.2 L4,2 Z" fill="#a8916b" stroke="${INK}" stroke-width=".8" stroke-linejoin="round"/>
  </symbol>
  <symbol id="wave-0" overflow="visible">
    <path d="M-9,0 C-7,-2.4 -5,-2.4 -3,0 C-1,2.4 1,2.4 3,0" fill="none" stroke="#56685a" stroke-width="1" opacity=".5" stroke-linecap="round"/>
  </symbol>
  <symbol id="wave-1" overflow="visible">
    <path d="M-7,0 C-5.5,-2 -3.5,-2 -2,0 M1,1.5 C2.5,-0.5 4.5,-0.5 6,1.5" fill="none" stroke="#56685a" stroke-width="1" opacity=".45" stroke-linecap="round"/>
  </symbol>

  <!-- Round stone fort that carries the army badge -->
  <symbol id="fort" overflow="visible">
    <ellipse cx="2" cy="5" rx="17" ry="6" fill="${INK}" opacity=".22"/>
    <circle r="15.5" fill="#bfa47a" stroke="${INK}" stroke-width="1.3"/>
    <circle r="15.5" fill="none" stroke="#8e7350" stroke-width="3.2" stroke-dasharray="3.4 2.7" opacity=".9"/>
    <circle r="12.4" fill="#d9c49a" stroke="${INK}" stroke-width=".9"/>
    <path d="M-10,6 A12,12 0 0 0 10,6" fill="none" stroke="#9c8058" stroke-width="2" opacity=".7"/>
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
  return [0, 1, 2].map(tree).join('') + [0, 1, 2].map(conifer).join('') + [0, 1, 2].map(mountain).join('') + SYMBOLS_EXTRA;
}
