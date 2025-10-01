# Internal Delivery Tracker

Progress: [████-----] 4/10 tasks complete

| # | Focus Area | Status | Next Action | Linked TODO |
|---|------------|--------|-------------|-------------|
| 1 | Runbook generator parity (CLI + Docs) | Completed | Monitor modal usage and expand multi-select inputs before next milestone | TODO.md §7 (Runbook Generator) |
| 2 | Post-session automation & session mirroring | Completed | Track additional UX feedback (sorting, filters) for the new CLI sessions panel | TODO.md §CLI INTERVIEW COMMANDS |
| 3 | CamelCase lint enforcement | In Progress | Verified camelCase across ticket UX and theme storage (no legacy fallbacks remain); continue auditing remaining snake_case identifiers and tighten lint rule exceptions | TODO.md §8 (Naming & Style Consistency) |
| 4 | Frontend modularisation | In Progress | Global store live (`useAppStore`); Docs tab hits `/api/docs/generate`, renders Markdown exports, syncs roadmap after spec/docs runs, static/meta checks documented, components split, CSS tab bundles delivered (`tabs/docs.css`, `tabs/roadmap.css`, `tabs/terminal.css`, `tabs/canvas.css`, `tabs/modules.css`, `tabs/specs.css`), theme styles now load via the dynamic loader in `themeManager`, roadmap detailed view now virtualises + supports inline editing, regression coverage lands in `tests/themeManager.test.mjs`, theme overlay tokens centralised in `theme-mole.css`/`theme-canyon.css` for roadmap components; next extract CSS/templates per plan | docs/frontend-refactor-plan.md |
| 5 | Index decomposition | Not Started | Create header/tab partials under `public/templates/` and update Express static config | docs/index-decomposition-plan.md |
| 6 | Terminal rewrite | In Progress | Finish multi-line terminal markup swap and hook new history handlers | TODO.md §Statusline Dashboard |
| 7 | Tech stack insights | Not Started | Design Stack tab view + markdown export workflow | TODO.md §Tech Stack Insights |
| 8 | Installer guidance exports | Not Started | Add CLAUDE/AGENTS/GEMINI prompt to setup flow, render templates | TODO.md §Installer Updates |
| 9 | API spec automation | Completed | Monitor warning telemetry + coverage for `/api/api-spec/*` endpoints | TODO.md §API Spec Automation |
| 10 | Roadmap state automation | Completed | Roadmap sync watchers now debounce data changes, enforce ticket→feature→module ordering, log/replay batches, emit `roadmap:reason:<prefix>` hooks, surface `milestone:<id>` cascades, guard milestone status transitions, maintain `dependencySummary` + automatic progress cascades for dependent milestones, and trigger git automation on manual completions (see `docs/roadmap-event-flow.md`) | TODO.md §10 (Backend State Management) |

Update this tracker whenever tasks move forward so the progress bar reflects reality.
