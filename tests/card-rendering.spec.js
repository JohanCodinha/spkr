// Visual regression test: Card rendering in actual browser canvas
// Verifies fonts, colors, and layout render correctly
// Requires Node 20.11+ for import.meta.dirname

import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';
import { join } from 'path';
import { load } from 'cheerio';

const ROOT = join(import.meta.dirname, '..');
const SRC = join(ROOT, 'src');

const TEST_SCRIPT = `
  import { renderCardFront, renderCardBack } from './card-rendering.js';
  import { calculateCardSize } from './constants.js';
  await document.fonts.ready;
  window.testFns = { renderCardFront, renderCardBack, calculateCardSize };
`;

test.describe('Card rendering (visual)', () => {
  test.beforeEach(async ({ page }) => {
    // Serve local source files as ES modules
    await page.route('http://test/**/*.js', route => {
      const url = new URL(route.request().url());
      const filename = url.pathname.split('/').pop();
      const content = readFileSync(join(SRC, filename), 'utf-8');
      route.fulfill({ contentType: 'application/javascript', body: content });
    });

    // Serve app's index.html with test script injected
    await page.route('http://test/index.html', route => {
      const $ = load(readFileSync(join(SRC, 'index.html'), 'utf-8'));

      // Replace entry script placeholder with test script
      $('body').append(`<script type="module">${TEST_SCRIPT}</script>`);
      $('body').contents().filter(function() {
        return this.type === 'comment' && this.data.trim() === 'ENTRY_SCRIPT';
      }).remove();

      route.fulfill({ contentType: 'text/html', body: $.html() });
    });
  });

  test('renders card front correctly', async ({ page }) => {
    await page.goto('http://test/index.html');
    await page.waitForFunction(() => window.testFns);

    await page.evaluate(() => {
      const { renderCardFront, calculateCardSize } = window.testFns;
      const cardSize = calculateCardSize(1.0, 1280, 720);

      const scale = 4;
      const padding = 4;
      const canvas = document.createElement('canvas');
      canvas.id = 'test-canvas';
      canvas.width = (cardSize.w + padding * 2) * scale;
      canvas.height = (cardSize.h + padding * 2) * scale;

      const ctx = canvas.getContext('2d');
      ctx.scale(scale, scale);
      ctx.translate(cardSize.w / 2 + padding, cardSize.h / 2 + padding);

      renderCardFront(ctx, {
        value: '8',
        playerName: 'VeryLongPlayerNameThatOverflows',
        playerColor: '#3b82f6',
        width: cardSize.w,
        height: cardSize.h,
      });

      document.body.appendChild(canvas);
    });

    const canvas = page.locator('#test-canvas');
    await expect(canvas).toHaveScreenshot('card-front.png');
  });
});
