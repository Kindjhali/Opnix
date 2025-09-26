# Diagrams Surface Template

## Current Behaviour
- `services/diagramGenerator.js` produces Mermaid definitions (architecture, sequence, entity, delivery-flow) using module detector output, features, tickets, and tech stack data.
- `/api/diagrams/:type` refreshes diagrams on demand, returning rendered Mermaid source and maintaining `.mmd` files under `spec/diagrams/`.
- Audit execution stores the latest diagrams and the runtime bundler mirrors them into `.opnix/runtime/diagrams/` for downstream viewers, while the Diagrams tab auto-renders the newest architecture export post-audit.
- The Diagrams tab now themes Mermaid output in-app: MOLE/CANYON palettes feed `mermaid.initialize`, and the canvas inherits the neon card framing so diagrams stay legible inside the console.

## Extension Prompts
- Which additional diagram types add value (deployment topology, dependency heatmaps, roadmap timelines, runbooks)?
- Should diagrams annotate risk indicators (open high-priority tickets, low coverage modules) directly in the Mermaid output?
- What interactive tooling is required in the UI (switching between diagram types, inline editing, integration with Storybook)?

## Integration Hooks
- `services/diagramGenerator.generateAllDiagrams()` is the pivot for new diagram builders—augment the context object with roadmap milestones, SLO snapshots, or incident history before fan-out.
- Individual builders (`buildArchitectureDiagram`, `buildSequenceDiagram`, etc.) are exported; override or wrap them to inject additional Mermaid annotations such as risk badges or environment clusters.
- `/api/diagrams/:type` can expose hooks for caching, webhooks, or CLI export triggers (PDF/PNG conversions via headless renderers).
- `services/diagramGenerator.generateDiagramFile()` centralises file emission; extend it to emit alternative formats (PNG, SVG) or register post-write publishers.
- The runtime index keeps diagram metadata; external dashboards can ingest `.opnix/runtime/index.json` to display architecture snapshots without running the server.

## Planned Automation
- Introduce diff visualisations that compare the latest diagram to previous audits and flag structural changes.
- Pipe diagram generation results into Storybook so designers review architecture visuals alongside UI artefacts.
- Automatically attach diagrams to spec exports and scaffold README files to keep documentation cohesive.
