/**
 * Parchment info card for the selected territory: name, continent,
 * neighbours (land vs. sea) and, in demo mode, owner + armies.
 */
import {
  BORDERS,
  CONTINENT_BY_ID,
  NEIGHBOURS,
  TERRITORY_BY_ID,
  type TerritoryId,
} from '../data/world';
import type { DemoState } from '../demo';
import { CONTINENT_COLORS } from '../map/renderer';

export interface InfoCardHandlers {
  onClose: () => void;
  onNeighbourHover: (id: TerritoryId | null) => void;
  onNeighbourClick: (id: TerritoryId) => void;
}

const isSeaBorder = (a: TerritoryId, b: TerritoryId) =>
  BORDERS.some((x) => x.kind === 'sea' && ((x.a === a && x.b === b) || (x.a === b && x.b === a)));

export class InfoCard {
  readonly el: HTMLElement;

  constructor(parent: HTMLElement, private handlers: InfoCardHandlers) {
    this.el = document.createElement('aside');
    this.el.className = 'info-card panel';
    this.el.setAttribute('aria-live', 'polite');
    parent.appendChild(this.el);

    this.el.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.info-close')) this.handlers.onClose();
      const chip = target.closest<HTMLElement>('[data-neighbour]');
      if (chip) this.handlers.onNeighbourClick(chip.dataset.neighbour as TerritoryId);
    });
    this.el.addEventListener('pointerover', (e) => {
      const chip = (e.target as HTMLElement).closest<HTMLElement>('[data-neighbour]');
      this.handlers.onNeighbourHover((chip?.dataset.neighbour as TerritoryId) ?? null);
    });
    this.el.addEventListener('pointerleave', () => this.handlers.onNeighbourHover(null));
  }

  show(id: TerritoryId | null, demo: DemoState | null): void {
    if (!id) {
      this.el.classList.remove('open');
      return;
    }
    const t = TERRITORY_BY_ID.get(id)!;
    const c = CONTINENT_BY_ID.get(t.continent)!;
    const neighbours = [...NEIGHBOURS.get(id)!].sort((a, b) =>
      TERRITORY_BY_ID.get(a)!.name.localeCompare(TERRITORY_BY_ID.get(b)!.name),
    );

    const ownerRow = demo
      ? (() => {
          const p = demo.players[demo.owner.get(id)!];
          return `<div class="info-owner">
            <span class="dot" style="background:${p.color}"></span>
            <span>Held by <b>${p.name}</b></span>
            <span class="info-armies" style="background:${p.color}">${demo.armies.get(id)}</span>
          </div>`;
        })()
      : `<div class="info-owner muted">Unclaimed — start a demo game to see owners.</div>`;

    const chips = neighbours
      .map((n) => {
        const nt = TERRITORY_BY_ID.get(n)!;
        const sea = isSeaBorder(id, n);
        const ownerColor = demo ? demo.players[demo.owner.get(n)!].color : CONTINENT_COLORS[nt.continent];
        return `<button class="chip" data-neighbour="${n}" title="${sea ? 'Connected by sea lane' : 'Shared land border'}">
          <span class="dot" style="background:${ownerColor}"></span>${nt.name}${sea ? '<span class="sea-mark" aria-label="by sea">≈</span>' : ''}
        </button>`;
      })
      .join('');

    this.el.innerHTML = `
      <button class="info-close" aria-label="Close">×</button>
      <div class="info-continent" style="--c:${CONTINENT_COLORS[c.id]}">
        <span class="dot"></span>${c.name} <span class="muted">· continent bonus +${c.bonus}</span>
      </div>
      <h2 class="info-title">${t.name}</h2>
      ${ownerRow}
      <div class="info-section">Borders ${neighbours.length} territories</div>
      <div class="chips">${chips}</div>
      <div class="info-foot muted">≈ connected across the sea</div>`;
    this.el.classList.add('open');
  }
}
