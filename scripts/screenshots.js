import { chromium } from 'playwright';
import { mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawn } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const PUBLIC = join(ROOT, 'public');
const SCREENSHOTS_DIR = join(ROOT, 'screenshots');

// Start serve in the background
function startServer(port) {
  return new Promise((resolve) => {
    const server = spawn('npx', ['serve', PUBLIC, '-l', port.toString(), '--no-clipboard'], {
      stdio: ['ignore', 'pipe', 'pipe'],
      cwd: ROOT,
    });

    let started = false;
    const onOutput = (data) => {
      if (!started && data.toString().includes('Accepting connections')) {
        started = true;
        resolve(server);
      }
    };

    server.stdout.on('data', onOutput);
    server.stderr.on('data', onOutput);

    // Timeout fallback
    setTimeout(() => {
      if (!started) {
        started = true;
        resolve(server);
      }
    }, 5000);
  });
}

async function main() {
  // Ensure screenshots directory exists
  if (!existsSync(SCREENSHOTS_DIR)) {
    mkdirSync(SCREENSHOTS_DIR, { recursive: true });
  }

  // Start local server
  const PORT = 3458;
  console.log('Starting server...');
  const server = await startServer(PORT);
  const URL = `http://localhost:${PORT}`;
  console.log(`Server running at ${URL}`);

  const browser = await chromium.launch({ headless: true });

  try {
    // ============================================
    // Screenshot 1: Lobby (Create/Join screen)
    // ============================================
    console.log('\n📸 Capturing lobby screenshot...');
    const lobbyContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
    });
    const lobbyPage = await lobbyContext.newPage();
    await lobbyPage.goto(URL);
    await lobbyPage.waitForSelector('#lobby-screen', { state: 'visible' });
    await lobbyPage.waitForTimeout(1000);
    await lobbyPage.screenshot({
      path: join(SCREENSHOTS_DIR, '01-lobby.png'),
    });
    console.log('✅ Lobby screenshot saved');
    await lobbyContext.close();

    // ============================================
    // Screenshot 2 & 3: Game UI with mocked state
    // We'll inject fake game state via JS since P2P requires
    // actual network connections that are hard to simulate
    // ============================================
    console.log('\n🎮 Setting up mocked game state...');

    const gameContext = await browser.newContext({
      viewport: { width: 1280, height: 800 },
      recordVideo: {
        dir: SCREENSHOTS_DIR,
        size: { width: 1280, height: 800 },
      },
    });
    const gamePage = await gameContext.newPage();
    await gamePage.goto(URL);
    await gamePage.waitForSelector('#lobby-screen', { state: 'visible' });

    // Enter a name and create room (this will initialize the game state)
    await gamePage.fill('#lobby-name-input', 'Alice');
    await gamePage.evaluate(() => {
      document.getElementById('lobby-color-input').value = '#e74c3c';
    });

    // Manually transition to game UI and inject mock state
    await gamePage.evaluate(() => {
      // Hide lobby, show game
      document.getElementById('lobby-screen').classList.add('hidden');
      document.getElementById('game-canvas').classList.remove('hidden');
      document.getElementById('ui-layer').classList.remove('hidden');

      // Set room code
      document.getElementById('room-code-display').textContent = 'DEMO42';
    });

    // Wait for game canvas to be visible
    await gamePage.waitForSelector('#game-canvas:not(.hidden)', { state: 'visible' });
    await gamePage.waitForTimeout(500);

    // Inject mock players into the avatar container
    await gamePage.evaluate(() => {
      const players = [
        { name: 'Alice', color: '#e74c3c', voted: true },
        { name: 'Bob', color: '#3498db', voted: true },
        { name: 'Charlie', color: '#2ecc71', voted: true },
        { name: 'Diana', color: '#9b59b6', voted: true },
        { name: 'Eve', color: '#f39c12', voted: true },
      ];

      const container = document.getElementById('avatar-container');
      container.innerHTML = '';

      players.forEach(p => {
        const wrapper = document.createElement('div');
        wrapper.className = 'avatar-item';

        const pill = document.createElement('div');
        pill.className = 'avatar-pill';
        pill.style.backgroundColor = p.color;
        pill.style.opacity = p.voted ? '1' : '0.4';

        const initials = document.createElement('div');
        initials.className = 'avatar-initials';
        initials.innerText = p.name[0].toUpperCase();

        const nameContainer = document.createElement('div');
        nameContainer.className = 'avatar-name-container';

        const nameText = document.createElement('div');
        nameText.className = 'avatar-name';
        nameText.innerText = p.name;

        nameContainer.appendChild(nameText);
        pill.appendChild(initials);
        pill.appendChild(nameContainer);
        wrapper.appendChild(pill);
        container.appendChild(wrapper);
      });
    });

    // Build the card deck
    await gamePage.evaluate(() => {
      const deck = document.getElementById('card-deck');
      deck.innerHTML = '';
      const values = [1, 2, 3, 5, 8, 13, 21, '?', '☕'];
      values.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'deck-card';
        btn.innerText = val;
        deck.appendChild(btn);
      });
    });

    // Draw mock cards on canvas
    await gamePage.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      const ctx = canvas.getContext('2d');
      const dpr = window.devicePixelRatio || 1;
      const w = window.innerWidth;
      const h = window.innerHeight;

      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = w + 'px';
      canvas.style.height = h + 'px';
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

      // Draw table background
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2);
      ctx.fill();

      // Draw some cards scattered on the table
      const players = [
        { name: 'Alice', color: '#e74c3c', vote: '5' },
        { name: 'Bob', color: '#3498db', vote: '8' },
        { name: 'Charlie', color: '#2ecc71', vote: '5' },
        { name: 'Diana', color: '#9b59b6', vote: '8' },
        { name: 'Eve', color: '#f39c12', vote: '5' },
      ];

      const cardW = 60;
      const cardH = 90;
      const centerX = w / 2;
      const centerY = h / 2;
      const radius = Math.min(w, h) * 0.25;

      players.forEach((p, i) => {
        const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2;
        // Scatter cards near center
        const scatter = 80;
        const x = centerX + (Math.random() - 0.5) * scatter;
        const y = centerY + (Math.random() - 0.5) * scatter;
        const rotation = (Math.random() - 0.5) * 0.5;

        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(rotation);

        // Card shadow
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        // Card back (colored)
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
        ctx.fill();

        // Card border
        ctx.strokeStyle = 'rgba(255,255,255,0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();

        ctx.restore();
      });
    });

    await gamePage.waitForTimeout(500);

    // Screenshot: Voting phase (cards face down)
    console.log('\n📸 Capturing voting screenshot...');
    await gamePage.screenshot({
      path: join(SCREENSHOTS_DIR, '02-voting.png'),
    });
    console.log('✅ Voting screenshot saved');

    // Now draw revealed cards
    console.log('\n🎬 Simulating reveal...');
    await gamePage.evaluate(() => {
      const canvas = document.getElementById('game-canvas');
      const ctx = canvas.getContext('2d');
      const w = window.innerWidth;
      const h = window.innerHeight;

      // Clear and redraw
      ctx.clearRect(0, 0, w, h);

      // Draw table background
      ctx.fillStyle = '#e2e8f0';
      ctx.beginPath();
      ctx.arc(w / 2, h / 2, Math.min(w, h) * 0.4, 0, Math.PI * 2);
      ctx.fill();

      const players = [
        { name: 'Alice', color: '#e74c3c', vote: '5' },
        { name: 'Bob', color: '#3498db', vote: '8' },
        { name: 'Charlie', color: '#2ecc71', vote: '5' },
        { name: 'Diana', color: '#9b59b6', vote: '8' },
        { name: 'Eve', color: '#f39c12', vote: '5' },
      ];

      const cardW = 60;
      const cardH = 90;
      const centerX = w / 2;
      const centerY = h / 2;
      const cardRadius = Math.min(w, h) * 0.22;

      players.forEach((p, i) => {
        const angle = (i / players.length) * Math.PI * 2 - Math.PI / 2;
        const x = centerX + Math.cos(angle) * cardRadius;
        const y = centerY + Math.sin(angle) * cardRadius;

        ctx.save();
        ctx.translate(x, y);

        // Card shadow
        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        // Card face (white)
        ctx.fillStyle = 'white';
        ctx.beginPath();
        ctx.roundRect(-cardW / 2, -cardH / 2, cardW, cardH, 8);
        ctx.fill();

        // Card border with player color
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 3;
        ctx.stroke();

        // Card value
        ctx.shadowColor = 'transparent';
        ctx.fillStyle = '#1e293b';
        ctx.font = 'bold 24px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.vote, 0, 0);

        // Player name
        ctx.font = 'bold 10px Nunito, sans-serif';
        ctx.fillStyle = '#94a3b8';
        ctx.fillText(p.name, 0, cardH / 2 - 12);

        ctx.restore();
      });

      // Draw reset button in center
      ctx.fillStyle = 'white';
      ctx.shadowColor = 'rgba(0,0,0,0.1)';
      ctx.shadowBlur = 20;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 50, 0, Math.PI * 2);
      ctx.fill();

      // Reset icon (simple circle arrow)
      ctx.strokeStyle = '#64748b';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.arc(centerX, centerY, 20, 0.5, Math.PI * 1.7);
      ctx.stroke();

      // Arrow head
      ctx.beginPath();
      ctx.moveTo(centerX + 12, centerY - 18);
      ctx.lineTo(centerX + 20, centerY - 8);
      ctx.lineTo(centerX + 8, centerY - 8);
      ctx.fillStyle = '#64748b';
      ctx.fill();

      // Hide deck
      document.getElementById('card-deck').classList.add('revealed');
    });

    await gamePage.waitForTimeout(500);

    // Screenshot: Cards revealed
    console.log('\n📸 Capturing reveal screenshot...');
    await gamePage.screenshot({
      path: join(SCREENSHOTS_DIR, '03-reveal.png'),
    });
    console.log('✅ Reveal screenshot saved');

    // Close context to finalize video
    await gameContext.close();

    // ============================================
    // Convert video to GIF
    // ============================================
    console.log('\n🎬 Converting video to GIF...');

    const files = readdirSync(SCREENSHOTS_DIR);
    const videoFile = files.find(f => f.endsWith('.webm'));

    if (videoFile) {
      const videoPath = join(SCREENSHOTS_DIR, videoFile);
      const gifPath = join(SCREENSHOTS_DIR, 'game-demo.gif');

      try {
        execSync(`ffmpeg -y -i "${videoPath}" -vf "fps=12,scale=800:-1:flags=lanczos,split[s0][s1];[s0]palettegen[p];[s1][p]paletteuse" -loop 0 "${gifPath}"`, {
          stdio: 'pipe',
        });
        console.log('✅ GIF created: game-demo.gif');
        unlinkSync(videoPath);
      } catch (e) {
        console.log('⚠️ ffmpeg not available in PATH, keeping video file');
        console.log('   Install ffmpeg to generate GIF: brew install ffmpeg');
      }
    }

  } finally {
    await browser.close();
    server.kill();
    console.log('\n✨ Done! Screenshots saved to ./screenshots/');
  }
}

main().catch(console.error);
