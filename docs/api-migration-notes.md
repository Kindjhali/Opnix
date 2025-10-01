# API CamelCase Migration Notes

Opnix now enforces camelCase naming across the backend, exported JSON artefacts, and the Vue client. This document captures the
changes you need to be aware of if you have external automations or scripts that still expect the legacy snake_case or kebab-case
keys.

## Tickets & Bugs

| Area | Previous values | Current canonical values |
| ---- | ---------------- | ------------------------ |
| Ticket statuses | `reported`, `in_progress`, `finished` (plus ad-hoc variants like `open`, `resolved`) | `reported`, `inProgress`, `finished` |
| Status transition hooks | `start_work`, `resolve_direct`, `complete_work` | `startWork`, `resolveDirect`, `completeWork` |
| API stats keys | `total`, `open_count`, `closed_count`, `in_progress_count`, `high_priority` | `total`, `open`, `closed`, `inProgress`, `finished`, `highPriority` |
| Ticket fields written to `data/tickets.json` | Mixed casing (`created_at`, `priority`, `tags`) | CamelCase identifiers (`created`, `priority`, `tags`) |

The ticket router now normalises inbound payloads before persistence. Legacy files can still be ingested—the server translates
`in_progress` → `inProgress`, keeps IDs numeric, and uppercases tags—but any new data it writes will use the camelCase form.

If you mutate `data/tickets.json` yourself, prefer the following structure:

```json
{
  "nextId": 42,
  "tickets": [
    {
      "id": 41,
      "title": "Repair theme toggle",
      "status": "inProgress",
      "priority": "high",
      "tags": ["UI", "PALETTE"],
      "created": "2025-09-27T07:20:11.181Z"
    }
  ]
}
```

## Features

Feature workflow data now shares the same conventions:

- Statuses: `proposed`, `approved`, `inDevelopment`, `testing`, `deployed`
- Acceptance criteria arrays should contain trimmed strings; any legacy objects (`{ text: "…" }`) are flattened automatically.
- The feature status validator enforces camelCase both in API payloads and when updating `data/features.json`.

## Checklists & Modules

Checklist task states are `notStarted`, `inProgress`, `blocked`, `completed`.
Module provenance flags use camelCase booleans such as `source`, `manual`, `autoDetected`, and dependency arrays now contain
normalised identifiers (`externalDeps`, `internalDeps`).

## CLI & Context Telemetry

- CLI routing emits camelCase metadata: `daicState`, `contextUsed`, `gateHistory`, `ultraThinkTriggered`.
- Gate logs are written to `data/cli-gating-log.json` with fields `timestamp`, `command`, `gate`, `status`, and `message`.

## Upgrading Existing Automations

1. **Adjust API consumers**: Replace lookups for snake_case keys (e.g., `ticket.status === 'in_progress'`) with the camelCase
   equivalents (`'inProgress'`).
2. **Regenerate exports**: Re-run your usual generators (for example `pnpm test:modules` or the CLI interview commands) so the artefacts
   reflect the new naming.
3. **Bulk normalisation**: Save the snippet below as `scripts/normaliseTickets.js`, then execute `node scripts/normaliseTickets.js
   data/tickets.json` to convert an existing file in-place.

   ```js
   const fs = require('fs');
   const path = require('path');

   function camelStatus(value) {
     if (!value) return 'reported';
     const condensed = String(value).replace(/[\s_-]/g, '').toLowerCase();
     if (condensed === 'inprogress') return 'inProgress';
     if (condensed === 'finished' || condensed === 'resolved' || condensed === 'complete') return 'finished';
     return 'reported';
   }

   function normaliseTicketsFile(filePath) {
     const fullPath = path.resolve(process.cwd(), filePath);
     const raw = JSON.parse(fs.readFileSync(fullPath, 'utf8'));

     if (Array.isArray(raw.tickets)) {
       raw.tickets = raw.tickets.map((ticket, index) => ({
         id: Number(ticket.id) || index + 1,
         title: ticket.title || `Ticket ${index + 1}`,
         description: ticket.description || '',
         status: camelStatus(ticket.status),
         priority: (ticket.priority || 'medium').toLowerCase(),
         tags: Array.isArray(ticket.tags) ? ticket.tags.map(tag => String(tag).toUpperCase()) : [],
         created: ticket.created || ticket.created_at || new Date().toISOString()
       }));
     }

     fs.writeFileSync(fullPath, `${JSON.stringify(raw, null, 2)}\n`);
     console.log(`Normalised ${raw.tickets?.length || 0} tickets in`, fullPath);
   }

   const target = process.argv[2] || 'data/tickets.json';
   normaliseTicketsFile(target);
   ```

4. **Lint protection**: ESLint now fails on new snake_case identifiers. If you copy snippets from older scripts, rename the keys or add
   an explicit normalisation step.

## Further Reading

- `docs/server-routing-map.md` – topology of the modular Express routers.
- `docs/cli-command-workflows.md` – updated to reflect camelCase CLI telemetry.
- `README.md` – operational overview with camelCase examples in the API usage section.
