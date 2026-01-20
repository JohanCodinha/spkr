# Card Hand Logo Editor - Status

## Current Implementation (Simplified)

### Overview

The `<card-hand-logo>` web component displays an animated fan of playing cards. In debug mode (`__DEBUG__ = true`), a separate editor module provides UI for tweaking visual parameters.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  card-hand-logo.js                                          │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ STATE (single source of truth)                       │   │
│  │   cards: [{ x, y, rotation, zIndex, shadowColor }]   │   │
│  │   config: { scale, cardHeight, hover..., shadow... } │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ SVGS = [imported card SVGs]                          │   │
│  │ (not baked - imported from ./cards/*.svg)            │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │ CardHandLogo class                                   │   │
│  │   getState() → { cards, config, svgs }               │   │
│  │   updateState(cards, config) → re-render             │   │
│  └─────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────┘

                    ↓ (debug mode only)

┌─────────────────────────────────────────────────────────────┐
│  card-hand-logo-editor.js (tree-shaken in production)       │
│                                                             │
│  renderEditor(component)                                    │
│    - Reads state via component.getState()                   │
│    - UI controls update local copy                          │
│    - Calls component.updateState() on change                │
│    - Save generates STATE source, patches component file    │
└─────────────────────────────────────────────────────────────┘
```

### Key Design Decisions

1. **SVGs are imported, not baked** - The SVGs stay as separate files (`./cards/*.svg`) and are imported at build time. They're not embedded in the STATE object.

2. **Single STATE object** - All editable values live in one place at the top of `card-hand-logo.js`. This makes it easy to:
   - See current values at a glance
   - Patch values for live reload
   - Generate new state from the editor

3. **Editor generates STATE only** - The save function generates just the STATE object source code, which is then patched into the component file. No need to regenerate the entire component.

4. **Tree-shaking via __DEBUG__** - The editor module is imported but the export is conditionally assigned based on `__DEBUG__`. When false, esbuild eliminates the dead code.

### Files

| File | Purpose |
|------|---------|
| `src/card-hand-logo.js` | Web component with STATE object |
| `src/card-hand-logo-editor.js` | Editor UI (debug only) |
| `dev-server.js` | Dev server with `/save-state` endpoint |

### Bundle Sizes

| Build | Size | Editor |
|-------|------|--------|
| Production | ~75KB | Stripped |
| Debug | ~113KB | Included |

### Commands

```bash
# Development with editor
npm run dev

# Debug build only
npm run build:debug

# Production build (no editor)
npm run build
```

### How State Saves Work

1. Editor calls `POST /save-state` with generated STATE source
2. Server reads `card-hand-logo.js`
3. Regex finds and replaces the STATE object
4. File is written and rebuild triggered
5. Refresh to see changes

### Live Reload

The component's `updateState()` method allows the editor to update values without saving:
- Changes are reflected immediately in the UI
- No rebuild needed for preview
- Save persists to source file
