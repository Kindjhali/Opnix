# API Surface Template

## Current Behaviour
- Express server (`server.js`) exposes REST endpoints for tickets, features, modules, agents, specs, diagrams, exports, and module links; all operations persist to the filesystem (`data/`, `spec/`).
- Installer wizard and CLI flows call backend helpers directly (e.g., `runInitialAudit()`, `generateProjectScaffold()`) while the SPA communicates via fetch requests defined in `src/App.vue + src/appOptions.js`.
- Runtime bundler captures API-produced artefacts and mirrors them into `.opnix/runtime/` for distribution with the hidden payload.

## Extension Prompts
- Which endpoints require authentication/authorisation once Opnix is deployed across teams (API keys, role-based access)?
- Should we introduce GraphQL or gRPC mirrors for consumers that prefer typed contracts and subscriptions?
- What rate limiting or batching strategies are needed for large repos or CI-driven audits?

## Integration Hooks
- Middleware layer in `server.js` can emit observability events (structured logs, metrics) to monitor API usage and performance.
- Each POST/PUT/DELETE handler can trigger automation hooks (webhooks, message queue) for external orchestration or Claude/Codex agents.
- CLI scripts (`scripts/setupWizard.js`, `scripts/generateStories.js`) demonstrate direct module access; packaging them as reusable clients enables external tooling integration.

## Planned Automation
- Auto-generate OpenAPI/AsyncAPI specs from route definitions to keep documentation synced with implementation.
- Introduce background jobs for expensive tasks (module detection, scaffolding) so the API responds immediately with job IDs.
- Provide a lightweight SDK that wraps REST calls, handles authentication, and surfaces helpers for spec/scaffold automation.
