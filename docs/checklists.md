# Checklist Hooks

Operational checklists capture remediation or compliance tasks produced by the installer wizard and audit flow. Entries are stored in `data/checklists.json` and surfaced through a small REST API:

| Endpoint | Method | Description |
| --- | --- | --- |
| `/api/checklists` | `GET` | Return all recorded checklists and their items. |
| `/api/checklists` | `POST` | Create a new checklist (initial status `pending`). |
| `/api/checklists/:id` | `PUT` | Update metadata, items, or advance status. |

Status transitions must include the correct `statusHook` token:

| Transition | Hook |
| --- | --- |
| `pending → inProgress` | `startChecklist` |
| `inProgress → complete` | `completeChecklist` |
| `inProgress → pending` | `restartChecklist` |
| `complete → inProgress` | `reopenChecklist` |

Any attempt to move between states without the matching hook returns HTTP `409` with a descriptive error, preventing silent bypasses.

Checklist items are simple `{ id, text, status }` objects. Status defaults to `pending` and can be advanced alongside the parent checklist to mirror real-world review flow.

Run the regression suite with:

```bash
npm run test:modules
```

The combined test verifies module detection, feature status enforcement, and checklist hook validation.
