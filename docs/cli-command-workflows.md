# CLI Command Workflow Enhancements

## Goal
Expose the progressive question flows (spec, feature, module, bug, diagram, API, docs) through the Claude/Codex CLI so operators can launch focused interviews directly from the terminal without opening the web UI. Slash commands spin up guided questionnaires, store responses alongside existing interviews, and will eventually update the Vue question area in real time.

## Current Behaviour
- Commands `/spec`, `/new-feature`, `/new-module`, `/new-bug`, `/new-diagram`, `/new-api`, and `/runbook` create a CLI interview session backed by the blueprint in `public/data/interview-sections.json`.
- Questions are filtered by the new `category` metadata on each section; the first question is returned immediately with instructions to continue.
- Responses are captured via `/answer <sessionId> <questionId> <your answer>` and persisted in `data/cli-sessions/<sessionId>.json`.
- Sessions return the next question until completion, at which point a summary of all responses is displayed and stored.
- On completion a Markdown transcript is exported to `spec/cli-sessions/`, and the CLI response lists the generated file path.
- `/help` lists available commands and `/sessions` summarises active or archived interviews directly from the terminal.
- REST helpers backing `/api/terminal/*` and `/api/cli/sessions*` now live in `routes/cli.js`, keeping the server entrypoint lean while letting tests import the handlers directly.
- Front-end helpers (`terminalManager`, `commandCenterManager`, `themeManager`) resolve a shared `useAppStore()` instance when no Vue component context is provided, so CLI routes and automated tests reuse the exact same flows as the UI.
- Spec interviews also trigger the full audit pipeline (spec JSON/Spec Kit, docs, diagrams). Module interviews publish a module summary JSON snapshot, and feature interviews generate a markdown plan so every transcript is paired with useful artefacts.
- Runbook interviews compile responses with module/ticket snapshots into Markdown runbooks under `spec/runbooks/` and report the file path back to the CLI.
- The Questions tab now mirrors CLI activity: a sessions list shows in-progress/completed interviews, and you can drill into a session to read responses and artefact paths without leaving the UI.

Example flow:

```
/spec
=> Specification Interview started (Session cli-....)
=> (project-name) What should we call this project?
=> Reply with /answer cli-... project-name <your response>

/answer cli-... project-name Atlas
=> Recorded answer for project-name.
=> (project-purpose) Describe the primary objective for this project.
=> Reply with /answer cli-... project-purpose <your response>
```

## Inspiration
- **GitHub Spec Kit** (`github/spec-kit`): demonstrates structured spec scaffolding, reusable prompts, and CLI-driven workflows that produce documentation artefacts.
- **GWUDCAP cc-sessions** (`GWUDCAP/cc-sessions`): showcases conversational CLI sessions that persist transcripts and branch based on responses—useful for modelling our command session handling.

## Command Matrix
| Command | Interview Category | Output Artefacts |
| --- | --- | --- |
| `/spec` or `/spec-doc` | Full specification interview (existing progressive flow) | Spec JSON/Markdown/Spec Kit, interview transcript |
| `/new-feature` | Feature intake (acceptance criteria, modules, priority) | Feature record in `data/features.json`, follow-up tickets/tasks |
| `/new-module` | Module onboarding (tech stack, dependencies, owners) | Module stub merged into `data/modules.json`, optional diagram update |
| `/new-bug` | Incident intake (repro steps, severity, context) | Ticket entry in `data/tickets.json`, optional checklists |
| `/new-diagram` | Diagram briefing (architecture context, scope) | Mermaid source queued for Diagram tab, stored in exports |
| `/new-api` | Endpoint specification (resources, verbs, contracts) | Generates live OpenAPI draft via `/api/api-spec/*`, exports Markdown/JSON, runs automated checks |
| `/runbook` | Operational readiness interview (deployment, incident, compliance playbooks) | Markdown runbook in `spec/runbooks/` plus transcript |

Commands such as `/plan` or `/tasks` are not implemented; keep docs and CLI help in sync with the matrix above.

## Usage
1. Start the Express server with `pnpm start`. The slash-command endpoint listens on `http://localhost:7337/api/claude/execute`.
2. Launch an interview by POSTing JSON containing the desired slash command. For example:
   ```bash
   curl -s http://localhost:7337/api/claude/execute \
     -H 'Content-Type: application/json' \
     -d '{"command":"/spec"}'
   ```
   The response includes `sessionId`, the next `question`, and any introductory `messages`.
3. Answer follow-up prompts by echoing the provided `sessionId` and `question.id`:
   ```bash
   curl -s http://localhost:7337/api/claude/execute \
     -H 'Content-Type: application/json' \
     -d '{"command":"/answer cli-123 project-name Atlas"}'
   ```
   Wrap multi-word answers in quotes or escape spaces just as you would in a shell.
4. Inspect progress at any time with `/sessions` (summary) or `/help` (supported commands). Completed sessions list generated artefacts so they can be piped into further automation.
5. Artefacts live in the workspace: JSON transcripts in `data/cli-sessions/`, Markdown transcripts in `spec/cli-sessions/`, and runbook exports in `spec/runbooks/`. The Vue Questions tab reflects these updates in real time.

## Alignment Gates
- Planning commands (`/spec`, `/new-feature`, `/new-module`, `/new-diagram`, `/new-api`, `/runbook`) require the DAIC state to be `Discussion`. If you are mid-implementation, call `POST /api/context/update` with `{"daicState":"Discussion"}` once alignment questions are answered.
- When UltraThink mode is `api`, append `[[ ultrathink ]]` to the slash command (for example `/spec [[ ultrathink ]]`) or change modes via `POST /api/ultrathink/mode` before retrying.
- The server blocks interviews when context usage exceeds 90%. Summarise or archive ongoing work, then update the context budget through `POST /api/context/update`.
- `/sessions` surfaces the most recent alignment gate events (and the `/api/cli/sessions` endpoint returns them under `gates`) so you can confirm when gating has been resolved.

## Architecture Snapshot
1. **Command Dispatcher** — implemented inside `/api/claude/execute`, routing slash commands through `services/cliInterviewManager.js`.
2. **CLI Router Module** — `routes/cli.js` exposes `createCliRoutes` plus reusable handlers for terminal history and CLI session APIs; server wiring is migrating here so tests and future route extractions can import the same handlers.
3. **Question Catalogue Enhancements** — sections in `public/data/interview-sections.json` now include a `category` field (`spec`, `feature`, `module`, `bug`, `diagram`, `api`, `docs`, `runbook`).
4. **Session Engine** — `cliInterviewManager` loads category-specific questions, adapts them through `ProgressiveQuestionEngine` (same logic as the UI), persists sessions to `data/cli-sessions/`, and returns the next prompt on each `/answer` call.
5. **Audit Exports** — `services/auditManager.js` now owns the spec/docs/canvas export pipeline and follow-up ticket creation, and the CLI dispatcher simply invokes the shared helpers.
6. **Next Up** — integrate `ProgressiveQuestionEngine` branching, trigger artefact generators after completion, and broadcast active sessions to the Vue app.

## Roadmap
1. Add filtering, search, and gating severity badges to the CLI Sessions panel so large transcripts are easier to navigate.
2. Expand `/help` with session detail navigation, runbook quick tips, and gating troubleshooting guidance.
3. Link CLI session details directly to exported docs/runbooks for quick drill-down from the UI.
4. Automate UI snapshot coverage for the CLI Sessions panel and runbook modal alongside the existing CLI workflow tests.

## Tracking
| Task | Status | Notes |
| --- | --- | --- |
| Categorise questions in blueprint | ✅ | `public/data/interview-sections.json` now embeds `category` metadata and exports `sectionCategories`.
| Implement CLI command router | ✅ | Slash commands parsed in `/api/claude/execute`, routed through `cliInterviewManager`.
| Build CLI interview session engine | ✅ | Manager provides session persistence and question progression.
| Persist CLI transcripts + expose API | ✅ | `/api/cli/sessions` + `/api/cli/sessions/:id` serve session metadata for the Questions tab.
| Hook artefact generators to CLI sessions | ✅ | Spec/feature/module/runbook flows emit Markdown + JSON artefacts alongside transcripts.
| Surface CLI sessions in Questions tab | ✅ | Sessions panel now mirrors CLI state with detail view and artefact links.
| Documentation updates | ✅ | README.md now contains a CLI quickstart; this doc captures the detailed workflow.
| Automated tests (`npm run test:modules`) | ✅ | `tests/cliInterviewCommands.test.mjs` ensures sessions spin up.
| Runbook API workflow coverage | ✅ | `tests/runbookApiWorkflow.test.mjs` exercises interview start, answer, and Markdown export.

Prepared 2025-09-26 — keep revisiting after DAIC alignment gates land.
