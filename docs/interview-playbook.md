# Opnix Interview Playbook

The interview blueprint that powers the spec builder and the `setup` audit is stored at `public/data/interview-sections.json`. It captures a staged discovery workflow designed to meet enterprise delivery best practices.

## Core sequence

1. **Foundation & Objectives** – codename, project type, purpose, value proposition, strategic alignment.
2. **Stakeholders & Governance** – executive sponsor, product owner, technical lead, communication cadence, RACI clarifications.
3. **Success Criteria** – primary/secondary metrics and qualitative indicators.
4. **Scope Boundaries** – inclusions, exclusions, definition of done.
5. **Constraints** – business, technical, budgetary constraints.
6. **Architecture Baseline** – current state, target vision, debt hotspots.
7. **Runtime Decisions** – primary language, frameworks, supporting libraries.
8. **Data & Domain** – core entities, data sources, volume/velocity, governance.
9. **Integrations** – consumers, providers, failure modes.
10. **Security & Compliance** – standards, authN/authZ models, monitoring.
11. **Quality Strategy** – test pyramid, non-functional tests, definition of ready.
12. **Operations & Reliability** – SLOs, scaling, observability, incident response.
13. **Deployment & Release** – environment promotion, cadence, rollback.
14. **AI Remediation** – regression history, guardrails, manual validation.
15. **Documentation & Enablement** – audiences, training, KT expectations.
16. **Risks & Assumptions** – risk register, assumptions, open questions.

## Conditional sections

- **Web Application** – design system, responsive breakpoints, performance budgets, accessibility, content workflow.
- **API Service** – consumer personas, versioning, API SLOs, observability, governance.
- **Mobile App** – platform strategy, app store process, offline behaviour, native capabilities, device matrix.
- **Desktop Software** – distribution channels, auto-update, hardware dependencies, IT policy alignment.
- **Library / Package** – distribution registry, install footprint rules, semantic versioning, compatibility testing, adoption support.
- **Framework-specific** – additional sections for React/Vue/Angular/Next.js and API stacks focus on state management, routing, or governance patterns.

## How it behaves in the app

- The spec builder loads the blueprint on mount and presents sections sequentially. Completing a section unlocks the next, surfacing the minimum viable set of questions first.
- When the **Project Type** answer is supplied, the relevant conditional sections are appended to the interview queue.
- Selecting a **Primary Language** refreshes framework options, and choosing a **Framework** injects any framework-specific sections.
- Answers are persisted in `questionAnswers` and flow into the generated spec payload under the `questionAnswers` key.
- The backend reuses the same blueprint during `setup` to include the questionnaire in audit responses when a fresh project is detected.

Use this playbook to tailor or extend the interview experience. Adjusting `public/data/interview-sections.json` immediately updates both the front-end spec builder and the backend audit questionnaire.
