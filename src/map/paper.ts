/**
 * Generates an aged-paper texture (grain, fibres, tea stains) on a canvas and
 * returns it as a data URL. Rendered once at startup and laid over the map
 * with `mix-blend-mode: multiply`, so it moves with pan/zoom at no extra cost.
 */
import { fbm, mulberry32 } from './noise';

export function paperTexture(width = 1400, height = 700): string {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  const img = ctx.createImageData(width, height);
  const rnd = mulberry32(7);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      // Large soft blotches (stains) + medium cloudiness + fine grain.
      const stain = fbm(x / 260, y / 260, 3);
      const cloud = fbm(x / 40 + 100, y / 40, 3);
      const grain = rnd();
      let v = 255 - (stain - 0.45) * 60 - (cloud - 0.5) * 22 - grain * 14;
      v = Math.max(170, Math.min(255, v));
      const i = (y * width + x) * 4;
      // Slightly warm (sepia) multiply colour.
      img.data[i] = v;
      img.data[i + 1] = v * 0.97;
      img.data[i + 2] = v * 0.9;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);

  // A few faint paper fibres.
  ctx.globalAlpha = 0.06;
  ctx.strokeStyle = '#5a4026';
  for (let i = 0; i < 260; i++) {
    const x = rnd() * width;
    const y = rnd() * height;
    const a = rnd() * Math.PI;
    const l = 4 + rnd() * 14;
    ctx.lineWidth = 0.5 + rnd();
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.quadraticCurveTo(x + Math.cos(a) * l * 0.5 + rnd() * 3, y + Math.sin(a) * l * 0.5, x + Math.cos(a) * l, y + Math.sin(a) * l);
    ctx.stroke();
  }
  return canvas.toDataURL('image/jpeg', 0.85);
}
