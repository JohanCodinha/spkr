// Test: Cloudflare Worker signaling
// Tests that CF signaling connects peers faster than BitTorrent fallback

import { test as baseTest, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';
import { spawn } from 'child_process';

// Skip in CI - wrangler dev requires Cloudflare auth for Durable Objects
const test = process.env.CI ? baseTest.skip : baseTest;

const ROOT = join(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');

const APP_PORT = 3460;
const WORKER_PORT = 8787; // Must match cf-strategy.js
const APP_URL = `http://localhost:${APP_PORT}`;

let server;
let wrangler;

// Start wrangler dev
async function startWrangler() {
  return new Promise((resolve, reject) => {
    wrangler = spawn('npx', ['wrangler', 'dev', '--port', String(WORKER_PORT)], {
      cwd: ROOT,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    let started = false;

    wrangler.stdout.on('data', (data) => {
      const output = data.toString();
      console.log('[wrangler]', output);
      if (output.includes('Ready on') && !started) {
        started = true;
        // Give it a moment to fully initialize
        setTimeout(resolve, 500);
      }
    });

    wrangler.stderr.on('data', (data) => {
      console.error('[wrangler stderr]', data.toString());
    });

    wrangler.on('error', reject);

    // Timeout after 30s
    setTimeout(() => {
      if (!started) reject(new Error('Wrangler failed to start'));
    }, 30000);
  });
}

// Setup hooks on a page to track game events AND CF events
async function setupHooks(page) {
  await page.evaluate(() => {
    // Game state hooks
    window.__SPKR_HOOKS__ = {};
    window.__SPKR_STATE__ = {
      roomCreated: false,
      roomJoined: false,
      peerCount: 0,
    };

    window.__SPKR_HOOKS__.roomCreated = ({ code }) => {
      window.__SPKR_STATE__.roomCreated = true;
      window.__SPKR_STATE__.roomCode = code;
    };

    window.__SPKR_HOOKS__.roomJoined = ({ code }) => {
      window.__SPKR_STATE__.roomJoined = true;
    };

    window.__SPKR_HOOKS__.peerJoined = ({ peerId, count }) => {
      window.__SPKR_STATE__.peerCount = count;
    };

    // CF state tracking
    window.__CF_STATE__ = {
      connected: false,
      peerJoinedViaCF: false,
      peerJoinedViaTorrent: false,
      fallbackActivated: false,
      errors: [],
    };

    // Intercept console logs
    const originalLog = console.log;
    console.log = (...args) => {
      const msg = args.join(' ');
      if (msg.includes('[CF] Connected')) {
        window.__CF_STATE__.connected = true;
      }
      if (msg.includes('[Hybrid] Peer joined via CF')) {
        window.__CF_STATE__.peerJoinedViaCF = true;
      }
      if (msg.includes('[Hybrid] Peer joined via BitTorrent') || msg.includes('[Hybrid] Peer joined via torrent')) {
        window.__CF_STATE__.peerJoinedViaTorrent = true;
      }
      if (msg.includes('[Hybrid] CF timeout') || msg.includes('fallback')) {
        window.__CF_STATE__.fallbackActivated = true;
      }
      originalLog.apply(console, args);
    };

    const originalError = console.error;
    console.error = (...args) => {
      window.__CF_STATE__.errors.push(args.join(' '));
      originalError.apply(console, args);
    };
  });
}

test.describe('CF Signaling', () => {
  test.beforeAll(async () => {
    // Start wrangler dev
    console.log('Starting wrangler dev...');
    await startWrangler();
    console.log('Wrangler started');

    // Start static server
    const html = readFileSync(join(PUBLIC, 'index.html'), 'utf-8');
    server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    await new Promise(resolve => server.listen(APP_PORT, resolve));
    console.log(`App server started on ${APP_URL}`);
  });

  test.afterAll(async () => {
    server?.close();
    if (wrangler) {
      wrangler.kill('SIGTERM');
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  });

  test('peers connect via CF signaling (not BitTorrent fallback)', async ({ browser }) => {
    // Create 2 browser contexts
    const ctx1 = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const ctx2 = await browser.newContext({ viewport: { width: 1280, height: 720 } });

    const page1 = await ctx1.newPage();
    const page2 = await ctx2.newPage();

    // Capture console logs from both pages
    page1.on('console', msg => console.log('[Page1]', msg.type(), msg.text()));
    page2.on('console', msg => console.log('[Page2]', msg.type(), msg.text()));

    try {
      // Load pages
      await page1.goto(APP_URL);
      await page2.goto(APP_URL);

      // Setup hooks
      await setupHooks(page1);
      await setupHooks(page2);

      // Player 1 creates room
      await page1.fill('#lobby-name-input', 'CFPlayer1');
      await page1.click('#create-room-btn');

      // Wait for game canvas to be visible
      await expect(page1.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Get room code from the displayed element
      const roomCode = await page1.locator('#room-code-display').textContent();
      expect(roomCode).toHaveLength(6);

      console.log('Room created:', roomCode);

      // Check CF connected on page1
      const cf1State = await page1.evaluate(() => window.__CF_STATE__);
      console.log('Page1 CF state:', cf1State);
      expect(cf1State.connected).toBe(true);

      // Player 2 joins
      await page2.fill('#lobby-name-input', 'CFPlayer2');
      await page2.fill('#room-code-input', roomCode);
      await page2.click('#join-room-btn');

      // Wait for game canvas
      await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 10000 });

      // Wait a moment for P2P connection
      await page2.waitForTimeout(3000);

      // Check CF state on both pages
      const cf1StateFinal = await page1.evaluate(() => window.__CF_STATE__);
      const cf2StateFinal = await page2.evaluate(() => window.__CF_STATE__);

      console.log('Final Page1 CF state:', cf1StateFinal);
      console.log('Final Page2 CF state:', cf2StateFinal);

      // Verify CF connected on page2
      expect(cf2StateFinal.connected).toBe(true);

      // Verify peers connected via CF, NOT via BitTorrent fallback
      const peerViaCF = cf1StateFinal.peerJoinedViaCF || cf2StateFinal.peerJoinedViaCF;
      const fallback = cf1StateFinal.fallbackActivated || cf2StateFinal.fallbackActivated;

      console.log('Peer joined via CF:', peerViaCF);
      console.log('Fallback activated:', fallback);

      // Either peers joined via CF, or if fallback was activated, that's a failure
      if (fallback && !peerViaCF) {
        // Collect errors
        const errors = [...cf1StateFinal.errors, ...cf2StateFinal.errors];
        console.log('Errors:', errors);
        throw new Error('CF signaling failed - fell back to BitTorrent. Errors: ' + errors.join(', '));
      }

      expect(peerViaCF).toBe(true);

    } finally {
      await ctx1.close();
      await ctx2.close();
    }
  });
});
