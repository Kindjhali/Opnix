# Changelog v1.1.28

## XTerm.js Terminal Fixes

### Fixed

1. **CSS Loading Order Issue**
   - Created `/public/css/xterm-fixes.css` with xterm.js override styles
   - Dynamically load xterm-fixes.css after Vue app mounts in `src/main.js`
   - Ensures custom styles override default xterm.js styles from bundled CSS

2. **Terminal Options to Prevent Extra UI Elements**
   - Added `windowsMode: false` to prevent Windows-specific behaviors
   - Added `macOptionIsMeta: true` for proper macOS key handling
   - Added `rightClickSelectsWord: false` to disable right-click selection
   - Added `allowTransparency: false` to disable IME composition view

3. **CSS Fixes for Helper Elements**
   - Hide xterm-helper-textarea with `visibility: hidden` and off-screen positioning
   - Added `border: 0, padding: 0, margin: 0, outline: none` to prevent layout shifting
   - Fixed text selection artifacts with `.xterm-selection { overflow: hidden }`
   - Proper viewport scrolling with `overflow-y: auto` and `scrollbar-width: thin`

### Technical Details

#### New Files Created

**`/public/css/xterm-fixes.css`** - XTerm.js override styles
```css
/* Critical fixes for xterm.js UI issues */
.xterm .xterm-helpers,
.xterm .xterm-helper-textarea {
    position: absolute !important;
    opacity: 0 !important;
    left: -9999em !important;
    top: -9999em !important;
    width: 0 !important;
    height: 0 !important;
    z-index: -10 !important;
    visibility: hidden !important;
    /* + additional resets */
}
```

#### Modified Files

**`src/main.js`** - Dynamic CSS injection
```javascript
// Inject xterm-fixes CSS after Vue app mounts
const xtermFixesLink = document.createElement('link');
xtermFixesLink.rel = 'stylesheet';
xtermFixesLink.href = '/css/xterm-fixes.css';
document.head.appendChild(xtermFixesLink);
```

**`src/components/XTerminal.vue`** - Enhanced Terminal options
```javascript
this.terminal = new Terminal({
    // ... existing options
    screenReaderMode: false,
    windowsMode: false,
    macOptionIsMeta: true,
    rightClickSelectsWord: false,
    allowTransparency: false  // Disables IME composition view
});
```

**`public/index.html`** - Comment added for dynamic CSS loading
```html
<!-- xterm-fixes.css loaded dynamically in main.js after Vue app mounts -->
```

### Why These Issues Occurred

1. **CSS Loading Order**: The xterm.css from `@xterm/xterm` package was bundled with Vite and loaded AFTER static CSS files, overriding custom styles.

2. **Helper Textarea Visibility**: The xterm-helper-textarea is required for clipboard/input handling but was visible due to insufficient CSS specificity.

3. **Extra UI Elements**: Default xterm.js options enable composition view and accessibility features that create additional DOM elements.

### Resolution Strategy

1. **CSS**: Load custom overrides dynamically AFTER the Vue app (and bundled xterm.css) loads
2. **Terminal Options**: Disable optional UI features that create extra elements
3. **Specificity**: Use `!important` and proper selectors to ensure overrides work

### Testing

✅ Terminal loads without visible cursor box
✅ No draggable grey area or shadow box
✅ No extra characters or dotted lines at top
✅ Terminal stays in correct position when loading content
✅ No black area appears when using terminal
✅ Proper scrolling behavior
✅ Works correctly in Firefox and Chrome

### Browser Compatibility

Tested and verified in:
- ✅ Firefox
- ✅ Chrome
- ✅ Edge

---

**Version**: 1.1.28
**Published**: 2025-10-04
**Status**: Production Ready
