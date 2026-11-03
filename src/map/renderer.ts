/**
 * SVG renderer for the world map.
 *
 * The static artwork (sea, coasts, decorations, labels) is assembled once as
 * an SVG string. Interactive state (hover, selection, ownership colours,
 * army counts) is applied by toggling classes / attributes on cached elements,
 * so updates are cheap and easy to drive from future game state.
 */

import {
  CONTINENTS,
  NEIGHBOURS,
  TERRITORIES,
  type ContinentId,
  type TerritoryId,
} from '../data/world';
import type { LonLat } from './geo/coastlines';
import { PanZoom } from './panzoom';
import { paperTexture } from './paper';
import { INK, SEA, compassRose, symbolDefs } from './symbols';
import type { GeneratedMap, Point } from './types';

/** Muted continent tints (used in the neutral, non-game view). */
export const CONTINENT_COLORS: Record<ContinentId, string> = {
  'north-america': '#d19a36',
  'south-america': '#c0603a',
  'europe': '#4f78a6',
  'africa': '#9a6a3a',
  'asia': '#5f8a45',
  'australia': '#8a5f9e',
};

/** Ownership info per territory, as a future game state would provide it. */
export interface TerritoryState {
  color: string;
  armies: number;
}

export interface MapEvents {
  onSelect?: (id: TerritoryId | null) => void;
  onHover?: (id: TerritoryId | null) => void;
}

// Projection must match src/map/geometry.ts (kept local so the browser bundle
// doesn't pull in the clipping libraries).
const project = ([lon, lat]: LonLat): Point => [(lon + 172) * 6.5, (84 - lat) * 6.5 * 1.2];

/** Frame band width around the map (map units). */
const FRAME = 16;
/** How far the view may scroll past the frame. */
const MARGIN = 40;

const CONTINENT_LABELS: { id: ContinentId; at: LonLat; rotate: number }[] = [
  { id: 'north-america', at: [-149, 45], rotate: -6 },
  { id: 'south-america', at: [-104, -24], rotate: 0 },
  { id: 'europe', at: [-28, 47.5], rotate: -4 },
  { id: 'africa', at: [-29, 4], rotate: 0 },
  { id: 'asia', at: [166, 40], rotate: 0 },
  { id: 'australia', at: [174, -12], rotate: 0 },
];

const OCEAN_LABELS: { text: string; at: LonLat; size: number; rotate?: number }[] = [
  { text: 'Pacific Ocean', at: [-135, 14], size: 30 },
  { text: 'Pacific Ocean', at: [172, 14], size: 24 },
  { text: 'Atlantic Ocean', at: [-42, 27], size: 28, rotate: -10 },
  { text: 'Atlantic Ocean', at: [-18, -22], size: 22, rotate: 10 },
  { text: 'Indian Ocean', at: [76, -16], size: 28 },
  { text: 'Arctic Ocean', at: [4, 79.5], size: 20 },
  { text: 'Southern Ocean', at: [40, -49], size: 22 },
  { text: 'Gulf of Mexico', at: [-90, 25.3], size: 9 },
  { text: 'Mediterranean Sea', at: [19.5, 34.6], size: 8, rotate: -3 },
  { text: 'Hudson Bay', at: [-86.5, 60], size: 9 },
  { text: 'Arabian Sea', at: [63, 15], size: 11 },
  { text: 'Bay of Bengal', at: [89, 15], size: 10 },
  { text: 'South China Sea', at: [114, 14], size: 10 },
  { text: 'Caribbean Sea', at: [-75, 15], size: 10 },
  { text: 'Tasman Sea', at: [160, -38], size: 11 },
  { text: 'Sea of Okhotsk', at: [149, 54.5], size: 9 },
];

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');

/** Break long names onto two lines at the space nearest the middle. */
function splitName(name: string): string[] {
  if (name.length <= 12 || !name.includes(' ')) return [name];
  const mid = name.length / 2;
  let best = -1;
  for (let i = 0; i < name.length; i++) {
    if (name[i] === ' ' && (best < 0 || Math.abs(i - mid) < Math.abs(best - mid))) best = i;
  }
  return [name.slice(0, best), name.slice(best + 1)];
}

/** Smooth polyline -> cubic Bézier path (Catmull-Rom). Two points become a gentle arc. */
function lanePath(points: Point[]): string {
  if (points.length === 2) {
    const [[x1, y1], [x2, y2]] = points;
    const len = Math.hypot(x2 - x1, y2 - y1);
    const bend = Math.min(40, len * 0.18);
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    // Always bulge "upwards" on screen for a consistent look.
    const s = ny > 0 ? -1 : 1;
    const cx = (x1 + x2) / 2 + nx * bend * s;
    const cy = (y1 + y2) / 2 + ny * bend * s;
    return `M${x1},${y1} Q${cx.toFixed(1)},${cy.toFixed(1)} ${x2},${y2}`;
  }
  let d = `M${points[0][0]},${points[0][1]}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[Math.max(0, i - 1)];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[Math.min(points.length - 1, i + 2)];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0]},${p2[1]}`;
  }
  return d;
}

export class WorldMapView {
  readonly svg: SVGSVGElement;
  readonly panZoom: PanZoom;
  private hits = new Map<TerritoryId, SVGPathElement>();
  private tints = new Map<TerritoryId, SVGGElement>();
  private badges = new Map<TerritoryId, SVGGElement>();
  private lanes: { a: TerritoryId; b: TerritoryId; el: SVGGElement }[] = [];
  private scaled: SVGGElement[] = [];
  private symbolScale = 0;
  private hovered: TerritoryId | null = null;
  private selected: TerritoryId | null = null;

  constructor(
    container: HTMLElement,
    private data: GeneratedMap,
    private events: MapEvents = {},
  ) {
    container.insertAdjacentHTML('beforeend', this.buildSvg());
    this.svg = container.querySelector('svg.world-map')!;
    const viewport = this.svg.querySelector<SVGGElement>('#viewport')!;

    for (const el of this.svg.querySelectorAll<SVGPathElement>('.hit')) this.hits.set(el.dataset.id as TerritoryId, el);
    for (const el of this.svg.querySelectorAll<SVGGElement>('.tint')) this.tints.set(el.dataset.id as TerritoryId, el);
    for (const el of this.svg.querySelectorAll<SVGGElement>('.badge')) this.badges.set(el.dataset.id as TerritoryId, el);
    for (const el of this.svg.querySelectorAll<SVGGElement>('.badge, .t-label-g')) this.scaled.push(el);
    for (const el of this.svg.querySelectorAll<SVGGElement>('.lane'))
      this.lanes.push({ a: el.dataset.a as TerritoryId, b: el.dataset.b as TerritoryId, el });

    // Paper texture is generated after first paint so the map shows up instantly.
    requestAnimationFrame(() => {
      this.svg.querySelector('#paper')!.setAttribute('href', paperTexture());
    });

    this.panZoom = new PanZoom({
      svg: this.svg,
      target: viewport,
      contentWidth: data.width,
      contentHeight: data.height,
      margin: MARGIN,
      maxZoom: 7,
      onChange: (v) => {
        // Level of detail: hide small sea labels when zoomed out.
        this.svg.classList.toggle('zoomed-out', v.k < 0.75);
        this.svg.classList.toggle('zoomed-in', v.k > 1.6);
        this.updateSymbolScale(v.k);
      },
    });
    this.panZoom.fit(false);
    this.bindEvents();
    this.setOwnership(null);
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  /** Apply ownership colours + army counts, or `null` for the neutral board. */
  setOwnership(state: Map<TerritoryId, TerritoryState> | null): void {
    this.svg.classList.toggle('demo', !!state);
    for (const t of TERRITORIES) {
      const tint = this.tints.get(t.id)!;
      const badge = this.badges.get(t.id)!;
      const s = state?.get(t.id);
      tint.style.color = s ? s.color : CONTINENT_COLORS[t.continent];
      badge.style.color = s ? s.color : '';
      badge.classList.toggle('owned', !!s);
      badge.querySelector('text')!.textContent = s ? String(s.armies) : '–';
    }
  }

  select(id: TerritoryId | null, focus = false): void {
    this.selected = id;
    if (id && focus) {
      const t = this.data.territories.find((x) => x.id === id)!;
      const k = Math.max(this.panZoom.current.k, 1.6);
      this.panZoom.focusOn(t.anchor[0], t.anchor[1], k);
    }
    this.refreshHighlight();
    this.events.onSelect?.(id);
  }

  /** Externally driven hover (e.g. hovering a neighbour chip in the info card). */
  preview(id: TerritoryId | null): void {
    this.hovered = id;
    this.refreshHighlight();
  }

  /**
   * Badges and labels shrink less than the map when zooming out (and grow
   * less when zooming in) so they stay legible on the full-world overview.
   */
  private updateSymbolScale(k: number): void {
    const s = Math.min(1.45, Math.max(0.85, Math.pow(k, -0.6)));
    if (Math.abs(s - this.symbolScale) < 0.01) return;
    this.symbolScale = s;
    for (const el of this.scaled) {
      el.setAttribute('transform', `translate(${el.dataset.x},${el.dataset.y}) scale(${s.toFixed(3)})`);
    }
  }

  // ---------------------------------------------------------------------
  // Interaction
  // ---------------------------------------------------------------------

  private bindEvents(): void {
    const idOf = (e: Event) => (e.target as Element).closest<SVGPathElement>('.hit')?.dataset.id as TerritoryId | undefined;

    this.svg.addEventListener('pointerover', (e) => {
      if (this.panZoom.isGesturing || (e as PointerEvent).pointerType === 'touch') return;
      const id = idOf(e) ?? null;
      if (id !== this.hovered) {
        this.hovered = id;
        this.refreshHighlight();
        this.events.onHover?.(id);
      }
    });
    this.svg.addEventListener('pointerleave', () => {
      this.hovered = null;
      this.refreshHighlight();
      this.events.onHover?.(null);
    });
    this.svg.addEventListener('click', (e) => {
      const id = idOf(e) ?? null;
      this.select(id === this.selected ? null : id);
    });
  }

  private refreshHighlight(): void {
    // Hover wins over selection for the transient highlight, selection stays outlined.
    const focus = this.hovered ?? this.selected;
    const neighbours = new Set(focus ? NEIGHBOURS.get(focus) : []);
    this.svg.classList.toggle('has-focus', !!focus);
    for (const [id, el] of this.hits) {
      el.classList.toggle('focus', id === focus);
      el.classList.toggle('neighbour', neighbours.has(id));
      el.classList.toggle('selected', id === this.selected);
    }
    for (const [id, el] of this.badges) {
      el.classList.toggle('focus', id === focus);
      el.classList.toggle('neighbour', neighbours.has(id));
    }
    for (const l of this.lanes) l.el.classList.toggle('active', !!focus && (l.a === focus || l.b === focus));
  }

  // ---------------------------------------------------------------------
  // Static artwork
  // ---------------------------------------------------------------------

  private buildSvg(): string {
    const { width: W, height: H, territories, decor } = this.data;

    const clipPaths = territories.map((t) => `<clipPath id="clip-${t.id}"><path d="${t.path}"/></clipPath>`).join('');
    const continentClips = this.data.continents
      .map((c) => `<clipPath id="cclip-${c.id}"><path d="${c.path}"/></clipPath>`)
      .join('');

    // Painterly tint: translucent wash + soft darker rim inside the border.
    const tints = territories
      .map(
        (t) => `<g class="tint" data-id="${t.id}" clip-path="url(#clip-${t.id})">
          <path d="${t.path}" class="tint-fill"/>
          <path d="${t.path}" class="tint-rim r1"/><path d="${t.path}" class="tint-rim r2"/><path d="${t.path}" class="tint-rim r3"/>
        </g>`,
      )
      .join('');

    const continentRims = this.data.continents
      .map(
        (c) => `<g clip-path="url(#cclip-${c.id})" style="color:${CONTINENT_COLORS[c.id]}">
          <path d="${c.path}" class="continent-rim"/>
        </g>`,
      )
      .join('');

    // Decorations sorted by y so lower glyphs overlap higher ones naturally.
    const glyphs: [number, string][] = [];
    const stamp = (list: [number, number, number, number][], sym: string, variants: number) => {
      for (const [x, y, s, v] of list) {
        glyphs.push([y, `<use href="#${sym}-${v % variants}" transform="translate(${x},${y}) scale(${s})"/>`]);
      }
    };
    stamp(decor.dunes, 'dune', 2);
    stamp(decor.rocks, 'rock', 2);
    stamp(decor.trees, 'tree', 3);
    stamp(decor.conifers, 'conifer', 3);
    stamp(decor.mountains, 'mountain', 3);
    glyphs.sort((a, b) => a[0] - b[0]);
    const waves = decor.waves
      .map(([x, y, s, v]) => `<use href="#wave-${v}" transform="translate(${x},${y}) scale(${s})"/>`)
      .join('');

    const borders = territories.map((t) => `<path d="${t.path}"/>`).join('');
    const hits = territories
      .map((t) => `<path class="hit" data-id="${t.id}" d="${t.path}"><title>${esc(TERRITORIES.find((x) => x.id === t.id)!.name)}</title></path>`)
      .join('');

    const lanes = this.data.seaLanes
      .map((l) => {
        const d = lanePath(l.points);
        const [ex, ey] = l.points[l.points.length - 1];
        const [sx, sy] = l.points[0];
        let extra = '';
        if (l.wraps) {
          // Arrow + caption at the map edge for the wrap-around connection.
          const dir = l.wraps === 'west' ? -1 : 1;
          const label = l.wraps === 'west' ? 'to Kamchatka' : 'to Alaska';
          extra = `<path d="M${ex},${ey} l${-dir * 7},-4 l0,8 Z" class="lane-arrow"/>
            <text x="${ex - dir * 10}" y="${ey + 16}" text-anchor="${dir < 0 ? 'start' : 'end'}" class="lane-caption">${label}</text>`;
        } else {
          extra = `<circle cx="${ex}" cy="${ey}" r="2.4" class="lane-dot"/>`;
        }
        return `<g class="lane" data-a="${l.a}" data-b="${l.b}">
          <path d="${d}" class="lane-under"/><path d="${d}" class="lane-line"/>
          <circle cx="${sx}" cy="${sy}" r="2.4" class="lane-dot"/>${extra}
        </g>`;
      })
      .join('');

    const badges = territories
      .map((t) => {
        const [x, y] = t.anchor;
        return `<g class="badge" data-id="${t.id}" data-x="${x}" data-y="${y}" transform="translate(${x},${y})">
          <g class="badge-inner">
            <use href="#fort"/>
            <circle r="10.2" class="badge-disc"/>
            <circle r="10.2" class="badge-shine"/>
            <text class="badge-num" y="4.6">–</text>
          </g>
        </g>`;
      })
      .join('');

    const labels = territories
      .map((t) => {
        const [x, y] = t.anchor;
        const lines = splitName(TERRITORIES.find((tt) => tt.id === t.id)!.name);
        const tspans = lines.map((l, i) => `<tspan x="0" dy="${i === 0 ? 0 : 11}">${esc(l)}</tspan>`).join('');
        return `<g class="t-label-g" data-x="${x}" data-y="${y}" transform="translate(${x},${y})"><text class="t-label" y="27">${tspans}</text></g>`;
      })
      .join('');

    const continentLabels = CONTINENT_LABELS.map(({ id, at, rotate }) => {
      const [x, y] = project(at);
      const c = CONTINENTS.find((cc) => cc.id === id)!;
      return `<g transform="translate(${x},${y}) rotate(${rotate})" style="color:${CONTINENT_COLORS[id]}">
        ${c.name
          .toUpperCase()
          .split(' ')
          .map((w, i, all) => `<text class="c-label" text-anchor="middle" y="${(i - (all.length - 1)) * 28}">${esc(w)}</text>`)
          .join('')}
        <text class="c-bonus" text-anchor="middle" y="17">✦ bonus +${c.bonus} ✦</text>
      </g>`;
    }).join('');

    const oceanLabels = OCEAN_LABELS.map(({ text, at, size, rotate = 0 }) => {
      const [x, y] = project(at);
      return `<text class="o-label ${size < 14 ? 'minor' : ''}" font-size="${size}" text-anchor="middle" transform="translate(${x},${y}) rotate(${rotate})">${esc(text)}</text>`;
    }).join('');

    // Portolan-style rhumb lines radiating from the compass roses.
    const rhumbs = (c: Point, n: number, len: number) =>
      Array.from({ length: n }, (_, i) => {
        const a = (i * 2 * Math.PI) / n;
        return `M${c[0]},${c[1]} L${(c[0] + Math.cos(a) * len).toFixed(0)},${(c[1] + Math.sin(a) * len).toFixed(0)}`;
      }).join(' ');
    const compassA = project([-128, -36]);
    const compassB = project([86, -42]);
    const cartouche = project([-30, -44]);

    // Graduated frame band (alternating light/dark every 10 degrees).
    const frameSegments: string[] = [];
    for (let lon = -170; lon < 194; lon += 10) {
      const [x1] = project([lon, 0]);
      const [x2] = project([Math.min(lon + 10, 194), 0]);
      if (Math.floor((lon + 170) / 10) % 2 === 0) {
        frameSegments.push(`<rect x="${x1}" y="${-FRAME}" width="${x2 - x1}" height="${FRAME / 2.6}"/>`);
        frameSegments.push(`<rect x="${x1}" y="${H + FRAME - FRAME / 2.6}" width="${x2 - x1}" height="${FRAME / 2.6}"/>`);
      }
    }
    for (let lat = 80; lat > -60; lat -= 10) {
      const [, y1] = project([0, lat]);
      const [, y2] = project([0, Math.max(lat - 10, -58)]);
      if (Math.floor((80 - lat) / 10) % 2 === 0) {
        frameSegments.push(`<rect x="${-FRAME}" y="${y1}" width="${FRAME / 2.6}" height="${y2 - y1}"/>`);
        frameSegments.push(`<rect x="${W + FRAME - FRAME / 2.6}" y="${y1}" width="${FRAME / 2.6}" height="${y2 - y1}"/>`);
      }
    }

    return `<svg class="world-map" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="World map with 42 territories">
      <defs>
        ${symbolDefs()}
        <radialGradient id="sea-grad" cx="50%" cy="45%" r="70%">
          <stop offset="0%" stop-color="#c6cdb3"/>
          <stop offset="100%" stop-color="${SEA}"/>
        </radialGradient>
        <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="3" result="b"/>
          <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
        ${clipPaths}${continentClips}
      </defs>
      <g id="viewport">
        <rect x="${-FRAME}" y="${-FRAME}" width="${W + FRAME * 2}" height="${H + FRAME * 2}" fill="url(#sea-grad)"/>
        <path class="rhumbs" d="${rhumbs(compassA, 32, 2600)} ${rhumbs(compassB, 16, 1400)}"/>
        <g class="waves">${waves}</g>

        <g class="coast">
          <path d="${this.data.landPath}" class="ripple w4"/>
          <path d="${this.data.landPath}" class="ripple-gap w4g"/>
          <path d="${this.data.landPath}" class="ripple w3"/>
          <path d="${this.data.landPath}" class="ripple-gap w3g"/>
          <path d="${this.data.landPath}" class="ripple w2"/>
          <path d="${this.data.landPath}" class="ripple-gap w2g"/>
          <path d="${this.data.landPath}" class="ripple w1"/>
        </g>
        <path d="${this.data.landPath}" class="land"/>
        <g class="tints">${tints}</g>
        <g class="continent-rims">${continentRims}</g>
        <g class="decor">${glyphs.map((g) => g[1]).join('')}</g>
        <g class="borders">${borders}</g>
        <path d="${this.data.landPath}" class="coastline"/>

        <g class="sea-labels">${oceanLabels}</g>
        <g class="continent-labels">${continentLabels}</g>
        <g transform="translate(${compassA[0]},${compassA[1]})" class="compass">${compassRose(62)}</g>
        <g transform="translate(${compassB[0]},${compassB[1]}) rotate(-8)" class="compass">${compassRose(36)}</g>
        ${this.cartouche(cartouche)}

        <g class="lanes">${lanes}</g>
        <g class="hits">${hits}</g>
        <g class="badges">${badges}</g>
        <g class="labels">${labels}</g>

        <image id="paper" x="${-FRAME}" y="${-FRAME}" width="${W + FRAME * 2}" height="${H + FRAME * 2}" preserveAspectRatio="none"/>
        <g class="frame">
          <rect x="${-FRAME}" y="${-FRAME}" width="${W + FRAME * 2}" height="${H + FRAME * 2}" class="frame-outer"/>
          <rect x="0" y="0" width="${W}" height="${H}" class="frame-inner"/>
          <g class="frame-ticks">${frameSegments.join('')}</g>
        </g>
      </g>
    </svg>`;
  }

  private cartouche([x, y]: Point): string {
    // Unrolled scroll banner with the working title.
    return `<g class="cartouche" transform="translate(${x},${y})">
      <path d="M-120,-30 C-60,-38 60,-38 120,-30 L120,22 C60,14 -60,14 -120,22 Z" fill="#efe0bb" stroke="${INK}" stroke-width="1.4"/>
      <path d="M-120,-30 C-134,-30 -138,-14 -128,-8 C-122,-4 -116,-10 -120,-16" fill="#d9c597" stroke="${INK}" stroke-width="1.2"/>
      <path d="M120,22 C134,22 138,6 128,0 C122,-4 116,2 120,8" fill="#d9c597" stroke="${INK}" stroke-width="1.2"/>
      <path d="M-108,-22 C-55,-29 55,-29 108,-22 M-108,14 C-55,7 55,7 108,14" fill="none" stroke="${INK}" stroke-width=".6" opacity=".6"/>
      <text class="cartouche-title" text-anchor="middle" y="-2">Conquest</text>
      <text class="cartouche-sub" text-anchor="middle" y="11">A Chart of the Known World</text>
    </g>`;
  }
}
