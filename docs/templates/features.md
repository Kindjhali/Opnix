# Features Surface Template

## Current Behaviour
- Feature records live in `data/features.json` and are served by `/api/features` for full CRUD operations with status/acceptance validation.
- The Features tab in `src/App.vue + src/appOptions.js` enables filtering, acceptance criteria capture, and status progression guarded by the API (criteria required beyond the `proposed` state).
- Audit exports include features in spec payloads (`runInitialAudit()` > `featureReview`) and propagate them to `.opnix/scaffold/features/*.md` for documentation.

## Extension Prompts
- What lifecycle states (discovery, shaping, ready, delivered) should be modelled beyond the current `status` field?
- Which acceptance artefacts (BDD scenarios, test plans, design links) should be captured automatically from interviews or docs?
- How should feature priority tie back to tickets, modules, and runway planning (e.g., dependencies, capacity signals)?

## Integration Hooks
- `services/scaffolder.generateProjectScaffold()` writes feature briefs; enhance it to include automatic TODO lists or embedded diagrams.
- The REST API can grow PUT/DELETE endpoints and emit events so agents update Specs/Docs when feature status changes.
- Diagram generation (`services/diagramGenerator.js`) already consumes features—extend the builder to illustrate feature-to-module flows on sequence/delivery diagrams.

## Planned Automation
- Auto-create feature shells from interview answers in the Spec Builder and push them into `data/features.json` rather than relying on manual entry.
- Mirror feature snapshots into `.opnix/runtime/` alongside specs so the runtime bundle can power Storybook stories and roadmap tooling.
- Add CLI commands (e.g., `claude$ feature plan`) to orchestrate acceptance criteria refinement and module alignment.
