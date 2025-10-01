# Opnix Onboarding Guide

This guide walks a new operator through standing up the Opnix stack, understanding the server/service layout, and validating key workflows.

## Prerequisites
- Node.js ≥ 18
- pnpm ≥ 8 (`corepack enable` recommended)
- macOS, Linux, or Windows (WSL for Windows)

## Initial Setup
```bash
# clone the repository and enter the workspace
git clone <repo-url>
cd opnix

# install dependencies + run the neon setup wizard
pnpm run setup:install

# build the production bundle (Vite)
pnpm build

# start the Express server
pnpm start
```

Visit `http://localhost:7337` to load the Vue SPA. The console banner on `/` also lists useful curl commands for a CLI-first audit.

## Runtime Architecture
- `server.js` hosts only middleware (CORS, JSON/urlencoded parsing, gzip via `compression`) and router mounts. Heavy orchestration now lives in modular routers (`routes/`) and services (`services/`).
- `services/auditManager.js` handles the entire audit pipeline (spec/docs/canvas exports, diagrams, follow-up tickets), exposing `runInitialAudit` and `loadDiagramContext` to both the server and CLI flows.
- Frontend state is orchestrated from `src/appOptions.js`, with domain logic split into composables under `src/composables/` and shared API helpers in `src/services/apiClient.js` (which now also loads the interview blueprint).

### Router/Service Map
See `docs/server-routing-map.md` for a deep dive into the Express topology and a Mermaid diagram showing how routers consume shared services.

## Validation Checklist
1. **Automated Suites** — `pnpm test:modules` (covers detectors, CLI flows, runbook workflows, etc.).
2. **Vite Build** — `pnpm build` (ensures the SPA bundles after modularisation).
3. **Storybook (optional)** — `pnpm run storybook` to confirm the embedded Storybook frame still renders on port 6006.
4. **CLI Audit** — From the Opnix CLI bar or `curl`, run `/spec [[ ultrathink ]]` to trigger an audit and verify artefacts populate `spec/`.

## Key Data & Artefact Paths
| Path | Purpose |
| --- | --- |
| `data/` | Persistent JSON state (tickets, features, modules, CLI sessions) |
| `spec/` | Generated artefacts (specs, docs, canvas snapshots, diagrams, runbooks) |
| `data/cli-sessions/` | CLI interview transcripts (JSON) |
| `spec/cli-sessions/` | CLI interview transcripts (Markdown) |
| `spec/runbooks/` | Runbook Markdown exports |

## Next Steps
- Follow the roadmap in `TODO.md` for upcoming enhancements (camelCase linting, roadmap state management, theme modularisation, etc.).
- Review `docs/cli-command-workflows.md` for detailed CLI usage, gating rules, and follow-up artefact generation.
- Consult `docs/install-decision-tree.md` to understand the installer/wizard branching between fresh installs and audits.

_Last updated: 2025-09-27_
