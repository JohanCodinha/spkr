// =============================================================================
// DRAWING
// =============================================================================

import { config } from './config.js';
import {
    TABLE_RADIUS_RATIO,
    RESET_BUTTON_RADIUS,
    BASE_CARD_W,
    BASE_CARD_H,
    COLORS,
    CONFETTI_COUNT,
    SCREEN_SCALE_REFERENCE,
    SCREEN_SCALE_MIN,
    SCREEN_SCALE_MAX
} from './constants.js';
import { ctx, width, height, cards, particles, isRevealed } from './state.js';

export function getCardSize() {
    const scale = config.cardScale;
    const screenScale = Math.min(window.innerWidth, window.innerHeight) / SCREEN_SCALE_REFERENCE;
    const adaptiveScale = Math.max(SCREEN_SCALE_MIN, Math.min(SCREEN_SCALE_MAX, screenScale));
    return {
        w: BASE_CARD_W * scale * adaptiveScale,
        h: BASE_CARD_H * scale * adaptiveScale
    };
}

// Reset icon SVG path
const resetIconPath = new Path2D('M683.6 288.4l-21.2 26.2c-12 14.8-2.6 36.9 16.3 38.7l165.9 15.4c21.9 2 38.8-18.8 32.3-39.8l-49.6-159c-5.7-18.2-29.3-22.7-41.2-7.9l-32.9 40.6c-85.1-62.9-194.4-89.5-305.7-67.7C290 165.7 166.1 295.6 142.7 454.4c-35.4 239.2 149.1 444.7 381.5 444.7 159.8 0 301.2-98 358.9-243.9 9.3-23.4 4.8-51.5-15.1-66.9-31.2-24.2-73.4-10.4-86.3 23.3-48.2 126.3-183.8 203.5-325.3 169.1C352.3 755.3 271 668 252.8 562.4c-30-173.9 103.1-324.7 271.4-324.7 58.2-0.1 113.5 18.1 159.4 50.7z');

export function drawTable() {
    ctx.fillStyle = '#e2e8f0';
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, Math.min(width, height) * TABLE_RADIUS_RATIO, 0, Math.PI * 2);
    ctx.fill();
}

export function drawCards() {
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

        const w = cardSize.w;
        const h = cardSize.h;

        ctx.shadowColor = 'rgba(0,0,0,0.1)';
        ctx.shadowBlur = 15;
        ctx.shadowOffsetY = 5;

        ctx.beginPath();
        ctx.roundRect(-w / 2, -h / 2, w, h, 8);

        const showBack = !isRevealed || card.flipProgress < 0.5;

        if (showBack) {
            ctx.fillStyle = card.player.color;
            ctx.fill();
            ctx.strokeStyle = 'rgba(255,255,255,0.4)';
            ctx.lineWidth = 2;
            ctx.stroke();
        } else {
            ctx.fillStyle = 'white';
            ctx.fill();
            ctx.strokeStyle = card.player.color;
            ctx.lineWidth = 3;
            ctx.stroke();

            ctx.shadowColor = 'transparent';
            ctx.fillStyle = '#1e293b';
            const valueFontSize = Math.round(28 * (w / BASE_CARD_W));
            ctx.font = `bold ${valueFontSize}px Nunito`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(card.value, 0, 0);

            const nameFontSize = Math.round(10 * (w / BASE_CARD_W));
            ctx.font = `bold ${nameFontSize}px Nunito`;
            ctx.fillStyle = '#94a3b8';
            ctx.fillText(card.player.name, 0, h / 2 - 12 * (h / BASE_CARD_H));
        }

        ctx.restore();
    });
}

export function drawResetButton() {
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
    for (let i = 0; i < CONFETTI_COUNT; i++) {
        particles.push({
            x: width / 2,
            y: height / 2,
            vx: (Math.random() - 0.5) * 15,
            vy: (Math.random() - 0.5) * 15,
            life: 1,
            color: COLORS[Math.floor(Math.random() * COLORS.length)]
        });
    }
}

export function drawParticles() {
    particles.forEach(p => {
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, 5, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.globalAlpha = 1;
}
