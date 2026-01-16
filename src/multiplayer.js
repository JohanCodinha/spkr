// Multiplayer module using Trystero for P2P communication
// Uses BitTorrent strategy for serverless peer discovery

import { joinRoom as trysteroJoinRoom, selfId } from 'https://esm.sh/trystero/torrent';

// =============================================================================
// CONSTANTS
// =============================================================================

const APP_ID = 'joyful-scrum-poker-v1';
const ROOM_CODE_LENGTH = 6;
const ROOM_CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // Avoid confusing chars

// =============================================================================
// STATE
// =============================================================================

let room = null;
let currentRoomCode = null;
let peers = new Map(); // peerId -> playerInfo
let actions = null;

// Callbacks to game.js
let onPeerJoinCallback = null;
let onPeerLeaveCallback = null;
let onVoteReceivedCallback = null;
let onRevealReceivedCallback = null;
let onResetReceivedCallback = null;
let onPlayerInfoCallback = null;
let onStateRequestCallback = null;
let onStateSyncCallback = null;

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

function generateRoomCode() {
    let code = '';
    for (let i = 0; i < ROOM_CODE_LENGTH; i++) {
        code += ROOM_CODE_CHARS[Math.floor(Math.random() * ROOM_CODE_CHARS.length)];
    }
    return code;
}

function normalizeRoomCode(code) {
    return code.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

// =============================================================================
// ROOM MANAGEMENT
// =============================================================================

export function createNewRoom() {
    const code = generateRoomCode();
    return connectToRoom(code);
}

export function joinExistingRoom(code) {
    const normalizedCode = normalizeRoomCode(code);
    if (normalizedCode.length !== ROOM_CODE_LENGTH) {
        throw new Error('Invalid room code');
    }
    return connectToRoom(normalizedCode);
}

function connectToRoom(code) {
    // Leave existing room if any
    if (room) {
        room.leave();
        room = null;
        peers.clear();
    }

    currentRoomCode = code;

    const config = { appId: `${APP_ID}-${code}` };
    room = trysteroJoinRoom(config, code);

    // Set up actions for data exchange
    setupActions();

    // Handle peer events
    room.onPeerJoin(handlePeerJoin);
    room.onPeerLeave(handlePeerLeave);

    return { code, peerId: selfId };
}

function setupActions() {
    // Create actions for game synchronization
    const [sendVote, onVote] = room.makeAction('vote');
    const [sendReveal, onReveal] = room.makeAction('reveal');
    const [sendReset, onReset] = room.makeAction('reset');
    const [sendPlayerInfo, onPlayerInfo] = room.makeAction('playerInfo');
    const [sendStateRequest, onStateRequest] = room.makeAction('stateRequest');
    const [sendStateSync, onStateSync] = room.makeAction('stateSync');

    // Store send functions
    actions = {
        sendVote,
        sendReveal,
        sendReset,
        sendPlayerInfo,
        sendStateRequest,
        sendStateSync
    };

    // Set up receive handlers
    onVote((data, peerId) => {
        if (onVoteReceivedCallback) {
            onVoteReceivedCallback(data, peerId);
        }
    });

    onReveal((data, peerId) => {
        if (onRevealReceivedCallback) {
            onRevealReceivedCallback(data, peerId);
        }
    });

    onReset((data, peerId) => {
        if (onResetReceivedCallback) {
            onResetReceivedCallback(data, peerId);
        }
    });

    onPlayerInfo((data, peerId) => {
        peers.set(peerId, data);
        if (onPlayerInfoCallback) {
            onPlayerInfoCallback(data, peerId);
        }
    });

    onStateRequest((data, peerId) => {
        if (onStateRequestCallback) {
            onStateRequestCallback(data, peerId);
        }
    });

    onStateSync((data, peerId) => {
        if (onStateSyncCallback) {
            onStateSyncCallback(data, peerId);
        }
    });
}

function handlePeerJoin(peerId) {
    console.log(`Peer joined: ${peerId}`);
    if (onPeerJoinCallback) {
        onPeerJoinCallback(peerId);
    }
}

function handlePeerLeave(peerId) {
    console.log(`Peer left: ${peerId}`);
    peers.delete(peerId);
    if (onPeerLeaveCallback) {
        onPeerLeaveCallback(peerId);
    }
}

export function leaveCurrentRoom() {
    if (room) {
        room.leave();
        room = null;
        currentRoomCode = null;
        peers.clear();
        actions = null;
    }
}

// =============================================================================
// DATA BROADCAST
// =============================================================================

export function broadcastVote(value, playerInfo) {
    if (actions) {
        actions.sendVote({ value, player: playerInfo });
    }
}

export function broadcastReveal() {
    if (actions) {
        actions.sendReveal({ timestamp: Date.now() });
    }
}

export function broadcastReset() {
    if (actions) {
        actions.sendReset({ timestamp: Date.now() });
    }
}

export function broadcastPlayerInfo(playerInfo) {
    if (actions) {
        actions.sendPlayerInfo(playerInfo);
    }
}

export function requestState(peerId) {
    if (actions) {
        actions.sendStateRequest({ timestamp: Date.now() }, peerId);
    }
}

export function sendStateTo(peerId, state) {
    if (actions) {
        actions.sendStateSync(state, peerId);
    }
}

// =============================================================================
// CALLBACKS REGISTRATION
// =============================================================================

export function onPeerJoin(callback) {
    onPeerJoinCallback = callback;
}

export function onPeerLeave(callback) {
    onPeerLeaveCallback = callback;
}

export function onVoteReceived(callback) {
    onVoteReceivedCallback = callback;
}

export function onRevealReceived(callback) {
    onRevealReceivedCallback = callback;
}

export function onResetReceived(callback) {
    onResetReceivedCallback = callback;
}

export function onPlayerInfoReceived(callback) {
    onPlayerInfoCallback = callback;
}

export function onStateRequest(callback) {
    onStateRequestCallback = callback;
}

export function onStateSync(callback) {
    onStateSyncCallback = callback;
}

// =============================================================================
// GETTERS
// =============================================================================

export function getSelfId() {
    return selfId;
}

export function getRoomCode() {
    return currentRoomCode;
}

export function getPeers() {
    return peers;
}

export function isConnected() {
    return room !== null;
}
