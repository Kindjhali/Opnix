# Audit & Setup Flow

Opnix now includes a one-shot audit pipeline that can be triggered from the Claude bar using:

```
claude$ setup
```

Or programmatically via the REST API:

```
POST /api/claude/execute
{ "command": "setup" }
```

## What the audit does

1. **Module scan** – runs the full detector (`services/moduleDetector`) to build live module + dependency graphs.
2. **Ticket analysis** – loads `tickets.json`, tallies status/priority/tag counts, and flags open high-priority issues.
3. **Feature review** – inspects `features.json` to highlight proposals missing acceptance criteria.
4. **Spec generation** – writes both JSON and GitHub Spec Kit files into `/exports` using the shared spec generator.
5. **Documentation** – emits an audit markdown report with module, ticket, and tech stack summaries.
6. **Canvas snapshot** – saves a Cytoscape-ready JSON payload for the current graph.
7. **Audit report** – persists `opnix-audit-*.json` containing the structured summary returned to the client.

## Response payload

The API returns:

- `message`: human-readable status.
- `project`: inferred name/type/goal.
- `ticketStats`: open/closed counts, status breakdown, high priority summary, and tag frequency.
- `moduleSummary`: totals from the detector (module count, dependency counts, LOC).
- `techStack`: dependencies, devDependencies, detected frameworks, and package manager (if present).
- `followUps`: ordered list of recommended next actions (low health modules, missing criteria, etc.).
- `featureReview`: per-feature prompts so the next agent can confirm scope and acceptance criteria.
- `exports`: metadata for each file dropped into `/exports`.
- `isNewProject`: boolean flag indicating an empty workspace.
- `questionnaire`: when `isNewProject` is true, a scaffold of questions to kick off spec-driven planning.

## New workspace behaviour

When the repo looks fresh (no modules, tickets, or dependencies), the audit skips health warnings and instead returns the questionnaire so the next agent can start collecting requirements immediately. This mirrors the Spec Kit intake questions used on the frontend and keeps the CLI experience deterministic.

## Typical first run checklist

1. Run `setup` (Opnix auto-appends `--ultrathink`) to generate the baseline audit.
2. Review `/exports` for:
   - `opnix-spec-*.json`
   - `opnix-spec-*.spec.md`
   - `opnix-docs-*.md`
   - `opnix-canvas-audit-*.json`
   - `opnix-audit-*.json`
3. Address items in `followUps` (e.g., add tests, complete feature criteria).
4. Re-run `setup` after remediation to verify improvements.

This flow means Opnix can be dropped into existing repos for an immediate health snapshot, or into new projects to seed the discovery questions before any code is written. The interview blueprint that powers the spec builder lives at `/data/interview-sections.json` and mirrors best-practice discovery frameworks covering stakeholders, success metrics, architecture, quality, operations, compliance, and AI remediation.
