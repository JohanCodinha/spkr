# Joyful Scrum Poker

<p align="center">
  <img src="src/logo.svg" alt="Joyful Scrum Poker Logo" width="200" />
</p>

<p align="center">
  A fun, physics-based Scrum Poker estimation game that runs entirely in your browser.
</p>

<p align="center">
  <a href="https://tools.joadn.com/spkr/"><strong>Try it live</strong></a> ·
  <a href="https://github.com/JohanCodinha/spkr/releases/latest/download/index.html"><strong>Download</strong></a>
</p>

---

## Demo

<table>
<tr>
<td><img src="https://github.com/JohanCodinha/spkr/releases/latest/download/01-lobby.png" alt="Lobby" width="400" /></td>
<td><img src="https://github.com/JohanCodinha/spkr/releases/latest/download/02-voting.png" alt="Voting" width="400" /></td>
</tr>
<tr>
<td><img src="https://github.com/JohanCodinha/spkr/releases/latest/download/03-reveal.png" alt="Reveal" width="400" /></td>
<td><img src="https://github.com/JohanCodinha/spkr/releases/latest/download/game-demo.gif" alt="Demo" width="400" /></td>
</tr>
</table>

## Features

- **Instant setup, zero friction** — Create a room and share a 6-character code. Teammates join in seconds with no accounts, downloads, or installations required
- **Works anywhere** — Runs entirely in your browser on desktop, tablet, or phone. No software to install or maintain
- **Truly private** — Your estimates never touch a server. All communication happens directly between browsers using peer-to-peer connections
- **Delightful card physics** — Watch estimate cards fly across the table, bounce off each other, and settle naturally. Makes planning sessions feel more engaging
- **Simultaneous reveal** — All votes stay hidden until everyone is ready, then flip over together with a satisfying animation and confetti celebration
- **Shareable invite links** — One click copies a direct join link. Paste it in Slack or your calendar invite and teammates land directly in your room
- **Remembers you** — Your name and color persist between sessions, so you're ready to go every time
- **Fibonacci scale built in** — Standard story point values (1, 2, 3, 5, 8, 13, 21) plus "?" for uncertainty and a coffee break option

## Quick Start

### Use the Hosted Version

1. Go to [tools.joadn.com/spkr/](https://tools.joadn.com/spkr/)
2. Enter your name and pick a color
3. Click **Create Room**
4. Share the room link with your team

### Self-Host

The entire application is a single HTML file. Download [`index.html`](https://github.com/JohanCodinha/spkr/releases/latest/download/index.html) from the latest release and serve it with any static web server:

```bash
# Python
python -m http.server 8000

# Node.js
npx serve .

# Or just open index.html directly in your browser
```

> **Note:** Opening directly in the browser works for testing, but peer connections require HTTPS in production. Any static hosting (Netlify, Vercel, GitHub Pages, Cloudflare Pages) works out of the box.

## How It Works

This application is **100% serverless**. There are no servers to maintain, no databases to manage, and no infrastructure costs.

Players connect directly to each other using **peer-to-peer WebRTC connections**, with peer discovery handled through the **BitTorrent DHT network**. Just share a 6-character room code and start estimating.

## Tech Stack

Built with vanilla JavaScript and two excellent libraries:

- **[Trystero](https://github.com/dmotz/trystero)** — Serverless WebRTC matchmaking using BitTorrent DHT
- **[Matter.js](https://brm.io/matter-js/)** — 2D physics engine for satisfying card interactions

## Development

```bash
# Install dependencies
npm install

# Build the single-file app
npm run build

# Run tests
npm test

# Generate screenshots (requires Playwright)
npm run screenshots
```

The build outputs a self-contained `public/index.html` with all JavaScript, CSS, and assets inlined.

## License

MIT
