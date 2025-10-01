# Roadmap Event Flow

This document explains how roadmap state changes propagate through the backend pipeline.

## Status Progression

Milestones use a guarded lifecycle to keep roadmap progress consistent:

- **pending → active/paused/blocked/completed** – Newly generated milestones start in `pending`; operators can activate them, pause, block, or mark them complete.
- **active → paused/blocked/completed** – Once work has started it can pause, block, or finish, but cannot return to `pending`.
- **paused ↔ active / blocked** – Paused items can resume or become blocked, and blocked work can move back to paused/active.
- **completed → completed** – Completion is terminal; reverting to in-progress states is disallowed to preserve history integrity.

Any attempt to use an unknown status or break these transitions raises a 400-level API error, and the Vue client surfaces the message inline.

## Dependency Cascade

Milestones now include a `dependencySummary` payload that captures dependency counts, statuses, and the minimum gating progress supplied by upstream milestones. Whenever a dependency changes progress or becomes blocked, the roadmap state manager automatically recalculates the dependent milestones and emits a cascade diff. Key behaviours:

- `dependencySummary` reports `total`, `blocked`, `pending`, and `gatingProgress` so the UI can surface dependency health without extra lookups.
- Dependent progress is limited by the lowest dependency progress; blocked dependencies force downstream milestones to 0% and a `blocked` status (unless the milestone is already completed).
- `updateRoadmapMilestone` returns a `cascadedChanges` array and history entries flag cascaded diffs with `cascade: true` so consumers can distinguish manual edits from automatic updates.
- Event batches still emit a single `reason`, but cascaded diffs annotate dependent IDs, making it easy to trace which milestones were adjusted because of upstream changes.

## Git Automation Hooks

Manual milestone completions (`roadmap:manual-*` reasons) now trigger the git automation manager after the state persists. The manager generates a detailed completion summary, stages filesystem changes (including the updated roadmap JSON), and commits them with metadata about dependencies, linked artefacts, and actors. If the repository has no pending changes the helper exits gracefully with a warning, and callers receive the automation result via `gitAutomationResult` on the response payload.

## Overview

1. **State Sources** – Tickets, features, and modules are persisted under `data/` as JSON (`tickets.json`, `features.json`, `modules.json`, `modules-detected.json`).
2. **Watchers** – `services/roadmapSyncWatcher.js` attaches chokidar listeners to those files. Any add/change/delete triggers a debounced `syncRoadmapState({ reason: ... })` call.
3. **Roadmap State Sync** – `services/roadmapState.js` ingests the latest JSON, recomputes milestone summaries, updates history, and emits a `state:sync` event with the computed payload (reason, summary, state snapshot, timestamp).
4. **Event Aggregation** – `services/roadmapEventAggregator.js` subscribes to `state:sync`, batches multiple syncs within 100 ms, deduplicates reasons, and emits ordered roadmap updates:
   - Primary stream: `roadmap:update` with grouped reasons and state snapshot.
   - Scoped streams: `roadmap:tickets`, `roadmap:features`, `roadmap:modules` emitting arrays of affected reason codes.
5. **Ordering Rules** – Batches enforce ticket → feature → module ordering so downstream consumers (Vue stores, CLI monitors) handle upstream dependencies deterministically.
6. **Consumers** – The roadmap bloc, Questions tab, CLI session dashboards, and any websocket relays subscribe to the aggregator streams to refresh derived views without polling.

## Reason Codes

Reasons are lower-case strings emitted by `syncRoadmapState` and downstream services:

| Prefix | Description | Example |
|--------|-------------|---------|
| `ticket:` | Ticket create/update/delete or bug workflow transitions | `ticket:create`, `ticket:update:123` |
| `feature:` | Feature lifecycle updates | `feature:update:roadmap` |
| `modules:` / `module:` | Module detection, manual additions, link edits | `modules:detect`, `module:link:create` |
| `watcher:` | File-watcher initiated sync (bulk change) | `watcher:tickets+features` |

Unknown prefixes fall back to the `other` group but still appear in `roadmap:update.reasons` so listeners can react.

## Shutdown and Resilience

- Watchers start during Express bootstrap (`server.js`) after the roadmap state file is ensured.
- On `SIGINT`, `SIGTERM`, or normal exit the watchers are torn down and timers cleared to avoid leaking file descriptors.
- All sync and aggregation steps guard against JSON parse failures; invalid files revert to defaults while logging warnings.

## Extending the Pipeline

- Use `syncRoadmapState({ reason, overrides })` to supply preloaded data (useful for tests).
- Subscribe to `roadmapEventAggregator` events to drive UI refreshes or telemetry.
- Additional scoped streams can be added by extending `normaliseGroups` and the emitter fan-out.
- For replay/debugging, capture `roadmap:update` payloads and feed them into custom tooling (planned checklist items).

## Replay & Debugging

- Aggregated events are persisted to `data/roadmap-events.log` (max 200 entries).
- Use `require('./services/roadmapEventAggregator')` and call `replayRoadmapEvents({ limit })` to re-emit recent events for debugging or UI resyncs.
- Logs capture `changes` arrays that include milestone progress/status deltas, so replays can restore dependent views. Logs can be tailed or archived for auditing; they are cleared automatically when trimmed below the retention cap.

## Filtering

- Scoped streams (`roadmap:tickets`, `roadmap:features`, `roadmap:modules`) continue to fan-out core entity changes.
- Prefix events (`roadmap:reason:<prefix>`) fire for each unique reason prefix found in a batch; e.g., subscribe to `roadmap:reason:ticket` to react only to ticket updates.
- Unknown prefixes inherit the leading segment before the first colon and emit their own stream (e.g., `watcher` events).
