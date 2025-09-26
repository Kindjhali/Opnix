# Specification Overview Template

## Current Behaviour
- The specification lifecycle begins with the installer wizard (new vs existing project) feeding interview sections defined in `public/data/interview-sections.json`.
- Answers persist in `data/setup-state.json` and are compiled by `buildSpecPayloadFromState()` into structured payloads for spec/doc generation and scaffolding.
- Specs are output in multiple formats (`JSON`, `Markdown`, GitHub Spec Kit) under `spec/blueprints/` and mirrored to `.opnix/runtime/blueprints/` for distribution.
- The Spec Builder panel hydrates automatically after audits by fetching the latest JSON export and rendering it inline.

## Extension Prompts
- What governance steps (approvals, sign-offs, RACI assignments) must be documented before specs are considered ready?
- How should specs track evolution over time (versioning, changelog sections, cross-links to audits or features)?
- Which external systems (issue trackers, knowledge bases) should receive spec artefacts automatically?

## Integration Hooks
- `scripts/setupWizard.js` determines whether the interview or audit flow runs; intercept the mode decision to branch into custom onboarding paths or telemetry capture.
- `services/interviewLoader.getNewProjectQuestionnaire()` is the hand-off into the Spec Builder—decorate its return payload with conditional questions, AI-suggested prompts, or localisation.
- `services/specGenerator.js` is extensible—inject additional sections (quality gates, performance budgets, compliance requirements) before export.
- Scaffolder consumes spec payloads; extend it to generate domain-specific templates (API contracts, UX research docs) from the same source data.
- Runtime bundler index entries can power CLI/UX affordances (e.g., quick access to the latest spec, diff against previous versions).

## Planned Automation
- Implement spec diff tooling that highlights changes between runtime bundle versions and alerts owners.
- Auto-create follow-up tickets for `[NEEDS CLARIFICATION]` markers to ensure gaps are resolved before development starts.
- Integrate Storybook and spec data so designers can jump directly from requirements to component states.
