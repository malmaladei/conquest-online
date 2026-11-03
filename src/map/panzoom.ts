/**
 * Minimal pan & zoom controller.
 * Supports mouse drag, wheel zoom (around the cursor), touch drag and pinch.
 * Distinguishes clicks from drags so territory selection still works.
 *
 * Performance notes:
 *  - The view is applied as ONE CSS transform on a wrapper element whose
 *    children are GPU-composited layers, so a pan/zoom frame is a cheap
 *    compositor update instead of an SVG repaint.
 *  - Input events only update the in-memory view; the DOM write is batched
 *    into a single requestAnimationFrame per frame.
 *  - `onSettle` fires once the view has been still for a moment, so callers
 *    can do the expensive work (re-raster at the new zoom, level of detail)
 *    when the user isn't interacting.
 */

export interface View {
  x: number;
  y: number;
  k: number;
}

export interface PanZoomOptions {
  /** Element that receives input and defines the viewport size. */
  surface: HTMLElement;
  /** Element that gets the CSS transform. */
  target: HTMLElement;
  contentWidth: number;
  contentHeight: number;
  /** Extra margin (content units) around the content that may be shown. */
  margin: number;
  maxZoom: number;
  /** Called (inside rAF) whenever the applied view changes. Keep it cheap. */
  onChange?: (view: View) => void;
  /** Called once the view has stopped changing for SETTLE_MS. */
  onSettle?: (view: View) => void;
}

const SETTLE_MS = 160;

export class PanZoom {
  private view: View = { x: 0, y: 0, k: 1 };
  private minK = 0.1;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart: { dist: number; k: number; cx: number; cy: number; vx: number; vy: number } | null = null;
  private dragStart: { x: number; y: number; vx: number; vy: number } | null = null;
  /** Total pointer travel of the current gesture; used to suppress clicks after drags. */
  private travel = 0;
  private animFrame = 0;
  private writeFrame = 0;
  private settleTimer = 0;
  /** Cached viewport size (avoids forced layout on every input event). */
  private size = { width: 0, height: 0, left: 0, top: 0 };
  private opts: PanZoomOptions;

  constructor(opts: PanZoomOptions) {
    this.opts = opts;
    const { surface } = opts;
    this.measure();
    surface.addEventListener('wheel', this.onWheel, { passive: false });
    surface.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove, { passive: true });
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerUp);
    // Swallow the click that ends a drag so it doesn't select a territory.
    surface.addEventListener(
      'click',
      (e) => {
        if (this.travel > 6) {
          e.stopPropagation();
          e.preventDefault();
        }
      },
      true,
    );
    window.addEventListener('resize', () => {
      this.measure();
      this.fit(false);
    });
  }

  get current(): View {
    return { ...this.view };
  }

  /** True while the user is actively dragging/pinching. */
  get isGesturing(): boolean {
    return this.travel > 6 && this.pointers.size > 0;
  }

  /** Fit the whole content into the viewport. */
  fit(animate = true): void {
    const { width, height } = this.size;
    const { contentWidth: cw, contentHeight: ch, margin } = this.opts;
    const k = Math.min(width / (cw + margin * 2), height / (ch + margin * 2));
    this.minK = k * 0.9;
    this.setView({ k, x: (width - cw * k) / 2, y: (height - ch * k) / 2 }, animate);
  }

  /** Zoom by a factor around a screen point (defaults to viewport centre). */
  zoomBy(factor: number, sx?: number, sy?: number, animate = true): void {
    const cx = sx ?? this.size.width / 2;
    const cy = sy ?? this.size.height / 2;
    const k = this.clampK(this.view.k * factor);
    const f = k / this.view.k;
    this.setView({ k, x: cx - (cx - this.view.x) * f, y: cy - (cy - this.view.y) * f }, animate);
  }

  /** Centre the view on a content point at a given zoom. */
  focusOn(px: number, py: number, k: number, animate = true): void {
    const kk = this.clampK(k);
    this.setView({ k: kk, x: this.size.width / 2 - px * kk, y: this.size.height / 2 - py * kk }, animate);
  }

  private measure(): void {
    const r = this.opts.surface.getBoundingClientRect();
    this.size = { width: r.width, height: r.height, left: r.left, top: r.top };
  }

  private clampK(k: number): number {
    return Math.max(this.minK, Math.min(this.opts.maxZoom, k));
  }

  /** Keep at least part of the map on screen. */
  private clampXY(v: View): View {
    const { contentWidth: cw, contentHeight: ch, margin } = this.opts;
    const m = margin * v.k;
    const clampAxis = (pos: number, content: number, viewport: number) => {
      const size = content * v.k;
      // Content (plus margin) fits: keep it centred.
      if (size + 2 * m <= viewport) return (viewport - size) / 2;
      return Math.max(viewport - size - m, Math.min(m, pos));
    };
    return { k: v.k, x: clampAxis(v.x, cw, this.size.width), y: clampAxis(v.y, ch, this.size.height) };
  }

  private setView(v: View, animate: boolean): void {
    const target = this.clampXY(v);
    cancelAnimationFrame(this.animFrame);
    if (!animate) {
      this.apply(target);
      return;
    }
    const from = { ...this.view };
    const start = performance.now();
    const dur = 320;
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      this.apply({
        k: from.k + (target.k - from.k) * e,
        x: from.x + (target.x - from.x) * e,
        y: from.y + (target.y - from.y) * e,
      });
      if (t < 1) this.animFrame = requestAnimationFrame(step);
    };
    this.animFrame = requestAnimationFrame(step);
  }

  /** Update the view in memory and schedule a single DOM write for this frame. */
  private apply(v: View): void {
    this.view = v;
    if (!this.writeFrame) this.writeFrame = requestAnimationFrame(this.write);
    clearTimeout(this.settleTimer);
    this.settleTimer = window.setTimeout(() => {
      if (this.pointers.size === 0) this.opts.onSettle?.(this.current);
      // While a finger/mouse is still down, settle once it is released (see onPointerUp).
    }, SETTLE_MS);
  }

  private write = () => {
    this.writeFrame = 0;
    const v = this.view;
    this.opts.target.style.transform = `translate3d(${v.x.toFixed(2)}px,${v.y.toFixed(2)}px,0) scale(${v.k.toFixed(4)})`;
    this.opts.onChange?.(v);
  };

  private localPoint(e: { clientX: number; clientY: number }) {
    return { x: e.clientX - this.size.left, y: e.clientY - this.size.top };
  }

  private onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const p = this.localPoint(e);
    // Trackpad pinch arrives as ctrl+wheel with small deltas.
    const intensity = e.ctrlKey ? 0.012 : 0.0018;
    const factor = Math.exp(-e.deltaY * intensity);
    cancelAnimationFrame(this.animFrame);
    const k = this.clampK(this.view.k * factor);
    const f = k / this.view.k;
    this.apply(this.clampXY({ k, x: p.x - (p.x - this.view.x) * f, y: p.y - (p.y - this.view.y) * f }));
  };

  private onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    cancelAnimationFrame(this.animFrame);
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);
    if (this.pointers.size === 1) {
      this.travel = 0;
      this.dragStart = { x: p.x, y: p.y, vx: this.view.x, vy: this.view.y };
    } else if (this.pointers.size === 2) {
      const [a, b] = [...this.pointers.values()];
      this.pinchStart = {
        dist: Math.hypot(a.x - b.x, a.y - b.y),
        k: this.view.k,
        cx: (a.x + b.x) / 2,
        cy: (a.y + b.y) / 2,
        vx: this.view.x,
        vy: this.view.y,
      };
      this.travel = 100;
    }
  };

  private onPointerMove = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    const p = this.localPoint(e);
    this.pointers.set(e.pointerId, p);

    if (this.pointers.size >= 2 && this.pinchStart) {
      const [a, b] = [...this.pointers.values()];
      const dist = Math.hypot(a.x - b.x, a.y - b.y);
      const cx = (a.x + b.x) / 2;
      const cy = (a.y + b.y) / 2;
      const s = this.pinchStart;
      const k = this.clampK(s.k * (dist / s.dist));
      const f = k / s.k;
      this.apply(this.clampXY({ k, x: cx - (s.cx - s.vx) * f, y: cy - (s.cy - s.vy) * f }));
      return;
    }
    if (this.dragStart) {
      const dx = p.x - this.dragStart.x;
      const dy = p.y - this.dragStart.y;
      this.travel = Math.max(this.travel, Math.hypot(dx, dy));
      if (this.travel > 6) {
        if (!this.opts.surface.classList.contains('is-dragging')) this.opts.surface.classList.add('is-dragging');
        this.apply(this.clampXY({ k: this.view.k, x: this.dragStart.vx + dx, y: this.dragStart.vy + dy }));
      }
    }
  };

  private onPointerUp = (e: PointerEvent) => {
    if (!this.pointers.has(e.pointerId)) return;
    this.pointers.delete(e.pointerId);
    if (this.pointers.size < 2) this.pinchStart = null;
    if (this.pointers.size === 1) {
      // Continue as a drag with the remaining finger.
      const [p] = [...this.pointers.values()];
      this.dragStart = { x: p.x, y: p.y, vx: this.view.x, vy: this.view.y };
    }
    if (this.pointers.size === 0) {
      this.dragStart = null;
      this.opts.surface.classList.remove('is-dragging');
      if (this.travel > 6) {
        clearTimeout(this.settleTimer);
        this.settleTimer = window.setTimeout(() => this.opts.onSettle?.(this.current), SETTLE_MS);
      }
      // Reset travel after the click event of this gesture has fired.
      setTimeout(() => (this.travel = 0), 0);
    }
  };
}
