// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

import { config } from './config.js';
import {
    SCREEN_SCALE_REFERENCE,
    SCREEN_SCALE_MIN,
    SCREEN_SCALE_MAX,
    BASE_CARD_W,
    BASE_CARD_H,
    MOBILE_BREAKPOINT,
    DESKTOP_BREAKPOINT,
    MOBILE_THROW_FORCE,
    DESKTOP_THROW_FORCE,
    NAME_ADJECTIVES,
    NAME_ANIMALS,
    RANDOM_COLORS,
    STORAGE_KEY_NAME,
    STORAGE_KEY_COLOR
} from './constants.js';

export function getCardSize() {
    const scale = config.cardScale;
    const screenScale = Math.min(window.innerWidth, window.innerHeight) / SCREEN_SCALE_REFERENCE;
    const adaptiveScale = Math.max(SCREEN_SCALE_MIN, Math.min(SCREEN_SCALE_MAX, screenScale));
    return {
        w: BASE_CARD_W * scale * adaptiveScale,
        h: BASE_CARD_H * scale * adaptiveScale
    };
}

export function getThrowForce() {
    const screenWidth = window.innerWidth;

    if (screenWidth <= MOBILE_BREAKPOINT) return MOBILE_THROW_FORCE;
    if (screenWidth >= DESKTOP_BREAKPOINT) return DESKTOP_THROW_FORCE;

    const t = (screenWidth - MOBILE_BREAKPOINT) / (DESKTOP_BREAKPOINT - MOBILE_BREAKPOINT);
    return MOBILE_THROW_FORCE + t * (DESKTOP_THROW_FORCE - MOBILE_THROW_FORCE);
}

export function getPlayerPositions(count) {
    const positions = [];
    for (let i = 0; i < count; i++) {
        const angle = (i / count) * Math.PI * 2 - Math.PI / 2;
        const x = 0.5 + Math.cos(angle) * 0.6;
        const y = 0.5 + Math.sin(angle) * 0.6;
        positions.push({ x, y });
    }
    return positions;
}

export function generateRandomName() {
    const adj = NAME_ADJECTIVES[Math.floor(Math.random() * NAME_ADJECTIVES.length)];
    const animal = NAME_ANIMALS[Math.floor(Math.random() * NAME_ANIMALS.length)];
    return `${adj} ${animal}`;
}

export function generateRandomColor() {
    return RANDOM_COLORS[Math.floor(Math.random() * RANDOM_COLORS.length)];
}

export function loadIdentityFromStorage() {
    const savedName = localStorage.getItem(STORAGE_KEY_NAME);
    const savedColor = localStorage.getItem(STORAGE_KEY_COLOR);
    return { name: savedName, color: savedColor };
}

export function saveIdentityToStorage(name, color) {
    if (name) localStorage.setItem(STORAGE_KEY_NAME, name);
    if (color) localStorage.setItem(STORAGE_KEY_COLOR, color);
}
