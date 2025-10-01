# Frontend Composable Architecture

Opnix now groups shared UI logic under `src/composables/`. Each composable exports plain functions that can run with `this` bound to the Vue app or with an explicit context; when neither is provided they resolve the shared store from `useAppStore()`, keeping `appOptions.js` lean while enabling CLI/tests to reuse flows.

## Active Composables

| File | Responsibility | Consumed By |
|------|----------------|-------------|
| `ticketManager.js` | Runbook/bug workflows: Python agent analysis, ticket creation, status updates, completion modal, Markdown export, status/date helpers | `appOptions.addBug`, `analyzeWithPythonAgent`, `onTicketStatusChange`, DocsTab export, tickets board |
| `commandCenterManager.js` | Claude CLI execution, CLI session fetch, agent activation, task queue updates | `executeClaudeCommand`, `fetchCliSessions`, `activateAgent`, `addTask` |
| `modalManager.js` | Modal show/hide/draft helpers for bug/feature/module/runbook flows | App shell, ModalsLayer |
| `dataBootstrap.js` | Shared data loaders for agents/tickets/features/stats/exports | App bootstrap, CLI/automation consumers |
| `featureManager.js` | Feature modal handling, report generation, module selection toggles | `addFeature`, `generateFeatureReport`, `toggleModule` |
| `moduleManager.js` | Canvas refresh payload, module analytics, colour helpers | `refreshCanvas`, `analyzeModule`, `getModule*` helpers |
| `canvasManager.js` | Cytoscape initialisation + layout switching | `ensureCanvas`, `layoutCanvas` |
| `moduleDetectionManager.js` | Module detection, link persistence, canvas export | Canvas tab actions & detection tasks |
| `roadmapManager.js` | Roadmap state sync, version history, generation/export, backup scheduling | Roadmap tab, ticket/feature/module flows |
| `runbookManager.js` | Interview flows & generation | Docs/Runbook actions |
| `docsManager.js` | Inline documentation generation/export + `/api/docs/generate` integration | Docs tab |
| `markdownUtils.js` | Shared Markdown strip + download helpers | Docs tab, ticket exports |
| `diagramManager.js` | Mermaid theme/render flows | Diagrams tab |
| `themeManager.js` | Theme persistence + Mermaid + Cytoscape sync | `setTheme`, mount bootstrap |
| `apiSpecManager.js` | API spec drafting, export, test helpers | API tab |
| `specBuilder.js` | Interview staging + spec payload helpers | Specs tab |
| `cliSessions.js` | CLI formatting helpers | Specs tab |

## Bloc Helpers

| File | Responsibility | Provides |
|------|----------------|----------|
| `workbenchBloc.js` | Binds terminal and command-centre flows to the shared store | `loadTerminalHistory`, `executeClaudeCommand`, `addTask`, `clearTaskQueue`, status refresh helpers |
| `docsBloc.js` | Centralises documentation + runbook flows with the Vue instance context | `updateDocType`, `generateDocs`, exports, runbook interview/generation controls |
| `featuresBloc.js` | Groups feature tab actions and modal handlers for reuse | `openFeatureModal`, `addFeature`, `toggleModule`, filter + report helpers |
| `modulesBloc.js` | Collects canvas/module actions and helpers | `ensureCanvas`, `detectModules`, `analyzeCanvas`, module stats/color helpers |
| `apiBloc.js` | Wraps API specification workflows | `buildApiSpecDraft`, `generateAPISpec`, exports, tests, format updates |
| `storybookBloc.js` | Manages Storybook iframe orchestration | `startStorybookInstance`, `refreshStorybookFrame` |
| `themeBloc.js` | Handles theme bootstrap + switching | `bootstrapTheme`, `setTheme` |
| `cliBloc.js` | Bundles CLI/terminal/agent flows | `executeClaudeCommand`, `loadTerminalHistory`, `fetchCliSessions`, task queue helpers |
| `dataBloc.js` | Centralises initial data loaders | `fetchAgents`, `fetchTickets`, `fetchFeatures`, `fetchExports`, `fetchStats` |
| `modalsBloc.js` | Exposes shared modal helpers | `openAddModuleModal`, `updateModuleDraft`, `updateRunbookDraft` |
| `specBloc.js` | Owns spec interview + generation helpers | `processAnswer`, `collectAnswers`, `generateSpec` |
| `diagramsBloc.js` | Handles diagram/mermaid workflows | `generateDiagram`, `generateFromModules`, `renderMermaid` |
| `interviewBloc.js` | Manages interview blueprint sequencing | `loadInterviewBlueprint`, `initializeInterview`, section helpers |
| `navigationBloc.js` | Centralises tab navigation side-effects | `setTab` |
| `bootstrapBloc.js` | Orchestrates initial data loading | `bootstrap` |
| `formattingBloc.js` | Provides CLI formatting helpers | `formatCliSessionStatus`, `formatCliTimestamp` |
| `roadmapSupportBloc.js` | Manages deferred roadmap refresh scheduling | `queueRoadmapRefresh` |
| `ticketsBloc.js` | Consolidates ticket and bug flows with modal hooks | `openBugModal`, `addBug`, `onTicketStatusChange`, filters, exports, completion helpers |
| `roadmapBloc.js` | Glues roadmap manager flows to the Vue app (view mode, refresh, rollback, exports) | `refreshRoadmapState`, `generateRoadmapFromData`, `exportRoadmapSnapshot`, `rollbackRoadmap`, view/selection helpers |

## Usage Pattern

1. Composable functions accept `call(this, ...)` from `appOptions.js`, but also fall back to `useAppStore()` when called without an explicit context (e.g., CLI routes or tests).
2. Modules that need shared helpers (e.g., canvas + module analytics) import from each other (`canvasManager` uses `moduleManager.refreshCanvasFlow`).
3. Components receive only the minimum props/callbacks; heavy logic lives in composables so other surfaces (CLI, Storybook) can reuse it later.

## Next Steps

- Extract remaining command-centre/CLI flows into composables for terminal automation.
- Add targeted unit tests for module and ticket composables.
- Reference this overview from `frontend-refactor-plan.md` once additional slices land.
