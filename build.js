import esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const publicDir = join(__dirname, 'public');

// Check for debug mode via environment variable
const isDebug = process.env.DEBUG === 'true';

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
    define: { '__DEBUG__': isDebug ? 'true' : 'false' },
    write: false,
  })).outputFiles[0].text;

  // Minify CSS
  const css = (await esbuild.transform(
    readFileSync(join(srcDir, 'styles.css'), 'utf-8'),
    { loader: 'css', minify: true }
  )).code;

  // URL-encode SVG (more efficient than base64 for text)
  const svg = readFileSync(join(srcDir, 'logo.svg'), 'utf-8')
    .replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23')
    .replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s+/g, ' ');

  // Build HTML
  // Note: Use function replacer to avoid $& special pattern in replacement string
  const html = readFileSync(join(srcDir, 'index.html'), 'utf-8')
    .replace(/<link rel="stylesheet" href="styles\.css">/, () => `<style>${css}</style>`)
    .replace(/src="logo\.svg"/g, () => `src="data:image/svg+xml,${svg}"`)
    .replace(/<script type="module" src="game\.js"><\/script>/, () => `<script type="module">${js}</script>`);

  writeFileSync(join(publicDir, 'index.html'), html);
}

build().catch(err => { console.error(err); process.exit(1); });
