/**
 * Card Hand Logo Editor Module
 * Debug-only editor UI - stripped from production builds via __DEBUG__ flag
 *
 * The editor works with STATE which has two parts:
 * - Editor inputs: cardHeight, anchor, fan, hover, shadow (what user tweaks)
 * - Precomputed values: viewBox, cardWidth, hoverTransform, cards[].transform (what component uses)
 */

// Card aspect ratio (must match card SVG viewBox)
const CARD_ASPECT = 356 / 525.7;

/**
 * Compute all derived values from editor inputs.
 * This is the core transformation: editor params -> component-ready values.
 */
function computeDerivedValues(state) {
    const { cardHeight, anchor, fan, hover, cards } = state;
    const cardWidth = cardHeight * CARD_ASPECT;
    const cardCount = cards.length;
    const centerIndex = (cardCount - 1) / 2;

    // Compute card transforms from fan parameters (no scaling - viewBox has fixed minimum)
    cards.forEach((card, i) => {
        const offset = i - centerIndex;
        const x = anchor.x + offset * fan.spacing;
        const y = anchor.y + Math.abs(offset) * fan.arc;
        const rotation = fan.rotation + (cardCount > 1
            ? offset * (fan.spread / (cardCount - 1))
            : 0);
        card.transform = `translate(${x}, ${y}) rotate(${rotation})`;
    });

    // Compute hover transform (CSS)
    const liftPercent = (hover.lift / cardHeight) * 100;
    state.hoverTransform = `translateY(-${liftPercent.toFixed(1)}%) scale(${hover.scale})`;

    // Store cardWidth
    state.cardWidth = parseFloat(cardWidth.toFixed(2));

    // Compute viewBox bounds (accounts for hover scale + lift)
    state.viewBox = computeViewBox(state);
}

/**
 * Compute viewBox string with fixed minimum size.
 * Small cards have padding, larger cards fill more of the space.
 */
function computeViewBox(state) {
    const { cardHeight, anchor, fan, hover, cards } = state;
    const cardWidth = cardHeight * CARD_ASPECT;
    const cardCount = cards.length;
    const centerIndex = (cardCount - 1) / 2;

    // Fixed minimum viewBox dimensions (reference size for cardHeight=250)
    const MIN_WIDTH = 700;
    const MIN_HEIGHT = 450;
    const padding = 20;

    // Account for hover: scale from bottom-center, lift upward
    const scaledWidth = cardWidth * hover.scale;
    const scaledHeight = cardHeight * hover.scale;

    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    // Card corners relative to bottom-center origin (before rotation)
    const corners = [
        [-scaledWidth / 2, -scaledHeight - hover.lift],
        [scaledWidth / 2, -scaledHeight - hover.lift],
        [-scaledWidth / 2, 0],
        [scaledWidth / 2, 0]
    ];

    cards.forEach((_, i) => {
        const offset = i - centerIndex;
        const cardX = offset * fan.spacing;
        const cardY = Math.abs(offset) * fan.arc;
        const rotation = fan.rotation + (cardCount > 1
            ? offset * (fan.spread / (cardCount - 1))
            : 0);

        const rad = rotation * Math.PI / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        corners.forEach(([cx, cy]) => {
            const rx = cx * cos - cy * sin;
            const ry = cx * sin + cy * cos;
            const x = anchor.x + cardX + rx;
            const y = anchor.y + cardY + ry;

            minX = Math.min(minX, x);
            minY = Math.min(minY, y);
            maxX = Math.max(maxX, x);
            maxY = Math.max(maxY, y);
        });
    });

    // Use minimum dimensions or actual bounds (whichever is larger)
    const contentWidth = maxX - minX + 2 * padding;
    const contentHeight = maxY - minY + 2 * padding;
    const vbWidth = Math.max(contentWidth, MIN_WIDTH);
    const vbHeight = Math.max(contentHeight, MIN_HEIGHT);

    // Center the content within the viewBox
    const contentCenterX = (minX + maxX) / 2;
    const contentCenterY = (minY + maxY) / 2;
    const vbMinX = contentCenterX - vbWidth / 2;
    const vbMinY = contentCenterY - vbHeight / 2;

    return `${vbMinX.toFixed(2)} ${vbMinY.toFixed(2)} ${vbWidth.toFixed(2)} ${vbHeight.toFixed(2)}`;
}

// Extract colors from SVG string for shadow color palette
function extractColorsFromSVG(svgString) {
    const found = svgString.match(/#[0-9A-Fa-f]{6}/g);
    return found ? [...new Set(found)].slice(0, 7) : ['#000000'];
}

// Card names for display
const CARD_NAMES = ['Gold', 'Blue', 'Green'];

// Generate STATE object source for patching into component file
function generateStateSource(state) {
    const cardsStr = state.cards.map(c =>
        `        { svgIndex: ${c.svgIndex}, shadowColor: '${c.shadowColor}', transform: '${c.transform}' }`
    ).join(',\n');

    return `const STATE = {
    // --- Editor inputs (used by editor to compute positions) ---
    cardHeight: ${state.cardHeight},
    anchor: { x: ${state.anchor.x}, y: ${state.anchor.y} },
    fan: {
        spread: ${state.fan.spread},        // total angle span from first to last card (degrees)
        spacing: ${state.fan.spacing},       // horizontal spacing between adjacent cards
        arc: ${state.fan.arc},           // vertical drop for outer cards (curve height)
        rotation: ${state.fan.rotation}        // base rotation offset for entire fan
    },
    hover: {
        scale: ${state.hover.scale},
        lift: ${state.hover.lift}
    },
    shadow: {
        dx: ${state.shadow.dx},
        dy: ${state.shadow.dy},
        blur: ${state.shadow.blur},
        opacity: ${state.shadow.opacity}
    },

    // --- Precomputed by editor, used directly by component ---
    viewBox: '${state.viewBox}',
    cardWidth: ${state.cardWidth},
    hoverTransform: '${state.hoverTransform}',
    cards: [
${cardsStr}
    ]
};`;
}

// Editor styles
const STYLES = `
.logo-editor-toggle {
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
.logo-editor-toggle:hover { background: #f59e0b; }
.logo-editor-toggle.open { left: 320px; }

.logo-editor-panel {
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
.logo-editor-panel.visible { transform: translateX(0); }

.logo-editor-header {
    padding: 12px;
    border-bottom: 1px solid #374151;
    background: #111827;
}
.logo-editor-header h2 {
    margin: 0;
    color: #fbbf24;
    font-size: 14px;
}

.logo-editor-content {
    flex: 1;
    overflow-y: auto;
    padding: 12px;
}

.logo-editor-section {
    margin-bottom: 16px;
}
.logo-editor-section h3 {
    margin: 0 0 8px 0;
    color: #6b7280;
    font-size: 10px;
    font-weight: bold;
    text-transform: uppercase;
}

.logo-editor-control {
    margin-bottom: 8px;
}
.logo-editor-control label {
    display: flex;
    justify-content: space-between;
    color: #d1d5db;
    font-size: 11px;
    margin-bottom: 2px;
}
.logo-editor-control .value {
    color: #fbbf24;
    font-family: monospace;
}
.logo-editor-control input[type="range"] {
    width: 100%;
    height: 4px;
    background: #374151;
    border-radius: 2px;
    appearance: none;
}
.logo-editor-control input[type="range"]::-webkit-slider-thumb {
    appearance: none;
    width: 12px;
    height: 12px;
    background: #fbbf24;
    border-radius: 50%;
    cursor: pointer;
}
.logo-editor-card-item {
    background: #374151;
    border-radius: 4px;
    padding: 8px;
    margin-bottom: 6px;
}
.logo-editor-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 8px;
}
.logo-editor-card-left {
    display: flex;
    align-items: center;
    gap: 8px;
}
.logo-editor-card-header span {
    color: #e5e7eb;
    font-size: 11px;
    font-weight: 600;
}
.logo-editor-reorder {
    display: flex;
    flex-direction: column;
    gap: 2px;
}
.logo-editor-reorder button {
    background: #4b5563;
    border: none;
    color: #9ca3af;
    font-size: 8px;
    line-height: 1;
    padding: 2px 4px;
    border-radius: 2px;
    cursor: pointer;
}
.logo-editor-reorder button:hover:not(:disabled) {
    background: #6b7280;
    color: #fff;
}
.logo-editor-reorder button:disabled {
    opacity: 0.3;
    cursor: default;
}
.logo-editor-swatches {
    display: flex;
    gap: 3px;
    margin-top: 6px;
}
.logo-editor-swatch {
    width: 14px;
    height: 14px;
    border-radius: 50%;
    border: 1px solid #6b7280;
    cursor: pointer;
}
.logo-editor-swatch:hover { transform: scale(1.2); }

.logo-editor-footer {
    padding: 12px;
    border-top: 1px solid #374151;
    background: #111827;
}
.logo-editor-btn {
    width: 100%;
    padding: 8px;
    border: none;
    border-radius: 4px;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    margin-bottom: 6px;
}
.logo-editor-btn:last-child { margin-bottom: 0; }
.logo-editor-btn-primary {
    background: #22c55e;
    color: white;
}
.logo-editor-btn-primary:hover { background: #16a34a; }
.logo-editor-btn-secondary {
    background: #374151;
    color: #e5e7eb;
}
.logo-editor-btn-secondary:hover { background: #4b5563; }

.logo-editor-toast {
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
.logo-editor-toast.visible { opacity: 1; }
.logo-editor-toast.error { background: #ef4444; }
`;

function slider(key, label, value, min, max, step) {
    return `<div class="logo-editor-control">
        <label>${label} <span class="value">${value}</span></label>
        <input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${value}">
    </div>`;
}

/**
 * Render the editor UI
 * @param {HTMLElement} component - The card-hand-logo element
 * @param {Object} state - The shared STATE object (modified in place)
 * @param {string[]} svgs - Array of card SVG strings
 */
export function renderEditor(component, state, svgs) {
    if (document.getElementById('logo-editor-panel')) return;

    // Extract color palette from SVGs
    const palette = new Set();
    svgs.forEach(svg => extractColorsFromSVG(svg).forEach(c => palette.add(c)));
    const colors = [...palette];

    // Inject styles
    if (!document.getElementById('logo-editor-styles')) {
        const style = document.createElement('style');
        style.id = 'logo-editor-styles';
        style.textContent = STYLES;
        document.head.appendChild(style);
    }

    // Toggle button
    const toggle = document.createElement('button');
    toggle.id = 'logo-editor-toggle';
    toggle.className = 'logo-editor-toggle';
    toggle.textContent = 'Editor';

    // Panel
    const panel = document.createElement('div');
    panel.id = 'logo-editor-panel';
    panel.className = 'logo-editor-panel';

    panel.innerHTML = `
        <div class="logo-editor-header"><h2>Card Hand Editor</h2></div>
        <div class="logo-editor-content">
            <div class="logo-editor-section">
                <h3>Fan Layout</h3>
                ${slider('fan.spread', 'Angle Spread', state.fan.spread, 0, 90, 1)}
                ${slider('fan.spacing', 'Spacing', state.fan.spacing, 0, 100, 5)}
                ${slider('fan.arc', 'Arc Height', state.fan.arc, -50, 100, 5)}
                ${slider('fan.rotation', 'Rotation', state.fan.rotation, -45, 45, 1)}
            </div>
            <div class="logo-editor-section">
                <h3>Card Size</h3>
                ${slider('cardHeight', 'Height', state.cardHeight, 80, 500, 5)}
            </div>
            <div class="logo-editor-section">
                <h3>Shadow</h3>
                ${slider('shadow.dx', 'X Offset', state.shadow.dx, -20, 20, 1)}
                ${slider('shadow.dy', 'Y Offset', state.shadow.dy, -20, 20, 1)}
                ${slider('shadow.blur', 'Blur', state.shadow.blur, 0, 20, 1)}
                ${slider('shadow.opacity', 'Opacity', state.shadow.opacity, 0, 1, 0.05)}
            </div>
            <div class="logo-editor-section">
                <h3>Cards</h3>
                <div id="editor-colors"></div>
            </div>
            <div class="logo-editor-section">
                <h3>Hover</h3>
                ${slider('hover.scale', 'Scale', state.hover.scale, 1, 1.5, 0.05)}
                ${slider('hover.lift', 'Lift', state.hover.lift, 0, 50, 1)}
            </div>
        </div>
        <div class="logo-editor-footer">
            <button class="logo-editor-btn logo-editor-btn-primary" id="editor-save">Save</button>
            <button class="logo-editor-btn logo-editor-btn-secondary" id="editor-copy">Copy STATE</button>
        </div>
    `;

    // Toast
    const toast = document.createElement('div');
    toast.id = 'logo-editor-toast';
    toast.className = 'logo-editor-toast';

    document.body.append(panel, toggle, toast);

    // Toggle visibility
    let visible = false;
    toggle.onclick = () => {
        visible = !visible;
        panel.classList.toggle('visible', visible);
        toggle.classList.toggle('open', visible);
    };

    // Update function - recomputes derived values and re-renders component
    const update = () => {
        computeDerivedValues(state);
        component.render();
    };

    // Helper to set nested property
    const setNested = (key, value) => {
        const parts = key.split('.');
        if (parts.length === 2) {
            state[parts[0]][parts[1]] = value;
        } else {
            state[key] = value;
        }
    };

    // Move card in array
    const moveCard = (index, direction) => {
        const newIndex = index + direction;
        if (newIndex < 0 || newIndex >= state.cards.length) return;
        [state.cards[index], state.cards[newIndex]] =
            [state.cards[newIndex], state.cards[index]];
        renderCardControls();
        update();
    };

    // Render card controls (called on init and after reorder)
    const colorContainer = panel.querySelector('#editor-colors');
    const renderCardControls = () => {
        colorContainer.innerHTML = state.cards.map((c, i) => `
            <div class="logo-editor-card-item">
                <div class="logo-editor-card-header">
                    <div class="logo-editor-card-left">
                        <div class="logo-editor-reorder">
                            <button data-move="${i}" data-dir="-1" ${i === 0 ? 'disabled' : ''}>&#9650;</button>
                            <button data-move="${i}" data-dir="1" ${i === state.cards.length - 1 ? 'disabled' : ''}>&#9660;</button>
                        </div>
                        <span>${CARD_NAMES[c.svgIndex] || 'Card'}</span>
                    </div>
                    <input type="color" data-card="${i}" value="${c.shadowColor}">
                </div>
                <div class="logo-editor-swatches" data-card="${i}">
                    ${colors.map(col => `<div class="logo-editor-swatch" style="background:${col}" data-color="${col}"></div>`).join('')}
                </div>
            </div>
        `).join('');

        // Bind reorder buttons
        colorContainer.querySelectorAll('button[data-move]').forEach(btn => {
            btn.onclick = e => {
                const idx = parseInt(e.target.dataset.move);
                const dir = parseInt(e.target.dataset.dir);
                moveCard(idx, dir);
            };
        });

        // Bind color pickers
        colorContainer.querySelectorAll('input[type="color"]').forEach(input => {
            input.oninput = e => {
                state.cards[e.target.dataset.card].shadowColor = e.target.value;
                update();
            };
        });

        // Bind color swatches
        colorContainer.querySelectorAll('.logo-editor-swatch').forEach(swatch => {
            swatch.onclick = e => {
                const idx = e.target.closest('.logo-editor-swatches').dataset.card;
                const color = e.target.dataset.color;
                state.cards[idx].shadowColor = color;
                colorContainer.querySelector(`input[data-card="${idx}"]`).value = color;
                update();
            };
        });
    };

    // Initial render of card controls
    renderCardControls();

    // All range sliders
    panel.querySelectorAll('input[type="range"][data-key]').forEach(input => {
        input.oninput = e => {
            const key = e.target.dataset.key;
            const value = parseFloat(e.target.value);
            setNested(key, value);
            e.target.parentElement.querySelector('.value').textContent = e.target.value;
            update();
        };
    });

    // Show toast
    const showToast = (msg, err) => {
        toast.textContent = msg;
        toast.classList.toggle('error', err);
        toast.classList.add('visible');
        setTimeout(() => toast.classList.remove('visible'), 2000);
    };

    // Save button
    panel.querySelector('#editor-save').onclick = async () => {
        const stateSource = generateStateSource(state);
        try {
            const res = await fetch('/save-state', {
                method: 'POST',
                headers: { 'Content-Type': 'text/plain' },
                body: stateSource
            });
            const data = await res.json();
            showToast(data.success ? 'Saved!' : (data.error || 'Failed'), !data.success);
        } catch {
            showToast('Server unavailable', true);
        }
    };

    // Copy button
    panel.querySelector('#editor-copy').onclick = async () => {
        try {
            await navigator.clipboard.writeText(generateStateSource(state));
            showToast('Copied!');
        } catch {
            showToast('Copy failed', true);
        }
    };
}
