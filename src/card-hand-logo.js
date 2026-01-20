/**
 * CardHandLogo Web Component (SVG-based, parametric)
 * Fills its container - parent controls size via CSS.
 *
 * Usage:
 *   <card-hand-logo></card-hand-logo>
 */

// Import card SVGs (esbuild bundles these as text)
import CARD_GOLD from './cards/card-gold.svg';
import CARD_BLUE from './cards/card-blue.svg';
import CARD_GREEN from './cards/card-green.svg';

// Debug editor import - tree-shaken in production via __DEBUG__
// eslint-disable-next-line no-unused-vars
import * as editorModule from './card-hand-logo-editor.js';
const renderEditor = __DEBUG__ ? editorModule.renderEditor : null;

const CARD_SVGS = [CARD_GOLD, CARD_BLUE, CARD_GREEN];

// =============================================================================
// STATE - Shared between component and editor
// Editor-owned fields (fan, anchor, hover, shadow) are inputs to computation
// Component-owned fields (cards[].transform, viewBox, etc.) are precomputed
// =============================================================================

const STATE = {
    // --- Editor inputs (used by editor to compute positions) ---
    cardHeight: 390,
    anchor: { x: 0, y: 180 },
    fan: {
        spread: 62,        // total angle span from first to last card (degrees)
        spacing: 100,       // horizontal spacing between adjacent cards
        arc: 40,           // vertical drop for outer cards (curve height)
        rotation: 0        // base rotation offset for entire fan
    },
    hover: {
        scale: 1.25,
        lift: 40
    },
    shadow: {
        dx: -13,
        dy: 8,
        blur: 1,
        opacity: 0.35
    },

    // --- Precomputed by editor, used directly by component ---
    viewBox: '-533.17 -367.50 1066.34 692.52',
    cardWidth: 264.11,
    hoverTransform: 'translateY(-10.3%) scale(1.25)',
    cards: [
        { svgIndex: 1, shadowColor: '#86a3c9', transform: 'translate(-100, 220) rotate(-31)' },
        { svgIndex: 0, shadowColor: '#d7b65e', transform: 'translate(0, 180) rotate(0)' },
        { svgIndex: 2, shadowColor: '#76ae85', transform: 'translate(100, 220) rotate(31)' }
    ]
};

// =============================================================================
// COMPONENT
// =============================================================================

class CardHandLogo extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.render();
    }

    connectedCallback() {
        // Initialize debug editor when component is added to DOM
        if (__DEBUG__ && renderEditor) {
            renderEditor(this, STATE, CARD_SVGS);
        }
    }

    render() {
        const { viewBox, cardWidth, cardHeight, hoverTransform, shadow, cards } = STATE;

        // Build shadow filters
        const filters = cards.map((card, i) => `
            <filter id="card-shadow-${i}" x="-50%" y="-50%" width="200%" height="200%">
                <feDropShadow dx="${shadow.dx}" dy="${shadow.dy}" stdDeviation="${shadow.blur}"
                    flood-color="${card.shadowColor}" flood-opacity="${shadow.opacity}"/>
            </filter>
        `).join('');

        // Build card groups using precomputed transforms
        const cardElements = cards.map((card, i) => `
            <g class="card-container" transform="${card.transform}">
                <rect class="hit-area" x="${-cardWidth / 2 - 5}" y="${-cardHeight - 5}"
                    width="${cardWidth + 10}" height="${cardHeight + 10}" fill="transparent"/>
                <g class="card" filter="url(#card-shadow-${i})">
                    <svg x="${-cardWidth / 2}" y="${-cardHeight}"
                        width="${cardWidth}" height="${cardHeight}">
                        ${CARD_SVGS[card.svgIndex]}
                    </svg>
                </g>
            </g>
        `).join('');

        this.shadowRoot.innerHTML = `
            <style>
                :host { display: block; }
                .card-container { cursor: default; }
                .card {
                    transform-box: fill-box;
                    transform-origin: center bottom;
                    transition: transform 0.25s cubic-bezier(0.34, 1.56, 0.64, 1);
                }
                .card-container:hover .card { transform: ${hoverTransform}; }
            </style>
            <svg viewBox="${viewBox}" style="width:100%;height:100%;display:block">
                <defs>${filters}</defs>
                ${cardElements}
            </svg>
        `;
    }
}

// Register the custom element
export function registerCardHandLogo() {
    if (!customElements.get('card-hand-logo')) {
        customElements.define('card-hand-logo', CardHandLogo);
    }
}
