# Screenshot Automation

This document explains how the automated screenshot system works for generating README images and demo GIFs.

## Overview

The screenshot system uses [Playwright](https://playwright.dev/) to orchestrate real browser instances that connect via P2P and play through a game session. This ensures screenshots reflect actual gameplay, not mocked states.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     scripts/screenshots.js                       │
│  - Launches 5 browser contexts                                   │
│  - Orchestrates game flow (create room → join → vote → reveal)  │
│  - Captures screenshots at key moments                           │
│  - Records video and converts to GIF                             │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                      src/debug.js                                │
│  - Exposes window.__SPKR_HOOKS__ for event callbacks            │
│  - Game emits events: peerJoined, allVotesIn, revealStarted     │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Game Code (lobby.js, game.js)                 │
│  - Calls emit() at key moments                                   │
│  - Hooks only fire if window.__SPKR_HOOKS__ is set              │
└─────────────────────────────────────────────────────────────────┘
```

## Debug Hooks

The game exposes hooks via `src/debug.js` that only activate when `window.__SPKR_HOOKS__` is set:

```javascript
// src/debug.js
export function emit(event, detail = {}) {
  if (typeof window !== 'undefined' && window.__SPKR_HOOKS__) {
    const handler = window.__SPKR_HOOKS__[event];
    if (handler) handler(detail);
  }
}
```

### Available Events

| Event | Detail | Emitted When |
|-------|--------|--------------|
| `roomCreated` | `{ code }` | Host creates a new room |
| `roomJoined` | `{ code }` | Player joins existing room |
| `peerJoined` | `{ peerId, count }` | New peer connects (count includes local player) |
| `allVotesIn` | `{ count }` | All players have voted |
| `revealStarted` | `{}` | Reveal animation begins |

### Adding New Hooks

1. Import emit in the relevant file:
   ```javascript
   import { emit } from './debug.js';
   ```

2. Call emit at the desired moment:
   ```javascript
   emit('eventName', { key: 'value' });
   ```

3. Listen in screenshots.js:
   ```javascript
   window.__SPKR_HOOKS__.eventName = (detail) => {
     // Handle event
   };
   ```

## Screenshot Script Flow

```
1. Start HTTP server serving built app
2. Capture lobby screenshot
3. Create 5 browser contexts (Alice, Bob, Charlie, Diana, Eve)
4. Alice creates room, others join
   └── Wait for peerJoined events (count reaches 5)
5. Each player votes in sequence
   └── Wait for reveal button to appear
6. Capture voting screenshot
7. Click reveal, wait for animation
8. Capture reveal screenshot
9. Convert recorded video to GIF with speed adjustment
```

## GIF Speed Adjustment

The connection phase (P2P setup) is slow (~25s) but uninteresting. The script:

1. Records video from the start
2. Tracks when all players connect (`connectionPhaseSeconds`)
3. Uses ffmpeg to speed up the first part 10x:

```javascript
const filter = `[0:v]split=2[conn][action];` +
  `[conn]trim=0:${connectionPhaseSeconds},setpts=PTS/10[fast];` +
  `[action]trim=${connectionPhaseSeconds},setpts=PTS-STARTPTS[normal];` +
  `[fast][normal]concat=n=2:v=1[out];` +
  `[out]fps=15,scale=960:-1:flags=lanczos,split[s0][s1];` +
  `[s0]palettegen[p];[s1][p]paletteuse`;
```

Result: ~25s connection becomes ~2.5s, voting/reveal plays at normal speed.

## Running Locally

```bash
# Install dependencies
npm install

# Install Playwright browsers
npx playwright install chromium

# Generate screenshots
npm run screenshots
```

Output files in `screenshots/`:
- `01-lobby.png` - Join/create room screen
- `02-voting.png` - All players voted, cards on table
- `03-reveal.png` - Cards revealed with votes
- `game-demo.gif` - Animated demo

## CI Integration

The GitHub Action (`.github/workflows/build.yml`) runs screenshots on every push:

```yaml
- name: Install Playwright browsers
  run: npx playwright install chromium --with-deps

- name: Generate screenshots
  run: npm run screenshots
```

Screenshots are auto-committed if changed.

## Configuration

Edit `scripts/screenshots.js` to customize:

```javascript
// Players and their votes
const PLAYERS = [
  { name: 'Alice', color: '#8b5cf6', vote: '5' },
  { name: 'Bob', color: '#3b82f6', vote: '8' },
  // ...
];

// Resolution (2x for retina)
const viewport = { width: 1920, height: 1080 };
const deviceScaleFactor = 2;
```

## Troubleshooting

**Screenshots are blank or incorrect:**
- Ensure `npm run build` was run first
- Check browser console for errors in headed mode: `chromium.launch({ headless: false })`

**Timeout waiting for peers:**
- P2P via BitTorrent can be slow; increase timeout in `waitForPeerCount()`
- Check network connectivity

**GIF conversion fails:**
- Requires ffmpeg: `brew install ffmpeg` (macOS)
- Falls back to simple conversion without speed adjustment

**Hooks not firing:**
- Verify `setupHooks(page)` is called before game actions
- Check that game was rebuilt after adding emit() calls
