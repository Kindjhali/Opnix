# Tickets Migration & Compatibility

Opnix still honours the original `tickets.json` workflow so existing automation and archives continue to function.

## File expectations

```json
{
  "tickets": [
    {
      "id": 42,
      "title": "Fix login redirect",
      "description": "Users see a blank page after SSO",
      "priority": "high",
      "status": "reported",
      "tags": ["BUG", "AUTH"],
      "created": "2025-09-24T15:53:38.095Z",
      "files": ["src/auth/validator.js"]
    }
  ],
  "nextId": 43
}
```

- `tickets` **must** be an array; invalid or missing arrays are normalised to `[]` at load time.
- `nextId` is optional—Opnix recomputes it using the highest existing `ticket.id` and persists the result.
- Unknown fields are preserved during updates so custom metadata survives round trips.

## Migration checklist

1. Drop legacy `tickets.json` into the repository root.
2. Start (or restart) the server – `readData()` validates the structure, sets `nextId`, and normalises ticket tags.
3. Confirm via `GET /api/tickets` that all records load without transformation surprises.
4. Use the UI or `POST /api/tickets` to append new items; the file is written back with consistent formatting.

## API compatibility

- `GET /api/tickets` returns the full list for the frontend and CLI clients.
- `GET /api/tickets/:id` lets older scripts query specific entries.
- `POST /api/tickets` uppercase-normalises tags supplied either as CSV or array.
- `PUT /api/tickets/:id` merges partial updates while preserving `created` timestamps.
- `DELETE /api/tickets/:id` removes the entry and rewrites the JSON file.
- `GET /api/export/markdown` produces a tag-segregated Markdown export for CLI tooling.

## Common pitfalls

- **Missing timestamps**: the UI displays `created` dates; if legacy data lacks timestamps, consider backfilling before import.
- **Case-sensitive tags**: the backend uppercases tags, so `bug` and `BUG` unify automatically.
- **Non-numeric IDs**: strings are coerced to integers. Ensure downstream consumers accept numeric IDs.

With these guardrails, Opnix can continue ingesting existing backlogs while exposing the richer module-aware tooling built in this iteration.
