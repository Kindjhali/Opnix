# Frontend Module Guide

This document outlines the planned module split for the Opnix frontend refactor. Each module is scoped to a clear responsibility so we can gradually extract logic from the current monolithic `src/App.vue + src/appOptions.js` / `public/index.html` without duplicating behaviour.

| Module | Responsibility | Notes / Overlaps |
| --- | --- | --- |
| `public/modules/opnixApp.js` | Bootstraps the Vue application and wires together injected managers/services. | Depends on other modules but holds no feature logic. |
| `public/modules/state.js` | Exposes shared constants: tab metadata, icon maps, ticket status hooks, theme definitions. | Pure data; consumed by most feature modules. |
| `public/modules/apiClient.js` | Wraps REST calls for tickets, features, modules, markdown, diagrams, Storybook, terminal, tech stack. | Shared `request()` helpers reused by terminal/interview clients. |
| `public/modules/terminalClient.js` | Executes shell commands via `/api/terminal/execute`, maintains history, normalization helpers. | Uses `apiClient` for requests; integrates with theme (ANSI styling). |
| `public/modules/interviewClient.js` | Exposes progressive-question helpers (load blueprint, advance, persist) for CLI + UI reuse. | Feeds both `interviewManager` and CLI command engine. |
| `public/modules/eventBus.js` | Minimal pub/sub (emit/on/off) for cross-module notifications during migration. | Optional; only needed if we encounter circular dependencies. |
| `public/modules/themeManager.js` | Handles theme switching, indicator positioning, keyboard interactions, Mermaid theme configuration. | Consumes `state.js`; feeds updates to `diagramManager.js` and Storybook embed. |
| `public/modules/diagramManager.js` | Mermaid generation (auto + manual), error/state handling, module graph fallback. | Reads module data from `canvasManager` or API; depends on `themeManager` for styling. |
| `public/modules/markdownManager.js` | Manages Markdown archive list, filters, editor state, API persistence. | Shares API calls with `docsManager`; potential shared helper for file formatting. |
| `public/modules/roadmapManager.js` | Roadmap milestones CRUD, stats computation, formatting helpers for timeline cards. | May use `apiClient` (if persistence added) and module data from `canvasManager`. |
| `public/modules/canvasManager.js` | Sets up Cytoscape graph, edge handles, canvas export, module summary tracking. | Primary source of module data for diagrams/roadmap. |
| `public/modules/interviewManager.js` | Drives progressive questionnaires, insights, auto-module/feature derivation, spec integration. | Consumes `interviewClient`; shared by CLI and UI flows. |
| `public/modules/techStackManager.js` | Aggregates detector output + interview-declared stack, renders stack tab/export. | Outputs Markdown export + feeds Tech Stack tab. |
| `public/modules/storybookEmbed.js` | Controls Storybook iframe URL, heartbeat, theme synchronisation, manual refresh button. | Listens to `themeManager` updates; uses `state.js` for defaults. |
| `public/modules/docsManager.js` | Handles Docs tab tree loading, template creation, file editing separate from Markdown manager. | Shares formatting helpers with `markdownManager`; both could use a common `files.js`. |

## Overlap & Integration Considerations

- **API Access**: `apiClient.js` should expose low-level `request()` helpers so modules like `terminalClient.js`, `markdownManager.js`, and `docsManager.js` can reuse retry/error handling.
- **Theme Events**: `themeManager.js` needs to notify `diagramManager.js` and `storybookEmbed.js` when palette changes; we can either call them directly or broadcast via `eventBus.js`.
- **Module Data Flow**: `canvasManager.js` remains the canonical source of module/edge data. Other modules should accept data via parameters to avoid hidden dependencies.
- **Markdown vs Docs**: both deal with filesystem content. Consider factoring shared path/date/size formatters into a `files.js` helper to avoid divergence.
- **Interview Stack**: `interviewManager.js` integrates with existing `spec-scaffold.mjs` and `interviewAdaptive.mjs`. During extraction, we can wrap those imports for clarity.

Having this map gives us a checklist to migrate incrementally: start with utilities (`state`, `apiClient`), then feature modules one by one, testing after each move.
