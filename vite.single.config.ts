/**
 * Self-contained single-file build (all JS, CSS, fonts and images inlined
 * into one index.html). Used by `npm run build:single`; the normal build is
 * configured in vite.config.ts and stays unchanged.
 */
import { readFileSync } from 'node:fs';
import { defineConfig, type Plugin } from 'vite';
import { viteSingleFile } from 'vite-plugin-singlefile';

/** Files in public/ are copied, not bundled, so the favicon is inlined by hand. */
function inlineFavicon(): Plugin {
  return {
    name: 'inline-favicon',
    transformIndexHtml(html) {
      const svg = readFileSync(new URL('./public/favicon.svg', import.meta.url), 'utf8');
      const dataUrl = `data:image/svg+xml,${encodeURIComponent(svg.trim())}`;
      return html.replace(/href="[^"]*favicon\.svg"/, `href="${dataUrl}"`);
    },
  };
}

export default defineConfig({
  base: './',
  plugins: [inlineFavicon(), viteSingleFile()],
  // Don't copy public/ next to the single file; everything lives inside it.
  publicDir: false,
  build: {
    outDir: 'dist-single',
    // Inline every asset (fonts) as a data URL.
    assetsInlineLimit: Number.MAX_SAFE_INTEGER,
  },
});
