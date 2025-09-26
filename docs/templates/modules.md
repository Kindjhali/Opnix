# Modules Surface Template

## Current Behaviour
- `services/moduleDetector.js` scans the workspace (ignoring `node_modules`, etc.) to classify modules, infer coverage/health, capture dependencies, and aggregate summary stats.
- Composite directories (`packages/`, `apps/`, `services/`) expand into individual modules so monorepo workspaces surface alongside single-package code.
- Express endpoints (`/api/modules`, `/api/modules/detect`, `/api/modules/links`) expose detector output, manual overrides, and relationship management to the frontend and canvas.
- Audit runs persist module data into spec payloads, canvas exports, and `.opnix/scaffold/modules/<module>/README.md` dossiers.

## Extension Prompts
- Which additional heuristics should module detection capture (build tooling, language versions, runtime targets, ownership metadata)?
- How should we annotate modules that represent external services or cross-repo contracts so they appear distinct in the UI/exports?
- Do we require dependency impact analysis (e.g., highlight modules affected by a change) or lifecycle signals (freshness, TODO density trends)?

## Integration Hooks
- Detector output feeds multiple services; extend `deriveTechStack()` and `inferProjectType()` to emit extra context for specs, diagrams, and scaffolds.
- `/api/modules/links` can be wrapped with event hooks so new dependencies trigger ticket creation or documentation updates automatically.
- `.opnix/runtime/` mirrors module artefacts; build follow-on jobs that turn the manifest into dashboards or CLI summaries.

## Planned Automation
- Implement a scheduled detector run (nodemon task or CLI) that diffs current modules against the last audit and raises drift alerts.
- Generate ownership and coverage reports and export them alongside the existing manifests for quick QA and compliance reviews.
- Surface module risk scores in Storybook (component stories) so designers spot areas requiring UI/UX validation.
