import esbuild from 'esbuild';
import { mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const srcDir = join(__dirname, 'src');
const publicDir = join(__dirname, 'public');

// Check for build mode via environment variables
const isDebug = process.env.DEBUG === 'true';
const isEditor = process.env.EDITOR === 'true';

async function build() {
  mkdirSync(publicDir, { recursive: true });

  // Bundle and minify JS
  // __DEBUG__ controls whether test hooks/mocks are included
  const js = (await esbuild.build({
    entryPoints: [join(srcDir, 'game.js')],
    bundle: true,
    minify: !isDebug,
    format: 'esm',
    define: {
      '__DEBUG__': isDebug ? 'true' : 'false',
      '__EDITOR__': 'false' // Editor is now loaded separately
    },
    loader: { '.svg': 'text' },
    write: false,
  })).outputFiles[0].text;

  // Bundle editor JS separately (only in editor mode)
  // The editor is a web component that self-registers
  let editorHtml = '';
  if (isEditor) {
    const editorJs = (await esbuild.build({
      entryPoints: [join(srcDir, 'card-hand-logo-editor.js')],
      bundle: true,
      minify: false,
      format: 'esm',
      loader: { '.svg': 'text' },
      write: false,
    })).outputFiles[0].text;
    editorHtml = `<script type="module">${editorJs}</script><logo-editor></logo-editor>`;
  }

  // Minify CSS (concatenate fonts + styles, then minify)
  const fontsCSS = readFileSync(join(srcDir, 'fonts.css'), 'utf-8');
  const stylesCSS = readFileSync(join(srcDir, 'styles.css'), 'utf-8');
  const css = (await esbuild.transform(fontsCSS + stylesCSS, { loader: 'css', minify: !isDebug })).code;

  // Read the pre-compiled logo SVG
  const logoSVG = readFileSync(join(srcDir, 'card-hand-logo.svg'), 'utf-8');

  // Read body template and inject logo SVG
  const bodyContent = readFileSync(join(srcDir, 'body.html'), 'utf-8')
    .replace('<card-hand-logo class="lobby-logo"></card-hand-logo>', `<div class="lobby-logo">${logoSVG}</div>`);

  // Build complete HTML using template literal
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Joyful Scrum Poker</title>
    <style>${css}</style>
</head>
<body>
${bodyContent}
    <script type="module">${js}</script>
    ${editorHtml}
</body>
</html>`;

  writeFileSync(join(publicDir, 'index.html'), html);
}

build().catch(err => { console.error(err); process.exit(1); });
