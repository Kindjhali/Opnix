# Visual Enablement Sprint — Technical Scope

## Mermaid Diagram Engine

### Current Signals to Leverage
- `services/moduleDetector.js`: authoritative source for modules + edges, including manual links and health metrics.
- `data/tickets.json` and `/api/tickets`: real backlog used to describe incidents and acceptance gaps.
- `data/features.json` (via `/api/features`): feature proposals with module bindings and acceptance criteria.
- `public/data/interview-sections.json`: progressive interview blueprint feeding spec builder and audit questionnaires.
- Audit payload (`runInitialAudit` in `server.js:320`): already aggregates the above into export-ready summaries.

### Backend Additions
- Create `services/diagramGenerator.js` to standardise Mermaid builders:
  - `buildArchitectureGraph({ modules, edges })` → `graph LR` with health/status annotations and edge weights from detector output.
  - `buildSequenceDiagram({ features, tickets })` → `sequenceDiagram` mapping feature life cycle (e.g., `Stakeholder -> Module -> QA -> Release`). Use ticket statuses to highlight blockers.
  - `buildEntityDiagram({ modules })` → `erDiagram` linking modules, external deps, and detected frameworks.
  - `buildFlowDiagram({ interview })` → `flowchart TD` covering intake → auditing → export stages using interview blueprint phases.
- Surface diagrams via REST:
  - `GET /api/diagrams/:type` returning `{ type, mermaid, generatedAt, sources }`.
  - Support query params (`?featureId=`, `?refresh=1`) to scope diagrams or force detector re-run.
  - Include validation so only known types resolve; others 404.
- Extend `runInitialAudit()` to call the diagram generator and append raw `.mmd` files into `spec/diagrams` alongside JSON/spec/doc artifacts.

### Frontend Responsibilities (`src/App.vue + src/appOptions.js`)
- Expand the DIAGRAMS tab to list architecture, sequence, entity, and flow variants with real timestamps + download buttons.
- Replace `generateFromModules()` inline diagramming with fetches to `/api/diagrams/...`; keep manual override mode for quick sketches.
- Provide export options: copy Mermaid source, save `.mmd` via new `/api/diagrams/export` (or reuse generic export endpoint).
- Indicate data freshness (e.g., show if underlying audit predates module/ticket updates).
- Auto-render the architecture diagram the first time the tab is opened each session and pipe Mermaid parser errors into a themed alert banner so failures are visible without digging through the console.

### Exports & Sync
- Add `docs/` reference describing diagram semantics for future onboarding.
- Ensure `/api/canvas/export` style path writes `.mmd` files into `spec/diagrams` so Storybook and docs can reuse the raw source.
- Wire into audit follow-ups: if diagram generation fails, surface actionable errors in `followUps` array.

### Risks / Considerations
- Sequence diagrams require heuristics to map tickets/features → actors; capture assumptions in code comments and docs.
- Keep UltraThink enforcement untouched; inspect CLI entry points before wiring new commands.
- Large module graphs may produce unreadable Mermaid output—consider chunking or providing layout hints (e.g., subgraphs per module type).

## Storybook Integration

### Present Frontend Shape
- Single-file Vue 3 app (`src/App.vue + src/appOptions.js`) mounted via CDN with global components baked into template markup inside `public/index.html`.
- Shared neon/cyber theme variables defined inline in `index.html`; JetBrains Mono as canonical font.
- Shell includes a metrics-driven top bar, tab navigation bar, and a sticky operations terminal strip that runs real shell commands so the console remains visible across surfaces.

### Refactor & Component Extraction
- Introduce `src/components/` and `src/composables/` directories to hold reusable Vue SFCs:
  - `CanvasPanel`, `ModuleHealthCard`, `AgentGrid`, `SpecTimeline`, `ExportList`, `InterviewStepper`.
  - Migrate theme tokens into `src/theme/neon.css` (still loaded by Express via static middleware).
- Update `src/App.vue + src/appOptions.js` to import from the new modules (switch to bundled build via Vite or Rollup) so runtime matches Storybook stories.

### Storybook Setup
- Add dev dependencies: `@storybook/vue3`, `@storybook/addon-essentials`, `@storybook/addon-interactions`, `@storybook/test`, `storybook-dark-mode`.
- Initialise config under `.storybook/` with Vite builder (`framework: { name: '@storybook/vue3-vite' }`).
- Register global decorators to apply neon/canyon theme classes and inject CSS tokens.
- Provide stories that hydrate with live repository data:
  - Load `public/data/interview-sections.json` via `import` for knobs/controls.
- Use fixture loaders that read from `data/tickets.json`, `data/features.json`, and module detector snapshots (leveraging `fs` in preview hooks or mocked fetch adapters) to avoid stale mocks.

### Embedded Viewer
- Keep the in-app Storybook iframe in sync with the active MOLE/CANYON theme by forwarding `globals=theme:<name>` in the URL and reloading when the console theme toggles.
- Surface a refresh affordance plus status indicator in the Storybook tab so operators know when the embedded build is connected.
- Style the iframe container with the same neon card treatment used across the console to avoid jarring theme transitions.

### Auto-Generated Story Sources
- Implement `npm run storybook:generate` script that scans `src/components/` and produces default stories per component using metadata (props, emits) gathered via Vue SFC compiler APIs.
- Drive story variants from the interview questionnaire answers and audit exports: generate controls from `questionAnswers`, modules from detector snapshots, and tickets/features pulled during generation.
- Persist generated stories under `src/stories/auto/` with an index file that Storybook auto-registers; manual stories live in `src/stories/manual/` to avoid overwrites.
- Regenerate the auto stories whenever the audit (`claude$ setup`) completes or when relevant source files change (hook script into detector exports and `package.json` `postsetup` step).
- Document the generation pipeline in `docs/storybook.md`, including how to extend questionnaires/components so new data flows into Storybook without manual wiring.

### NPM Scripts & CI Hooks
- Extend `package.json` scripts: `storybook`, `build:storybook`, `test:storybook` (chromatic-style smoke run or `--ci`).
- Ensure Storybook build artefacts land in `spec/storybook-static` or similar for eventual deployment; add to `.gitignore` if necessary.
- Incorporate Storybook run into CI by updating documentation and providing a sample GitHub Actions workflow (`docs/storybook-ci.md`).

### Data Plumbing Strategy
- Create a lightweight API client in `src/api/index.ts` (or `.js`) that wraps fetch calls to Express endpoints; stories can swap fetch for local JSON via dependency injection.
- Provide `args`/`controls` for interview sections, module filters, ticket status toggles so designers can explore the UI with the same data the app uses live.
- Guard against network calls inside Storybook by bundling raw JSON snapshots under `.storybook/mocks/` and regenerating them via an npm script (`npm run snapshot:data`) that hits the local API.

### Risks / Open Questions
- Migrating from CDN script to module-based build requires bundler adoption (Vite recommended); confirm Express static setup will serve the new `dist/` while keeping existing functionality.
- Need to validate whether Storybook can run under current licensing constraints (no network restrictions flagged, but confirm offline assets for fonts/icons).
- Determine how to share Cytoscape/Mermaid heavy components inside Storybook (may require dynamic imports or stubbed window globals).

## Sequencing & Next Steps
1. Stand up Vite build + component extraction (prereq for both Storybook and maintainable Mermaid UI updates).
2. Implement `services/diagramGenerator.js`, REST endpoints, and audit wiring; ship architecture diagram first for regression safety.
3. Replace frontend diagram tab with API-driven renderer; add download/export support.
4. Finish Storybook configuration using extracted components and live data snapshots.
5. Document workflows (`docs/diagram-engine.md`, `docs/storybook.md`) and update `TODO.md` checkpoints accordingly.

Deliverables from this scope: the above plan (this file), updated TODO entries, and explicit service/component boundaries so the next agent can start coding without discovery overhead.
