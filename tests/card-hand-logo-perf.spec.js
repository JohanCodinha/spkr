// Performance test: Measure first paint time for card-hand-logo component
// Uses Performance API and custom timing to measure component rendering

import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync, existsSync } from 'fs';
import { join, extname } from 'path';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC_DIR = join(ROOT, 'public');

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.svg': 'image/svg+xml',
};

// Simple static file server for the built app
function createStaticServer() {
  return createServer((req, res) => {
    const urlPath = new URL(req.url, 'http://localhost').pathname;
    const filePath = join(PUBLIC_DIR, urlPath === '/' ? 'index.html' : urlPath);

    if (!existsSync(filePath)) {
      res.writeHead(404);
      res.end('Not found');
      return;
    }

    const ext = extname(filePath);
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';
    const content = readFileSync(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
}

test.describe('card-hand-logo performance', () => {
  let server;
  let baseURL;

  test.beforeAll(async () => {
    server = createStaticServer();
    await new Promise(resolve => {
      server.listen(0, () => {
        const port = server.address().port;
        baseURL = `http://localhost:${port}`;
        resolve();
      });
    });
  });

  test.afterAll(async () => {
    if (server) {
      await new Promise(resolve => server.close(resolve));
    }
  });

  test('measures first paint time of card-hand-logo', async ({ page }) => {
    // Inject performance measurement script before page loads
    await page.addInitScript(() => {
      window.__perfMarks = {};

      // Use MutationObserver to detect when the logo SVG is added to DOM
      const observer = new MutationObserver((mutations) => {
        for (const mutation of mutations) {
          for (const node of mutation.addedNodes) {
            // Check if it's the lobby-logo div or contains the SVG
            if (node.nodeType === 1) {
              const svg = node.classList?.contains('card-hand-logo')
                ? node
                : node.querySelector?.('svg.card-hand-logo');
              if (svg && !window.__perfMarks.svgAdded) {
                window.__perfMarks.svgAdded = performance.now();
              }
            }
          }
        }
      });
      observer.observe(document, { childList: true, subtree: true });
    });

    const navStart = Date.now();
    await page.goto(baseURL);

    // Wait for the SVG to be in the DOM (now inline, no shadow DOM)
    await page.waitForFunction(() => {
      const svg = document.querySelector('svg.card-hand-logo');
      if (!svg) return false;
      // Mark first paint when SVG is found
      if (!window.__perfMarks.firstPaint) {
        window.__perfMarks.firstPaint = performance.now();
      }
      return true;
    });

    // Collect all timing data
    const metrics = await page.evaluate(() => {
      const paintEntries = performance.getEntriesByType('paint');
      const navEntries = performance.getEntriesByType('navigation');

      return {
        // Standard paint metrics
        firstPaint: paintEntries.find(e => e.name === 'first-paint')?.startTime,
        firstContentfulPaint: paintEntries.find(e => e.name === 'first-contentful-paint')?.startTime,

        // Navigation timing
        domContentLoaded: navEntries[0]?.domContentLoadedEventEnd,
        loadComplete: navEntries[0]?.loadEventEnd,

        // Custom marks
        svgAdded: window.__perfMarks.svgAdded,
        svgFirstPaint: window.__perfMarks.firstPaint,
      };
    });

    const totalTime = Date.now() - navStart;

    // Log results
    console.log('\n📊 card-hand-logo Performance Metrics (Static SVG):');
    console.log('─'.repeat(50));
    console.log(`First Paint (browser):        ${metrics.firstPaint?.toFixed(2) ?? 'N/A'} ms`);
    console.log(`First Contentful Paint:       ${metrics.firstContentfulPaint?.toFixed(2) ?? 'N/A'} ms`);
    console.log(`DOM Content Loaded:           ${metrics.domContentLoaded?.toFixed(2) ?? 'N/A'} ms`);
    console.log(`SVG Added to DOM:             ${metrics.svgAdded?.toFixed(2) ?? 'N/A'} ms`);
    console.log(`SVG First Paint:              ${metrics.svgFirstPaint?.toFixed(2) ?? 'N/A'} ms`);
    console.log(`Total Navigation Time:        ${totalTime} ms`);
    console.log('─'.repeat(50));

    // Key assertion: SVG should be in DOM from HTML parsing (no JS needed)
    // The svgAdded metric shows when SVG appeared in DOM during HTML parse
    expect(metrics.svgAdded || metrics.firstContentfulPaint).toBeDefined();
    // First Contentful Paint should be fast since SVG is inline HTML
    expect(metrics.firstContentfulPaint).toBeLessThan(500);

    // Store results for potential CI reporting
    test.info().annotations.push({
      type: 'performance',
      description: JSON.stringify(metrics, null, 2),
    });
  });

  test('measures paint time over multiple runs for consistency', async ({ page }) => {
    const runs = 5;
    const results = [];

    for (let i = 0; i < runs; i++) {
      // Clear page and inject measurement
      await page.addInitScript(() => {
        window.__paintTime = null;
      });

      const start = Date.now();
      await page.goto(baseURL);

      // Wait for SVG to render (now inline, no shadow DOM)
      await page.waitForFunction(() => {
        const svg = document.querySelector('svg.card-hand-logo');
        if (!svg) return false;
        window.__paintTime = performance.now();
        return true;
      });

      const paintTime = await page.evaluate(() => window.__paintTime);
      const totalTime = Date.now() - start;

      results.push({ paintTime, totalTime });

      // Small delay between runs
      if (i < runs - 1) {
        await page.waitForTimeout(100);
      }
    }

    // Calculate statistics
    const paintTimes = results.map(r => r.paintTime);
    const avg = paintTimes.reduce((a, b) => a + b, 0) / paintTimes.length;
    const min = Math.min(...paintTimes);
    const max = Math.max(...paintTimes);
    const stdDev = Math.sqrt(
      paintTimes.reduce((sum, t) => sum + Math.pow(t - avg, 2), 0) / paintTimes.length
    );

    console.log('\n📊 card-hand-logo Paint Time Statistics (5 runs):');
    console.log('─'.repeat(50));
    console.log(`Average:    ${avg.toFixed(2)} ms`);
    console.log(`Min:        ${min.toFixed(2)} ms`);
    console.log(`Max:        ${max.toFixed(2)} ms`);
    console.log(`Std Dev:    ${stdDev.toFixed(2)} ms`);
    console.log('─'.repeat(50));
    console.log('Individual runs:', paintTimes.map(t => `${t.toFixed(2)}ms`).join(', '));

    // Consistency check - should be very fast now (static SVG)
    expect(avg).toBeLessThan(200); // Much lower threshold for static SVG
  });
});
