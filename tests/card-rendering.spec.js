// Visual regression test: Card rendering in actual browser canvas
// Verifies fonts, colors, and layout render correctly
// Requires Node 20.11+ for import.meta.dirname

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');
const FIXTURES = join(import.meta.dirname, 'fixtures');

// Rendering constants
const SCREENSHOT_SCALE = 4; // Higher DPI for crisp, detailed screenshots
const CANVAS_PADDING = 4;   // Padding around card to capture full border/shadow

const TEST_SCRIPT = `
  import { renderCardFront, renderCardBack } from './card-rendering.js';
  import { calculateCardSize } from './constants.js';
  await document.fonts.ready;
  window.testFns = { renderCardFront, renderCardBack, calculateCardSize };
`;

// Test cases for parameterized card front tests
const cardFrontTestCases = [
  {
    name: 'normal',
    value: '8',
    playerName: 'Alice',
    playerColor: '#3b82f6',
  },
  {
    name: 'long-name',
    value: '13',
    playerName: 'VeryLongPlayerNameThatOverflows',
    playerColor: '#ef4444',
  },
  {
    name: 'special-chars',
    value: '?',
    playerName: 'Bob',
    playerColor: '#10b981',
  },
  {
    name: 'emoji-value',
    value: '☕',
    playerName: 'A',
    playerColor: '#8b5cf6',
  },
];

test.describe('Card rendering (visual)', () => {
  test.beforeEach(async ({ page }) => {
    // Serve source JS files as ES modules
    await page.route('http://test/**/*.js', route => {
      const filename = new URL(route.request().url()).pathname.split('/').pop();
      route.fulfill({
        contentType: 'application/javascript',
        body: readFileSync(join(SRC, filename), 'utf-8'),
      });
    });

    // Serve fonts.css from src (single source of truth)
    await page.route('http://test/fonts.css', route => {
      route.fulfill({
        contentType: 'text/css',
        body: readFileSync(join(SRC, 'fonts.css'), 'utf-8'),
      });
    });

    // Serve minimal test harness
    await page.route('http://test/index.html', route => {
      route.fulfill({
        contentType: 'text/html',
        body: readFileSync(join(FIXTURES, 'card-test-harness.html'), 'utf-8'),
      });
    });
  });

  // Parameterized card front tests
  for (const tc of cardFrontTestCases) {
    test(`renders card front: ${tc.name}`, async ({ page }) => {
      await page.goto('http://test/index.html');
      await page.addScriptTag({ content: TEST_SCRIPT, type: 'module' });
      await page.waitForFunction(() => window.testFns);

      await page.evaluate(({ value, playerName, playerColor, scale, padding }) => {
        const { renderCardFront, calculateCardSize } = window.testFns;
        const cardSize = calculateCardSize(1.0, 1280, 720);

        const canvas = document.createElement('canvas');
        canvas.id = 'test-canvas';
        canvas.width = (cardSize.w + padding * 2) * scale;
        canvas.height = (cardSize.h + padding * 2) * scale;

        const ctx = canvas.getContext('2d');
        ctx.scale(scale, scale);
        ctx.translate(cardSize.w / 2 + padding, cardSize.h / 2 + padding);

        renderCardFront(ctx, {
          value,
          playerName,
          playerColor,
          width: cardSize.w,
          height: cardSize.h,
        });

        document.body.appendChild(canvas);
      }, { ...tc, scale: SCREENSHOT_SCALE, padding: CANVAS_PADDING });

      const canvas = page.locator('#test-canvas');
      await expect(canvas).toHaveScreenshot(`card-front-${tc.name}.png`);
    });
  }

  test('renders card back correctly', async ({ page }) => {
    await page.goto('http://test/index.html');
    await page.addScriptTag({ content: TEST_SCRIPT, type: 'module' });
    await page.waitForFunction(() => window.testFns);

    await page.evaluate(({ scale, padding }) => {
      const { renderCardBack, calculateCardSize } = window.testFns;
      const cardSize = calculateCardSize(1.0, 1280, 720);

      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = (cardSize.w + padding * 2) * scale;
      canvas.height = (cardSize.h + padding * 2) * scale;

      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.translate(cardSize.w / 2 + padding, cardSize.h / 2 + padding);

      renderCardBack(ctx, {
        color: '#3b82f6',
        width: cardSize.w,
        height: cardSize.h,
      });

      document.body.appendChild(canvas);
    }, { scale: SCREENSHOT_SCALE, padding: CANVAS_PADDING });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('card-back.png');
  });
});
