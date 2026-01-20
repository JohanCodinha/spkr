import esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { load } from 'cheerio';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const publicDir = join(__dirname, 'public');

// Check for build mode via environment variables
const isDebug = process.env.DEBUG === 'true';
const isEditor = process.env.EDITOR === 'true';

async function build() {
  mkdirSync(publicDir, { recursive: true });

  // Bundle and minify JS
  // Use ESM format to preserve the external Trystero import from esm.sh
  // __DEBUG__ controls whether test hooks/mocks are included
  const js = (await esbuild.build({
    entryPoints: [join(srcDir, 'game.js')],
    bundle: true,
    minify: !isDebug,
    format: 'esm',
    external: ['https://esm.sh/*'],
    define: {
      '__DEBUG__': isDebug ? 'true' : 'false',
      '__EDITOR__': isEditor ? 'true' : 'false'
    },
    loader: { '.svg': 'text' },
    write: false,
  })).outputFiles[0].text;

  // Minify CSS (concatenate fonts + styles, then minify)
  const fontsCSS = readFileSync(join(srcDir, 'fonts.css'), 'utf-8');
  const stylesCSS = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
  const css = (await esbuild.transform(fontsCSS + stylesCSS, { loader: 'css', minify: true })).code;

  // Build HTML using cheerio for robust DOM manipulation
  const $ = load(readFileSync(join(srcDir, 'index.html'), 'utf-8'));

  // Inline CSS (fonts.css + styles.css combined)
  $('link[href="fonts.css"]').remove();
  $('link[href="styles.css"]').replaceWith(`<style>${css}</style>`);

  // Inline JS - find the entry script comment and replace with script tag
  $('body').append(`<script type="module">${js}</script>`);
  // Remove the placeholder comment
  $('body').contents().filter(function() {
    return this.type === 'comment' && this.data.trim() === 'ENTRY_SCRIPT';
  }).remove();

  writeFileSync(join(publicDir, 'index.html'), $.html());

  // Note: The logo editor is now self-contained in the component.
  // No need to copy card-hand-editor.html - it's only kept for standalone use.
}

build().catch(err => { console.error(err); process.exit(1); });
