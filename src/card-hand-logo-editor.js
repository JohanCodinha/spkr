/**
 * Card Hand Logo Editor Web Component
 * Dev-only editor that manipulates the SVG directly.
 * Reads config from data-editor attribute, updates SVG live, saves to disk.
 */

// Card SVG sources (imported at build time)
import CARD_GOLD from './cards/card-gold.svg';
import CARD_BLUE from './cards/card-blue.svg';
import CARD_GREEN from './cards/card-green.svg';

const CARD_SVGS = [CARD_GOLD, CARD_BLUE, CARD_GREEN];
const CARD_NAMES = ['Gold', 'Blue', 'Green'];

const CARD_ASPECT = 356 / 525.7;

// =============================================================================
// SVG COMPILATION
// =============================================================================

/**
 * Compute derived values from editor state
 */
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

/**
 * Compute viewBox with fixed minimum size
 */
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

/**
 * Generate complete SVG string from state
 */
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
        const cardSVG = CARD_SVGS[card.svgIndex].replace(
            '<svg',
            `<svg x="${-cardWidth / 2}" y="${-cardHeight}" width="${cardWidth}" height="${cardHeight}"`
        );

        // Hitbox matches the card exactly for precise hover detection
        const hitboxX = -cardWidth / 2;
        const hitboxY = -cardHeight;

        return `
  <!-- Card ${i}: ${CARD_NAMES[card.svgIndex]} -->
  <g class="card-container" transform="${transform}">
    <rect class="card-hitbox" x="${hitboxX.toFixed(0)}" y="${hitboxY.toFixed(0)}" width="${cardWidth.toFixed(0)}" height="${cardHeight.toFixed(0)}" fill="transparent"/>
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

// =============================================================================
// WEB COMPONENT
// =============================================================================

const STYLES = `
:host {
    display: contents;
}

.toggle {
    position: fixed;
    top: 50%;
    left: 0;
    transform: translateY(-50%);
    z-index: 10000;
    background: #fbbf24;
    color: #1f2937;
    border: none;
    padding: 8px 12px;
    font-size: 12px;
    font-weight: bold;
    cursor: pointer;
    border-radius: 0 4px 4px 0;
    writing-mode: vertical-rl;
    transition: left 0.3s ease, background 0.2s;
    font-family: system-ui, sans-serif;
}
.toggle:hover { background: #f59e0b; }
.toggle.open { left: 320px; }

.panel {
    position: fixed;
    top: 0;
    left: 0;
    width: 320px;
    height: 100%;
    z-index: 9999;
    background: #1f2937;
    border-right: 2px solid #fbbf24;
    transform: translateX(-100%);
    transition: transform 0.3s ease;
    font-family: system-ui, sans-serif;
    display: flex;
    flex-direction: column;
    overflow: hidden;
}
.panel.visible { transform: translateX(0); }

.header {
    padding: 12px;
    border-bottom: 1px solid #374151;
    background: #111827;
}
.header h2 {
    margin: 0;
    color: #fbbf24;
    font-size: 14px;
}

.content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

.section {
    margin-bottom: 16px;
}
.section h3 {
    margin: 0 0 8px 0;
    color: #6b7280;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
}

.control {
    margin-bottom: 8px;
}
.control label {
    display: flex;
    justify-content: space-between;
    color: #d1d5db;
    font-size: 11px;
    margin-bottom: 2px;
}
.control .value {
    color: #fbbf24;
    font-family: monospace;
}
.control input[type="range"] {
    width: 100%;
    height: 4px;
    background: #374151;
    border-radius: 2px;
    appearance: none;
}
.control input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: #fbbf24;
    border-radius: 50%;
    cursor: pointer;
}

.card-item {
    background: #374151;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 6px;
}
.card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}
.card-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.card-header span {
    color: #e5e7eb;
    font-size: 11px;
    font-weight: 600;
}
.reorder {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.reorder button {
    background: #4b5563;
    border: none;
    color: #9ca3af;
    font-size: 8px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 2px;
    cursor: pointer;
}
.reorder button:hover:not(:disabled) {
    background: #6b7280;
    color: #fff;
}
.reorder button:disabled {
    opacity: 0.3;
    cursor: default;
}
.swatches {
    display: flex;
    gap: 3px;
    margin-top: 6px;
}
.swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid #6b7280;
    cursor: pointer;
}
.swatch:hover { transform: scale(1.2); }

.footer {
    padding: 12px;
    border-top: 1px solid #374151;
    background: #111827;
}
.btn {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 6px;
}
.btn:last-child { margin-bottom: 0; }
.btn-primary {
    background: #22c55e;
    color: white;
}
.btn-primary:hover { background: #16a34a; }
.btn-secondary {
    background: #374151;
    color: #e5e7eb;
}
.btn-secondary:hover { background: #4b5563; }

.toast {
    position: fixed;
    bottom: 20px;
    left: 50%;
    transform: translateX(-50%);
    background: #22c55e;
    color: white;
    padding: 8px 16px;
    border-radius: 4px;
    font-size: 12px;
    z-index: 10001;
    opacity: 0;
    transition: opacity 0.3s;
}
.toast.visible { opacity: 1; }
.toast.error { background: #ef4444; }
`;

function extractColorsFromSVG(svgString) {
    const found = svgString.match(/#[0-9A-Fa-f]{6}/g);
    return found ? [...new Set(found)].slice(0, 7) : ['#000000'];
}

function slider(key, label, value, min, max, step) {
    return `<div class="control">
        <label>${label} <span class="value">${value}</span></label>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
}

class LogoEditor extends HTMLElement {
    constructor() {
        super();
        this.attachShadow({ mode: 'open' });
        this.state = null;
        this.svgContainer = null;
        this.colors = [];
    }

    connectedCallback() {
        // Find the SVG in the light DOM
        const svg = document.querySelector('svg.card-hand-logo');
        if (!svg) {
            console.warn('[logo-editor] No svg.card-hand-logo found on page');
            return;
        }

        const editorData = svg.dataset.editor;
        if (!editorData) {
            console.warn('[logo-editor] No data-editor attribute found');
            return;
        }

        try {
            this.state = JSON.parse(editorData);
        } catch (e) {
            console.error('[logo-editor] Failed to parse data-editor:', e);
            return;
        }

        this.svgContainer = svg.parentElement;

        // Extract color palette from card SVGs
        const palette = new Set();
        CARD_SVGS.forEach(s => extractColorsFromSVG(s).forEach(c => palette.add(c)));
        this.colors = [...palette];

        this.render();
        this.bindEvents();

        console.log('[logo-editor] Initialized');
    }

    render() {
        const { state, colors } = this;

        this.shadowRoot.innerHTML = `
            <style>${STYLES}</style>
            <button class="toggle">Editor</button>
            <div class="panel">
                <div class="header"><h2>Card Hand Editor</h2></div>
                <div class="content">
                    <div class="section">
                        <h3>Fan Layout</h3>
                        ${slider('fan.spread', 'Angle Spread', state.fan.spread, 0, 90, 1)}
                        ${slider('fan.spacing', 'Spacing', state.fan.spacing, 0, 150, 5)}
                        ${slider('fan.arc', 'Arc Height', state.fan.arc, -50, 100, 5)}
                        ${slider('fan.rotation', 'Rotation', state.fan.rotation, -45, 45, 1)}
                    </div>
                    <div class="section">
                        <h3>Card Size</h3>
                        ${slider('cardHeight', 'Height', state.cardHeight, 80, 500, 5)}
                    </div>
                    <div class="section">
                        <h3>Shadow</h3>
                        ${slider('shadow.dx', 'X Offset', state.shadow.dx, -20, 20, 1)}
                        ${slider('shadow.dy', 'Y Offset', state.shadow.dy, -20, 20, 1)}
                        ${slider('shadow.blur', 'Blur', state.shadow.blur, 0, 20, 1)}
                        ${slider('shadow.opacity', 'Opacity', state.shadow.opacity, 0, 1, 0.05)}
                    </div>
                    <div class="section">
                        <h3>Cards</h3>
                        <div class="cards-container"></div>
                    </div>
                    <div class="section">
                        <h3>Hover</h3>
                        ${slider('hover.scale', 'Scale', state.hover.scale, 1, 1.5, 0.05)}
                        ${slider('hover.lift', 'Lift', state.hover.lift, 0, 80, 1)}
                    </div>
                </div>
                <div class="footer">
                    <button class="btn btn-primary" data-action="save">Save to Disk</button>
                    <button class="btn btn-secondary" data-action="copy">Copy SVG</button>
                </div>
            </div>
            <div class="toast"></div>
        `;

        this.renderCardControls();
    }

    renderCardControls() {
        const { state, colors } = this;
        const container = this.shadowRoot.querySelector('.cards-container');

        container.innerHTML = state.cards.map((c, i) => `
            <div class="card-item">
                <div class="card-header">
                    <div class="card-left">
                        <div class="reorder">
                            <button data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
                            <button data-move="${i}" data-dir="1" ${i === state.cards.length - 1 ? 'disabled' : ''}>&#9660;</button>
                        </div>
                        <span>${CARD_NAMES[c.svgIndex] || 'Card'}</span>
                    </div>
                    <input type="color" data-card="${i}" value="${c.shadowColor}">
                </div>
                <div class="swatches" data-card="${i}">
                    ${colors.map(col => `<div class="swatch" style="background:${col}" data-color="${col}"></div>`).join('')}
                </div>
            </div>
        `).join('');

        // Bind reorder buttons
        container.querySelectorAll('button[data-move]').forEach(btn => {
            btn.onclick = e => {
                const idx = parseInt(e.target.dataset.move);
                const dir = parseInt(e.target.dataset.dir);
                this.moveCard(idx, dir);
            };
        });

        // Bind color pickers
        container.querySelectorAll('input[type="color"]').forEach(input => {
            input.oninput = e => {
                this.state.cards[e.target.dataset.card].shadowColor = e.target.value;
                this.updateSVG();
            };
        });

        // Bind swatches
        container.querySelectorAll('.swatch').forEach(swatch => {
            swatch.onclick = e => {
                const idx = e.target.closest('.swatches').dataset.card;
                const color = e.target.dataset.color;
                this.state.cards[idx].shadowColor = color;
                container.querySelector(`input[data-card="${idx}"]`).value = color;
                this.updateSVG();
            };
        });
    }

    bindEvents() {
        const toggle = this.shadowRoot.querySelector('.toggle');
        const panel = this.shadowRoot.querySelector('.panel');

        // Toggle visibility
        toggle.onclick = () => {
            const visible = panel.classList.toggle('visible');
            toggle.classList.toggle('open', visible);
        };

        // Bind sliders
        this.shadowRoot.querySelectorAll('input[type="range"][data-key]').forEach(input => {
            input.oninput = e => {
                const key = e.target.dataset.key;
                const value = parseFloat(e.target.value);
                this.setNested(key, value);
                e.target.parentElement.querySelector('.value').textContent = e.target.value;
                this.updateSVG();
            };
        });

        // Save button
        this.shadowRoot.querySelector('[data-action="save"]').onclick = () => this.save();

        // Copy button
        this.shadowRoot.querySelector('[data-action="copy"]').onclick = () => this.copy();
    }

    setNested(key, value) {
        const parts = key.split('.');
        if (parts.length === 2) {
            this.state[parts[0]][parts[1]] = value;
        } else {
            this.state[key] = value;
        }
    }

    moveCard(index, direction) {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= this.state.cards.length) return;
        [this.state.cards[index], this.state.cards[newIndex]] =
            [this.state.cards[newIndex], this.state.cards[index]];
        this.renderCardControls();
        this.updateSVG();
    }

    updateSVG() {
        const newSVG = compileSVG(this.state);
        this.svgContainer.innerHTML = newSVG;
    }

    showToast(msg, isError = false) {
        const toast = this.shadowRoot.querySelector('.toast');
        toast.textContent = msg;
        toast.classList.toggle('error', isError);
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2000);
    }

    async save() {
        const svgContent = compileSVG(this.state);
        try {
            const res = await fetch('/save-logo', {
                method: 'POST',
                headers: { 'Content-Type': 'image/svg+xml' },
                body: svgContent
            });
            const data = await res.json();
            this.showToast(data.success ? 'Saved!' : (data.error || 'Failed'), !data.success);
        } catch {
            this.showToast('Server unavailable', true);
        }
    }

    async copy() {
        try {
            await navigator.clipboard.writeText(compileSVG(this.state));
            this.showToast('Copied!');
        } catch {
            this.showToast('Copy failed', true);
        }
    }
}

customElements.define('logo-editor', LogoEditor);
