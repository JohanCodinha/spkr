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
      '__EDITOR__': 'false' // Editor is now loaded separately
    },
    loader: { '.svg': 'text' },
    write: false,
  })).outputFiles[0].text;

  // Bundle editor JS separately (only in editor mode)
  let editorJs = '';
  if (isEditor) {
    editorJs = (await esbuild.build({
      entryPoints: [join(srcDir, 'card-hand-logo-editor.js')],
      bundle: true,
      minify: false,
      format: 'esm',
      loader: { '.svg': 'text' },
      write: false,
    })).outputFiles[0].text;
  }

  // Minify CSS (concatenate fonts + styles, then minify)
  const fontsCSS = readFileSync(join(srcDir, 'fonts.css'), 'utf-8');
  const stylesCSS = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
  const css = (await esbuild.transform(fontsCSS + stylesCSS, { loader: 'css', minify: !isDebug })).code;

  // Read the pre-compiled logo SVG
  const logoSVG = readFileSync(join(srcDir, 'card-hand-logo.svg'), 'utf-8');

  // Build HTML using cheerio for robust DOM manipulation
  const $ = load(readFileSync(join(srcDir, 'index.html'), 'utf-8'));

  // Inline CSS (fonts.css + styles.css combined)
  $('link[href="fonts.css"]').remove();
  $('link[href="styles.css"]').replaceWith(`<style>${css}</style>`);

  // Replace <card-hand-logo> with a placeholder that won't be lowercased
  // (cheerio lowercases SVG element names like feDropShadow, breaking filters)
  $('card-hand-logo').replaceWith('<div class="lobby-logo">__LOGO_SVG_PLACEHOLDER__</div>');

  // Inline JS - find the entry script comment and replace with script tag
  $('body').append(`<script type="module">${js}</script>`);

  // Add editor script if in editor mode
  if (isEditor) {
    $('body').append(`<script type="module">${editorJs}</script>`);
  }

  // Remove the placeholder comment
  $('body').contents().filter(function() {
    return this.type === 'comment' && this.data.trim() === 'ENTRY_SCRIPT';
  }).remove();

  // Get HTML and replace the SVG placeholder with actual SVG
  // (done as string replacement to preserve SVG element case like feDropShadow)
  const html = $.html().replace('__LOGO_SVG_PLACEHOLDER__', logoSVG);

  writeFileSync(join(publicDir, 'index.html'), html);
}

build().catch(err => { console.error(err); process.exit(1); });
