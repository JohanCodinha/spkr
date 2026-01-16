// =============================================================================
// STATE
// =============================================================================

// Game state
export let cards = [];
export let particles = [];
export let isRevealed = false;
export let revealComplete = false; // All cards finished flipping
export let ctx = null;
export let width = 0;
export let height = 0;
export let gameStarted = false;

// Players - Map of peerId -> playerInfo
export const players = new Map();
export let localPlayer = {
    id: null, // Will be set to selfId
    name: 'You',
    color: '#3b82f6',
    voted: false,
    vote: null
};

// DOM Elements cache
export let elements = {};

// Matter.js engine
export let engine = null;

// State setters (needed because we're exporting let bindings)
export function setCards(newCards) {
    cards = newCards;
}

export function setParticles(newParticles) {
    particles = newParticles;
}

export function setIsRevealed(revealed) {
    isRevealed = revealed;
}

export function setRevealComplete(complete) {
    revealComplete = complete;
}

export function setCtx(context) {
    ctx = context;
}

export function setDimensions(w, h) {
    width = w;
    height = h;
}

export function setGameStarted(started) {
    gameStarted = started;
}

export function setElements(els) {
    elements = els;
}

export function setEngine(eng) {
    engine = eng;
}

export function setLocalPlayer(player) {
    localPlayer = player;
}

export function updateLocalPlayer(updates) {
    Object.assign(localPlayer, updates);
}

// Helper to get all players (local + remote)
export function getAllPlayers() {
    const allPlayers = [localPlayer];
    players.forEach((player) => {
        allPlayers.push(player);
    });
    return allPlayers;
}
