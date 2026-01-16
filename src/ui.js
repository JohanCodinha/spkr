// =============================================================================
// UI LOGIC
// =============================================================================

import { config } from './config.js';
import { elements, setElements, localPlayer, cards, getAllPlayers } from './state.js';
import { saveIdentityToStorage } from './utils.js';
import * as mp from './multiplayer.js';

export function cacheElements() {
    setElements({
        // Lobby
        lobbyScreen: document.getElementById('lobby-screen'),
        lobbyColorInput: document.getElementById('lobby-color-input'),
        lobbyColorPreview: document.getElementById('lobby-color-preview'),
        lobbyNameInput: document.getElementById('lobby-name-input'),
        roomCodeInput: document.getElementById('room-code-input'),
        lobbyStatus: document.getElementById('lobby-status'),
        lobbyStatusText: document.getElementById('lobby-status-text'),
        lobbyError: document.getElementById('lobby-error'),
        createRoomBtn: document.getElementById('create-room-btn'),
        joinRoomBtn: document.getElementById('join-room-btn'),
        // Game
        canvas: document.getElementById('game-canvas'),
        uiLayer: document.getElementById('ui-layer'),
        deck: document.getElementById('card-deck'),
        revealBtn: document.getElementById('reveal-btn'),
        avatarContainer: document.getElementById('avatar-container'),
        settingsPanel: document.getElementById('settings-panel'),
        settingsBtn: document.getElementById('settings-btn'),
        colorPreview: document.getElementById('color-preview-inline'),
        colorInput: document.getElementById('user-color-input-inline'),
        nameInput: document.getElementById('user-name-input-inline'),
        roomCodeDisplay: document.getElementById('room-code-display'),
        copyRoomBtn: document.getElementById('copy-room-btn'),
        leaveRoomBtn: document.getElementById('leave-room-btn')
    });
}

export function toggleSettings() {
    elements.settingsPanel.classList.toggle('hidden');
}

export function updateConfig(key, value) {
    config[key] = parseFloat(value);
    document.getElementById(`val-${key}`).innerText = value;

    if (key === 'restitution' || key === 'frictionAir') {
        cards.forEach(c => {
            if (c.body) {
                c.body.restitution = config.restitution;
                c.body.frictionAir = config.frictionAir;
            }
        });
    }
}

export function updateIdentity(key, value) {
    if (key === 'name') {
        localPlayer.name = value || localPlayer.name;
        elements.nameInput.value = localPlayer.name;
        saveIdentityToStorage(localPlayer.name, null);
    }
    if (key === 'color') {
        localPlayer.color = value;
        elements.colorPreview.style.backgroundColor = value;
        elements.colorInput.value = value;
        saveIdentityToStorage(null, localPlayer.color);
    }

    // Broadcast updated info to peers
    mp.broadcastPlayerInfo({
        name: localPlayer.name,
        color: localPlayer.color,
        voted: localPlayer.voted
    });

    renderHeader();
}

export function renderHeader() {
    if (!elements.avatarContainer) return;

    elements.avatarContainer.innerHTML = '';
    const allPlayers = getAllPlayers();

    allPlayers.forEach(p => {
        const wrapper = document.createElement('div');
        wrapper.className = 'avatar-item';

        const pill = document.createElement('div');
        pill.className = 'avatar-pill';
        pill.style.backgroundColor = p.color;
        pill.style.opacity = p.voted ? '1' : '0.4';
        pill.setAttribute('aria-label', `${p.name}: ${p.voted ? 'voted' : 'waiting'}`);

        const initials = document.createElement('div');
        initials.className = 'avatar-initials';
        initials.innerText = p.name.substring(0, 1).toUpperCase();
        initials.setAttribute('aria-hidden', 'true');

        const nameContainer = document.createElement('div');
        nameContainer.className = 'avatar-name-container';

        const nameText = document.createElement('div');
        nameText.className = 'avatar-name';
        nameText.innerText = p.name;

        nameContainer.appendChild(nameText);
        pill.appendChild(initials);
        pill.appendChild(nameContainer);
        wrapper.appendChild(pill);
        elements.avatarContainer.appendChild(wrapper);
    });
}
