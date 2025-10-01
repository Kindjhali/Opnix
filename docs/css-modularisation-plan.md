# CSS Modularisation Plan

`public/css/base.css` originally contained ~2,800 lines of global styles spanning layout scaffolding, tab-specific panels, modal chrome, and legacy helpers. The refactor splits the stylesheet into cohesive modules while preserving the existing markup contract.

## Baseline
- Base CSS line count (2025-09-27 start): 2,785 lines
- Base CSS line count after Phase 4 (2025-09-27): 674 lines

## Goals
1. Reduce `base.css` to foundational tokens (reset, typography, utilities) and shared layout scaffolding.
2. Move tab-specific rules into dedicated files under `public/css/tabs/` (canvas, roadmap, docs, specs, api, storybook, terminal).
3. Extract component-scoped styles (e.g., status panel, workbench strip, modal layer) into CSS modules that mirror the Vue component structure.
4. Maintain MOLE/CANYON theming by keeping colour variables in `theme-*.css` and using CSS custom properties in the extracted files.

## Progress by Phase
### Phase 1 – Inventory & Baseline ✅
- [x] Tagged each major section inside `base.css` with comments that map to a target module (tabs, components, utilities).
- [x] Captured a `wc -l` snapshot before beginning the extraction work.

### Phase 2 – Utilities & Layout ✅
- [x] Extracted resets, typography, spacing utilities, and grid helpers into `public/css/base/utilities.css`.
- [x] Updated `base.css` to import the utility bundle via `@import`.

### Phase 3 – Tab Bundles ✅
- [x] Created `public/css/tabs/` packages (Docs, Roadmap, Terminal footer, Canvas/Modules, Specs).
- [x] Wired the new tab styles through `base.css` imports so existing HTML continues to load them without bundler changes.

### Phase 4 – Component Bundles ✅
- [x] Mirrored key Vue components under `public/css/components/` (`app-header.css`, `workbench-strip.css`, `command-center.css`, `statusline-panel.css`, `tab-navigation.css`, `terminal-panel.css`, `modals-layer.css`, `storybook-frame.css`).
- [x] Replaced legacy global selectors with component-scoped classes while keeping aliases where legacy markup still relies on them.

### Phase 5 – Cleanup & Validation (In Progress)
- [x] Remove obsolete console/command helpers from `base.css` to rely on the new component bundles.
- [x] Add automated theme-loader regression (`tests/themeManager.test.mjs`) covering MOLE/CANYON switching + persistence.
- [x] Run `pnpm lint:css` + `pnpm test:modules` after component extractions to keep Phase 5 clean.
- [ ] Manually regress both MOLE and CANYON themes across responsive breakpoints.

## Open Questions
- Should long-term bundling move CSS into Vite modules? (Optional follow-up once the split stabilises.)
- Do we introduce CSS Modules/SFC `<style scoped>` portions for certain components? (Out of scope for this pass.)

Keep this document updated as each phase completes so future contributors can pick up the remaining tasks.
