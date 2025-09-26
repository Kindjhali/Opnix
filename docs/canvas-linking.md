# Canvas Linking System

The Opnix canvas renders the live module graph and lets operators create or prune dependencies directly from the UI. This document outlines how linking works end-to-end.

## Data sources

1. **Directory & package discovery** – `services/moduleDetector.detectModules` scans the workspace root. It classifies well-known directories (e.g. `src/`, `public/`, `agents/`) and registers composite workspaces (`packages/*`, `apps/*`, `services/*`). Any custom modules stored in `data/modules.json` are merged so the canvas honours operator-defined boundaries.
2. **Import graph analysis** – Every code file under a module’s root is parsed for `import`, `require`, and dynamic `import()` calls. Relative imports are resolved to absolute files and mapped back to module owners; a hit turns into an internal dependency edge. External packages (anything not built-in Node) are tallied separately for health metrics but do not create canvas edges.
3. **Manual edges** – Operators can drag a link in the UI. The client calls `POST /api/modules/links`, which records `{ source, target, createdAt }` in `data/module-links.json`. During the next detection run these manual links are folded into the dependency set so they render alongside auto-detected edges.

The combined module list and edge array are returned by `/api/modules/graph` and cached in the Vue client. This keeps the canvas tied to real code paths while still allowing curated relationships.

## Client interaction flow

1. The Vue client calls `/api/modules/graph` on mount. The payload includes `modules[]`, `edges[]`, and a `summary` block (module count, dependency count, etc.).
2. Nodes are hydrated with metadata: `health` (computed from TODOs, coverage, external deps), `frameworks`, and `pathHints` (relative folders the module manages). This drives tooltips and inspector panels.
3. `cytoscape-edgehandles` activates when the CANVAS tab opens. Dragging from a node spawns the handle overlay; releasing over a second node posts `{ source, target }` to `/api/modules/links`.
4. On success the client re-fetches `/api/modules/graph`. Duplicate requests short-circuit with `{ duplicate: true }`, so the UI simply ignores the redundant drag.
5. Deleting a link invokes `DELETE /api/modules/links` with the same `{ source, target }` payload; the backend removes it from `data/module-links.json` and the next refresh drops the edge.

## API endpoints

| Endpoint | Method | Purpose |
| --- | --- | --- |
| `/api/modules/graph` | `GET` | Combined auto + manual edges (used for initial render). |
| `/api/modules/links` | `POST` | Persist a new manual dependency and timestamp. |
| `/api/modules/links` | `DELETE` | Remove an existing manual dependency (`{ source, target }`). |
| `/api/modules/detect` | `POST` | On-demand rescan (optional `rootPath`) used by the UI after bulk edits. |

Errors (missing modules, self-links) return HTTP 4xx codes with explanatory messages.

## Storage format

`data/module-links.json` contains a simple append-only array:

```json
[
  {
    "source": "frontend",
    "target": "backend",
    "createdAt": "2025-09-24T18:42:11.220Z"
  }
]
```

The detector also writes the full snapshot (modules, edges, summary) to `data/modules-detected.json`. The canvas reads from this cache whenever `/api/modules/graph` reruns, and the API falls back to it if a scan fails so the UI never drops back to placeholder nodes.

During detection, these relationships are folded into the dependency set before Cytoscape elements are generated.

## Canvas UI behaviour

- **Node encoding** – Fill colour tracks the `health` score (80–100: neon cyan, 50–79: warm orange, <50: warning red). Framework badges leverage `module.frameworks` and tooltips surface `pathHints` for quick navigation back to the filesystem.
- **Edge creation rules** – The client refuses to create self-loops and will only POST when both modules exist. The backend re-validates this and collapses duplicates, keeping the graph canonical.
- **Layouts** – `Tree`, `Circle`, and `Force` layouts all reuse the same `modules`/`edges` array; Cytoscape simply changes the layout function at runtime so the underlying relationships stay intact.
- **Exports** – The Export button posts either a base64 PNG or raw JSON to `/api/canvas/export`. Files land in `spec/canvas/` (e.g. `opnix-canvas-<timestamp>.png`) and are indexed by `/api/exports` so the archive modal can download them later.
- **Post-audit refresh** – When an audit completes, `runInitialAudit()` captures the current module set and writes a snapshot to the spec bundle, ensuring the visual canvas, documentation, and audit payload reference the same dependency graph.

## Operational tips

- To seed links programmatically, write directly to `data/module-links.json` and call `/api/modules/detect` once.
- Remove stale edges with `DELETE /api/modules/links` prior to the next detection cycle.
- If drag-and-drop feels slow on huge graphs, consider filtering modules in the UI before linking.

This pipeline keeps the visual map aligned with the codebase by marrying static analysis with real-time manual curation.
