# Opnix Operational Toolkit Specification

## Context
- Opnix delivers an operational command center that merges automated audits, visual canvases, and guided interviews so teams can inspect and explain a codebase end-to-end.
- The system runs a Vue 3 single-page app against an Express backend with filesystem-backed data (no mock payloads) and a persistent neon/cyber aesthetic.
- All tooling is designed for neurodivergent-friendly workflows: deterministic flows, progressive disclosure, and high-contrast visuals derived from the MOLE and CANYON themes.

## Architecture Overview
- `Frontend`: Vue app in `public/app.js` composed of canvases (Cytoscape), Mermaid diagram views, agent controls, and the spec/playbook panes.
- `Backend`: `server.js` exposes REST endpoints for audits, module detection, ticket management, exports, and manual canvas links.
- `Detectors & Data`: `services/moduleDetector.js` scans the filesystem, merges manual edges from `module-links.json`, and powers the CANVAS, MODULES, and DIAGRAM tabs. Tickets remain in `tickets.json`; interview questions in `public/data/interview-sections.json`.
- `Exports`: Audit/spec/timeline outputs land in `/exports` with metadata returned to the client for download surfaces.

## Current Capabilities
- `Setup audit`: `claude$ setup` (or POST `/api/claude/execute`) runs the full audit: module scan, ticket analysis, feature review, spec generation, documentation, canvas snapshot, and `opnix-audit-*.json` payloads.
- `Module detection`: Reads package manifests, directory aliases, recursive imports, manual overrides, and synthesises health/coverage metrics for Cytoscape and downstream summaries.
- `Canvas linking`: Frontend uses `/api/modules/graph` and `/api/modules/links` to merge automatic + manual dependencies, persist edge handles, and export images via `/api/canvas/export`.
- `Ticket compatibility`: Legacy `tickets.json` files continue to work; the API normalises structure, uppercases tags, and exposes CRUD endpoints plus Markdown exports.
- `Interview playbook`: Sequential blueprint from `interview-sections.json` drives the spec builder, conditional sections, and audit questionnaires for greenfield repos.
- `Exports & documentation`: Spec Kit bundles, audit docs, and canvas JSON are generated through the audit flow with zero placeholder content.

## Visual Enablement Sprint Goals
1. **Mermaid Diagram Engine** – autogenerate architecture/sequence/entity/flow diagrams from interview + detector data and expose raw Mermaid through APIs.
2. **Storybook Integration** – run Storybook beside the Vue app, drive stories with live data, and add CI scripts.
3. **Visual Timeline Canvas** – drag-and-drop roadmap/Gantt view wired to real features/tickets with `/exports` outputs.
4. **Module Canvas Enhancements** – critical-path highlighting, health badges, edge annotations, and persisted manual notes.
5. **Playbook Library** – UI pane rendering the interview blueprint with Markdown export for audits.
6. **Dependency Book** – combined internal/external dependency dossier with risk scores, delivered via API and downloadable UI.

## Accessibility & UX Guardrails
- Maintain WCAG AA/AAA contrast, predictable layouts, and animation controls honouring `prefers-reduced-motion`.
- Apply progressive disclosure: one primary action per screen, chunked content, accordion/tab patterns for secondary data.
- Provide clear drag/drop feedback, 44×44px interaction targets, throttled updates, and semantic zooming on canvases.
- Keep theme fonts (JetBrains Mono) and avoid sensory overload while preserving neon styling.

## Key Data Sources & Files
- Interview blueprint: `public/data/interview-sections.json`
- Module detector + aliases: `services/moduleDetector.js`
- Canvas links store: `module-links.json`
- Ticket backlog: `tickets.json`
- Audit pipeline doc: `docs/audit-flow.md`
- Best-practice research: `docs/best_practice.md`
- Canvas linking reference: `docs/canvas-linking.md`

## Operational Workflow
1. Run `node server.js` (port 7337) and use the Claude bar `setup` command to generate a fresh audit.
2. Inspect `/exports` artefacts (`opnix-spec-*.json`, `opnix-spec-*.spec.md`, `opnix-docs-*.md`, `opnix-canvas-audit-*.json`, `opnix-audit-*.json`).
3. Iterate on follow-up actions (module health, missing acceptance criteria, roadmap planning) and rerun `setup` to validate improvements.

## Success Criteria
- No placeholders: every UI view is backed by filesystem data or detector output.
- Visual tooling (Mermaid, canvases, Storybook) reflects real modules, tickets, and interview answers.
- Backward compatibility: existing `tickets.json` files and manual `module-links.json` edits remain valid.
- Documentation stays synced with the actual implementation to keep future agents productive.
