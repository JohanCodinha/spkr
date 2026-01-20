// Debug hooks for screenshot automation
// Stripped from production builds via __DEBUG__ flag (set by esbuild)

import { getState } from './store.js';
import { renderHeader } from './ui.js';

export function emit(event, detail = {}) {
  if (__DEBUG__) {
    const handler = window.__SPKR_HOOKS__?.[event];
    if (handler) handler(detail);
  }
}

// Events:
// - roomCreated: { code }
// - roomJoined: { code }
// - peerJoined: { peerId, count }
// - allPlayersReady: { count }
// - voteCast: { playerId, value }
// - allVotesIn: { count }
// - cardsSettled: { count } - all thrown cards have stopped moving (velocity ~0)
// - revealStarted: {}
// - revealComplete: {} - all cards flipped AND positioned at targets
// - reset: {}

// =============================================================================
// DUMMY PLAYERS (for UI testing)
// =============================================================================

// Dummy player names pool
const DUMMY_NAMES = [
    'Alice Smith', 'Bob Johnson', 'Charlie Brown', 'Diana Prince',
    'Edward Stark', 'Fiona Green', 'George White', 'Hannah Black',
    'Ivan Gray', 'Julia Red', 'Kevin Blue', 'Laura Gold',
    'Michael Silver', 'Nancy Purple', 'Oscar Orange', 'Paula Pink'
];

// Colors for dummy players
const DUMMY_COLORS = [
    '#ef4444', '#f97316', '#f59e0b', '#eab308',
    '#84cc16', '#22c55e', '#14b8a6', '#06b6d4',
    '#0ea5e9', '#3b82f6', '#6366f1', '#8b5cf6',
    '#a855f7', '#d946ef', '#ec4899', '#f43f5e'
];

// Track dummy players
const dummyPlayers = new Map();
let dummyCounter = 0;

// Card values for random voting
const CARD_VALUES = ['1', '2', '3', '5', '8', '13', '21', '?'];

// Reference to castVote function (set via initDebugTools)
let castVoteFn = null;

function generateDummyId() {
    return `dummy-${Date.now()}-${dummyCounter++}`;
}

function getRandomElement(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
}

function getUnusedName() {
    const { localPlayer, players } = getState();
    const usedNames = new Set([localPlayer.name, ...Object.values(players).map(p => p.name)]);

    const available = DUMMY_NAMES.filter(n => !usedNames.has(n));
    if (available.length > 0) {
        return getRandomElement(available);
    }
    return `Player ${dummyCounter + 1}`;
}

function getUnusedColor() {
    const { localPlayer, players } = getState();
    const usedColors = new Set([localPlayer.color, ...Object.values(players).map(p => p.color)]);

    const available = DUMMY_COLORS.filter(c => !usedColors.has(c));
    if (available.length > 0) {
        return getRandomElement(available);
    }
    return `hsl(${Math.random() * 360}, 70%, 50%)`;
}

function getPlayerPosition(index, total) {
    const angle = (index / total) * Math.PI * 2 - Math.PI / 2;
    return {
        x: 0.5 + Math.cos(angle) * 0.6,
        y: 0.5 + Math.sin(angle) * 0.6
    };
}

function updateDummyPositions() {
    const { setPlayer } = getState();
    const allDummies = [...dummyPlayers.values()];
    allDummies.forEach((dummy, i) => {
        dummy.pos = getPlayerPosition(i, allDummies.length);
        setPlayer(dummy.id, dummy);
    });
}

function scheduleRandomVote(dummyId) {
    // Vote after 1-5 seconds
    const delay = 1000 + Math.random() * 4000;

    setTimeout(() => {
        const dummy = dummyPlayers.get(dummyId);
        if (dummy && !dummy.voted && castVoteFn) {
            const vote = getRandomElement(CARD_VALUES);
            dummy.voted = true;
            dummy.vote = vote;

            // Create card for this dummy player
            castVoteFn(vote, dummyId);

            renderHeader();
        }
    }, delay);
}

function updateDummyCount() {
    const countEl = document.getElementById('dummy-count');
    if (countEl) {
        const count = dummyPlayers.size;
        countEl.textContent = count > 0 ? `${count} dummy player${count !== 1 ? 's' : ''} active` : '';
    }
}

export function addDummyPlayer() {
    const { setPlayer } = getState();
    const id = generateDummyId();
    const dummy = {
        id,
        name: getUnusedName(),
        color: getUnusedColor(),
        voted: false,
        vote: null,
        isObserver: false,
        pos: { x: 0.5, y: 0.5 }
    };

    dummyPlayers.set(id, dummy);
    setPlayer(id, dummy);

    // Update positions for all dummies
    updateDummyPositions();

    // Random chance to auto-vote after a delay
    scheduleRandomVote(id);

    renderHeader();
    updateDummyCount();

    return dummy;
}

export function clearDummyPlayers() {
    const { deletePlayer } = getState();
    dummyPlayers.forEach((_, id) => {
        deletePlayer(id);
    });
    dummyPlayers.clear();

    renderHeader();
    updateDummyCount();
}

export function resetDummyPlayers() {
    if (!__DEBUG__) return;

    const { setPlayer } = getState();
    // Reset voted status for all dummy players and schedule new votes
    dummyPlayers.forEach((dummy, id) => {
        dummy.voted = false;
        dummy.vote = null;
        setPlayer(id, dummy);
        scheduleRandomVote(id);
    });
}

// =============================================================================
// LOGO EDITOR (now self-contained in component)
// =============================================================================

// The logo editor is now integrated directly into the card-hand-logo component.
// When __DEBUG__ is true, the component automatically renders its own editor UI.
// No external initialization is needed - simply using <card-hand-logo> in debug
// mode will enable the editor.

export function initLogoEditor() {
    if (!__DEBUG__) return;
    // Editor is now self-contained in the component - nothing to initialize
    console.log('[DEBUG] Logo editor is now self-contained in <card-hand-logo>');
}

export function initDebugTools(castVoteCallback) {
    if (!__DEBUG__) return;

    castVoteFn = castVoteCallback;

    // Inject debug controls into settings panel
    const settingsContent = document.querySelector('.settings-content');
    if (settingsContent) {
        const debugControls = document.createElement('div');
        debugControls.id = 'debug-controls';
        debugControls.innerHTML = `
            <hr>
            <h4 class="settings-subtitle">Debug Tools</h4>
            <div class="debug-buttons">
                <button id="add-dummy-btn" class="debug-btn">+ Add Player</button>
                <button id="clear-dummies-btn" class="debug-btn debug-btn-danger">Clear</button>
            </div>
            <div id="dummy-count" class="dummy-count"></div>
        `;
        settingsContent.appendChild(debugControls);
    }

    // Wire up buttons
    const addBtn = document.getElementById('add-dummy-btn');
    const clearBtn = document.getElementById('clear-dummies-btn');

    if (addBtn) {
        addBtn.addEventListener('click', addDummyPlayer);
    }

    if (clearBtn) {
        clearBtn.addEventListener('click', clearDummyPlayers);
    }

    console.log('[DEBUG] Debug tools initialized');
}
