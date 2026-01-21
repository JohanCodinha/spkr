// E2E Test: Full Multiplayer Flow
// Tests the complete user journey with 3 players using real P2P connections
// Requires Node 20.11+ for import.meta.dirname

import { test, expect } from '@playwright/test';
import { createServer } from 'http';
import { readFileSync } from 'fs';
import { join } from 'path';

const ROOT = join(import.meta.dirname, '..');
const PUBLIC = join(ROOT, 'public');

const PORT = 3459;
const URL = `http://localhost:${PORT}`;

// Test configuration
const PLAYERS = [
  { name: 'Alice', color: '#8b5cf6', isObserver: false },
  { name: 'Bob', color: '#3b82f6', isObserver: false },
  { name: 'Charlie', color: '#10b981', isObserver: false },
  { name: 'Diana', color: '#f59e0b', isObserver: true },
];

const VOTES = {
  round1: ['5', '8', '5'],
  round2: ['3', '3', '3'],
};

let server;

// Setup debug hooks on a page
async function setupHooks(page) {
  await page.evaluate(() => {
    window.__SPKR_HOOKS__ = {};
    window.__SPKR_STATE__ = {
      roomCreated: false,
      roomJoined: false,
      peerCount: 0,
      allVotesIn: false,
      cardsSettled: false,
      revealComplete: false,
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

    window.__SPKR_HOOKS__.allVotesIn = ({ count }) => {
      window.__SPKR_STATE__.allVotesIn = true;
    };

    window.__SPKR_HOOKS__.cardsSettled = ({ count }) => {
      window.__SPKR_STATE__.cardsSettled = true;
    };

    window.__SPKR_HOOKS__.revealComplete = () => {
      window.__SPKR_STATE__.revealComplete = true;
    };
  });
}

// Reset hook state for a new round
async function resetHookState(page) {
  await page.evaluate(() => {
    window.__SPKR_STATE__.allVotesIn = false;
    window.__SPKR_STATE__.cardsSettled = false;
    window.__SPKR_STATE__.revealComplete = false;
  });
}

// Wait helpers
async function waitForCardsSettled(page, timeout = 15000) {
  await page.waitForFunction(
    () => window.__SPKR_STATE__?.cardsSettled === true,
    { timeout }
  );
}

async function waitForRevealComplete(page, timeout = 15000) {
  await page.waitForFunction(
    () => window.__SPKR_STATE__?.revealComplete === true,
    { timeout }
  );
}

// Start/stop server
test.beforeAll(async () => {
  const html = readFileSync(join(PUBLIC, 'index.html'), 'utf-8');
  server = createServer((req, res) => {
    res.writeHead(200, { 'Content-Type': 'text/html' });
    res.end(html);
  });
  await new Promise(resolve => server.listen(PORT, resolve));
});

test.afterAll(async () => {
  server?.close();
});

test.describe('Multiplayer Scrum Poker', () => {
  test('full game flow with 3 players and 1 observer', async ({ browser }) => {
    // Create 4 browser contexts (simulating 4 different users, 1 is observer)
    const contexts = await Promise.all(
      PLAYERS.map(() => browser.newContext({ viewport: { width: 1280, height: 720 } }))
    );

    const pages = await Promise.all(contexts.map(ctx => ctx.newPage()));
    const [page1, page2, page3, page4] = pages;
    const voterPages = [page1, page2, page3]; // Pages that can vote

    try {
      // =====================================================================
      // PHASE 1: Load lobby
      // =====================================================================
      await test.step('all players load lobby', async () => {
        await Promise.all(pages.map(p => p.goto(URL)));
        await Promise.all(pages.map(p => setupHooks(p)));
        await Promise.all(pages.map(p =>
          expect(p.locator('#lobby-screen')).toBeVisible()
        ));
      });

      // =====================================================================
      // PHASE 2: Create room
      // =====================================================================
      let roomCode;
      await test.step('Player 1 creates room', async () => {
        await page1.fill('#lobby-name-input', PLAYERS[0].name);
        await page1.evaluate((color) => {
          document.querySelector('#lobby-color-input').value = color;
        }, PLAYERS[0].color);

        await page1.click('#create-room-btn');

        await page1.waitForFunction(
          () => window.__SPKR_STATE__?.roomCreated === true,
          { timeout: 15000 }
        );
        await expect(page1.locator('#game-canvas')).toBeVisible();

        roomCode = await page1.evaluate(() => window.__SPKR_STATE__.roomCode);
        expect(roomCode).toHaveLength(6);
      });

      // =====================================================================
      // PHASE 3: Other players join
      // =====================================================================
      await test.step('Players 2, 3, and 4 (observer) join room', async () => {
        // Player 2 joins
        await page2.fill('#lobby-name-input', PLAYERS[1].name);
        await page2.evaluate((color) => {
          document.querySelector('#lobby-color-input').value = color;
        }, PLAYERS[1].color);
        await page2.fill('#room-code-input', roomCode);
        await page2.click('#join-room-btn');
        await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

        // Player 3 joins
        await page3.fill('#lobby-name-input', PLAYERS[2].name);
        await page3.evaluate((color) => {
          document.querySelector('#lobby-color-input').value = color;
        }, PLAYERS[2].color);
        await page3.fill('#room-code-input', roomCode);
        await page3.click('#join-room-btn');
        await expect(page3.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

        // Player 4 joins as observer
        await page4.fill('#lobby-name-input', PLAYERS[3].name);
        await page4.evaluate((color) => {
          document.querySelector('#lobby-color-input').value = color;
        }, PLAYERS[3].color);
        await page4.check('#lobby-observer-input'); // Check observer checkbox
        await page4.fill('#room-code-input', roomCode);
        await page4.click('#join-room-btn');
        await expect(page4.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

        // Verify observer's deck is hidden
        await expect(page4.locator('.card-deck')).toHaveClass(/hidden/);

        // Wait for P2P mesh to form
        await page1.waitForTimeout(3000);
      });

      // =====================================================================
      // PHASE 4: Round 1 - Voting
      // =====================================================================
      await test.step('Round 1: all voters vote (observer watches)', async () => {
        for (let i = 0; i < voterPages.length; i++) {
          const vote = VOTES.round1[i];
          await voterPages[i].click(`.deck-card:has-text("${vote}")`);
          await voterPages[i].waitForTimeout(500);
        }

        await waitForCardsSettled(page1);
      });

      // =====================================================================
      // PHASE 5: Round 1 - Reveal (observer triggers)
      // =====================================================================
      await test.step('Round 1: observer reveals cards', async () => {
        // Observer can see and click reveal button
        await expect(page4.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });
        await page4.click('#reveal-btn');
        await waitForRevealComplete(page1);
      });

      // =====================================================================
      // PHASE 6: Reset
      // =====================================================================
      await test.step('reset game', async () => {
        const canvas = page1.locator('#game-canvas');
        const box = await canvas.boundingBox();
        await page1.mouse.click(box.x + box.width / 2, box.y + box.height / 2);

        await page1.waitForTimeout(1000);
        await expect(page1.locator('.card-deck:not(.voted):not(.revealed)')).toBeVisible();

        await Promise.all(pages.map(p => resetHookState(p)));
      });

      // =====================================================================
      // PHASE 7: Round 2 - Consensus vote
      // =====================================================================
      await test.step('Round 2: consensus vote', async () => {
        for (let i = 0; i < voterPages.length; i++) {
          const vote = VOTES.round2[i];
          await voterPages[i].click(`.deck-card:has-text("${vote}")`);
          await voterPages[i].waitForTimeout(500);
        }

        await waitForCardsSettled(page1);
      });

      // =====================================================================
      // PHASE 8: Round 2 - Reveal
      // =====================================================================
      await test.step('Round 2: reveal cards', async () => {
        await expect(page1.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });
        await page1.click('#reveal-btn');
        await waitForRevealComplete(page1);

        // Verify final state
        const state = await page1.evaluate(() => window.__SPKR_MOCK__?.getMockState?.());
        expect(state.isRevealed).toBe(true);
        expect(state.cards).toBe(3);
      });

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('player can change vote before reveal', async ({ browser }) => {
    // Create 2 browser contexts (2 players)
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
    ]);

    const [page1, page2] = await Promise.all(contexts.map(ctx => ctx.newPage()));

    try {
      // Load lobby
      await Promise.all([page1, page2].map(p => p.goto(URL)));
      await Promise.all([page1, page2].map(p => setupHooks(p)));

      // Player 1 creates room
      await page1.fill('#lobby-name-input', 'VoteChanger');
      await page1.click('#create-room-btn');
      await page1.waitForFunction(
        () => window.__SPKR_STATE__?.roomCreated === true,
        { timeout: 15000 }
      );

      const roomCode = await page1.evaluate(() => window.__SPKR_STATE__.roomCode);

      // Player 2 joins
      await page2.fill('#lobby-name-input', 'Watcher');
      await page2.fill('#room-code-input', roomCode);
      await page2.click('#join-room-btn');
      await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Wait for P2P mesh
      await page1.waitForTimeout(2000);

      // Player 1 votes "5"
      await page1.click('.deck-card:has-text("5")');
      await page1.waitForTimeout(500);

      // Verify card "5" is selected in deck
      await expect(page1.locator('.deck-card:has-text("5")')).toHaveClass(/selected/);

      // Verify deck is still active (can change vote)
      await expect(page1.locator('.card-deck')).not.toHaveClass(/voted/);

      // Player 1 changes vote to "13"
      await page1.click('.deck-card:has-text("13")');

      // Wait for recall animation to complete and new card to spawn
      await page1.waitForTimeout(1500);

      // Verify "13" is now selected, "5" is not
      await expect(page1.locator('.deck-card:has-text("13")')).toHaveClass(/selected/);
      await expect(page1.locator('.deck-card:has-text("5")')).not.toHaveClass(/selected/);

      // Player 2 votes so we can reveal
      await page2.click('.deck-card:has-text("8")');
      await page2.waitForTimeout(500);

      // Wait for cards to settle on both pages
      await waitForCardsSettled(page1);
      await waitForCardsSettled(page2);

      // Reveal cards
      await expect(page1.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });
      await page1.click('#reveal-btn');
      await waitForRevealComplete(page1);

      // Verify final state shows 2 cards (one per player)
      const state = await page1.evaluate(() => window.__SPKR_MOCK__?.getMockState?.());
      expect(state.isRevealed).toBe(true);
      expect(state.cards).toBe(2);

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('reveal confirmation appears when not all players have voted', async ({ browser }) => {
    // Create 2 browser contexts (2 players)
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
    ]);

    const [page1, page2] = await Promise.all(contexts.map(ctx => ctx.newPage()));

    try {
      // Load lobby
      await Promise.all([page1, page2].map(p => p.goto(URL)));
      await Promise.all([page1, page2].map(p => setupHooks(p)));

      // Player 1 creates room
      await page1.fill('#lobby-name-input', 'Revealer');
      await page1.click('#create-room-btn');
      await page1.waitForFunction(
        () => window.__SPKR_STATE__?.roomCreated === true,
        { timeout: 15000 }
      );

      const roomCode = await page1.evaluate(() => window.__SPKR_STATE__.roomCode);

      // Player 2 joins
      await page2.fill('#lobby-name-input', 'Pending');
      await page2.fill('#room-code-input', roomCode);
      await page2.click('#join-room-btn');
      await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Wait for P2P mesh AND for Player 2 to appear in Player 1's state
      await page1.waitForFunction(
        () => {
          const state = window.__SPKR_MOCK__?.getVoterState?.();
          return state && state.remotePlayers.length >= 1;
        },
        { timeout: 15000 }
      );

      // =====================================================================
      // TEST 1: Only Player 1 votes, confirmation should appear
      // =====================================================================
      await test.step('reveal button appears after first vote', async () => {
        // Player 1 votes "5"
        await page1.click('.deck-card:has-text("5")');
        await page1.waitForTimeout(500);

        // Reveal button should be visible (since there's at least one card)
        await expect(page1.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });

        // Confirmation should NOT be visible yet
        await expect(page1.locator('#reveal-confirm')).toBeHidden();
      });

      // =====================================================================
      // TEST 2: Clicking reveal shows confirmation with pending count
      // =====================================================================
      await test.step('clicking reveal shows confirmation dialog', async () => {
        await page1.click('#reveal-btn');

        // Confirmation should appear
        await expect(page1.locator('#reveal-confirm')).toBeVisible();

        // Reveal button should be hidden
        await expect(page1.locator('#reveal-btn')).toBeHidden();

        // Message should show "1 player still voting"
        const message = await page1.locator('#reveal-confirm-message').textContent();
        expect(message).toBe('1 player still voting');
      });

      // =====================================================================
      // TEST 3: Cancel returns to reveal button
      // =====================================================================
      await test.step('cancel hides confirmation and shows reveal button', async () => {
        await page1.click('#reveal-confirm-no');

        // Confirmation should be hidden
        await expect(page1.locator('#reveal-confirm')).toBeHidden();

        // Reveal button should be visible again
        await expect(page1.locator('#reveal-btn')).toBeVisible();
      });

      // =====================================================================
      // TEST 4: Confirm proceeds with reveal
      // =====================================================================
      await test.step('confirm proceeds with reveal', async () => {
        // Click reveal again to show confirmation
        await page1.click('#reveal-btn');
        await expect(page1.locator('#reveal-confirm')).toBeVisible();

        // Click confirm
        await page1.click('#reveal-confirm-yes');

        // Wait for reveal to complete
        await waitForRevealComplete(page1);

        // Confirmation should be hidden
        await expect(page1.locator('#reveal-confirm')).toBeHidden();

        // Verify cards are revealed
        const state = await page1.evaluate(() => window.__SPKR_MOCK__?.getMockState?.());
        expect(state.isRevealed).toBe(true);
      });

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('reveal skips confirmation when all players have voted', async ({ browser }) => {
    // Create 2 browser contexts (2 players)
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
    ]);

    const [page1, page2] = await Promise.all(contexts.map(ctx => ctx.newPage()));

    try {
      // Load lobby
      await Promise.all([page1, page2].map(p => p.goto(URL)));
      await Promise.all([page1, page2].map(p => setupHooks(p)));

      // Player 1 creates room
      await page1.fill('#lobby-name-input', 'Player1');
      await page1.click('#create-room-btn');
      await page1.waitForFunction(
        () => window.__SPKR_STATE__?.roomCreated === true,
        { timeout: 15000 }
      );

      const roomCode = await page1.evaluate(() => window.__SPKR_STATE__.roomCode);

      // Player 2 joins
      await page2.fill('#lobby-name-input', 'Player2');
      await page2.fill('#room-code-input', roomCode);
      await page2.click('#join-room-btn');
      await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Wait for P2P mesh AND for Player 2 to appear in Player 1's state
      await page1.waitForFunction(
        () => {
          const state = window.__SPKR_MOCK__?.getVoterState?.();
          return state && state.remotePlayers.length >= 1;
        },
        { timeout: 15000 }
      );

      // Both players vote
      await page1.click('.deck-card:has-text("5")');
      await page1.waitForTimeout(500);
      await page2.click('.deck-card:has-text("8")');
      await page2.waitForTimeout(500);

      // Wait for cards to settle
      await waitForCardsSettled(page1);

      // Click reveal - should NOT show confirmation since all voted
      await expect(page1.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });
      await page1.click('#reveal-btn');

      // Confirmation should NOT appear
      await expect(page1.locator('#reveal-confirm')).toBeHidden();

      // Should go straight to reveal
      await waitForRevealComplete(page1);

      const state = await page1.evaluate(() => window.__SPKR_MOCK__?.getMockState?.());
      expect(state.isRevealed).toBe(true);
      expect(state.cards).toBe(2);

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });

  test('reveal confirmation shows correct plural for multiple pending players', async ({ browser }) => {
    // Create 3 browser contexts (3 players)
    const contexts = await Promise.all([
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
      browser.newContext({ viewport: { width: 1280, height: 720 } }),
    ]);

    const [page1, page2, page3] = await Promise.all(contexts.map(ctx => ctx.newPage()));

    try {
      // Load lobby
      await Promise.all([page1, page2, page3].map(p => p.goto(URL)));
      await Promise.all([page1, page2, page3].map(p => setupHooks(p)));

      // Player 1 creates room
      await page1.fill('#lobby-name-input', 'Voter');
      await page1.click('#create-room-btn');
      await page1.waitForFunction(
        () => window.__SPKR_STATE__?.roomCreated === true,
        { timeout: 15000 }
      );

      const roomCode = await page1.evaluate(() => window.__SPKR_STATE__.roomCode);

      // Player 2 joins
      await page2.fill('#lobby-name-input', 'Pending1');
      await page2.fill('#room-code-input', roomCode);
      await page2.click('#join-room-btn');
      await expect(page2.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Player 3 joins
      await page3.fill('#lobby-name-input', 'Pending2');
      await page3.fill('#room-code-input', roomCode);
      await page3.click('#join-room-btn');
      await expect(page3.locator('#game-canvas')).toBeVisible({ timeout: 15000 });

      // Wait for P2P mesh AND for both players to appear in Player 1's state
      await page1.waitForFunction(
        () => {
          const state = window.__SPKR_MOCK__?.getVoterState?.();
          return state && state.remotePlayers.length >= 2;
        },
        { timeout: 15000 }
      );

      // Only Player 1 votes
      await page1.click('.deck-card:has-text("5")');
      await page1.waitForTimeout(500);

      // Click reveal
      await expect(page1.locator('#reveal-btn')).toBeVisible({ timeout: 5000 });
      await page1.click('#reveal-btn');

      // Confirmation should show "2 players still voting" (plural)
      await expect(page1.locator('#reveal-confirm')).toBeVisible();
      const message = await page1.locator('#reveal-confirm-message').textContent();
      expect(message).toBe('2 players still voting');

    } finally {
      await Promise.all(contexts.map(ctx => ctx.close()));
    }
  });
});
