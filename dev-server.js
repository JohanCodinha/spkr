/**
 * Development server with hot-save support for the logo editor.
 *
 * Usage: node dev-server.js
 *
 * - Serves public/ folder
 * - POST /save-state patches STATE object in src/card-hand-logo.js
 */

import { createServer } from 'http';
import { readFileSync, writeFileSync, existsSync, watch } from 'fs';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const publicDir = join(__dirname, 'public');
const srcDir = join(__dirname, 'src');
const logoPath = join(__dirname, 'src', 'card-hand-logo.svg');

const PORT = process.env.PORT || 3000;

// Debounced rebuild
let buildProcess = null;
let buildTimeout = null;

function triggerRebuild(changedFile) {
    if (buildTimeout) clearTimeout(buildTimeout);
    buildTimeout = setTimeout(() => {
        if (buildProcess) {
            buildProcess.kill();
        }
        console.log(`\n📦 Rebuilding (${changedFile} changed)...`);
        buildProcess = spawn('node', ['build.js'], {
            env: { ...process.env, DEBUG: 'true', EDITOR: 'true' },
            stdio: 'inherit'
        });
        buildProcess.on('close', (code) => {
            buildProcess = null;
            if (code === 0) {
                console.log('✓ Rebuild complete');
            } else {
                console.error('✗ Rebuild failed');
            }
        });
    }, 100);
}

const MIME_TYPES = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.ico': 'image/x-icon'
};

// Initial build
console.log('Building in dev mode (debug + editor)...');
const build = spawn('node', ['build.js'], {
    env: { ...process.env, DEBUG: 'true', EDITOR: 'true' },
    stdio: 'inherit'
});

build.on('close', (code) => {
    if (code !== 0) {
        console.error('Build failed');
        process.exit(1);
    }
    startServer();
});


function startServer() {
    const server = createServer((req, res) => {
        // CORS headers
        res.setHeader('Access-Control-Allow-Origin', '*');
        res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
        res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

        if (req.method === 'OPTIONS') {
            res.writeHead(200);
            res.end();
            return;
        }

        // Save logo endpoint - writes SVG directly to file
        if (req.method === 'POST' && req.url === '/save-logo') {
            let body = '';
            req.on('data', chunk => body += chunk);
            req.on('end', () => {
                try {
                    writeFileSync(logoPath, body, 'utf-8');
                    console.log(`✓ Saved logo to ${logoPath}`);

                    // Rebuild
                    console.log('Rebuilding...');
                    const rebuild = spawn('node', ['build.js'], {
                        env: { ...process.env, DEBUG: 'true', EDITOR: 'true' },
                        stdio: 'inherit'
                    });

                    rebuild.on('close', (code) => {
                        if (code === 0) {
                            console.log('✓ Rebuild complete');
                            res.writeHead(200, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: true }));
                        } else {
                            res.writeHead(500, { 'Content-Type': 'application/json' });
                            res.end(JSON.stringify({ success: false, error: 'Rebuild failed' }));
                        }
                    });
                } catch (err) {
                    console.error('Save failed:', err);
                    res.writeHead(500, { 'Content-Type': 'application/json' });
                    res.end(JSON.stringify({ success: false, error: err.message }));
                }
            });
            return;
        }

        // Serve static files - strip query string from URL
        const urlPath = new URL(req.url, `http://localhost:${PORT}`).pathname;
        let filePath = join(publicDir, urlPath === '/' ? 'index.html' : urlPath);

        if (!existsSync(filePath)) {
            res.writeHead(404);
            res.end('Not found');
            return;
        }

        const ext = extname(filePath);
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';

        try {
            const content = readFileSync(filePath);
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        } catch (err) {
            res.writeHead(500);
            res.end('Server error');
        }
    });

    server.listen(PORT, () => {
        console.log(`\n🚀 Dev server running at http://localhost:${PORT}`);
        console.log(`   Save endpoint: POST /save-logo`);
        console.log(`   Watching src/ for changes...\n`);
    });

    // Watch src directory for changes
    watch(srcDir, { recursive: true }, (eventType, filename) => {
        if (filename && /\.(js|css|html|svg)$/.test(filename)) {
            triggerRebuild(filename);
        }
    });
}
