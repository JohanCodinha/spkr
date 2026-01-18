// =============================================================================
// LOBBY FUNCTIONS
// =============================================================================

import { STORAGE_KEY_NAME, STORAGE_KEY_COLOR } from './constants.js';
import { elements, localPlayer, players, setGameStarted } from './state.js';
import * as mp from './multiplayer.js';
import { emit } from './debug.js';

export function saveIdentityToStorage(name, color) {
    if (name) localStorage.setItem(STORAGE_KEY_NAME, name);
    if (color) localStorage.setItem(STORAGE_KEY_COLOR, color);
}

// Callback for starting the game (set from game.js)
let onStartGame = null;

export function setStartGameCallback(callback) {
    onStartGame = callback;
}

export function showLobby() {
    elements.lobbyScreen.classList.remove('hidden');
    elements.canvas.classList.add('hidden');
    elements.uiLayer.classList.add('hidden');
    setGameStarted(false);
}

export function hideLobby() {
    elements.lobbyScreen.classList.add('hidden');
    elements.canvas.classList.remove('hidden');
    elements.uiLayer.classList.remove('hidden');
    setGameStarted(true);
}

export function showLobbyStatus(message) {
    elements.lobbyStatus.classList.remove('hidden');
    elements.lobbyStatusText.textContent = message;
    elements.lobbyError.classList.add('hidden');
    elements.createRoomBtn.disabled = true;
    elements.joinRoomBtn.disabled = true;
}

export function hideLobbyStatus() {
    elements.lobbyStatus.classList.add('hidden');
    elements.createRoomBtn.disabled = false;
    elements.joinRoomBtn.disabled = false;
}

export function showLobbyError(message) {
    elements.lobbyError.textContent = message;
    elements.lobbyError.classList.remove('hidden');
    hideLobbyStatus();
}

export function createRoom() {
    try {
        showLobbyStatus('Creating room...');

        // Update local player info from lobby inputs
        // Use placeholder (random name) if input is empty
        const inputName = elements.lobbyNameInput.value.trim();
        localPlayer.name = inputName || elements.lobbyNameInput.placeholder;
        localPlayer.color = elements.lobbyColorInput.value;
        localPlayer.isObserver = elements.lobbyObserverInput.checked;

        // Save to localStorage
        saveIdentityToStorage(localPlayer.name, localPlayer.color);

        const { code, peerId } = mp.createNewRoom();
        localPlayer.id = peerId;

        // Update game UI with lobby values
        elements.colorInput.value = localPlayer.color;
        elements.colorPreview.style.backgroundColor = localPlayer.color;
        elements.nameInput.value = localPlayer.name;
        elements.roomCodeDisplay.textContent = code;

        // Broadcast our player info
        mp.broadcastPlayerInfo({
            name: localPlayer.name,
            color: localPlayer.color,
            voted: false,
            isObserver: localPlayer.isObserver
        });

        emit('roomCreated', { code });
        if (onStartGame) onStartGame();
    } catch (error) {
        showLobbyError('Failed to create room: ' + error.message);
    }
}

export function joinRoom() {
    const code = elements.roomCodeInput.value.trim();
    if (!code) {
        showLobbyError('Please enter a room code');
        return;
    }

    try {
        showLobbyStatus('Joining room...');

        // Update local player info from lobby inputs
        // Use placeholder (random name) if input is empty
        const inputName = elements.lobbyNameInput.value.trim();
        localPlayer.name = inputName || elements.lobbyNameInput.placeholder;
        localPlayer.color = elements.lobbyColorInput.value;
        localPlayer.isObserver = elements.lobbyObserverInput.checked;

        // Save to localStorage
        saveIdentityToStorage(localPlayer.name, localPlayer.color);

        const { code: normalizedCode, peerId } = mp.joinExistingRoom(code);
        localPlayer.id = peerId;

        // Update game UI with lobby values
        elements.colorInput.value = localPlayer.color;
        elements.colorPreview.style.backgroundColor = localPlayer.color;
        elements.nameInput.value = localPlayer.name;
        elements.roomCodeDisplay.textContent = normalizedCode;

        // Broadcast our player info
        mp.broadcastPlayerInfo({
            name: localPlayer.name,
            color: localPlayer.color,
            voted: false,
            isObserver: localPlayer.isObserver
        });

        emit('roomJoined', { code: normalizedCode });
        if (onStartGame) onStartGame();
    } catch (error) {
        showLobbyError('Failed to join room: ' + error.message);
    }
}

export function leaveRoom() {
    mp.leaveCurrentRoom();
    players.clear();
    showLobby();
}

export async function copyRoomCode() {
    const code = mp.getRoomCode();
    if (code) {
        try {
            // Build URL with room code
            const url = new URL(window.location.href);
            url.search = ''; // Clear existing params
            url.searchParams.set('room', code);

            await navigator.clipboard.writeText(url.toString());
            // Brief visual feedback
            const display = elements.roomCodeDisplay;
            const original = display.textContent;
            display.textContent = 'Copied!';
            setTimeout(() => { display.textContent = original; }, 1000);
        } catch (err) {
            console.error('Failed to copy:', err);
        }
    }
}

export function checkUrlForRoom() {
    const params = new URLSearchParams(window.location.search);
    const roomCode = params.get('room');

    if (roomCode) {
        // Pre-fill the room code and auto-join
        elements.roomCodeInput.value = roomCode;
        // Small delay to ensure everything is initialized
        setTimeout(() => joinRoom(), 100);

        // Clean the URL without reloading
        const cleanUrl = new URL(window.location.href);
        cleanUrl.search = '';
        window.history.replaceState({}, '', cleanUrl.toString());
    }
}
