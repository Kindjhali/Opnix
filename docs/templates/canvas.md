# Canvas Surface Template

## Current Behaviour
- Vue SPA (`src/App.vue + src/appOptions.js`) instantiates Cytoscape with the module detector payload returned by `/api/modules/detect` and manual links from `/api/modules/links`.
- Module nodes include health, coverage, and type metadata derived from `services/moduleDetector.js` and are persistently stored on audit export via `spec/canvas/opnix-canvas-*.json`.
- Users can drag-create dependencies; the backend enforces validation (no self-links, requires known module IDs) before storing records in `data/module-links.json`.

## Extension Prompts
- How should the canvas represent cross-repo or external service dependencies (e.g., colour bands, grouped clusters)?
- What additional telemetry (test coverage deltas, TODO counts, tracked metrics) should surface as badges or callouts on nodes?
- Which manual editing workflows (bulk link creation, health overrides, tag-based filtering) are missing for day-to-day operators?

## Integration Hooks
- `services/moduleDetector.detectModules()` is the authoritative data source; extend it to capture new attributes (risk scores, subsystem tags) that the canvas can render.
- `/api/modules/links` can accept hookable events for automation (e.g., notify Claude/Codex when a new dependency is created to update documentation).
- Cytoscape initialisation in `src/App.vue + src/appOptions.js` is the injection point for custom layouts, custom node renderers, and cross-surface navigation (e.g., click-to-open Module docs).

## Planned Automation
- Add timeline snapshots to `.opnix/runtime/canvas/` so downstream tooling can diff topology changes between audits.
- Generate narrative diagrams (Mermaid or PNG) directly from the current Cytoscape session and mirror them in the runtime bundle alongside detector exports.
- Introduce health-based remediation tickets by exposing low-health/coverage signals from the canvas to the Bugs surface via the tickets API.
