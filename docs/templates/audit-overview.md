# Audit Overview Template

## Current Behaviour
- `runInitialAudit()` orchestrates module detection, ticket/stat aggregation, spec/doc/diagram generation, canvas snapshotting, and runtime bundling.
- Outputs are stored in `spec/` (blueprints, docs, canvas, diagrams, audits) and mirrored to `.opnix/runtime/` for packaging; scaffolding updates `.opnix/scaffold/`.
- Wizards default to audit mode when existing telemetry (modules, tickets, dependencies) is detected, producing summary markdown and follow-up recommendations.

## Extension Prompts
- Which additional signals should audits capture (CI status, security scans, dependency updates, infrastructure health)?
- How should audit severity or confidence be communicated to stakeholders (scores, dashboards, SLA timers)?
- Do we need incremental audits (module-level, feature-level) or rolling windows for change detection?

## Integration Hooks
- Enhance `runInitialAudit()` to publish events or webhooks after completing so external systems (Slack, Jira, Claude) can react immediately.
- Runtime bundle index provides a canonical artefact list—integrate it with deployment pipelines to gate releases on fresh audits.
- Store audit metadata in a dedicated history file (append-only log) to support trend analysis and compliance reporting.

## Planned Automation
- Schedule audits from CI/cron and push summaries to agents for triage without manual CLI interaction.
- Generate remediation plans (tickets, feature updates) automatically based on follow-up recommendations or low-health modules.
- Provide a diff viewer comparing successive audit payloads to highlight drift in modules, specs, or documentation coverage.
