# Opnix — Operational Toolkit

Opnix delivers a neon-soaked command center for auditing, explaining, and visualising software projects end-to-end. It combines a Vue 3 single-page interface with an Express backend, filesystem-backed data, and automation that keeps every artefact grounded in the real repository—no mock payloads, no placeholders.

## Feature Highlights
- **Neon Installation Flow** — `npm run setup:install` guides dependency setup, triggers the decision tree wizard, and hands you curated next steps in the CLI.
- **New vs Existing Project Decision Tree** — automatically routes greenfield repos to discovery interviews or established codebases to the full audit (`scripts/setupWizard.js`).
- **Automated Audits** — `claude$ setup` or the wizard runs module detection, ticket/feature analysis, spec-kit generation, canvas snapshots, and Markdown docs; artefacts land in `spec/`.
- **Cytoscape Module Canvas** — renders live module graphs, merges manual links (`data/module-links.json`), supports drag-and-drop dependencies, and exports PNG/JSON payloads.
- **Ticket Command Center** — CRUD via `/api/tickets`, filtering, tagging, and a completion modal that captures work summaries before a ticket can be marked finished.
- **Progressive Interview Playbook** — blueprint in `public/data/interview-sections.json` powers the spec builder and audit questionnaire for new projects.
- **Mermaid Diagram Engine** — architecture, sequence, entity, and delivery-flow diagrams derived from detector + interview data (details in `docs/visual-enablement-scope.md`).
- **Storybook Integration** — `pnpm run storybook:generate` rebuilds stories from detector exports + interview answers, and `pnpm run storybook` renders them with MOLE/CANYON themes.
- **Hidden `.opnix` Scaffold** — every wizard run composes `.opnix/scaffold/` with module handbooks, ticket summaries, tech-stack manifests, and framework bootstraps without overwriting prior runs.
- **Audit Checklists** — `/api/checklists` enforces hook-driven status transitions (`start-checklist`, `complete-checklist`) so compliance steps can’t be bypassed.
- **Runbook Generator** — CLI `/runbook` sessions merge interview answers with live module/ticket snapshots and drop Markdown playbooks into `spec/runbooks/` for the Docs tab.

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
- **Frontend**: `public/index.html` bootstraps the Vue app defined by `src/App.vue` (template) and `src/appOptions.js` (logic). Components manage tickets, features, modules, diagrams, docs, and theme switching.
- **Backend**: `server.js` exposes REST endpoints for tickets, features, modules, agents, audits, the spec archive, and spec generation. It reuses shared services for detection and document creation.
- **Data Sources**: `data/tickets.json`, `data/features.json`, `data/module-links.json`, and `public/data/interview-sections.json` provide persistent state; `spec/` stores generated artefacts.

## Requirements
- Node.js ≥ 18
- pnpm ≥ 8 (required for all package operations)
- macOS, Linux, or Windows (WSL recommended)

## Getting Started
```bash
# 1. Clone the repository and enter the directory
git clone <your-fork-or-repo-url>
cd opnix

# 2. Run the neon installer (installs deps, ensures spec/ tree, launches wizard)
pnpm run setup:install

# 3. Start the server
pnpm start

# 4. Open the interface
open http://localhost:7337  # or use your browser of choice
```

## Data Storage
- All install-time JSON state lives under `data/` so audits and UI share a single source of truth.
- `data/tickets.json` — primary ticket backlog (auto-created with an example ticket on first run).
- `data/features.json` — feature catalogue persisted through the Features tab and audit pipeline.
- `data/modules-detected.json` — latest detector snapshot (auto-refreshed whenever `/api/modules/graph` or `/api/modules/detect` runs, used as a cache if a future scan fails).
- `data/module-links.json` — manual canvas edges captured via drag-and-drop.
- `data/modules.json` — optional manual module overrides created through the Modules UI/API (merged into every detection pass).
- `data/checklists.json` — operational checklists (audit/wizard) with hook-guarded status transitions.
- `data/setup-state.json` — remembers the installer wizard's last selections and run history.
- Legacy root-level JSON files are migrated into `data/` automatically when the installer or server starts.
- `.opnix/scaffold/` — versioned scaffolding output containing module dossiers, ticket reports, tech-stack manifests, and framework-specific bootstrap code.

## .opnix Scaffold
- Generated automatically at the end of every installer wizard run (both new-project discovery and existing-repo audits).
- Produces module-specific README files, ticket markdown exports, a `tech/stack.md` report, and a `project/` skeleton (`package.json`, Express/Vue/React bootstraps when frameworks are detected).
- Files are written with timestamped versions when prior artefacts exist, so manual edits are preserved.
- Inspect `.opnix/scaffold/manifest.json` for a machine-readable summary of modules, tickets, and the files created in the latest pass.

## .opnix Runtime Bundle
- `.opnix/runtime/` mirrors every auto-generated artefact so installers can ship a single hidden payload.
- `index.json` tracks blueprints, docs, canvas snapshots, diagrams, audit payloads, Storybook stories, and the latest scaffold manifest.
- `pnpm run storybook:generate` automatically mirrors stories into `runtime/stories/` alongside the source files.
- The audit pipeline copies fresh spec/doc/diagram exports into `runtime/`, keeping the bundle in sync with `spec/` without manual curation.

### Installation Decision Tree
- **New Project Path**
  1. Installer detects an empty repo and emits `spec/revision/opnix-new-project-scope-*.md` with interview highlights.
  2. Open the Spec Builder tab, complete staged questions, and export the resulting spec kit.
     - As you answer, the UI auto-seeds placeholder modules/features (via `src/spec-scaffold.mjs`) and rehydrates them on reload so greenfield work has scaffolded specs before any detectors run.
  3. Use the Playbook pane (blueprint in `docs/interview-playbook.md`) for stakeholder alignment.
- **Existing Repository Path**
  1. Wizard runs the audit (equivalent to `claude$ setup`).
  2. Artefacts land in `spec/` (grouped into `blueprints/`, `docs/`, `revision/`, `canvas/`, `audits/`).
  3. Follow the recommended remediation list and rerun the audit to measure improvement.

### Manual Wizard Invocation
```bash
pnpm run setup:wizard
```
Use this when you want to refresh the decision tree without re-running dependency checks.

## Core Workflows
### Claude Terminal
- The Claude strip is pinned to the bottom of the interface so you can fire `claude$` commands from any tab; responses stay in view for quick copy/paste or follow-up actions.

### Tickets & Incident Response
- View, filter, and create tickets from the **Bugs** tab.
- Status dropdown enforces `reported → inProgress → finished` transitions.
- Moving a ticket to `finished` triggers a completion modal requiring a summary of work performed, validation steps, and follow-ups.
- Backend (`server.js`) persists the `completionSummary` alongside updated timestamps.

### Module Detection & Canvas
- `services/moduleDetector.js` scans directories, imports, TODO markers, and merges manual links/overrides (modules include a `source` flag and honour `data/modules.json`).
- `/api/modules/graph` powers the canvas, module cards, and export pipeline, persisting results to `data/modules-detected.json` so the UI can fall back when offline.
- The Modules tab automatically triggers a detection pass the first time you visit it each session, so cards always reflect the current workspace without pressing “Auto-Detect”.
- Dragging edges in the canvas saves to `data/module-links.json`; exports use `/api/canvas/export` and are stored under `spec/canvas`.

### Spec & Docs Generation
- Spec APIs (`/api/specs/generate`) rely on `services/specGenerator.js` to output JSON, Markdown, and GitHub Spec Kit formats.
- `docsGenerator` produces complementary Markdown summary docs consumed by the audit.
- All generated files are written to `spec/` and surfaced via `/api/exports`.
- Docs tab renders those exports inside theme-aware Markdown wrappers so MOLE/CANYON palettes carry through to headings, callouts, and code blocks.

### Visual Enablement Sprint (In Flight)
- **Mermaid Diagram Engine** — build flow/sequence/entity diagrams from detector, interview, ticket, and feature data. The Diagrams tab auto-renders the architecture view on first load and surfaces Mermaid parse errors in a styled alert. Exposed via `/api/diagrams/:type` (scope documented).
- **Storybook Autogen** — `pnpm run storybook:generate` scans component metadata, interview answers, and detector outputs to mint live stories (details in `docs/storybook.md`).
- **Timeline Canvas** — roadmap/Gantt view wired to features/tickets with export hooks (roadmap item).

## Command Reference
| Task | Command |
| --- | --- |
| Start server | `pnpm start` |
| Development mode (nodemon) | `pnpm run dev` |
| Neon installer | `pnpm run setup:install` |
| Decision tree only | `pnpm run setup:wizard` |
| Claude audit (API) | `claude$ setup` via CLI bar or `POST /api/claude/execute` |
| Export tickets as Markdown | `curl http://localhost:7337/api/export/markdown > tickets.md` |
| Fetch architecture diagram | `curl http://localhost:7337/api/diagrams/architecture` |

## CLI Interviews & Automation
Keep the Express server running (`pnpm start`) and interact with the interview engine via the slash-command endpoint at `/api/claude/execute`. Each call returns JSON suitable for automation pipelines.

```bash
# Kick off the specification interview
curl -s http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/spec"}'

# Answer follow-up questions
curl -s http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/answer cli-123 project-name Atlas"}'

# List active/archived sessions
curl -s http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/sessions"}'
```

- `/spec`, `/new-feature`, `/new-module`, `/new-bug`, `/new-diagram`, `/new-api`, and `/runbook` reuse the progressive question engine that powers the UI.
- Responses are persisted under `data/cli-sessions/` and Markdown transcripts land in `spec/cli-sessions/`; runbook flows also drop files into `spec/runbooks/`.
- The Questions tab mirrors CLI progress in real time, and `/help` lists the available commands from the terminal.
- Planning commands pause when the DAIC state is not `Discussion` or when context usage tops 90%; reset via `POST /api/context/update` before retrying.
- In UltraThink `api` mode append `[[ ultrathink ]]` to the command (for example `/spec [[ ultrathink ]]`) or change modes with `POST /api/ultrathink/mode` to clear the gate.
- `/sessions` lists recent gating events alongside session metadata so you can confirm alignment before reissuing commands.
- See `docs/cli-command-workflows.md` for deeper architecture notes and follow-on roadmap items.

## Key Files & Directories
| Path | Purpose |
| --- | --- |
| `public/index.html` | Vue mount point, theme variables, layout, modals |
| `src/appOptions.js` | Vue Option API logic (API calls, canvas wiring, completion modal) |
| `server.js` | Express routes, audit pipeline, spec archive helpers, decision-tree flows |
| `services/moduleDetector.js` | Filesystem scan + manual link merge for modules |
| `services/specGenerator.js` | JSON/Markdown/Spec Kit generation |
| `services/docsGenerator.js` | Markdown report generator for audits |
| `services/diagramGenerator.js` | Mermaid builders & exports surfaced via `/api/diagrams` |
| `services/interviewLoader.js` | Loads interview blueprint and questionnaires |
| `src/components/` | Vue single-file components extracted from the SPA for reuse/storybook |
| `src/stories/` | Storybook stories backed by live repository data |
| `docs/install-decision-tree.md` | Installation wizard overview & Mermaid decision tree |
| `docs/visual-enablement-scope.md` | Detailed plan for Mermaid + Storybook deliverables |
| `docs/audit-flow.md` | Audit pipeline reference |
| `docs/interview-playbook.md` | Interview stages and conditional sections |
| `docs/storybook.md` | Storybook workflow & CI guidance |
| `docs/checklists.md` | Checklist API and hook policy |
| `docs/templates/` | Surface documentation templates for Canvas/Bugs/Features/etc. |
| `data/module-links.json` | Persisted manual module edges |
| `data/tickets.json` | Primary ticket store |
| `data/` | Workspace telemetry (tickets, features, manual modules, canvas links) |
| `/spec` | Audit/spec/doc/canvas/diagram outputs |

## Data Contracts
- Tickets include: `id`, `title`, `description`, `priority`, `status`, `tags`, `modules`, `created`, `updated`, `completionSummary?`.
- Modules include: `id`, `name`, `type`, `pathHints`, `dependencies`, `externalDependencies`, `health`, `coverage`.
- Feature records include: `id`, `title`, `description`, `moduleId`, `priority`, `status`, `acceptanceCriteria`, `created`.

## Accessibility & Design
- WCAG-compliant contrast ratios with neon accents (MOLE/CANYON themes).
- Progressive disclosure in the interview flow, timeline planning, and docs.
- Animations respect motion reduction preferences; focus states and keyboard navigation are maintained across the interface.

## Testing & Validation Checklist
- [ ] Run `pnpm run setup:install` in a clean clone; verify wizard branches appropriately.
- [ ] Trigger `claude$ setup` to ensure audits complete and artefacts populate `spec/`.
- [ ] Create, update, finish, and delete tickets via UI; ensure completion summary is required when finishing.
- [ ] Detect modules and export canvas (PNG/JSON) from the UI.
- [ ] Generate spec/doc bundles and confirm they land in `spec/`.

## Code Quality & Development
- **Package Manager**: All operations use `pnpm` instead of `npm` for consistency and performance
- **Linting**: ESLint with Vue.js support and Stylelint for CSS/SCSS files
- **Code Quality**: 60% reduction in linting warnings achieved through proper implementation vs suppression
- **Naming Convention**: **CRITICAL** - All code must use camelCase (variables, properties, functions, API endpoints)
  - ESLint enforces camelCase with error severity
  - No snake_case or kebab-case allowed in JavaScript/Vue code
  - API endpoints and database fields must follow camelCase standard

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
