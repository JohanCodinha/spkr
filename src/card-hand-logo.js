/**
 * CardHandLogo Web Component
 *
 * A decorative logo showing three playing cards arranged in a fan.
 * Configuration extracted from card-hand-export.html demo.
 *
 * Usage:
 *   <card-hand-logo></card-hand-logo>
 *   <card-hand-logo size="12rem"></card-hand-logo>
 */

// Import card SVGs as text (esbuild handles this)
import CARD_BLUE from './cards/card-blue.svg';
import CARD_GOLD from './cards/card-gold.svg';
import CARD_GREEN from './cards/card-green.svg';

// Convert SVG text to data URL (handles unicode safely)
function svgToDataUrl(svg) {
    return 'data:image/svg+xml,' + encodeURIComponent(svg);
}

// Pre-compute data URLs at module load time
const CARD_BLUE_URL = svgToDataUrl(CARD_BLUE);
const CARD_GOLD_URL = svgToDataUrl(CARD_GOLD);
const CARD_GREEN_URL = svgToDataUrl(CARD_GREEN);

// Shadow colors (cross-shadows as per demo)
const SHADOW_GOLD = 'rgba(215, 182, 94, 0.5)';
const SHADOW_BLUE = 'rgba(134, 163, 201, 0.5)';
const SHADOW_GREEN = 'rgba(118, 174, 133, 0.5)';

class CardHandLogo extends HTMLElement {
    static get observedAttributes() {
        return ['size'];
    }

    constructor() {
        super();
        this.shadow = this.attachShadow({ mode: 'open' });
        this.render();
    }

    get size() {
        return this.getAttribute('size') || '10rem';
    }

    set size(value) {
        this.setAttribute('size', value);
    }

    attributeChangedCallback(_name, oldValue, newValue) {
        if (oldValue !== newValue) {
            this.render();
        }
    }

    render() {
        const size = this.size;

        // Demo uses 300px card height - we scale relative to that
        // Card positions in demo: left=-84px, center=0, right=84px at 300px height
        // Scale factor for offsets: size / 300px equivalent
        const styles = `
            :host {
                display: inline-block;
                width: ${size};
                height: ${size};
            }

            .hand-container {
                position: relative;
                width: 100%;
                height: 100%;
                display: flex;
                align-items: center;
                justify-content: center;
                --hover-scale: 1.1;
                --hover-lift: 30px;
            }

            .card-wrapper {
                position: absolute;
                transform-origin: center bottom;
                transform: translate(var(--x), var(--y)) rotate(var(--r)) scale(var(--s));
                /* Fast return transition */
                transition: transform 0.2s cubic-bezier(0.25, 0.46, 0.45, 0.94), filter 0.2s ease;
                cursor: pointer;
            }

            .card-wrapper:hover {
                /* Bouncy enter transition */
                transition: transform 0.3s cubic-bezier(0.34, 1.56, 0.64, 1), filter 0.3s ease;
                transform:
                    translate(var(--x), calc(var(--y) - var(--hover-lift)))
                    rotate(var(--r))
                    scale(calc(var(--s) * var(--hover-scale)));
                z-index: 10 !important;
            }

            .card-wrapper img {
                pointer-events: none;
                display: block;
                height: 300px;
                width: auto;
            }

            /* Card 1: Blue ? card on left with gold shadow */
            .card-left {
                --x: -84px;
                --y: 30px;
                --r: -18deg;
                --s: 0.63;
                z-index: 0;
                filter: drop-shadow(5px 10px 12px ${SHADOW_GOLD});
            }

            /* Card 2: Gold ♠ card in center with blue shadow */
            .card-center {
                --x: 0px;
                --y: 0px;
                --r: 0deg;
                --s: 0.63;
                z-index: 1;
                filter: drop-shadow(5px 10px 12px ${SHADOW_BLUE});
            }

            /* Card 3: Green 😊 card on right with green shadow */
            .card-right {
                --x: 84px;
                --y: 30px;
                --r: 18deg;
                --s: 0.63;
                z-index: 2;
                filter: drop-shadow(5px 10px 12px ${SHADOW_GREEN});
            }
        `;

        // Clear shadow and build DOM
        this.shadow.innerHTML = '';

        // Add styles
        const styleEl = document.createElement('style');
        styleEl.textContent = styles;
        this.shadow.appendChild(styleEl);

        // Create container
        const container = document.createElement('div');
        container.className = 'hand-container';

        // Card data - order: Blue (left), Gold (center), Green (right)
        const cards = [
            { cls: 'card-left', url: CARD_BLUE_URL, alt: 'Question card' },
            { cls: 'card-center', url: CARD_GOLD_URL, alt: 'Ace of Spades card' },
            { cls: 'card-right', url: CARD_GREEN_URL, alt: 'Smiley card' }
        ];

        // Create cards
        cards.forEach(card => {
            const wrapper = document.createElement('div');
            wrapper.className = 'card-wrapper ' + card.cls;

            const img = document.createElement('img');
            img.src = card.url;
            img.alt = card.alt;
            img.draggable = false;

            wrapper.appendChild(img);
            container.appendChild(wrapper);
        });

        this.shadow.appendChild(container);
    }
}

// Register the custom element
export function registerCardHandLogo() {
    if (!customElements.get('card-hand-logo')) {
        customElements.define('card-hand-logo', CardHandLogo);
    }
}
