# Installation Decision Tree

OTKit now ships with an installation wizard that branches setup into two flows:

1. **New Project Discovery** – guides greenfield repositories through the interview blueprint and playbook export so scope is captured before code exists.
2. **Existing Repository Audit** – runs the full `claude$ setup` audit, generates specs/docs/canvas artefacts, and surfaces follow-up actions.

Kick off the neon installer with:

```
npm run setup:install
```

The installer verifies dependencies, prepares directories, and then launches the decision tree. To run only the decision flow:

```
npm run setup:wizard
```

If stdin is interactive, the wizard shows a summary of detected modules/tickets/dependencies and asks you to choose a path. In CI or non-interactive shells, it auto-selects the best match based on repository telemetry.

```mermaid
flowchart TD
  Install[[Install Opnix]] --> Decision{Workspace type?}
  Decision -->|New project| Scope[Discovery flow]
  Scope --> Interview[Run Spec Builder interview]
  Scope --> Playbook[Use Playbook UI & export scope docs]
  Decision -->|Existing repo| Audit[Automated audit run]
  Audit --> Exports[Spec, docs, canvas, audit payloads]
```

## New Project Flow
- Generates `exports/opnix-new-project-scope-*.md` outlining the staged interview, section highlights, and next steps.
- Directs operators to the Spec Builder, Playbook UI, and `docs/interview-playbook.md` for discovery.
- Designed for workspaces without modules, tickets, or dependencies yet—ideal right after repo creation.

## Existing Repository Flow
- Invokes the same audit pipeline exposed via `claude$ setup` to produce spec kits, documentation, canvas snapshots, and audit JSON.
- Writes a summary handoff to `exports/opnix-existing-project-entry-*.md` with key stats and top follow-ups.
- Ideal after dropping `tickets.json` or when scanning an established codebase.

Re-run the wizard whenever the workspace changes (e.g., after initial discovery or post-remediation) to pivot between flows or refresh exports.
