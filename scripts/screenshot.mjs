// Headless screenshots of the running dev server: node scripts/screenshot.mjs <url> <out.png> [width] [height]
import puppeteer from 'puppeteer-core';
const [url, out, w = '1600', h = '900'] = process.argv.slice(2);
const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH ?? '/usr/local/bin/google-chrome', args: ['--no-sandbox'] });
const page = await browser.newPage();
await page.setViewport({ width: Number(w), height: Number(h), deviceScaleFactor: Number(process.env.DSF ?? 1) });
page.on('console', (m) => console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(url, { waitUntil: 'networkidle0' });
await new Promise((r) => setTimeout(r, 1500));
if (process.env.HOVER) {
  const el = await page.$(`.badge[data-id="${process.env.HOVER}"] .badge-disc`);
  const box = await el.boundingBox();
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await new Promise((r) => setTimeout(r, 500));
}
const clip = process.env.CLIP?.split(',').map(Number);
await page.screenshot({ path: out, ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : {}) });
await browser.close();
