// Joyful Scrum Poker - Game Logic with Multiplayer Support

import * as mp from './multiplayer.js';
import { config } from './config.js';
import {
    FIBONACCI,
    RESET_BUTTON_RADIUS,
    REVEAL_RADIUS_RATIO,
    PARTICLE_GRAVITY,
    PARTICLE_DECAY,
    NAME_ADJECTIVES,
    NAME_ANIMALS,
    RANDOM_COLORS,
    STORAGE_KEY_NAME,
    STORAGE_KEY_COLOR
} from './constants.js';
import { getState, subscribe } from './store.js';
import { shallow } from 'zustand/vanilla/shallow';
import { getCardSize, getDisplayName, renderCardFront, renderCardBack } from './drawing.js';
import { initEngine, clearEngine, spawnCard, setCardStatic, setCardPosition, setCardAngle, updateEngine, recallCard, removeCardBody } from './physics.js';
import { drawTable, drawCards, drawResetButton, drawParticles, spawnConfetti } from './drawing.js';
import { cacheElements, toggleSettings, updateConfig, updateIdentity, renderHeader } from './ui.js';
import {
    showLobby, hideLobby, hideLobbyStatus,
    createRoom, joinRoom, leaveRoom, copyRoomCode, checkUrlForRoom,
    setStartGameCallback
} from './lobby.js';
import {
    initConnectionStatus,
    setAdvertising,
    updatePeerCount,
    reset as resetConnectionStatus
} from './connection-status.js';
import { emit, initDebugTools, resetDummyPlayers } from './debug.js';

// =============================================================================
// LOCAL HELPERS
// =============================================================================

function getPlayerPositions(count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = 0.5 + Math.cos(angle) * 0.6;
        const y = 0.5 + Math.sin(angle) * 0.6;
        positions.push({ x, y });
    }
    return positions;
}

function generateRandomName() {
    const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
    const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
    return `${adj} ${animal}`;
}

function generateRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

function loadIdentityFromStorage() {
    const savedName = localStorage.getItem(STORAGE_KEY_NAME);
    const savedColor = localStorage.getItem(STORAGE_KEY_COLOR);
    return { name: savedName, color: savedColor };
}

// =============================================================================
// INITIALIZATION
// =============================================================================

function init() {
    cacheElements();
    setupEventListeners();

    const { elements, setCtx, updateLocalPlayer } = getState();
    setCtx(elements.canvas.getContext('2d'));

    // Initialize Matter.js engine
    initEngine();

    // Initialize connection status UI
    initConnectionStatus();

    // Load saved name or generate random placeholder
    const saved = loadIdentityFromStorage();
    const randomName = generateRandomName();

    // Set placeholder to random name suggestion
    elements.lobbyNameInput.placeholder = randomName;

    // If saved name exists, use it as value; otherwise leave empty (will use placeholder)
    if (saved.name) {
        elements.lobbyNameInput.value = saved.name;
        updateLocalPlayer({ name: saved.name });
    } else {
        updateLocalPlayer({ name: randomName }); // Will be used if input stays empty
    }

    // Always use random color in lobby (only saved when entering room)
    const color = generateRandomColor();
    updateLocalPlayer({ color });
    elements.lobbyColorInput.value = color;
    elements.lobbyColorPreview.style.backgroundColor = color;

    // Set up multiplayer handlers
    setupMultiplayerHandlers();

    // Set callback for lobby to start game
    setStartGameCallback(startGame);

    // Subscribe to player state changes to auto-render header
    subscribe(
        (state) => ({ players: state.players, localPlayer: state.localPlayer }),
        () => renderHeader(),
        { equalityFn: shallow }
    );

    // Start render loop
    resize();
    window.addEventListener('resize', resize);
    requestAnimationFrame(loop);

    // Check for room code in URL and auto-join
    checkUrlForRoom();
}

function setupEventListeners() {
    const { elements, updateLocalPlayer } = getState();

    // Lobby buttons
    elements.createRoomBtn.addEventListener('click', createRoom);
    elements.joinRoomBtn.addEventListener('click', joinRoom);

    // Room code input - allow Enter to join
    elements.roomCodeInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') joinRoom();
    });

    // Lobby color preview (don't save until room entry)
    elements.lobbyColorInput.addEventListener('input', (e) => {
        const { elements, updateLocalPlayer } = getState();
        elements.lobbyColorPreview.style.backgroundColor = e.target.value;
        updateLocalPlayer({ color: e.target.value });
    });

    // Game header buttons
    elements.copyRoomBtn.addEventListener('click', copyRoomCode);
    elements.leaveRoomBtn.addEventListener('click', handleLeaveRoom);
    elements.settingsBtn.addEventListener('click', toggleSettings);

    // Identity controls
    elements.colorInput.addEventListener('input', (e) => {
        updateIdentity('color', e.target.value);
    });
    elements.nameInput.addEventListener('input', (e) => {
        updateIdentity('name', e.target.value);
    });

    // Reveal button
    elements.revealBtn.addEventListener('click', revealCards);

    // Config sliders
    document.querySelectorAll('[data-config]').forEach(slider => {
        slider.addEventListener('input', (e) => {
            updateConfig(e.target.dataset.config, e.target.value);
        });
    });
}

function handleLeaveRoom() {
    leaveRoom();
    resetGameState();
}

function startGame() {
    hideLobby();
    hideLobbyStatus();

    const { elements, localPlayer, players } = getState();

    elements.canvas.addEventListener('click', handleCanvasClick);
    elements.canvas.addEventListener('mousemove', handleCanvasMove, { passive: true });

    // Start in advertising mode (waiting for peers)
    setAdvertising();
    updatePeerCount(Object.keys(players).length);

    buildDeck();

    // Hide deck for observers
    if (localPlayer.isObserver) {
        elements.deck.classList.add('hidden');
    }

    renderHeader();

    // Initialize debug tools (only in debug builds)
    initDebugTools(spawnCardForDummy);
}

// Callback for debug tools to spawn cards for dummy players
function spawnCardForDummy(value, playerId) {
    const { players, cards } = getState();
    const player = players[playerId];
    if (player && !cards.some(c => c.player.id === playerId)) {
        spawnCard(player, value);
        checkState();
    }
}

function resize() {
    const { elements, ctx, setDimensions } = getState();
    const dpr = window.devicePixelRatio || 1;
    const w = window.innerWidth;
    const h = window.innerHeight;
    setDimensions(w, h);
    elements.canvas.width = w * dpr;
    elements.canvas.height = h * dpr;
    elements.canvas.style.width = w + 'px';
    elements.canvas.style.height = h + 'px';
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}

function buildDeck() {
    const { elements } = getState();
    elements.deck.innerHTML = '';
    FIBONACCI.forEach(val => {
        const btn = document.createElement('button');
        btn.className = 'deck-card';
        btn.innerText = val;
        btn.setAttribute('role', 'button');
        btn.setAttribute('aria-label', `Vote ${val}`);
        btn.onclick = () => userVote(val);
        btn.onkeydown = (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                userVote(val);
            }
        };
        elements.deck.appendChild(btn);
    });
}

// =============================================================================
// EVENT HANDLERS
// =============================================================================

function handleCanvasClick(e) {
    const { isRevealed, elements, width, height } = getState();
    if (!isRevealed) return;

    const rect = elements.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = width / 2;
    const cy = height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    if (dist <= RESET_BUTTON_RADIUS) {
        resetGame();
    }
}

function handleCanvasMove(e) {
    const { isRevealed, elements, width, height } = getState();
    if (!isRevealed) {
        elements.canvas.style.cursor = 'default';
        return;
    }

    const rect = elements.canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const cx = width / 2;
    const cy = height / 2;
    const dist = Math.sqrt((x - cx) ** 2 + (y - cy) ** 2);

    elements.canvas.style.cursor = dist <= RESET_BUTTON_RADIUS ? 'pointer' : 'default';
}

// =============================================================================
// MULTIPLAYER EVENT HANDLERS
// =============================================================================

function setupMultiplayerHandlers() {
    mp.onPeerJoin((peerId) => {
        console.log('Peer joined:', peerId);
        const { localPlayer, isRevealed } = getState();

        // Broadcast our info so they know about us
        mp.broadcastPlayerInfo({
            name: localPlayer.name,
            color: localPlayer.color,
            voted: localPlayer.voted,
            isObserver: localPlayer.isObserver
        });

        // If we have voted, re-broadcast so new peer sees our card
        if (localPlayer.voted && localPlayer.vote !== null) {
            mp.broadcastVote(localPlayer.vote, {
                id: localPlayer.id,
                name: localPlayer.name,
                color: localPlayer.color
            });
        }

        // If cards are revealed, let the new peer know
        if (isRevealed) {
            mp.broadcastReveal();
        }
    });

    mp.onPeerLeave((peerId) => {
        console.log('Peer left:', peerId);
        const { deletePlayer, filterCards } = getState();

        // Remove player and their cards
        deletePlayer(peerId);
        filterCards(c => c.player.id !== peerId);

        // Update connection status - need fresh state after deletions
        const { players } = getState();
        updatePeerCount(Object.keys(players).length);

        checkState();
    });

    mp.onPlayerInfoReceived((data, peerId) => {
        console.log('Player info received:', peerId, data);
        const { players, setPlayer } = getState();
        const existingPlayer = players[peerId];
        const isNewPlayer = !existingPlayer;

        setPlayer(peerId, {
            id: peerId,
            name: data.name,
            color: data.color,
            voted: data.voted || (existingPlayer?.voted ?? false),
            isObserver: data.isObserver || false,
            pos: existingPlayer?.pos || { x: 0.5, y: 0.5 }
        });

        // Update connection status when a new player joins
        if (isNewPlayer) {
            // Need fresh state after setPlayer mutation
            const updatedPlayers = getState().players;
            const playerCount = Object.keys(updatedPlayers).length;
            updatePeerCount(playerCount);
            emit('peerJoined', { peerId, count: playerCount + 1 }); // +1 for local player
        }

        updatePlayerPositions();
    });

    mp.onVoteReceived((data, peerId) => {
        console.log('Vote received:', peerId, data);
        const { players, cards, isRevealed, setPlayer, findCardForPlayer, width, height } = getState();
        let player = players[peerId];

        // If player doesn't exist yet, create from vote data
        if (!player && data.player) {
            player = {
                id: peerId,
                name: data.player.name,
                color: data.player.color,
                voted: false,
                pos: { x: 0.5, y: 0.5 }
            };
            setPlayer(peerId, player);
            updatePlayerPositions();
            updatePeerCount(Object.keys(getState().players).length);
        }

        if (!player) return;

        // Immediately update player state (decoupled from animation)
        player.voted = true;
        player.vote = data.value;
        setPlayer(peerId, player);

        // Check if this player already has a card (vote change)
        const existingCard = findCardForPlayer(peerId);

        if (existingCard) {
            // Player is changing their vote - recall existing card, then spawn new
            if (!existingCard.isRecalling) {
                const targetX = player.pos.x * width;
                const targetY = player.pos.y * height;
                recallCard(existingCard, targetX, targetY);
            }
            // Store pending vote for card spawn after recall
            existingCard.pendingVote = data.value;
        } else {
            // New vote - spawn card
            const card = spawnCard(player, data.value);

            // If already revealed, position this card immediately
            if (isRevealed && card) {
                positionCardsForReveal();
            }
        }

        checkState();
    });

    mp.onRevealReceived((data, peerId) => {
        console.log('Reveal received from:', peerId);
        if (!getState().isRevealed) {
            doReveal();
        }
    });

    mp.onResetReceived((data, peerId) => {
        console.log('Reset received from:', peerId);
        doReset();
    });

    mp.onStateRequest((data, peerId) => {
        const { isRevealed, players, localPlayer } = getState();
        // Send current game state to the requesting peer
        const state = {
            isRevealed,
            players: Object.entries(players),
            localVote: localPlayer.voted ? localPlayer.vote : null
        };
        mp.sendStateTo(peerId, state);
    });

    mp.onStateSync((data, peerId) => {
        // Sync state from another peer
        if (data.isRevealed && !getState().isRevealed) {
            doReveal();
        }
    });
}

function updatePlayerPositions() {
    const { players, setPlayer } = getState();
    const remotePlayers = Object.values(players);
    const positions = getPlayerPositions(remotePlayers.length);

    remotePlayers.forEach((player, i) => {
        player.pos = positions[i];
        setPlayer(player.id, player);
    });
}

// =============================================================================
// GAME ACTIONS
// =============================================================================

// Track pending card spawn after recall animation
let pendingLocalCardSpawn = null;

function userVote(val) {
    const { localPlayer, isRevealed, findCardForPlayer, updateLocalPlayer, width, height } = getState();
    if (localPlayer.isObserver) return;
    if (isRevealed) return; // Can't change vote after reveal

    // Immediately update state and broadcast (decoupled from animation)
    updateLocalPlayer({ voted: true, vote: val });
    updateDeckSelection(val);

    const updatedLocalPlayer = getState().localPlayer;

    // Broadcast to peers immediately
    mp.broadcastVote(val, {
        id: updatedLocalPlayer.id,
        name: updatedLocalPlayer.name,
        color: updatedLocalPlayer.color
    });

    // Handle animation: recall existing card if any, then spawn new
    const existingCard = findCardForPlayer(localPlayer.id);
    if (existingCard) {
        // Start recall animation - card goes back to player position
        if (!existingCard.isRecalling) {
            recallCard(existingCard, width * 0.5, height * 1.1);
        }
        // Queue the new card to spawn after recall completes
        pendingLocalCardSpawn = val;
    } else {
        // No existing card, spawn directly
        spawnCard({ ...updatedLocalPlayer, pos: { x: 0.5, y: 1.1 } }, val);
    }

    checkState();
}

function updateDeckSelection(selectedVal) {
    const { elements } = getState();
    const cards = elements.deck.querySelectorAll('.deck-card');
    cards.forEach(card => {
        if (card.innerText === String(selectedVal)) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
}

function checkState() {
    const { areAllVotesIn, canObserverReveal, elements, getVotedCount } = getState();

    if (areAllVotesIn() || canObserverReveal()) {
        elements.revealBtn.classList.remove('hidden');
        elements.revealBtn.classList.add('scale-in');
        if (areAllVotesIn()) {
            emit('allVotesIn', { count: getVotedCount() });
        }
    }
}

function revealCards() {
    doReveal();
    mp.broadcastReveal();
}

function positionCardsForReveal() {
    const { cards, width, height } = getState();
    const cardSize = getCardSize();
    const numCards = cards.length;
    const cardDiagonal = Math.sqrt(cardSize.w * cardSize.w + cardSize.h * cardSize.h);
    const minRadiusForSpacing = (cardDiagonal * numCards) / (2 * Math.PI) + cardDiagonal * 0.3;
    const baseRadius = Math.min(width, height) * REVEAL_RADIUS_RATIO;
    const radius = Math.max(baseRadius, minRadiusForSpacing);

    cards.forEach((card, i) => {
        setCardStatic(card, true);
        const angle = (i / cards.length) * Math.PI * 2 - Math.PI / 2;
        card.targetX = width / 2 + Math.cos(angle) * radius;
        card.targetY = height / 2 + Math.sin(angle) * radius;
        card.targetAngle = 0;
    });
}

function doReveal() {
    const { elements, reveal } = getState();
    reveal();
    elements.revealBtn.classList.add('hidden');
    elements.deck.classList.add('revealed');

    positionCardsForReveal();
    spawnConfetti();
    emit('revealStarted', {});
}

function resetGame() {
    doReset();
    mp.broadcastReset();
}

function doReset() {
    resetGameState();
    resetDummyPlayers();
}

function resetGameState() {
    const { resetGame, elements, localPlayer } = getState();

    clearEngine();
    resetGame();

    // Clear pending card spawn
    pendingLocalCardSpawn = null;

    if (elements.revealBtn) {
        elements.revealBtn.classList.add('hidden');
    }
    if (elements.deck) {
        elements.deck.classList.remove('voted', 'revealed');
        // Clear selection from deck cards
        elements.deck.querySelectorAll('.deck-card.selected').forEach(card => {
            card.classList.remove('selected');
        });
        // Keep deck hidden for observers
        if (localPlayer.isObserver) {
            elements.deck.classList.add('hidden');
        }
    }
}

// =============================================================================
// MAIN LOOP
// =============================================================================

function loop() {
    requestAnimationFrame(loop);

    const { gameStarted, ctx, width, height } = getState();

    if (!gameStarted) {
        // Just clear in lobby
        ctx.clearRect(0, 0, width, height);
        return;
    }

    updateEngine();
    updateLogic();
    ctx.clearRect(0, 0, width, height);
    drawTable();
    drawParticles();
    drawCards();
    drawResetButton();
}

function updateLogic() {
    const { isRevealed, cards, particles, revealComplete, setRevealComplete, setParticles, removeCardForPlayer, localPlayer } = getState();

    // Handle recalling cards (vote changes)
    const recallingCards = cards.filter(c => c.isRecalling);
    for (const card of recallingCards) {
        const smooth = config.revealSmooth * 1.5; // Slightly faster for recall
        const cx = card.body.position.x;
        const cy = card.body.position.y;

        setCardPosition(card,
            cx + (card.recallTargetX - cx) * smooth,
            cy + (card.recallTargetY - cy) * smooth
        );

        // Check if card has reached target (or close enough)
        const dx = Math.abs(card.body.position.x - card.recallTargetX);
        const dy = Math.abs(card.body.position.y - card.recallTargetY);

        if (dx < 20 && dy < 20) {
            // Card reached player, remove it and spawn new card if pending
            const playerId = card.player.id;
            const pendingVote = card.pendingVote;
            const player = card.player;

            removeCardBody(card);
            removeCardForPlayer(playerId);

            // If this was local player's card and there's a pending spawn, do it
            if (playerId === localPlayer.id && pendingLocalCardSpawn !== null) {
                const val = pendingLocalCardSpawn;
                pendingLocalCardSpawn = null;
                const updatedLocalPlayer = getState().localPlayer;
                spawnCard({ ...updatedLocalPlayer, pos: { x: 0.5, y: 1.1 } }, val);
            } else if (pendingVote !== undefined && player) {
                // Remote player's recall completed - spawn their new card
                spawnCard(player, pendingVote);
            }
        }
    }

    if (isRevealed) {
        let allSettled = cards.length > 0;
        cards.forEach(card => {
            const smooth = config.revealSmooth;
            const cx = card.body.position.x;
            const cy = card.body.position.y;

            setCardPosition(card,
                cx + (card.targetX - cx) * smooth,
                cy + (card.targetY - cy) * smooth
            );

            const ca = card.body.angle;
            setCardAngle(card, ca + (card.targetAngle - ca) * smooth);

            if (card.flipProgress < 1) {
                card.flipProgress += config.flipSpeed;
            }

            // Check if card has settled: flipped AND positioned
            const positionSettled =
                Math.abs(card.body.position.x - card.targetX) < 2 &&
                Math.abs(card.body.position.y - card.targetY) < 2;
            const flipSettled = card.flipProgress >= 1;

            if (!positionSettled || !flipSettled) {
                allSettled = false;
            }
        });

        // Emit revealComplete when all cards have finished flipping AND moving
        if (allSettled && !revealComplete) {
            setRevealComplete(true);
            emit('revealComplete', {});
        }
    } else if (cards.length > 0) {
        // Check if thrown cards have settled (for voting phase)
        const velocityThreshold = 0.5;
        const allCardsSettled = cards.every(card => {
            const v = card.body.velocity;
            const av = card.body.angularVelocity;
            return Math.abs(v.x) < velocityThreshold &&
                   Math.abs(v.y) < velocityThreshold &&
                   Math.abs(av) < velocityThreshold;
        });

        if (allCardsSettled && !cards._settledEmitted) {
            cards._settledEmitted = true;
            emit('cardsSettled', { count: cards.length });
        }
    }

    // Update particles in place
    const updatedParticles = particles.filter(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += PARTICLE_GRAVITY;
        p.life -= PARTICLE_DECAY;
        return p.life > 0;
    });

    // Only update if changed
    if (updatedParticles.length !== particles.length) {
        setParticles(updatedParticles);
    }
}

// =============================================================================
// MOCK API FOR SCREENSHOTS (stripped from production builds)
// =============================================================================

if (__DEBUG__) {
    window.__SPKR_MOCK__ = {
        // Start game without P2P (for mock mode)
        startGame(name, color, isObserver = false) {
            const { elements, updateLocalPlayer } = getState();
            updateLocalPlayer({ name, color, id: 'local-mock', isObserver });
            elements.colorInput.value = color;
            elements.colorPreview.style.backgroundColor = color;
            elements.nameInput.value = name;
            elements.roomCodeDisplay.textContent = 'MOCK';
            hideLobby();
            hideLobbyStatus();
            setAdvertising();
            buildDeck();
            if (isObserver) {
                elements.deck.classList.add('hidden');
            }
            renderHeader();
        },
        // Local player votes
        vote(value) {
            userVote(value);
        },
        // Add a fake remote player and optionally spawn their card
        addPlayer(id, name, color, vote, isObserver = false) {
            const { players, setPlayer } = getState();
            const playerCount = Object.keys(players).length;
            const pos = getPlayerPositions(playerCount + 1)[playerCount];
            const player = { id, name, color, voted: !isObserver, vote: isObserver ? null : vote, isObserver, pos };
            setPlayer(id, player);
            if (!isObserver) {
                spawnCard(player, vote);
            }
            // Need fresh state after setPlayer mutation
            updatePeerCount(Object.keys(getState().players).length);
            checkState();
        },
        // Trigger reveal
        reveal() {
            doReveal();
        },
        // Get current state
        getMockState() {
            const state = getState();
            return {
                players: Object.keys(state.players).length,
                cards: state.cards.length,
                isRevealed: state.isRevealed,
                revealComplete: state.revealComplete
            };
        },
        // Pure rendering functions for testing
        getCardSize,
        getDisplayName,
        renderCardFront,
        renderCardBack
    };
}

// =============================================================================
// START
// =============================================================================

init();
