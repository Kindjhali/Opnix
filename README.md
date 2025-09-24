# Opnix — Operational Toolkit

Opnix delivers a neon-soaked command center for auditing, explaining, and visualising software projects end-to-end. It combines a Vue 3 single-page interface with an Express backend, filesystem-backed data, and automation that keeps every artefact grounded in the real repository—no mock payloads, no placeholders.

## Feature Highlights
- **Neon Installation Flow** — `npm run setup:install` guides dependency setup, triggers the decision tree wizard, and hands you curated next steps in the CLI.
- **New vs Existing Project Decision Tree** — automatically routes greenfield repos to discovery interviews or established codebases to the full audit (`scripts/setupWizard.js`).
- **Automated Audits** — `claude$ setup` or the wizard runs module detection, ticket/feature analysis, spec-kit generation, canvas snapshots, and Markdown docs; exports land in `/exports`.
- **Cytoscape Module Canvas** — renders live module graphs, merges manual links (`module-links.json`), supports drag-and-drop dependencies, and exports PNG/JSON payloads.
- **Ticket Command Center** — CRUD via `/api/tickets`, filtering, tagging, and a completion modal that captures work summaries before a ticket can be marked finished.
- **Progressive Interview Playbook** — blueprint in `public/data/interview-sections.json` powers the spec builder and audit questionnaire for new projects.
- **Mermaid Diagram Engine (roadmap)** — architecture, sequence, entity, and flow diagrams derived from detector + interview data (scope defined in `docs/visual-enablement-scope.md`).
- **Storybook Integration (roadmap)** — auto-generated stories sourced from detector exports and interview answers (see scope doc).

## Architecture Overview
```
┌─────────────┐    REST/JSON    ┌──────────────┐
│ Vue 3 SPA   │ <────────────── │ Express API  │
│ (public/)   │                 │ (server.js)  │
└─────┬───────┘                 └──────┬───────┘
      │                                │
      │                                ├─ services/moduleDetector.js
      │                                ├─ services/specGenerator.js
      │                                ├─ services/docsGenerator.js
      │                                └─ services/interviewLoader.js
      │
      └─ Cytoscape, Mermaid, local Vue state hydrate from live API responses
```
- **Frontend**: `public/index.html` bootstraps the Vue app defined in `public/app.js`. Components manage tickets, features, modules, diagrams, docs, and theme switching.
- **Backend**: `server.js` exposes REST endpoints for tickets, features, modules, agents, audits, exports, and spec generation. It reuses shared services for detection and document creation.
- **Data Sources**: `tickets.json`, `features.json`, `module-links.json`, and `public/data/interview-sections.json` provide persistent state; `/exports` stores generated artefacts.

## Requirements
- Node.js ≥ 18
- npm ≥ 9
- macOS, Linux, or Windows (WSL recommended)

## Getting Started
```bash
# 1. Clone the repository and enter the directory
git clone <your-fork-or-repo-url>
cd opnix

# 2. Run the neon installer (installs deps, ensures exports/, launches wizard)
npm run setup:install

# 3. Start the server
npm start

# 4. Open the interface
open http://localhost:7337  # or use your browser of choice
```

### Installation Decision Tree
- **New Project Path**
  1. Installer detects an empty repo and emits `exports/opnix-new-project-scope-*.md` with interview highlights.
  2. Open the Spec Builder tab, complete staged questions, and export the resulting spec kit.
  3. Use the Playbook pane (blueprint in `docs/interview-playbook.md`) for stakeholder alignment.
- **Existing Repository Path**
  1. Wizard runs the audit (equivalent to `claude$ setup`).
  2. Artefacts land in `/exports` (`opnix-spec-*.json`, `.spec.md`, docs, canvas JSON, audit JSON, entry summary).
  3. Follow the recommended remediation list and rerun the audit to measure improvement.

### Manual Wizard Invocation
```bash
npm run setup:wizard
```
Use this when you want to refresh the decision tree without re-running dependency checks.

## Core Workflows
### Tickets & Incident Response
- View, filter, and create tickets from the **Bugs** tab.
- Status dropdown enforces `reported → in_progress → finished` transitions.
- Moving a ticket to `finished` triggers a completion modal requiring a summary of work performed, validation steps, and follow-ups.
- Backend (`server.js`) persists the `completionSummary` alongside updated timestamps.

### Module Detection & Canvas
- `services/moduleDetector.js` scans directories, imports, TODO markers, and merges manual links.
- `/api/modules/graph` powers the canvas, module cards, and export pipeline.
- Dragging edges in the canvas saves to `module-links.json`; exports use `/api/canvas/export`.

### Spec & Docs Generation
- Spec APIs (`/api/specs/generate`) rely on `services/specGenerator.js` to output JSON, Markdown, and GitHub Spec Kit formats.
- `docsGenerator` produces complementary Markdown summary docs consumed by the audit.
- All generated files are written to `/exports` and surfaced via `/api/exports`.

### Visual Enablement Sprint (In Flight)
- **Mermaid Diagram Engine** — build flow/sequence/entity diagrams from detector, interview, ticket, and feature data. Exposed via `/api/diagrams/:type` (scope documented).
- **Storybook Autogen** — `npm run storybook:generate` (planned) will scan component metadata, interview answers, and detector outputs to mint live stories. Refer to `docs/visual-enablement-scope.md`.
- **Timeline Canvas** — roadmap/Gantt view wired to features/tickets with export hooks (roadmap item).

## Command Reference
| Task | Command |
| --- | --- |
| Start server | `npm start` |
| Development mode (nodemon) | `npm run dev` |
| Neon installer | `npm run setup:install` |
| Decision tree only | `npm run setup:wizard` |
| Claude audit (API) | `claude$ setup` via CLI bar or `POST /api/claude/execute` |
| Export tickets as Markdown | `curl http://localhost:7337/api/export/markdown > tickets.md` |

## Key Files & Directories
| Path | Purpose |
| --- | --- |
| `public/index.html` | Vue mount point, theme variables, layout, modals |
| `public/app.js` | Vue application logic, API calls, canvas wiring, ticket completion modal |
| `server.js` | Express routes, audit pipeline, exports, decision-tree helpers |
| `services/moduleDetector.js` | Filesystem scan + manual link merge for modules |
| `services/specGenerator.js` | JSON/Markdown/Spec Kit generation |
| `services/docsGenerator.js` | Markdown report generator for audits |
| `services/interviewLoader.js` | Loads interview blueprint and questionnaires |
| `docs/install-decision-tree.md` | Installation wizard overview & Mermaid decision tree |
| `docs/visual-enablement-scope.md` | Detailed plan for Mermaid + Storybook deliverables |
| `docs/audit-flow.md` | Audit pipeline reference |
| `docs/interview-playbook.md` | Interview stages and conditional sections |
| `module-links.json` | Persisted manual module edges |
| `tickets.json` | Primary ticket store |
| `/exports` | Audit/spec/doc/canvas outputs |

## Data Contracts
- Tickets include: `id`, `title`, `description`, `priority`, `status`, `tags`, `modules`, `created`, `updated`, `completionSummary?`.
- Modules include: `id`, `name`, `type`, `pathHints`, `dependencies`, `externalDependencies`, `health`, `coverage`.
- Feature records include: `id`, `title`, `description`, `moduleId`, `priority`, `status`, `acceptanceCriteria`, `created`.

## Accessibility & Design
- WCAG-compliant contrast ratios with neon accents (MOLE/CANYON themes).
- Progressive disclosure in the interview flow, timeline planning, and docs.
- Animations respect motion reduction preferences; focus states and keyboard navigation are maintained across the interface.

## Testing & Validation Checklist
- [ ] Run `npm run setup:install` in a clean clone; verify wizard branches appropriately.
- [ ] Trigger `claude$ setup` to ensure audits complete and exports populate `/exports`.
- [ ] Create, update, finish, and delete tickets via UI; ensure completion summary is required when finishing.
- [ ] Detect modules and export canvas (PNG/JSON) from the UI.
- [ ] Generate spec/doc bundles and confirm they land in `/exports`.

## Contributing
1. Fork the repo and create a feature branch.
2. Follow the neon style guide (theme tokens in `index.html`) and prefer filesystem-backed data over mock objects.
3. Add docs under `docs/` for any substantial feature or workflow.
4. Run the installer + wizard to ensure no regressions in the onboarding flow.
5. Open a PR with screenshots of UI changes when applicable.

## Roadmap Signals
- Automated Mermaid diagram exports in audit summaries.
- Storybook auto-generation leveraging detector + interview snapshots.
- Visual timeline canvas for milestone planning.
- Dependency book with internal/external risk scoring exposed via API & UI.

---

### Uploading Opnix to GitHub
1. **Create a GitHub repository** (web UI → “New repository”). Copy the remote URL, e.g., `https://github.com/<username>/opnix.git`.
2. **Initialize and commit locally** (if you haven’t already):
   ```bash
   git init
   git add .
   git commit -m "Initial Opnix import"
   ```
3. **Add the remote**:
   ```bash
git remote add origin https://github.com/<username>/opnix.git
   ```
4. **Push to GitHub**:
   ```bash
git push -u origin main   # or master, depending on your default branch
   ```
5. **Verify on GitHub**: refresh the repo page to confirm files uploaded.

If the repository already exists locally with a remote, skip the `git init` and `git remote add` steps—just commit your changes and run `git push`.
