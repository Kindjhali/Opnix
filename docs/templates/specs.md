# Specs Surface Template

## Current Behaviour
- Spec Builder questions are defined in `public/data/interview-sections.json` and orchestrated in `src/App.vue + src/appOptions.js`, persisting answers into `data/setup-state.json` and spec payloads.
- `src/spec-scaffold.mjs` derives placeholder modules/features from interview answers, and the Spec Builder rehydrates saved responses on load so new-project flows surface scaffolds immediately.
- `services/specGenerator.js` produces JSON, Markdown, and GitHub Spec Kit formats on demand and during audits (`runInitialAudit()`), storing outputs in `spec/blueprints/` and mirroring them into `.opnix/runtime/`.
- Scaffold generation uses the spec payload to populate README introductions, tech stack summaries, and module feature dossiers.

## Extension Prompts
- Which additional interview branches or conditional sections are required for specialised domains (AI/ML, compliance, mobile, hardware)?
- How should stakeholder approvals and sign-offs be recorded within specs (checkboxes, digital signatures, integrated ticket references)?
- What validation or linting rules are needed to ensure specs remain actionable (required fields, no `[NEEDS CLARIFICATION]` markers, acceptance criteria completeness)?

## Integration Hooks
- `public/data/interview-sections.json` defines the question taxonomy; append new sections or branch rules and they flow through `services/interviewLoader` and the Spec Builder without additional wiring.
- `services/interviewLoader.loadInterviewBlueprint()` caches the blueprint—swap it for a remote fetcher, A/B blueprint loader, or per-vertical overrides by returning merged payloads before caching.
- `buildSpecPayloadFromState()` in `server.js` centralises spec data; register additional collectors (coverage stats, pipeline health) or mutate interview answers before export.
- `src/spec-scaffold.mjs` exposes pure helpers for deriving auto modules/features—extend it with additional heuristics (personas, journeys) and reuse across CLI/UI without duplication.
- Spec exports are tracked via the runtime bundler—extend `runtimeBundler.syncExportArtefacts()` to invoke downstream delivery (Notion, Confluence, ticket webhooks) when files refresh.
- Storybook stories can ingest spec metadata to contextualise components (e.g., show acceptance criteria alongside UI variants) by enriching `scripts/generateStories.js` with spec-driven args.

## Planned Automation
- Expand real-time auto-population beyond modules/features to narrative sections (architecture decisions, risk registers, dependency maps).
- Implement spec regression detection: diff new spec outputs against prior runtime artefacts and raise alerts on missing sections.
- Provide CLI tooling (`claude$ spec review`) that walks through outstanding `[NEEDS CLARIFICATION]` items and suggests follow-up interviews.
