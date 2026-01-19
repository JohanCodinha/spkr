// =============================================================================
// UI LOGIC
// =============================================================================

import { config } from './config.js';
import { elements, setElements, localPlayer, cards, getAllPlayers } from './state.js';
import { saveIdentityToStorage } from './lobby.js';
import * as mp from './multiplayer.js';
import observerIconSvg from './observer-icon.svg';

export function cacheElements() {
    setElements({
        // Lobby
        lobbyScreen: document.getElementById('lobby-screen'),
        lobbyColorInput: document.getElementById('lobby-color-input'),
        lobbyColorPreview: document.getElementById('lobby-color-preview'),
        lobbyNameInput: document.getElementById('lobby-name-input'),
        lobbyObserverInput: document.getElementById('lobby-observer-input'),
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
        voted: localPlayer.voted,
        isObserver: localPlayer.isObserver
    });

    renderHeader();
}

// Track rendered players for enter/exit animations
let renderedPlayerIds = new Set();
let lastPlayerCount = 0;

// Check if container needs compact mode (only when player count changes)
function checkCompactMode(forceCheck = false) {
    if (!elements.avatarContainer) return;

    const container = elements.avatarContainer;
    const items = container.querySelectorAll('.avatar-item:not(.exiting)');
    const currentCount = items.length;
    const wasCompact = container.classList.contains('compact');
    const countChanged = currentCount !== lastPlayerCount;
    const countIncreased = currentCount > lastPlayerCount;

    // Skip if player count hasn't changed (unless forced)
    if (!forceCheck && !countChanged) return;
    lastPlayerCount = currentCount;

    if (currentCount === 0) {
        container.classList.remove('compact');
        return;
    }

    // If already compact and adding players, stay compact (no need to measure)
    if (wasCompact && countIncreased && !forceCheck) {
        return;
    }

    // Temporarily remove compact to measure natural width
    container.classList.remove('compact');

    // Wait for layout, then check if content overflows
    requestAnimationFrame(() => {
        const containerWidth = container.parentElement?.clientWidth || container.clientWidth;
        const contentWidth = container.scrollWidth;

        if (contentWidth > containerWidth) {
            container.classList.add('compact');
        }
    });
}

function createAvatarElement(p, isNew) {
    const wrapper = document.createElement('div');
    wrapper.className = 'avatar-item';
    wrapper.dataset.playerId = p.id;

    // Only animate new players
    if (!isNew) {
        wrapper.style.animation = 'none';
    }

    const pill = document.createElement('div');
    pill.className = 'avatar-pill';
    pill.style.backgroundColor = p.color;
    // Observers always shown at full opacity, voters depend on vote status
    pill.style.opacity = p.isObserver ? '1' : (p.voted ? '1' : '0.4');
    const status = p.isObserver ? 'observer' : (p.voted ? 'voted' : 'waiting');
    pill.setAttribute('aria-label', `${p.name}: ${status}`);

    const nameText = document.createElement('div');
    nameText.className = 'avatar-name';
    nameText.innerText = p.name;

    const initial = document.createElement('div');
    initial.className = 'avatar-initial';
    initial.innerText = p.name.charAt(0).toUpperCase();

    pill.appendChild(nameText);
    pill.appendChild(initial);
    wrapper.appendChild(pill);

    // Add observer badge if player is an observer
    if (p.isObserver) {
        const badge = document.createElement('div');
        badge.className = 'avatar-observer-badge';
        badge.style.color = p.color;
        badge.innerHTML = observerIconSvg;
        badge.setAttribute('aria-label', 'Observer');
        wrapper.appendChild(badge);
    }

    return wrapper;
}

export function renderHeader() {
    if (!elements.avatarContainer) return;

    const allPlayers = getAllPlayers();
    const currentPlayerIds = new Set(allPlayers.map(p => p.id));
    const existingElements = new Map();

    // Collect existing elements
    elements.avatarContainer.querySelectorAll('.avatar-item').forEach(el => {
        const id = el.dataset.playerId;
        if (id) existingElements.set(id, el);
    });

    // Remove players that left (with animation)
    existingElements.forEach((el, id) => {
        if (!currentPlayerIds.has(id)) {
            el.classList.add('exiting');
            el.addEventListener('animationend', () => el.remove(), { once: true });
            renderedPlayerIds.delete(id);
        }
    });

    // Add or update players
    allPlayers.forEach(p => {
        const existingEl = existingElements.get(p.id);

        if (existingEl && !existingEl.classList.contains('exiting')) {
            // Update existing player
            const pill = existingEl.querySelector('.avatar-pill');
            if (pill) {
                pill.style.backgroundColor = p.color;
                pill.style.opacity = p.isObserver ? '1' : (p.voted ? '1' : '0.4');
                const status = p.isObserver ? 'observer' : (p.voted ? 'voted' : 'waiting');
                pill.setAttribute('aria-label', `${p.name}: ${status}`);
            }
            const nameEl = existingEl.querySelector('.avatar-name');
            if (nameEl) nameEl.innerText = p.name;
            const initialEl = existingEl.querySelector('.avatar-initial');
            if (initialEl) initialEl.innerText = p.name.charAt(0).toUpperCase();
        } else {
            // Add new player
            const isNew = !renderedPlayerIds.has(p.id);
            const newEl = createAvatarElement(p, isNew);
            elements.avatarContainer.appendChild(newEl);
            renderedPlayerIds.add(p.id);
        }
    });

    // Check if we need compact mode
    checkCompactMode();
}

// Re-check compact mode on resize (force check)
let resizeTimeout;
window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => checkCompactMode(true), 100);
});
