/**
 * Baked decoration glyphs.
 *
 * Stamping ~2,000 trees/mountains with `<use transform="…">` gives every
 * instance its own transform node (and every `opacity=` its own effect node)
 * in Chrome's property trees. Each node starts a new paint chunk, and the
 * compositor's "Layerize" step walks all chunks of the document whenever
 * *anything* repaints — so a hover highlight on the overlay paid for the
 * whole forest. Here every glyph primitive is transformed into absolute path
 * data instead, so all decor shares a single property state (one chunk) while
 * looking exactly like the old symbols.
 */

import { INK } from './symbols';

/** One drawing primitive of a glyph, in glyph-local coordinates. */
export interface Primitive {
  /** Path data using only absolute M/L/C/Z commands. */
  d: string;
  fill?: string;
  stroke?: string;
  strokeWidth?: number;
  /** Applied as fill- or stroke-opacity (never element opacity, see above). */
  alpha?: number;
  cap?: 'round';
  join?: 'round';
}

/** Ellipse as four cubic béziers (kappa approximation). */
function ellipse(cx: number, cy: number, rx: number, ry: number): string {
  const k = 0.5523;
  const ox = rx * k;
  const oy = ry * k;
  return (
    `M${cx - rx},${cy} C${cx - rx},${cy - oy} ${cx - ox},${cy - ry} ${cx},${cy - ry} ` +
    `C${cx + ox},${cy - ry} ${cx + rx},${cy - oy} ${cx + rx},${cy} ` +
    `C${cx + rx},${cy + oy} ${cx + ox},${cy + ry} ${cx},${cy + ry} ` +
    `C${cx - ox},${cy + ry} ${cx - rx},${cy + oy} ${cx - rx},${cy} Z`
  );
}

const shadow = (cx: number, cy: number, rx: number, ry: number, alpha: number): Primitive => ({
  d: ellipse(cx, cy, rx, ry),
  fill: INK,
  alpha,
});

const TREE_CROWNS = [
  // Three slightly different deciduous crowns (lumpy cloud shapes).
  'M-5.5,1.5 C-8,1 -8,-3.5 -5,-4 C-5,-7.5 -1,-8.5 0.5,-6.5 C2.5,-8.5 6.5,-7 5.8,-3.6 C8.2,-2.6 7.6,1.4 5,1.8 C3.5,3.4 -3.8,3.4 -5.5,1.5 Z',
  'M-5,2 C-7.6,0.6 -6.6,-4 -3.6,-4.4 C-3,-7.6 2,-8 3,-5.2 C6.6,-5.4 7.4,-1 5,1.2 C4,3.2 -2.6,3.6 -5,2 Z',
  'M-4.6,1.8 C-7,0 -5.4,-3.6 -3,-3.8 C-3.4,-7 1,-8.4 2.6,-6 C5.2,-6.8 7,-3 5,-1 C6.6,1.2 3.4,3.6 0.4,2.8 C-1.2,3.8 -3.6,3.2 -4.6,1.8 Z',
];

function tree(i: number): Primitive[] {
  return [
    shadow(1.6, 4.2, 6.4, 2, 0.18),
    { d: 'M-0.8,1 L-1,5 L1,5 L0.8,1 Z', fill: '#6b4a2b', stroke: INK, strokeWidth: 0.6 },
    { d: TREE_CROWNS[i], fill: '#7d8c46', stroke: INK, strokeWidth: 0.9, join: 'round' },
    { d: 'M-3.6,-3.4 C-2.6,-5.6 0,-6 1.2,-4.6', stroke: '#b5b56a', strokeWidth: 1.3, cap: 'round', alpha: 0.9 },
    { d: 'M1.5,1 C3,0.6 4.4,-0.4 4.8,-1.6', stroke: '#4f5c2c', strokeWidth: 1.1, cap: 'round', alpha: 0.7 },
  ];
}

function conifer(i: number): Primitive[] {
  const h = [10, 12, 9][i];
  const w = [4.2, 4.6, 4][i];
  const body =
    `M0,${-h} L${w * 0.55},${-h * 0.55} L${w * 0.3},${-h * 0.55} L${w * 0.85},${-h * 0.15} L${w * 0.45},${-h * 0.15} ` +
    `L${w},2 L${-w},2 L${-w * 0.45},${-h * 0.15} L${-w * 0.85},${-h * 0.15} L${-w * 0.3},${-h * 0.55} L${-w * 0.55},${-h * 0.55} Z`;
  return [
    shadow(1.4, 3.6, 4.4, 1.5, 0.18),
    { d: 'M-0.6,1.5 L-0.6,4 L0.6,4 L0.6,1.5 Z', fill: '#5d3f24' },
    { d: body, fill: '#5d7742', stroke: INK, strokeWidth: 0.85, join: 'round' },
    { d: `M0,${-h + 1.5} L${-w * 0.5},1.2`, stroke: '#9aa660', strokeWidth: 0.9, alpha: 0.8 },
  ];
}

function mountain(i: number): Primitive[] {
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
  const out: Primitive[] = [
    shadow(2, 3.4, (rx - lx) * 0.55, 2.2, 0.16),
    { d: `M${lx},${ly} L${px},${py} L${rx},${ry} Z`, fill: '#cfb183', stroke: INK, strokeWidth: 1.1, join: 'round' },
    { d: `M${px},${py} L${rx},${ry} L${mx},${my} Z`, fill: '#a8865a' },
    { d: hatch, stroke: INK, strokeWidth: 0.7, alpha: 0.55 },
    { d: `M${px},${py} L${mx},${my}`, stroke: INK, strokeWidth: 0.7, alpha: 0.6 },
  ];
  if (i === 2) {
    out.push({
      d: `M${px},${py} L${px - 4},${py + 6} L${px - 1.5},${py + 4.5} L${px + 0.5},${py + 6.5} L${px + 2.5},${py + 4.6} L${px + 4.4},${py + 5.6} Z`,
      fill: '#f6efdc',
      stroke: INK,
      strokeWidth: 0.6,
      join: 'round',
    });
  }
  out.push({ d: `M${lx},${ly} L${px},${py} L${rx},${ry}`, stroke: INK, strokeWidth: 1.1, join: 'round' });
  return out;
}

const DUNES: Primitive[][] = [
  [
    { d: 'M-9,2 C-5,-3 -1,-3.5 2,0 C4,-1.6 7,-1.4 9,1.6', stroke: INK, strokeWidth: 0.9, alpha: 0.55, cap: 'round' },
    { d: 'M-3,1 C-1.4,-0.6 0.6,-0.6 2,0.4', stroke: '#b48a52', strokeWidth: 1.6, alpha: 0.55, cap: 'round' },
  ],
  [
    { d: 'M-8,2 C-4,-2.6 1,-2.6 4,0.6 C5.6,-0.4 7,-0.2 8,1.2', stroke: INK, strokeWidth: 0.9, alpha: 0.5, cap: 'round' },
    { d: `${ellipse(-3, 3.6, 0.6, 0.6)} ${ellipse(2, 4, 0.5, 0.5)}`, fill: INK, alpha: 0.4 },
  ],
];

const ROCKS: Primitive[][] = [
  [
    shadow(1, 2.2, 4.6, 1.4, 0.16),
    { d: 'M-4,2 L-3.4,-1.4 L-1,-3.2 L2.6,-2.6 L4,0.4 L3.4,2 Z', fill: '#b39c78', stroke: INK, strokeWidth: 0.8, join: 'round' },
    { d: 'M-1,-3.2 L0,-0.2 L4,0.4 M0,-0.2 L-0.6,2', stroke: INK, strokeWidth: 0.6, alpha: 0.6 },
  ],
  [
    shadow(1, 2, 5, 1.4, 0.16),
    { d: 'M-4.4,2 L-3,-1 L-0.6,-1.8 L0.6,-0.4 L2.4,-2 L4.4,0.2 L4,2 Z', fill: '#a8916b', stroke: INK, strokeWidth: 0.8, join: 'round' },
  ],
];

const WAVES: Primitive[][] = [
  [{ d: 'M-9,0 C-7,-2.4 -5,-2.4 -3,0 C-1,2.4 1,2.4 3,0', stroke: '#56685a', strokeWidth: 1, alpha: 0.5, cap: 'round' }],
  [{ d: 'M-7,0 C-5.5,-2 -3.5,-2 -2,0 M1,1.5 C2.5,-0.5 4.5,-0.5 6,1.5', stroke: '#56685a', strokeWidth: 1, alpha: 0.45, cap: 'round' }],
];

export const GLYPHS: Record<string, Primitive[][]> = {
  tree: [0, 1, 2].map(tree),
  conifer: [0, 1, 2].map(conifer),
  mountain: [0, 1, 2].map(mountain),
  dune: DUNES,
  rock: ROCKS,
  wave: WAVES,
};

/**
 * Apply `translate(tx,ty) scale(s)` to absolute M/L/C/Z path data. Every
 * number in these paths is a coordinate, alternating x and y.
 */
function transformPath(d: string, tx: number, ty: number, s: number): string {
  let isX = true;
  return d.replace(/-?\d*\.?\d+(?:e-?\d+)?|[A-Za-z]/g, (tok) => {
    if (/[A-Za-z]/.test(tok)) return tok;
    const v = Number(tok) * s + (isX ? tx : ty);
    isX = !isX;
    return String(Math.round(v * 100) / 100);
  });
}

/** Presentation attributes of a primitive at scale `s`. */
function styleAttrs(p: Primitive, s: number): string {
  const a: string[] = [];
  a.push(`fill="${p.fill ?? 'none'}"`);
  if (p.stroke) {
    a.push(`stroke="${p.stroke}" stroke-width="${Math.round(p.strokeWidth! * s * 100) / 100}"`);
    if (p.cap) a.push(`stroke-linecap="${p.cap}"`);
    if (p.join) a.push(`stroke-linejoin="${p.join}"`);
  }
  if (p.alpha !== undefined) {
    if (p.fill) a.push(`fill-opacity="${p.alpha}"`);
    if (p.stroke) a.push(`stroke-opacity="${p.alpha}"`);
  }
  return a.join(' ');
}

/** SVG markup for one glyph instance as plain, untransformed <path>s. */
export function bakeGlyph(kind: string, variant: number, x: number, y: number, s: number): string {
  const variants = GLYPHS[kind];
  return variants[variant % variants.length]
    .map((p) => `<path d="${transformPath(p.d, x, y, s)}" ${styleAttrs(p, s)}/>`)
    .join('');
}

/**
 * Like bakeGlyph, but for many instances of a stroke-only glyph that may be
 * merged freely (no overlap ordering): one <path> per primitive in total.
 */
export function bakeMerged(kind: string, items: [number, number, number, number][]): string {
  const variants = GLYPHS[kind];
  const out: string[] = [];
  variants.forEach((prims, v) => {
    const mine = items.filter((it) => it[3] % variants.length === v);
    if (!mine.length) return;
    prims.forEach((p) => {
      // Stroke width varies with scale; use the average so one path suffices.
      const avg = mine.reduce((t, it) => t + it[2], 0) / mine.length;
      const d = mine.map(([x, y, s]) => transformPath(p.d, x, y, s)).join(' ');
      out.push(`<path d="${d}" ${styleAttrs(p, avg)}/>`);
    });
  });
  return out.join('');
}
