// =============================================================================
// CONSTANTS
// =============================================================================

export const FIBONACCI = [1, 2, 3, 5, 8, 13, 21, '?', '☕'];
export const COLORS = ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEEAD'];

// Card dimensions
export const BASE_CARD_W = 60;
export const BASE_CARD_H = 90;

// Screen scaling
export const SCREEN_SCALE_MIN = 0.7;
export const SCREEN_SCALE_MAX = 1.2;
export const SCREEN_SCALE_REFERENCE = 800;

// Pure function for card size calculation
export function calculateCardSize(cardScale, windowWidth, windowHeight) {
    const screenScale = Math.min(windowWidth, windowHeight) / SCREEN_SCALE_REFERENCE;
    const adaptiveScale = Math.max(SCREEN_SCALE_MIN, Math.min(SCREEN_SCALE_MAX, screenScale));
    return {
        w: BASE_CARD_W * cardScale * adaptiveScale,
        h: BASE_CARD_H * cardScale * adaptiveScale
    };
}

// Responsive breakpoints
export const MOBILE_BREAKPOINT = 480;
export const DESKTOP_BREAKPOINT = 1200;
export const MOBILE_THROW_FORCE = 0.045;
export const DESKTOP_THROW_FORCE = 0.11;

// UI constants
export const CONFETTI_COUNT = 60;
export const TABLE_RADIUS_RATIO = 0.4;
export const RESET_BUTTON_RADIUS = 50;
export const REVEAL_RADIUS_RATIO = 0.2;

// Physics constants
export const PARTICLE_GRAVITY = 0.2;
export const PARTICLE_DECAY = 0.015;

// Random name generation
export const NAME_ADJECTIVES = ['Swift', 'Clever', 'Bold', 'Calm', 'Eager', 'Fair', 'Kind', 'Wise', 'Bright', 'Quick'];
export const NAME_ANIMALS = ['Panda', 'Fox', 'Owl', 'Bear', 'Wolf', 'Hawk', 'Deer', 'Lion', 'Tiger', 'Eagle'];

// LocalStorage keys
export const STORAGE_KEY_NAME = 'scrumpoker_name';
export const STORAGE_KEY_COLOR = 'scrumpoker_color';

// Random colors for new users
export const RANDOM_COLORS = ['#3b82f6', '#ec4899', '#8b5cf6', '#10b981', '#f59e0b', '#ef4444', '#06b6d4', '#84cc16'];
