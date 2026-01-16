const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const srcDir = path.join(__dirname, 'src');
const publicDir = path.join(__dirname, 'public');

async function build() {
  fs.mkdirSync(publicDir, { recursive: true });

  // Bundle and minify JS
  const js = (await esbuild.build({
    entryPoints: [path.join(srcDir, 'game.js')],
    bundle: true,
    minify: true,
    format: 'iife',
    write: false,
  })).outputFiles[0].text;

  // Minify CSS
  const css = (await esbuild.transform(
    fs.readFileSync(path.join(srcDir, 'styles.css'), 'utf-8'),
    { loader: 'css', minify: true }
  )).code;

  // URL-encode SVG (more efficient than base64 for text)
  const svg = fs.readFileSync(path.join(srcDir, 'logo.svg'), 'utf-8')
    .replace(/"/g, "'").replace(/%/g, '%25').replace(/#/g, '%23')
    .replace(/</g, '%3C').replace(/>/g, '%3E').replace(/\s+/g, ' ');

  // Build HTML
  const html = fs.readFileSync(path.join(srcDir, 'index.html'), 'utf-8')
    .replace(/<link rel="stylesheet" href="styles\.css">/, `<style>${css}</style>`)
    .replace(/src="logo\.svg"/g, `src="data:image/svg+xml,${svg}"`)
    .replace(/<script type="module" src="game\.js"><\/script>/, `<script>${js}</script>`);

  fs.writeFileSync(path.join(publicDir, 'index.html'), html);
}

build().catch(err => { console.error(err); process.exit(1); });
