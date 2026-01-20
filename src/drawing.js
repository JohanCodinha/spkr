// =============================================================================
// DRAWING
// =============================================================================

import { config } from './config.js';
import {
    TABLE_RADIUS_RATIO,
    RESET_BUTTON_RADIUS,
    COLORS,
    CONFETTI_COUNT,
    calculateCardSize
} from './constants.js';
import { getState } from './store.js';
import { renderCardBack, renderCardFront } from './card-rendering.js';

export function getCardSize() {
    return calculateCardSize(config.cardScale, window.innerWidth, window.innerHeight);
}

// Re-export pure functions for external use
export { getDisplayName, renderCardBack, renderCardFront } from './card-rendering.js';

// Reset icon SVG path
const resetIconPath = new Path2D('M683.6 288.4l-21.2 26.2c-12 14.8-2.6 36.9 16.3 38.7l165.9 15.4c21.9 2 38.8-18.8 32.3-39.8l-49.6-159c-5.7-18.2-29.3-22.7-41.2-7.9l-32.9 40.6c-85.1-62.9-194.4-89.5-305.7-67.7C290 165.7 166.1 295.6 142.7 454.4c-35.4 239.2 149.1 444.7 381.5 444.7 159.8 0 301.2-98 358.9-243.9 9.3-23.4 4.8-51.5-15.1-66.9-31.2-24.2-73.4-10.4-86.3 23.3-48.2 126.3-183.8 203.5-325.3 169.1C352.3 755.3 271 668 252.8 562.4c-30-173.9 103.1-324.7 271.4-324.7 58.2-0.1 113.5 18.1 159.4 50.7z');

export function drawTable() {
    const { ctx, width, height } = getState();
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * TABLE_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.fill();
}

export function drawCards() {
    const { ctx, cards, isRevealed } = getState();
    const cardSize = getCardSize();
    cards.forEach(card => {
        const { position, angle } = card.body;

        ctx.save();
        ctx.translate(position.x, position.y);
        ctx.rotate(angle);

        let scaleX = 1;
        if (isRevealed) {
            scaleX = Math.cos(card.flipProgress * Math.PI);
        }
        ctx.scale(Math.abs(scaleX), 1);

        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        const showBack = !isRevealed || card.flipProgress < 0.5;

        if (showBack) {
            renderCardBack(ctx, {
                color: card.player.color,
                width: cardSize.w,
                height: cardSize.h
            });
        } else {
            renderCardFront(ctx, {
                value: card.value,
                playerName: card.player.name,
                playerColor: card.player.color,
                width: cardSize.w,
                height: cardSize.h
            });
        }

        ctx.restore();
    });
}

export function drawResetButton() {
    const { ctx, width, height, isRevealed } = getState();
    if (!isRevealed) return;

    const cx = width / 2;
    const cy = height / 2;

    ctx.shadowColor = 'rgba(0,0,0,0.1)';
    ctx.shadowBlur = 20;
    ctx.fillStyle = 'white';
    ctx.beginPath();
    ctx.arc(cx, cy, RESET_BUTTON_RADIUS, 0, Math.PI * 2);
    ctx.fill();

    ctx.shadowColor = 'transparent';
    ctx.save();
    const iconScale = (RESET_BUTTON_RADIUS * 1.3) / 1024;
    ctx.translate(cx - 512 * iconScale, cy - 512 * iconScale);
    ctx.scale(iconScale, iconScale);
    ctx.fillStyle = '#64748b';
    ctx.fill(resetIconPath);
    ctx.restore();
}

export function spawnConfetti() {
    const { width, height, particles, setParticles } = getState();
    const newParticles = [...particles];
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        newParticles.push({
            x: width / 2,
            y: height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
    }
    setParticles(newParticles);
}

export function drawParticles() {
    const { ctx, particles } = getState();
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}
