/**
 * Frame-time benchmark for the map: scripted pan, wheel zoom and hover sweep,
 * driven from inside the page (one synthetic input event per animation frame)
 * so the measurement isn't limited by DevTools round-trips.
 *
 * Usage: node scripts/bench.mjs <url> [cpuThrottle=4] [width=1440] [height=860]
 */
import puppeteer from 'puppeteer-core';

const [url = 'http://localhost:4401/', throttle = '4', w = '1440', h = '860'] = process.argv.slice(2);
const browser = await puppeteer.launch({
  executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome',
  args: ['--no-sandbox', '--enable-gpu-rasterization', '--ignore-gpu-blocklist'],
});
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h) });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 2500));
if (process.env.HIDE) await page.addStyleTag({ content: `${process.env.HIDE} { display: none !important; }` });
if (process.env.ONLY) {
  const keep = process.env.ONLY.split(',');
  await page.evaluate((keep) => {
    for (const el of document.querySelectorAll('#viewport > *')) if (!keep.some((k) => el.matches(k))) el.style.display = 'none';
  }, keep);
}
const cdp = await page.createCDPSession();
await cdp.send('Emulation.setCPUThrottlingRate', { rate: Number(throttle) });

if (process.env.TRACE) await page.tracing.start({ path: process.env.TRACE, categories: ['devtools.timeline', 'disabled-by-default-devtools.timeline', 'cc', 'viz'] });
const result = await page.evaluate(async (PHASES) => {
  const stage = document.querySelector('.stage');
  // Dispatch on the element under the centre so events bubble through whatever renders the map.
  const svg = document.elementFromPoint(stage.clientWidth / 2, stage.clientHeight / 2);
  const rect = stage.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;
  const nextFrame = () => new Promise((r) => requestAnimationFrame(r));

  /** Run `step(i)` once per frame for n frames; return frame intervals. */
  async function measure(n, step) {
    const times = [];
    let last = await nextFrame();
    for (let i = 0; i < n; i++) {
      step(i);
      const t = await nextFrame();
      times.push(t - last);
      last = t;
    }
    return times;
  }
  const pe = (type, x, y, target = svg) =>
    target.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1, pointerType: 'mouse', button: 0, buttons: 1, isPrimary: true }));

  // Zoom in first (unmeasured) so panning actually moves the map.
  for (let i = 0; i < 12; i++) {
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx, clientY: cy, deltaY: -60 }));
    await nextFrame();
  }
  await new Promise((r) => setTimeout(r, 800));

  // Pan: drag in a circle-ish path.
  pe('pointerdown', cx, cy);
  const pan = await measure(PHASES.includes('pan') ? 150 : 1, (i) => {
    const a = i / 20;
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: cx + Math.sin(a) * 300, clientY: cy + Math.cos(a) * 160 - 160, pointerId: 1, pointerType: 'mouse', buttons: 1 }));
  });
  window.dispatchEvent(new PointerEvent('pointerup', { clientX: cx, clientY: cy, pointerId: 1, pointerType: 'mouse' }));
  await new Promise((r) => setTimeout(r, 400));

  // Zoom: wheel in then out around the centre.
  const zoom = await measure(PHASES.includes('zoom') ? 150 : 1, (i) => {
    const deltaY = i < 75 ? -60 : 60;
    svg.dispatchEvent(new WheelEvent('wheel', { bubbles: true, cancelable: true, clientX: cx + 120, clientY: cy - 60, deltaY }));
  });
  await new Promise((r) => setTimeout(r, 400));

  // Hover: sweep the pointer across the map so the hovered territory changes often.
  const hover = await measure(150, (i) => {
    const x = rect.left + 40 + ((i * 37) % (rect.width - 80));
    const y = rect.top + 120 + ((i * 53) % (rect.height - 240));
    const el = document.elementFromPoint(x, y);
    if (el) {
      el.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
      el.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, clientX: x, clientY: y, pointerType: 'mouse' }));
    }
  });
  return { pan, zoom, hover, nodes: document.getElementsByTagName('*').length };
}, process.env.PHASES ?? 'pan,zoom,hover');

if (process.env.TRACE) await page.tracing.stop();
const stats = (arr) => {
  const s = [...arr].sort((a, b) => a - b);
  const avg = s.reduce((a, b) => a + b, 0) / s.length;
  const p = (q) => s[Math.min(s.length - 1, Math.floor(q * s.length))];
  return {
    fps: +(1000 / avg).toFixed(1),
    avgMs: +avg.toFixed(1),
    p50: +p(0.5).toFixed(1),
    p95: +p(0.95).toFixed(1),
    max: +s[s.length - 1].toFixed(1),
    over33: `${((s.filter((x) => x > 33.4).length / s.length) * 100).toFixed(0)}%`,
  };
};
console.log(`[${process.env.HIDE ?? process.env.ONLY ?? 'all'}] url=${url} cpuThrottle=${throttle}x viewport=${w}x${h} domNodes=${result.nodes}`);
for (const k of (process.env.PHASES ?? 'pan,zoom,hover').split(',')) console.log(k.padEnd(6), JSON.stringify(stats(result[k])));
await browser.close();
