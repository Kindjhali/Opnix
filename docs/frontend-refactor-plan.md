# Frontend Refactor Plan

## Current State Snapshot (2025-09-25)
- `public/index.html` — 3,424 LOC, single HTML document containing layout, tab markup, modal definitions, and global styles.
- `src/App.vue + src/appOptions.js` — 3,683 LOC, monolithic Vue 3 app with tabs, API calls, canvas logic, Markdown manager, terminal client, Storybook embed, and progressive interview orchestration.
- Both files load via CDN Vue runtime (no build step) and rely on globally registered refs/components.

## Recent Progress (2025-09-27)
- Introduced `src/composables/appStore.js`, a reactive singleton shared by `App.vue`, terminal/command centre composables, and CLI routes. State previously hoisted in `appOptions.js` is now resolved via `useAppStore()`, unblocking the rest of the decomposition strategy.
- Updated `commandCenterManager`, `terminalManager`, and `themeManager` to fall back to the store when invoked outside the Vue instance, ensuring CLI/test flows stay aligned with the UI refactor.

## Goals
1. Reduce the surface area of `public/index.html` and `src/App.vue + src/appOptions.js` without breaking the SPA bootstrap or CDN deployment.
2. Preserve accessibility + metadata (viewport, charset) and ensure the theme toggle continues to apply `data-theme` to `<body>`/`<html>`.
2. Improve maintainability by extracting cohesive modules/components while keeping the runtime script-based (no bundler yet).
3. Preserve existing functionality (tabs, canvas, terminal, Markdown manager, Storybook embed, diagrams, interview flow).
4. Maintain accessibility + theming hooks introduced in recent sessions (theme toggle, keyboard navigation, live regions).

## Constraints
- No build tooling currently (no Vite/Webpack); refactor must work with native ES modules served by Express.
- All APIs already live; refactor must avoid renaming public routes until UI code updated in sync.
- The console/terminal needs to remain globally available across tabs.
- Tests rely on existing endpoints (`npm run test:modules`); ensure any extraction keeps API interface stable.

## Proposed Extraction Strategy

### Phase 0 — Infrastructure Setup
- Enable ES module support via `<script type="module">` for new files while keeping legacy inline script for fallback.
- Create `public/modules/` directory to house extracted ES modules.
- Introduce a lightweight global event bus (or use Vue provide/inject) to share state across extracted modules if needed.

### Phase 1 — Static Assets & Styles
- Move global CSS from inline `<style>` to `public/css/base.css`; include via `<link>`.
- Split tab-specific styles into dedicated CSS modules (`canvas.css`, `terminal.css`, etc.) to simplify the HTML head.

### Phase 2 — Vue App Composition
1. **Bootstrap Module (`public/modules/opnixApp.js`)**
   - Export `createOpnixApp()` that encapsulates the current `createApp({...})` options object.
   - Accept dependencies via parameters to aid testing (API client, canvas helpers).
2. **State/Constants (`public/modules/state.js`)**
   - Export static maps (`agentCategoryIcons`, `SPEC_CATEGORY_LABELS`, `TICKET_STATUS_HOOKS`).
   - Centralize theme metadata (`MERMAID_THEME_MAP`, `themeOptions`).
3. **Services Layer**
   - `public/modules/apiClient.js`: wrap `fetch` calls (tickets, modules, markdown, diagrams).
   - `public/modules/terminalClient.js`: hold terminal history/execute functions.
   - `public/modules/interviewClient.js`: expose progressive-question helpers for CLI + UI reuse.
   - `public/modules/eventBus.js`: tiny pub/sub for cross-module notifications (optional but helpful during migration).
4. **Feature Modules**
   - `public/modules/themeManager.js`: move `setTheme`, `updateThemeIndicator`, keyboard handlers.
   - `public/modules/diagramManager.js`: contains `generateDiagram`, `generateFromModules`, `renderMermaid` with theme injection.
   - `public/modules/markdownManager.js`: isolated state + methods for Markdown tab.
   - `public/modules/roadmapManager.js`: milestone CRUD + formatting helpers.
   - `public/modules/canvasManager.js`: Cytoscape initialisation, edge handles, export helpers.
   - `public/modules/interviewManager.js`: progressive questionnaire orchestration reused by CLI/live UI.
   - `public/modules/storybookEmbed.js`: iframe source handling, theme sync, polling.
   - `public/modules/docsManager.js`: docs tab file tree interactions (distinct from Markdown manager).
   - `public/modules/techStackManager.js`: aggregate detected dependencies + interview responses into stack snapshot/export.

### Module Naming Summary
- `opnixApp.js` — bootstrap + dependency injection
- `state.js` — shared constants, theme descriptors
- `apiClient.js` — REST fetch wrappers
- `terminalClient.js` — terminal command/history operations
- `interviewClient.js` — progressive-question helpers for CLI/UI reuse
- `eventBus.js` — optional shared event emitter
- `themeManager.js` — theme switching + indicator logic
- `diagramManager.js` — Mermaid generation and rendering
- `markdownManager.js` — Markdown archive CRUD + filtering
- `roadmapManager.js` — roadmap timeline helpers
- `canvasManager.js` — Cytoscape graph setup and refresh
- `interviewManager.js` — progressive question flow, insights, CLI reuse
- `storybookEmbed.js` — Storybook iframe coordination
- `docsManager.js` — documentation tab file browser/editing
- `techStackManager.js` — tech stack aggregation/export

### Phase 3 — Template Decomposition
- Replace inline tab markup with `<component :is="activeTabComponent">` referencing a registry of template strings or SFC-like render functions.
- Example approach: create `public/templates/canvas.html`, fetch/inline on load, or convert to render functions.
- Alternative: convert to Vue Single File Components compiled ahead of time (requires build step) — optional follow-up.

### Phase 4 — Progressive Migration Plan
1. Extract non-reactive helpers first (services/constants) since low risk.
2. Move terminal + theme management to modules while keeping existing method signatures (import and bind to `this`).
3. Incrementally replace in-component methods with imported functions using `.call(this, ...)` or by returning composition functions.
4. After each extraction, run `pnpm lint:js` and `npm run test:modules` to confirm no regressions.

### Phase 5 — HTML Cleanup
- Introduce partial includes (server-side) or hydrating placeholders.
- Example: use `<div id="tab-canvas" data-template="/templates/canvas.html"></div>` and hydrate via fetch.
- Ensure script order maintained: load Vue, then shared modules, then bootstrap module that mounts app.

## Risk Mitigation
- Work in small PR-sized increments (extract theme module, verify tests, then move to next area).
- Keep a feature flag to fallback to legacy functions while migrating (e.g., `useLegacyMarkdownManager` flag).
- Maintain thorough logging in early phases to catch undefined state.
- Add smoke test scripts for critical tabs (canvas load, markdown CRUD, terminal command) to run after each extraction.

## Immediate Next Steps (Pre-Refactor)
1. Create skeleton module files with exports mirroring current methods (no behavioural changes yet).
2. Add unit-like smoke tests for theme toggle + terminal via Cypress-lite script (optional but recommended).
3. Communicate deployment impact (Express static config may need to expose new directories).

---

Prepared by Codex (GPT-5) — 2025-09-25

## Updated Architecture

See [Composables Overview](composables-overview.md) for current module breakdown.
