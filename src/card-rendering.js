// =============================================================================
// PURE CARD RENDERING FUNCTIONS
// No browser globals, all dependencies passed in - fully testable
// =============================================================================

import { BASE_CARD_W, BASE_CARD_H } from './constants.js';

// Pure truncation logic - no canvas dependency, easily unit testable
export function truncateToFit(text, measureFn, maxWidth, ellipsis = '…') {
    if (measureFn(text) <= maxWidth) return text;

    let truncated = text;
    while (truncated.length > 0) {
        truncated = truncated.slice(0, -1);
        if (measureFn(truncated + ellipsis) <= maxWidth) {
            return truncated + ellipsis;
        }
    }
    return ellipsis;
}

export function getDisplayName(ctx, name, cardWidth) {
    const fontSize = Math.round(10 * (cardWidth / BASE_CARD_W));
    ctx.font = `bold ${fontSize}px Nunito`;

    const padding = 8;
    const maxWidth = cardWidth - padding;

    return truncateToFit(name, (t) => ctx.measureText(t).width, maxWidth);
}

export function renderCardBack(ctx, { color, width: w, height: h }) {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.4)';
    ctx.lineWidth = 2;
    ctx.stroke();
}

export function renderCardFront(ctx, { value, playerName, playerColor, width: w, height: h }) {
    ctx.beginPath();
    ctx.roundRect(-w / 2, -h / 2, w, h, 8);
    ctx.fillStyle = 'white';
    ctx.fill();
    ctx.strokeStyle = playerColor;
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.shadowColor = 'transparent';

    // Value
    ctx.fillStyle = '#1e293b';
    const valueFontSize = Math.round(28 * (w / BASE_CARD_W));
    ctx.font = `bold ${valueFontSize}px Nunito`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(value, 0, 0);

    // Name (with truncation)
    const displayName = getDisplayName(ctx, playerName, w);
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(displayName, 0, h / 2 - 12 * (h / BASE_CARD_H));
}
