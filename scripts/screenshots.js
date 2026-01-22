import { chromium } from 'playwright';
import { createServer } from 'http';
import { mkdirSync, existsSync, readdirSync, unlinkSync, readFileSync, writeFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const SCREENSHOTS_DIR = join(ROOT, 'screenshots');

const PLAYERS = [
  { name: 'Alice', color: '#8b5cf6', vote: '5' },
  { name: 'Bob', color: '#3b82f6', vote: '8' },
  { name: 'Charlie', color: '#10b981', vote: '5' },
  { name: 'Diana', color: '#f59e0b', vote: '8' },
  { name: 'Eve', color: '#ec4899', vote: '5' },
  { name: 'Frank', color: '#64748b', vote: null, isObserver: true },
];

// Start a simple HTTP server
function startServer(port) {
  return new Promise((resolve) => {
    const html = readFileSync(join(PUBLIC, 'index.html'), 'utf-8');
    const server = createServer((req, res) => {
      res.writeHead(200, { 'Content-Type': 'text/html' });
      res.end(html);
    });
    server.listen(port, () => resolve(server));
  });
}

// Set up debug hooks
async function setupHooks(page) {
  await page.evaluate(() => {
    window.__SPKR_HOOKS__ = {};
    window.__SPKR_STATE__ = {
      cardsSettled: false,
      revealComplete: false,
    };

    window.__SPKR_HOOKS__.cardsSettled = () => {
      window.__SPKR_STATE__.cardsSettled = true;
      console.log('[HOOK] cardsSettled');
    };

    window.__SPKR_HOOKS__.revealComplete = () => {
      window.__SPKR_STATE__.revealComplete = true;
      console.log('[HOOK] revealComplete');
    };
  });
}

// Wait for thrown cards to settle (velocity ~0)
async function waitForCardsSettled(page, timeout = 10000) {
  return page.waitForFunction(
    () => window.__SPKR_STATE__?.cardsSettled === true,
    { timeout }
  );
}

// Wait for reveal animation to complete (flipped + positioned)
async function waitForRevealComplete(page, timeout = 10000) {
  return page.waitForFunction(
    () => window.__SPKR_STATE__?.revealComplete === true,
    { timeout }
  );
}

async function main() {
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  const PORT = 3458;
  console.log('Starting server...');
  const server = await startServer(PORT);
  const URL = `http://localhost:${PORT}`;
  console.log(`Server running at ${URL}`);

  const browser = await chromium.launch({ headless: true });

  // High-res settings
  const viewport = { width: 1920, height: 1080 };
  const deviceScaleFactor = 2;

  try {
    // ============================================
    // Screenshot 1: Lobby
    // ============================================
    console.log('\n📸 Capturing lobby screenshot...');
    const lobbyContext = await browser.newContext({ viewport, deviceScaleFactor });
    const lobbyPage = await lobbyContext.newPage();
    await lobbyPage.goto(URL);
    await lobbyPage.waitForSelector('#lobby-screen', { state: 'visible' });
    await lobbyPage.waitForTimeout(500);
    await lobbyPage.screenshot({ path: join(SCREENSHOTS_DIR, '01-lobby.png') });
    console.log('✅ Lobby screenshot saved');
    await lobbyContext.close();

    // ============================================
    // Screenshot 2 & 3 + Video: Mock 5-player game
    // ============================================
    console.log('\n🎮 Setting up mock 5-player game (no P2P)...');

    const gameContext = await browser.newContext({
      viewport,
      deviceScaleFactor,
      recordVideo: { dir: SCREENSHOTS_DIR, size: { width: 1920, height: 1080 } }
    });
    const gamePage = await gameContext.newPage();
    await gamePage.goto(URL);
    await setupHooks(gamePage);
    await gamePage.waitForSelector('#lobby-screen', { state: 'visible' });

    // Start game in mock mode (bypasses P2P entirely)
    console.log('🚀 Starting game in mock mode...');
    await gamePage.evaluate((player) => {
      window.__SPKR_MOCK__.startGame(player.name, player.color);
    }, PLAYERS[0]);

    await gamePage.waitForSelector('#game-canvas:not(.hidden)');
    console.log(`✅ Game started as ${PLAYERS[0].name}`);

    // Add fake remote players (no P2P needed!)
    console.log('\n👥 Adding mock players...');
    for (let i = 1; i < PLAYERS.length; i++) {
      const player = PLAYERS[i];
      await gamePage.evaluate(({ p, idx }) => {
        window.__SPKR_MOCK__.addPlayer(`mock-${idx}`, p.name, p.color, p.vote, p.isObserver || false);
      }, { p: player, idx: i });
      const role = player.isObserver ? '(observer)' : `with vote ${player.vote}`;
      console.log(`✅ Added ${player.name} ${role}`);
      await gamePage.waitForTimeout(600); // Time between cards for animation
    }

    // Host votes last
    console.log(`\n🗳️ ${PLAYERS[0].name} voting ${PLAYERS[0].vote}...`);
    await gamePage.evaluate((vote) => {
      window.__SPKR_MOCK__.vote(vote);
    }, PLAYERS[0].vote);
    console.log(`✅ ${PLAYERS[0].name} voted`);

    // Wait for cards to settle (physics-based, no timeout)
    console.log('\n⏳ Waiting for cards to settle...');
    await waitForCardsSettled(gamePage, 10000);
    console.log('✅ Cards settled');

    // Screenshot: All voted
    console.log('\n📸 Capturing voting screenshot...');
    await gamePage.screenshot({ path: join(SCREENSHOTS_DIR, '02-voting.png') });
    console.log('✅ Voting screenshot saved');

    // Reveal cards
    console.log('\n🎬 Revealing cards...');
    await gamePage.evaluate(() => {
      window.__SPKR_MOCK__.reveal();
    });

    // Wait for reveal animation using revealComplete hook
    try {
      await waitForRevealComplete(gamePage, 10000);
      console.log('✅ Cards finished flipping');
    } catch (e) {
      console.log('⚠️ Reveal timeout, continuing...');
    }

    // Extra time for visual polish
    await gamePage.waitForTimeout(500);

    // Screenshot: Revealed
    console.log('\n📸 Capturing reveal screenshot...');
    await gamePage.screenshot({ path: join(SCREENSHOTS_DIR, '03-reveal.png') });
    console.log('✅ Reveal screenshot saved');

    // Hold for video outro
    await gamePage.waitForTimeout(2000);

    await gameContext.close();

    // ============================================
    // Convert video to MP4 (GitHub-friendly)
    // ============================================
    console.log('\n🎬 Converting video to MP4...');
    // Small delay to ensure video file is fully written
    await new Promise(r => setTimeout(r, 500));
    const files = readdirSync(SCREENSHOTS_DIR);
    const videoFile = files.find(f => f.endsWith('.webm'));

    if (videoFile) {
      const videoPath = join(SCREENSHOTS_DIR, videoFile);
      const mp4Path = join(SCREENSHOTS_DIR, 'game-demo.mp4');
      const gifPath = join(SCREENSHOTS_DIR, 'game-demo.gif');

      try {
        // Create MP4 (much smaller, better quality)
        execSync(`ffmpeg -y -i "${videoPath}" -c:v libx264 -preset slow -crf 22 -pix_fmt yuv420p -movflags +faststart "${mp4Path}"`, {
          stdio: 'pipe',
        });
        console.log('✅ MP4 created: game-demo.mp4');

        // Create optimized GIF (600px, 24fps, 256 colors with diff palette)
        execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=24,scale=600:-1:flags=lanczos,split[s0][s1];[s0]palettegen=stats_mode=diff[p];[s1][p]paletteuse=dither=floyd_steinberg" -loop 0 "${gifPath}"`, {
          stdio: 'pipe',
        });
        console.log('✅ GIF created: game-demo.gif');

        unlinkSync(videoPath);
      } catch (e) {
        console.log('⚠️ ffmpeg not available, keeping video file');
        console.log('   Install ffmpeg for MP4/GIF conversion');
      }
    }

  } finally {
    await browser.close();
    server.close();

    // Generate minimal preview HTML
    const sizes = ['01-lobby.png', '02-voting.png', '03-reveal.png', 'game-demo.gif', 'game-demo.mp4']
      .map(f => {
        try {
          const s = statSync(join(SCREENSHOTS_DIR, f)).size;
          return `${f}: ${(s / 1024).toFixed(0)}KB`;
        } catch { return null; }
      }).filter(Boolean);

    const html = `<!DOCTYPE html><meta charset=utf-8><meta name=viewport content="width=device-width"><title>Preview</title>
<style>*{margin:0;box-sizing:border-box}body{background:#111;color:#fff;font:14px system-ui;padding:1em}
img,video{max-width:100%;border-radius:4px;margin:.5em 0}h2{margin-top:1em;font-size:1em;opacity:.6}</style>
<h2>Screenshots</h2>${['01-lobby.png','02-voting.png','03-reveal.png'].map(f=>`<img src=screenshots/${f}>`).join('')}
<h2>Demo</h2><video src=screenshots/game-demo.mp4 autoplay loop muted></video><img src=screenshots/game-demo.gif>
<pre style="margin-top:1em;opacity:.5">${sizes.join('\n')}</pre>`;

    writeFileSync(join(ROOT, 'preview.html'), html);
    console.log('\n✨ Done!');
    console.log(`   Preview: file://${join(ROOT, 'preview.html')}`);
  }
}

main().catch(console.error);
