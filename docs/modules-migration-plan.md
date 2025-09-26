# opnixApp Module Migration Plan

## Objective
Incrementally extract logic from `src/App.vue + src/appOptions.js` into the dedicated modules listed in `docs/modules.md`, keeping the SPA functional at each checkpoint and maintaining CDN-friendly ES module loading.

---

## Migration Checklist

| Phase | Target Module | Key Work | Validation |
| --- | --- | --- | --- |
| 1 | `state.js` | Move constants (`themeOptions`, tab metadata, icon maps, ticket hooks) into exported objects. Update `app.js` to import them. | `pnpm lint:js`; spot-check tabs render. |
| 2 | `apiClient.js` | Wrap existing `fetch` calls (tickets/features/modules/markdown/diagrams) with shared error handling + CLI reuse points. Wire `app.js` methods to use the client. | `npm run test:modules`; verify UI & CLI fetches succeed. |
| 3 | `terminalClient.js` | Extract terminal history load/execute helpers and ANSI normalization. Ensure contenteditable input still focuses and history updates. | Run terminal commands in UI; ensure lint clean. |
| 4 | `themeManager.js` | Move theme switching, indicator math, keyboard handlers, Mermaid theme configuration. Provide composable that returns the current theme + callbacks. | Toggle themes repeatedly; confirm indicator + diagrams update. |
| 5 | `diagramManager.js` | Port Mermaid generation/rendering, including error handling and module-derived fallback graph. Accept theme + module data as parameters. | Generate each diagram type; ensure auto-load works. |
| 6 | `canvasManager.js` | Extract Cytoscape initialization, edge handles, export logic, module summary updates. Keep public API minimal (`initCanvas`, `refresh`, `saveEdge`). | Canvas tab interactive test; export JSON/PNG if available. |
| 7 | `markdownManager.js` | Isolate markdown archive state, filtering, editor operations. Introduce events for preview/clear. | CRUD operations via UI; markdown tests (`npm run test:modules`). |
| 8 | `docsManager.js` | Mirror steps for Docs tab (file tree, templates). Share formatting helpers with markdown module. | Verify docs tab loads tree, edits, templates. |
| 9 | `roadmapManager.js` | Move milestone CRUD/stat calculations. Ensure timeline + cards re-render when data changes. | Generate roadmap from tickets; add milestone manually. |
|10 | `techStackManager.js` | Aggregate detector results + interview responses to produce stack snapshot (tab + export). | Stack view renders; export generated. |
|11 | `interviewClient.js` | Extract ProgressiveQuestionEngine helpers for reuse by CLI session engine. | CLI command smoke test hitting interview flows. |
|12 | `interviewManager.js` | Wrap progressive question orchestration, insights, auto-module feature scaffolding. Coordinate with existing `spec-scaffold.mjs`. | Walk through interview flow; ensure insights still show. |
|13 | `storybookEmbed.js` | Extract iframe URL logic, heartbeat refresh, theme sync. | Storybook tab loads; theme changes update embed. |
|14 | `eventBus.js` (optional) | Add minimal emitter if modules need decoupled comms; refactor direct callbacks if necessary. | Unit smoke test (manual) for pub/sub. |
|15 | `opnixApp.js` | Final pass: convert root Vue `createApp` call to import individual modules and compose them via `setup()`/`methods`. | Full regression: `pnpm lint:js`, `npm run test:modules`, manual tab sweep. |

---

## Cross-Cutting Tasks
- Add `public/modules/` to Express static middleware (`server.js`) once modules are introduced.
- Update `TODO.md` as phases complete.
- After each extraction, document new module APIs in `docs/modules.md`.
- Maintain backwards compatibility (keep existing method names) until all call sites updated.
- Ensure theme and terminal managers expose synchronous APIs so Vue reactivity remains intact.

---

## Tracking Template
Use the table below during execution (copy into PR notes or update directly):

| Module | Status | Notes |
| --- | --- | --- |
| state.js | ☐ Not started | |
| apiClient.js | ☐ Not started | |
| terminalClient.js | ☐ Not started | |
| themeManager.js | ☐ Not started | |
| diagramManager.js | ☐ Not started | |
| canvasManager.js | ☐ Not started | |
| markdownManager.js | ☐ Not started | |
| docsManager.js | ☐ Not started | |
| roadmapManager.js | ☐ Not started | |
| techStackManager.js | ☐ Not started | |
| interviewClient.js | ☐ Not started | |
| interviewManager.js | ☐ Not started | |
| storybookEmbed.js | ☐ Not started | |
| eventBus.js | ☐ Not started | Optional |
| opnixApp.js | ☐ Not started | Final consolidation |

---

Prepared 2025-09-25 — keep this doc updated as modules land.
