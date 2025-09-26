# Documentation Surface Template

## Current Behaviour
- `services/docsGenerator.js` compiles audit-ready Markdown summaries, consolidating module stats, feature catalogues, ticket overviews, and tech stack snapshots into `spec/docs/opnix-docs-*.md`.
- `docs/` directory houses process documentation (installation decision tree, module detection, storybook scope) which the installer and wizard reference for onboarding.
- Audit/scaffold runs mirror generated docs into `.opnix/runtime/docs/` and craft module/feature handbooks under `.opnix/scaffold/`.
- The UI now auto-loads the freshest documentation export after each audit by streaming the Markdown via `/api/exports/download` into the Docs panel.
- Docs tab renders Markdown inside theme-aware wrappers so MOLE/CANYON palettes, code blocks, and callouts match the rest of the console UI.
- Docs tab now includes a Generate Runbook action that reuses the shared generator to write Markdown playbooks into `spec/runbooks/` and preview them immediately.
- Operational checklists live in `data/checklists.json`; updates go through `/api/checklists` and require status hooks so review steps cannot be silently skipped.

## Extension Prompts
- What additional audiences require tailored documentation (executives, QA, onboarding, compliance) and what artefacts do they expect?
- Should documentation include runbooks/playbooks sourced from agents or external knowledge bases?
- How can we ensure documentation stays current—do we need freshness metadata, automated reviews, or doc linting?

## Integration Hooks
- Extend `docsGenerator.buildDocsMarkdown()` to accept plug-ins (e.g., charts, metrics) and to ingest external datasets (incident history, observability dashboards).
- Use runtime bundler outputs to feed static site generators (Docusaurus, MkDocs) so documentation can be published without manual curation.
- Introduce CLI commands that bundle relevant docs for a given surface (e.g., `claude$ docs modules` -> open module handbook, canvas notes, and diagram references).
- Expose checklist anchoring from docs so reviewers can tick off compliance items via the `/api/checklists` hook flow.

## Planned Automation
- Auto-generate changelogs summarising differences between the latest and previous documentation exports.
- Link docs to Storybook stories and diagrams by embedding runtime bundle references, enabling unified browsing.
- Provide a documentation checklist in the scaffold manifest so teams can track completeness across surfaces.
