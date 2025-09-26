# Bugs Surface Template

## Current Behaviour
- Tickets are persisted in `data/tickets.json` and accessed via Express routes (`/api/tickets`, `/api/tickets/:id`, `/api/search`, `/api/stats`).
- The Bugs tab in `src/App.vue + src/appOptions.js` renders the backlog using the `TicketList` component and provides CRUD, tagging, completion summaries, and markdown export via `/api/export/markdown`.
- Storybook mirrors the live backlog through `src/stories/auto/TicketList.generated.stories.ts`, ensuring visual parity with production data.
- `runInitialAudit()` now auto-creates follow-up tickets for detected issues (low module health, missing acceptance criteria, high-priority backlog) tagged with `FOLLOW_UP`/`AUDIT`.
- Status transitions must flow through API hooks (`startWork`, `resolveDirect`, `completeWork`); the UI/CLI supplies the required `statusHook` token when progressing tickets.

## Extension Prompts
- Which remediation workflows require automation (e.g., escalate high-priority tickets to agents, auto-create follow-up stories)?
- Should completion summaries capture structured data (root cause, validation steps) for analytics?
- What filters, views, or dashboards help incident commanders triage faster (lenses by module, SLA clocks, regression indicators)?

## Integration Hooks
- Ticket mutations hit `server.js` endpoints; middleware hooks can emit events (webhooks, queue messages) for external systems or Claude/Codex agents.
- The export pipeline already feeds `.opnix/runtime/`—extend `runtimeBundler.syncExportArtefacts()` to flag new backlogs for Slack/terminal notifications.
- Completion modal logic in `src/App.vue + src/appOptions.js` is the entry point for validations and cross-surface updates (e.g., auto-link to Modules or Specs sections).

## Planned Automation
- Mirror bug metrics (counts by tag/priority/status) into `.opnix/runtime/index.json` so the runtime bundle can drive dashboards without booting the server.
- Add CLI helpers (`claude$`) that pull the next ticket based on priority/module to streamline agent handoffs.
