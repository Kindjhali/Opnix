# Opnix Next Agent Brief

## Mission Overview
We just shipped the comprehensive interview/audit system and UltraThink setup flow. The next sprint focuses on **visual storytelling and developer enablement** so Opnix can audit, explain, and visualise a codebase end‑to‑end. Your goal is to deliver production-ready artefacts—no stubs, no mock data.

## Core Deliverables
1. **Mermaid Diagram Engine**
   - Expand the existing diagrams tab so the new interview/spec data can generate system-level Mermaid diagrams automatically (architecture, sequence, entity, flow).
   - Provide API endpoints that return Mermaid sources for audit exports.
   - Ensure diagrams stay in sync with the module detector and interview answers (e.g., integrations, runtime choices).

2. **Storybook Integration**
   - Stand up Storybook alongside the Vue front-end (component library for the neon theme).
   - Wire Storybook stories to real data (use the interview blueprint to supply controls/knobs).
   - Add build/test npm scripts so Storybook is part of CI.

3. **Visual Timeline Canvas**
   - Implement the roadmap/Gantt view promised in the TODO: drag-and-drop milestones, module links, export capabilities.
   - Use real feature/ticket data to populate the timeline; ensure exports land in `spec/`.

4. **Visual Module Canvas Enhancements**
   - Take the current Cytoscape graph further: highlight dependency critical paths, show health badges, allow edge annotations.
   - Persist manual annotations (use `data/module-links.json` or a companion file).

5. **Playbook Library**
   - Convert `docs/interview-playbook.md` into a structured “playbook” UI pane (read from the JSON blueprint).
   - Allow users to export the playbook as Markdown and include it in audits.

6. **Dependency Book**
   - Produce a dependency dossier: combined report of internal module edges, external packages, and inferred risk scores.
   - Expose via API + UI download; include in audit exports.

## Critical Requirements
- Follow the existing neon/cyber aesthetic—no visual regressions.
- All new data must come from real sources (filesystem scans, interview answers, tickets, features).
- Keep UltraThink flag enforcement intact when you touch CLI/backend command handling.
- Update docs for each feature (README sections or dedicated docs in `docs/`).
- Sync progress with `docs/internal-delivery-tracker.md` so the handoff list stays accurate.

## Reference Files
- Interview blueprint: `public/data/interview-sections.json`
- Vue app: `src/App.vue + src/appOptions.js`
- Module detector: `services/moduleDetector.js`
- Audit flow docs: `docs/audit-flow.md`
- Playbook overview: `docs/interview-playbook.md`

## Suggested First Steps
1. Run `node server.js` (port 7337) and trigger `setup` from the Claude bar to review the current audit payload.
2. Sketch the data flows for diagrams/Storybook/timeline using real spec archive artefacts.
3. Backfill any missing tests or scripts as you integrate new tooling.

Deliver real functionality end-to-end—no placeholders, no TODOs. EOF
