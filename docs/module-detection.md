# Module Detection System

Opnix ships with a filesystem-backed module discovery pipeline that produces the data rendered on the CANVAS, MODULES, and DIAGRAM tabs. The detector combines package metadata, directory inspection, and static import tracing to surface the real structure of a project.

## Detection pipeline

1. **Package manifest scan**
   - Reads `package.json` (and optionally `devDependencies`) to seed known dependencies and framework hints.
   - Captures dependency names so downstream health scoring can penalise missing coverage or heavy external reliance.

2. **Top-level directory sweep**
   - Walks every first-level directory (excluding `node_modules`, VCS folders, build artefacts, etc.).
   - Maps directories to canonical modules using `DIRECTORY_ALIASES` (e.g. `public → frontend`, `agents → knowledge base`).
   - Adds standalone backend entry points (`server.js`, `app.js`, `index.js`) as the `backend` module.

3. **Recursive file analysis**
   - Traverses each module root, scanning only code-centric extensions (`.js`, `.ts`, `.jsx`, `.tsx`, `.json`, `.vue`, `.py`).
   - Parses ES module imports, CommonJS `require`, and dynamic `import()` calls to build dependency edges.
   - Resolves relative imports to real files, then maps those files back to owning modules for internal linking.
   - Tallies TODO/FIXME markers, line counts, test artefacts, and external packages for health metrics.

4. **Manual data merge**
   - Reads `modules.json` (if present) to merge user-defined modules or overrides.
   - Reads `module-links.json` to fold in drag-and-drop dependencies created from the canvas UI.

5. **Metric synthesis**
   - Health score = `100 - (todoPenalty + coveragePenalty + externalPenalty)`; clamped to `[20, 100]` and derived from real file analytics.
   - Coverage = `% test-bearing files` per module, based on filename heuristics (`test`, `spec`, `__tests__`).
   - Summary totals (module count, internal/external dependencies, line counts) power dashboard call-outs.

## API surface

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/modules/graph` | `GET` | Returns `{ modules, edges, summary }` for UI hydration. |
| `/api/modules/detect` | `POST` | Reruns the detector on-demand (optionally accepts `{ rootPath }`). |
| `/api/modules/links` | `GET/POST/DELETE` | Persists manual edges in `module-links.json`. |

## Output format

Each module object contains:

```jsonc
{
  "id": "frontend",
  "name": "Frontend Interface",
  "type": "frontend",
  "pathHints": ["public"],
  "dependencies": ["backend"],
  "externalDependencies": ["vue"],
  "fileCount": 12,
  "lineCount": 1342,
  "todoCount": 0,
  "coverage": 25,
  "health": 82,
  "frameworks": ["vue"]
}
```

Edges are plain Cytoscape-ready objects (`{ id, source, target }`). The `summary` object includes `moduleCount`, `dependencyCount`, `externalDependencyCount`, and `totalLines` for quick status displays.

## Storage

- `module-links.json` lives in the project root and is updated whenever the canvas edgehandles save a new dependency.
- `modules.json` remains optional and can carry custom modules (the detector honours `path`, `dependencies`, and any pre-computed metrics).

## Extending detection

- Add new directory aliases in `services/moduleDetector.js` → `DIRECTORY_ALIASES`.
- Expand supported languages by adding extensions to `CODE_EXTENSIONS` and language-specific framework hints (`FRAMEWORK_HINTS`).
- For large repos, consider filtering via the `rootPath` payload when calling `/api/modules/detect` to target sub-projects.

With the enhanced detector in place, every UI surface now reflects the actual repository structure—no placeholders, and a direct bridge between the filesystem, dependency graph, and operative canvas.
