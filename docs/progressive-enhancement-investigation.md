# Progressive Enhancement Investigation: card-hand-logo

## Current Problem

The `<card-hand-logo>` component requires JavaScript to render anything. Users see a blank space until:
1. JS bundle loads (~344ms first paint)
2. Custom element is defined (~654ms)
3. SVG renders in shadow DOM (~686ms)

**Performance metrics (commit 437d12b):**
- First meaningful paint of component: **686ms**
- After browser caching: **~25ms**

## Current Architecture

```
src/index.html          → <card-hand-logo class="lobby-logo"></card-hand-logo> (empty)
src/card-hand-logo.js   → Defines component, imports SVGs, renders to shadow DOM
src/card-hand-logo-editor.js → Dev-only editor UI, modifies STATE
dev-server.js           → Patches STATE in source file when editor saves
build.js                → Bundles JS, inlines into public/index.html
```

**Key constraint:** The editor workflow relies on:
1. STATE object in `card-hand-logo.js` being the source of truth
2. Editor modifying STATE → saving to file → rebuild → see changes
3. Precomputed transforms (viewBox, card positions) stored in STATE

## Progressive Enhancement Options

### Option A: Build-time SVG Injection

**How it works:**
1. At build time, render the static SVG using STATE values
2. Inject the pre-rendered SVG directly into index.html
3. Component "adopts" or replaces the static content when JS loads

**Build changes:**
```js
// build.js additions
import { renderStaticSVG } from './src/card-hand-logo-static.js';

// Replace <card-hand-logo></card-hand-logo> with pre-rendered content
const staticSVG = renderStaticSVG(STATE);
$('card-hand-logo').html(staticSVG);
```

**Component changes:**
```js
// card-hand-logo.js
connectedCallback() {
  // Check for pre-rendered content (light DOM)
  const existingContent = this.innerHTML;
  if (existingContent.includes('<svg')) {
    // Already has static content, upgrade to shadow DOM
    this.attachShadow({ mode: 'open' });
    this.shadowRoot.innerHTML = `<style>...</style>${existingContent}`;
    this.innerHTML = ''; // Clear light DOM
  } else {
    // No static content, render dynamically
    this.render();
  }
}
```

**Editor workflow:**
- Editor saves STATE → triggers rebuild → new static SVG injected
- No change to current editor experience

**Pros:**
- Zero JS required for initial paint
- Existing editor workflow preserved
- Simple implementation
- Works in all browsers

**Cons:**
- Slightly larger HTML (adds ~2-3KB gzipped for inline SVGs)
- Brief flash possible during JS upgrade (mitigatable with CSS)

---

### Option B: Declarative Shadow DOM

**How it works:**
Use `<template shadowrootmode="open">` for immediate shadow DOM without JS.

```html
<card-hand-logo class="lobby-logo">
  <template shadowrootmode="open">
    <style>:host { display: block; } ...</style>
    <svg viewBox="..."><!-- pre-rendered cards --></svg>
  </template>
</card-hand-logo>
```

**Build changes:**
Similar to Option A, but output uses template syntax.

**Component changes:**
```js
connectedCallback() {
  // Declarative shadow DOM already attached by browser
  if (this.shadowRoot) {
    // Just add interactivity (hover states already work via CSS)
    if (__EDITOR__ && renderEditor) {
      renderEditor(this, STATE, CARD_SVGS);
    }
  } else {
    // Fallback for older browsers
    this.attachShadow({ mode: 'open' });
    this.render();
  }
}

render() {
  // Only called as fallback or by editor for live updates
  this.shadowRoot.innerHTML = `...`;
}
```

**Pros:**
- True progressive enhancement (shadow DOM exists before JS)
- CSS hover effects work immediately (no JS needed)
- Cleaner semantic structure
- Editor can still call `render()` to update

**Cons:**
- Browser support: Chrome 90+, Firefox 123+, Safari 16.4+
- Needs fallback for older browsers
- Template parsing slightly more complex

---

### Option C: Hybrid with CSS-only Fallback

**How it works:**
1. Inline a simplified SVG in HTML (single combined image, no hover)
2. JS replaces with full interactive version
3. CSS transition masks the swap

```html
<card-hand-logo class="lobby-logo">
  <!-- Static fallback, hidden when JS loads -->
  <svg class="static-fallback" viewBox="...">...</svg>
</card-hand-logo>
```

```css
card-hand-logo .static-fallback {
  opacity: 1;
  transition: opacity 0.2s;
}
card-hand-logo:defined .static-fallback {
  opacity: 0;
  position: absolute;
}
```

**Pros:**
- Simplest implementation
- Graceful transition
- Works everywhere

**Cons:**
- Two SVGs in HTML briefly
- Static version can't have hover effects

---

### Option D: Server-generated Snapshot

**How it works:**
1. Create a Node script that renders the component headlessly
2. Output static HTML snapshot
3. Include snapshot in build

This is more complex and essentially duplicates the rendering logic server-side.

**Not recommended** for this use case - overkill for a logo component.

---

## Recommendation: Option A (Build-time SVG Injection)

**Rationale:**
1. **Simplest path** from current architecture
2. **Universal browser support** (no declarative shadow DOM concerns)
3. **Editor workflow unchanged** - STATE remains source of truth
4. **Measurable win** - First paint drops from 686ms to <50ms

**Implementation plan:**

1. **Create static renderer** (`src/card-hand-logo-static.js`)
   - Export function that generates SVG string from STATE
   - Reuse existing transform/viewBox calculations

2. **Update build.js**
   - Import static renderer
   - Generate SVG at build time
   - Inject into `<card-hand-logo>` element

3. **Update component** (`src/card-hand-logo.js`)
   - In `connectedCallback`, check for existing light DOM content
   - Move to shadow DOM if found, otherwise render dynamically
   - Editor still calls `render()` directly for live updates

4. **Add CSS to prevent flash**
   ```css
   card-hand-logo:not(:defined) svg {
     /* Static content visible before JS */
   }
   card-hand-logo:defined svg {
     /* Smooth transition to interactive version */
   }
   ```

**Expected result:**
- First paint: **<50ms** (HTML parsing only)
- Interactive: **~686ms** (same as before, but already visible)
- User perceives instant load

---

## Migration Considerations

### Editor Compatibility

The editor modifies STATE and saves to the source file. With build-time injection:
- Saving STATE triggers rebuild
- Rebuild regenerates static SVG
- Browser refresh shows updated logo

No changes needed to editor workflow.

### Testing

Update the performance test to verify:
1. Static SVG present in HTML before JS
2. Component upgrades correctly
3. Hover effects work after upgrade

### Rollback

If issues arise, simply remove the build-time injection. The component will render dynamically as before.

---

## Next Steps

1. [ ] Prototype Option A with a simple static renderer
2. [ ] Measure new first-paint time
3. [ ] Verify editor workflow still works
4. [ ] Add visual regression test for the upgrade transition
