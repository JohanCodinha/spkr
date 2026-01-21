#!/usr/bin/env node
/**
 * Regenerate card-hand-logo.svg using the editor's compileSVG function
 * This applies the current editor logic to the state stored in data-editor
 */

import { readFileSync, writeFileSync } from 'fs';

// Import card SVGs as text
const CARD_GOLD = readFileSync('src/cards/card-gold.svg', 'utf-8');
const CARD_BLUE = readFileSync('src/cards/card-blue.svg', 'utf-8');
const CARD_GREEN = readFileSync('src/cards/card-green.svg', 'utf-8');

const CARD_SVGS = [CARD_GOLD, CARD_BLUE, CARD_GREEN];
const CARD_NAMES = ['Gold', 'Blue', 'Green'];
const CARD_VIEWBOX = '0 0 356 525.7';
const CARD_ASPECT = 356 / 525.7;

function computeDerived(state) {
    const { cardHeight, fan, hover, cards } = state;
    const cardWidth = cardHeight * CARD_ASPECT;
    const cardCount = cards.length;
    const centerIndex = (cardCount - 1) / 2;

    const cardTransforms = cards.map((card, i) => {
        const offset = i - centerIndex;
        const x = offset * fan.spacing;
        const y = Math.abs(offset) * fan.arc;
        const rotation = fan.rotation + (cardCount > 1
            ? offset * (fan.spread / (cardCount - 1))
            : 0);
        return { x, y, rotation };
    });

    const liftPercent = (hover.lift / cardHeight) * 100;
    const hoverTransform = `translateY(-${liftPercent.toFixed(1)}%) scale(${hover.scale})`;

    const viewBox = computeViewBox(state, cardTransforms);

    return {
        cardWidth: parseFloat(cardWidth.toFixed(2)),
        cardTransforms,
        hoverTransform,
        viewBox
    };
}

function computeViewBox(state, cardTransforms) {
    const { cardHeight, hover } = state;
    const cardWidth = cardHeight * CARD_ASPECT;

    const MIN_WIDTH = 700;
    const MIN_HEIGHT = 450;
    const padding = 20;

    const scaledWidth = cardWidth * hover.scale;
    const scaledHeight = cardHeight * hover.scale;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    const corners = [
        [-scaledWidth / 2, -scaledHeight - hover.lift],
        [scaledWidth / 2, -scaledHeight - hover.lift],
        [-scaledWidth / 2, 0],
        [scaledWidth / 2, 0]
    ];

    cardTransforms.forEach(({ x, y, rotation }) => {
        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        corners.forEach(([cx, cy]) => {
            const rx = cx * cos - cy * sin;
            const ry = cx * sin + cy * cos;
            const px = x + rx;
            const py = y + ry;

            minX = Math.min(minX, px);
            minY = Math.min(minY, py);
            maxX = Math.max(maxX, px);
            maxY = Math.max(maxY, py);
        });
    });

    const contentWidth = maxX - minX + 2 * padding;
    const contentHeight = maxY - minY + 2 * padding;
    const vbWidth = Math.max(contentWidth, MIN_WIDTH);
    const vbHeight = Math.max(contentHeight, MIN_HEIGHT);

    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const vbMinX = contentCenterX - vbWidth / 2;
    const vbMinY = contentCenterY - vbHeight / 2;

    return `${vbMinX.toFixed(2)} ${vbMinY.toFixed(2)} ${vbWidth.toFixed(2)} ${vbHeight.toFixed(2)}`;
}

function compileSVG(state) {
    const derived = computeDerived(state);
    const { cardHeight, shadow, cards } = state;
    const { cardWidth, cardTransforms, viewBox } = derived;

    const filters = cards.map((card, i) => `
    <filter id="card-shadow-${i}" x="-50%" y="-50%" width="200%" height="200%">
      <feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}" flood-color="${card.shadowColor}" flood-opacity="${shadow.opacity}"/>
    </filter>`).join('');

    const cardGroups = cards.map((card, i) => {
        const t = cardTransforms[i];
        const transform = `translate(${t.x}, ${t.y}) rotate(${t.rotation})`;
        // Add positioning attributes to the card SVG (nested SVGs are valid)
        const cardSVG = CARD_SVGS[card.svgIndex].replace(
            '<svg',
            `<svg x="${-cardWidth / 2}" y="${-cardHeight}" width="${cardWidth}" height="${cardHeight}"`
        );

        return `
  <!-- Card ${i}: ${CARD_NAMES[card.svgIndex]} -->
  <g class="card-container" transform="${transform}">
    <g class="card" filter="url(#card-shadow-${i})">
      ${cardSVG}
    </g>
  </g>`;
    }).join('\n');

    const editorData = JSON.stringify({
        cardHeight: state.cardHeight,
        fan: state.fan,
        hover: state.hover,
        shadow: state.shadow,
        cards: state.cards.map(c => ({ svgIndex: c.svgIndex, shadowColor: c.shadowColor }))
    });

    return `<svg
  class="card-hand-logo"
  xmlns="http://www.w3.org/2000/svg"
  viewBox="${viewBox}"
  data-editor='${editorData}'
>
  <defs>${filters}
  </defs>
${cardGroups}
</svg>`;
}

// Read current SVG and extract state from data-editor
const currentSVG = readFileSync('src/card-hand-logo.svg', 'utf-8');
const dataEditorMatch = currentSVG.match(/data-editor='([^']+)'/);

if (!dataEditorMatch) {
    console.error('Could not find data-editor attribute');
    process.exit(1);
}

const state = JSON.parse(dataEditorMatch[1]);
console.log('Current state:', JSON.stringify(state, null, 2));

// Generate new SVG
const newSVG = compileSVG(state);

// Write it back
writeFileSync('src/card-hand-logo.svg', newSVG);
console.log('\nRegenerated src/card-hand-logo.svg');

// Show the new transforms
const transforms = newSVG.match(/transform="[^"]+"/g);
console.log('\nNew transforms:');
transforms?.forEach(t => console.log('  ' + t));
