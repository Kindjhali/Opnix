# Questions Event Flow

The hot-reload watcher (`services/questionFileWatcher.js`) now emits fine-grained events whenever `public/data/interview-sections.json` changes.

## Change Pipeline

1. **Watch** – chokidar or `fs.watch` observes the JSON file.
2. **Validate & Hash** – the watcher parses the payload, validates sections/questions, and hashes every question.
3. **Snapshot Diff** – diffs run against the previous snapshot to classify changes:
   - Section added/removed/updated
   - Question added/removed/updated (per section)
4. **Session Updates** – active sessions receive either an immediate update or a deferred `pendingUpdate` with the diff payload.
5. **Event Emission** – events fire in multiple granularities:
   - `questions-changed` – full payload + diff
   - `questions-delta` – `{ timestamp, diff }`
   - `questions:sections` – array of section-level changes
   - `questions:section:<id>` – per-section change event
   - `questions:questions` – array of question-level changes
   - `questions:question:<sectionId>:<questionId>` – specific question change

All change objects include the new question content, previous content (for updates), and the hashed fingerprints for quick comparisons.

## Session Hooks

Sessions integrating with the watcher can:

- React to `questions-updated` events (now carrying a `diff` object).
- Inspect `session.pendingUpdate` when mid-question to preview upcoming changes before applying them.

## Diff Payload Structure

```
{
  sections: [
    {
      type: 'updated' | 'added' | 'removed',
      id: 'section-1',
      title: 'Architecture',
      questionCount: 5,
      changes: {
        added: ['question-5'],
        removed: [],
        updated: ['question-2']
      }
    },
    ...
  ],
  questions: [
    {
      type: 'updated',
      id: 'question-2',
      sectionId: 'section-1',
      question: { ...new data... },
      previousQuestion: { ...old data... }
    },
    ...
  ]
}
```

Use these structures to power UI indicators, change logs, or to reconcile in-progress interviews.
