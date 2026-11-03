/**
 * App entry: mounts the map, HUD controls, legend and the info card.
 * Fonts come from the Google Fonts CDN (see index.html).
 */
import './style.css';

import { CONTINENTS, TERRITORIES, type TerritoryId } from './data/world';
import { generateDemo, type DemoState } from './demo';
import mapData from './map/generated/map.json';
import { CONTINENT_COLORS, WorldMapView, type TerritoryState } from './map/renderer';
import type { GeneratedMap } from './map/types';
import { InfoCard } from './ui/infoCard';

const app = document.querySelector<HTMLDivElement>('#app')!;
app.innerHTML = `
  <div class="stage"></div>
  <div class="vignette"></div>

  <header class="brand panel">
    <div class="brand-mark" aria-hidden="true">
      <svg viewBox="-20 -20 40 40"><circle r="17" fill="none" stroke="currentColor" stroke-width="2"/>
        <path d="M0,-15 L4,0 L0,15 L-4,0 Z" fill="currentColor"/><path d="M-15,0 L0,4 L15,0 L0,-4 Z" fill="currentColor" opacity=".55"/></svg>
    </div>
    <div>
      <h1>Conquest</h1>
      <p>World board · 42 territories · 6 continents</p>
    </div>
  </header>

  <section class="controls panel" aria-label="Board options">
    <label class="switch">
      <input type="checkbox" id="demo-toggle" />
      <span class="switch-track"><span class="switch-thumb"></span></span>
      <span>Demo game</span>
    </label>
    <div class="segmented" role="radiogroup" aria-label="Players">
      ${[2, 3, 4].map((n) => `<button data-players="${n}" role="radio" aria-checked="${n === 3}" class="${n === 3 ? 'active' : ''}">${n}P</button>`).join('')}
    </div>
    <button class="btn" id="reshuffle" title="Deal a new random game">Reshuffle</button>
  </section>

  <section class="legend panel" aria-label="Legend"></section>

  <nav class="zoom panel" aria-label="Zoom">
    <button data-zoom="in" aria-label="Zoom in">+</button>
    <button data-zoom="out" aria-label="Zoom out">−</button>
    <button data-zoom="fit" aria-label="Fit map" title="Fit map">⤢</button>
  </nav>

  <p class="hint">Drag to pan · scroll or pinch to zoom · tap a territory</p>
`;

const stage = app.querySelector<HTMLDivElement>('.stage')!;
const legend = app.querySelector<HTMLElement>('.legend')!;
const demoToggle = app.querySelector<HTMLInputElement>('#demo-toggle')!;
const segmented = app.querySelector<HTMLElement>('.segmented')!;
const reshuffle = app.querySelector<HTMLButtonElement>('#reshuffle')!;

let demo: DemoState | null = null;
let playerCount = 3;
let selected: TerritoryId | null = null;

const map = new WorldMapView(stage, mapData as GeneratedMap, {
  onSelect: (id) => {
    selected = id;
    card.show(id, demo);
  },
});

const card = new InfoCard(app, {
  onClose: () => map.select(null),
  onNeighbourHover: (id) => map.preview(id),
  onNeighbourClick: (id) => map.select(id, true),
});

function applyDemo(): void {
  if (demo) {
    const state = new Map<TerritoryId, TerritoryState>();
    for (const t of TERRITORIES) {
      state.set(t.id, { color: demo.players[demo.owner.get(t.id)!].color, armies: demo.armies.get(t.id)! });
    }
    map.setOwnership(state);
  } else {
    map.setOwnership(null);
  }
  app.classList.toggle('is-demo', !!demo);
  segmented.querySelectorAll('button').forEach((b) => (b.disabled = !demo));
  reshuffle.disabled = !demo;
  renderLegend();
  card.show(selected, demo);
}

function renderLegend(): void {
  if (demo) {
    const d = demo;
    const rows = d.players
      .map((p) => {
        const owned = TERRITORIES.filter((t) => d.owner.get(t.id) === p.id);
        const armies = owned.reduce((s, t) => s + d.armies.get(t.id)!, 0);
        return `<li><span class="dot" style="background:${p.color}"></span><b>${p.name}</b>
          <span class="muted">${owned.length} terr. · ${armies} armies</span></li>`;
      })
      .join('');
    legend.innerHTML = `<h3>Players</h3><ul>${rows}</ul>`;
  } else {
    const rows = CONTINENTS.map(
      (c) => `<li><span class="dot" style="background:${CONTINENT_COLORS[c.id]}"></span>${c.name}
        <span class="muted">+${c.bonus}</span></li>`,
    ).join('');
    legend.innerHTML = `<h3>Continents</h3><ul>${rows}</ul>`;
  }
}

demoToggle.addEventListener('change', () => {
  demo = demoToggle.checked ? generateDemo(playerCount) : null;
  applyDemo();
});
segmented.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('button[data-players]');
  if (!btn || !demo) return;
  playerCount = Number(btn.dataset.players);
  segmented.querySelectorAll('button').forEach((b) => {
    b.classList.toggle('active', b === btn);
    b.setAttribute('aria-checked', String(b === btn));
  });
  demo = generateDemo(playerCount);
  applyDemo();
});
reshuffle.addEventListener('click', () => {
  demo = generateDemo(playerCount);
  applyDemo();
});
app.querySelector('.zoom')!.addEventListener('click', (e) => {
  const z = (e.target as HTMLElement).closest<HTMLButtonElement>('button')?.dataset.zoom;
  if (z === 'in') map.panZoom.zoomBy(1.5);
  if (z === 'out') map.panZoom.zoomBy(1 / 1.5);
  if (z === 'fit') map.panZoom.fit();
});
window.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') map.select(null);
});

// URL flags make it easy to share / screenshot a given state: ?demo=4&zoom=europe
const params = new URLSearchParams(location.search);
if (params.has('demo')) {
  playerCount = Math.min(4, Math.max(2, Number(params.get('demo')) || 3));
  demoToggle.checked = true;
  segmented.querySelectorAll('button').forEach((b) => b.classList.toggle('active', b.dataset.players === String(playerCount)));
  demo = generateDemo(playerCount);
}
applyDemo();
const focus = params.get('focus') as TerritoryId | null;
if (focus && TERRITORIES.some((t) => t.id === focus)) {
  const t = (mapData as GeneratedMap).territories.find((x) => x.id === focus)!;
  map.panZoom.focusOn(t.anchor[0], t.anchor[1], Number(params.get('zoom')) || 2.4, false);
  if (params.has('select')) map.select(focus);
}
