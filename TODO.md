# Opnix Development TODO

## ⚠️ DEVELOPMENT RULES - STRICTLY ENFORCED

**FORBIDDEN:**
- ❌ NO placeholders or mock data
- ❌ NO empty functions or half-implementations
- ❌ NO console.log fake functionality
- ❌ NO "TODO" comments in code
- ❌ NO partial implementations

**REQUIRED:**
- ✅ ONLY real, working, and valid code
- ✅ Complete functional implementations
- ✅ Actual file system operations
- ✅ Real API integrations
- ✅ Full end-to-end functionality

**IF YOU CANNOT COMPLETE A FEATURE FULLY:**
- Stop and document what needs to be completed by the next agent
- Do not commit broken or half-working code
- Provide clear handoff instructions

## DOCUMENTATION UPKEEP

- [x] Refresh docs/spec.md with current mission context

## VISUAL ENABLEMENT SPRINT

- [x] Draft Mermaid + Storybook scope (see docs/visual-enablement-scope.md)
- [x] Implement Mermaid diagram engine per scope
- [x] Stand up Storybook integration and CI scripts
- [x] Automate Storybook story generation from detector exports + interview questionnaire
- [x] Ship go-back capable wizard with persistent edits across all interview sections
- [x] Add final scaffolding stage that builds project skeleton from collected tech stack
- [x] Convert auto-generated artefacts (stories, diagrams, scaffolds) into `.opnix/` runtime bundle
- [x] Produce documentation templates for each major surface (Canvas, Bugs, Features, Modules, Specs, Diagrams, API, Docs, Spec & Audit overviews)
- [x] Catalogue extensibility hooks for interviews, diagrams, Storybook, and future automation within docs/code comments
- [x] Theme console CLI output to match MOLE neon palette and typography
- [x] Auto-populate Modules/API/Docs/Diagrams/Specs panels post-audit based on detector output
- [x] Generate follow-up tickets for issues discovered during audit (auto or Claude/Codex command hook)
- [x] Enforce ticket status progression via hooks before allowing actions (no silent updates)
- [x] Enforce feature TODO / acceptance criteria completion before permitting status changes
- [x] Require checklist status updates via defined hooks (no manual bypasses)
- [x] Auto-populate new-project spec flow with scaffolded modules/features based on discovery questionnaire
- [x] Replace deprecated `@storybook/testing-library` usage with `@storybook/test`
- [x] Embed Storybook UI and Mermaid viewer directly within the main app (using app themes)
- [x] Render exported Markdown artefacts with in-app theming (MOLE/CANYON)
- [x] Redesign layout with top bar, embedded terminal strip, and tab navigation beneath, as the nav bar currently is (console always visible)
- [x] Auto-start Storybook when app starts with embedded iframe integration

## CRITICAL FIXES REQUIRED

### 1. RETAIN: Backward Compatibility
- [x] Keep `data/tickets.json` workflow working (and migrate legacy root files)
- [x] Ensure user can drop in existing tickets.json files
- [x] Test with real data/tickets.json contents
- [x] Document migration path if needed

### 2. MODULE DETECTION SYSTEM
- [x] **DOCUMENT**: How system detects modules
  - Scans package.json for dependencies
  - Checks directory structure (src/, lib/, components/, etc.)
  - Reads import/require statements
  - Identifies framework patterns (React, Vue, etc.)
- [x] **IMPLEMENT**: Real module detection algorithm
- [x] **TEST**: Module detection on actual projects

### 3. CANVAS LINKING SYSTEM
- [x] **DOCUMENT**: How canvas creates links between modules
  - Dependency relationships from package.json
  - Import/export relationships in code
  - File structure relationships
  - Visual representation rules
- [x] **IMPLEMENT**: Canvas dependency visualization
- [x] **IMPLEMENT**: Interactive node linking
- [x] **IMPLEMENT**: Drag-and-drop dependency creation

### 4. FRONTEND-BACKEND INTEGRATION
- [x] Fix API calls instead of localStorage fallbacks
- [x] Connect agent system to real /agents folder
- [x] Connect module detection to backend scanning
- [x] Fix file operations to use server filesystem

### 5. INSTALLER SYSTEM
- [x] Add interactive setup decision tree (`scripts/setupWizard.js`)
- [x] Ship neon installer CLI (`npm run setup:install`)
- [x] Update install.sh to create complete Opnix system
- [x] Include all necessary files and directories
- [x] Test fresh installation process
- [x] Restructure installer to unpack into hidden `.opnix/` directory and clean up installation artefacts
- [x] Detect existing `.opnix/` and auto-switch to audit flow on reinstall
- [x] Ensure scaffolding output and archives remain editable under `.opnix/`
- [x] Trim distribution to a single installer script that unpacks runtime bundle

### 6. DOCUMENT QUESTIONS SYSTEM
- [x] Implement truly progressive questioning
- [x] Questions adapt based on previous answers
- [x] Pattern detection (API → endpoints, etc.)
- [x] GitHub spec-kit format export
- [x] Extend per-surface templates (Canvas, Bugs, Features, Modules, Specs, Diagrams, API, Docs, Spec Audit) outlining future hooks & question banks

### 7. FILE OPERATIONS
- [x] Canvas export writes to server spec/canvas directory
- [x] Spec generation creates real files
- [x] All exports accessible via API endpoints
- [ ] **RUNBOOK GENERATOR**: Add CLI and UI-driven runbook creation functionality (shared question set, Docs tab export, automated tests)
  - [x] Add `/runbook` command to CLI interview system with dedicated question set
  - [x] Add "Generate Runbook" button/option in Docs tab alongside existing templates
  - Reuse existing generators (`specGenerator.js`, `artifactGenerator.js`) for runbook templates
  - Progressive questioning for: incident response, deployment procedures, troubleshooting steps, monitoring, rollback processes
  - [x] Generate operational runbooks from project analysis, module health, and interview responses
  - [x] Export as Markdown files in `spec/runbooks/` directory
  - [x] Surface generated runbooks via existing Docs tab file browser
  - [x] Ensure both CLI `/runbook` and UI "Generate Runbook" use same question set and generator logic

### 8. NAMING & STYLE CONSISTENCY
- [ ] Enforce camelCase across frontend/backend code (audit remaining snake_case/TitleCase identifiers and refactor)
- [ ] Update lint/config rules to fail CI when camelCase violations detected
- [ ] Provide migration notes in docs for any renamed APIs/fields

### 8. VALIDATION TESTS
- [x] Complete user flow: install → detect modules → create canvas → export
- [x] Drop in old tickets.json and verify automatic migration to data/
- [x] Test all API endpoints return real data
- [x] Verify file system operations work

### 9. ULTRATHINK MODE & CONTEXT STATUS BAR INTEGRATION
- [x] **INTEGRATE**: UltraThink API endpoints into installer system
  - `/api/ultrathink/trigger` - Detects `[[ ultrathink ]]` activation (31,999 token budget)
  - `/api/ultrathink/mode` - Switch between 'default', 'max', 'api' modes
  - Ensure backend endpoints survive fresh installation
- [x] **INTEGRATE**: Context status bar into installer system
  - `/api/context/status` - Real-time context usage with visual bar
  - `/api/context/update` - Update context usage, task, files edited, DAIC state
  - Terminal footer integration with color-coded warnings (75%, 90% thresholds)
- [x] **VERIFY**: Fresh installation includes UltraThink and context monitoring
  - Test installer creates system with both features working
  - Verify theme color integration (--accent-cyan, --accent-orange, --danger)
  - Test UltraThink trigger detection and token budget allocation
  - Verify context status bar displays correctly in terminal footer

## ARCHITECTURE DOCUMENTATION NEEDED

### Module Detection Flow
```
1. User clicks "Detect Modules"
2. Backend scans project directory
3. Reads package.json dependencies
4. Scans src/ directories for imports
5. Creates module objects with dependencies
6. Returns to frontend for canvas display
```

### Canvas Linking Flow
```
1. Frontend receives module data from backend
2. Creates Cytoscape nodes for each module
3. Creates edges based on dependency relationships
4. Applies health-based coloring
5. Enables interactive editing of links
```

### File Export Flow
```
1. User clicks export
2. Frontend sends data to backend API
3. Backend writes real files to spec/ directory
4. Returns file path/download link
5. User can access exported files
```

## CURRENT SYSTEM STATE
- ✅ Frontend consumes live Express APIs (no localStorage fallbacks)
- ✅ Agent system streams from the `/agents` directory via backend loaders
- ✅ Module detection writes real results to `data/modules-detected.json` and merges manual modules from `data/modules.json`
- ✅ Canvas renders the real project structure from detector output and manual links
- ✅ Document questions are progressive with adaptive follow-ups
- ✅ File operations write to the server-side spec/docs directories before surfacing downloads
- ✅ Installer provisions the current Opnix runtime (auto-detects existing `.opnix/` installs)

### 9. ROADMAP GENERATOR SYSTEM ✅ COMPLETE
- [x] **RESEARCH**: Web investigation of roadmap visualization tools
  - Gantt chart libraries (D3.js gantt, Frappe Gantt, etc.)
  - Timeline visualization components
  - Project management visual patterns
  - Integration with Mermaid for roadmaps
- [x] **DESIGN**: Roadmap visual requirements
  - Project timeline tracker on same canvas as modules
  - Integration with existing Cytoscape canvas
  - Milestone tracking and dependencies
  - Progress visualization
- [x] **IMPLEMENT**: Roadmap generator
  - Can be part of docs system or Mermaid integration
  - Visual timeline on canvas alongside modules
  - Export roadmap as separate view or overlay
- [x] **INTEGRATE**: Roadmap with existing systems
  - Link roadmap milestones to modules
  - Connect tickets/features to timeline
  - Progress tracking based on module health

### 10. DEFINITIVE ROADMAP TRACKER SYSTEM 🔴 CRITICAL
- [ ] **BACKEND STATE MANAGEMENT**: Enhance existing roadmap API with comprehensive state tracking
  - [ ] Create `data/roadmap-state.json` with auto-backup functionality
  - [ ] Add state change listeners for tickets/features/modules status updates
  - [ ] Implement real-time roadmap state synchronization with existing JSON files
  - [ ] Add version control for roadmap state changes with rollback capability
- [ ] **DUAL VIEW SYSTEM**: Implement clean minimal and detailed roadmap views
  - [ ] Create toggle component between minimal/detailed views in roadmap tab
  - [ ] Design minimal view showing only key milestones and progress
  - [ ] Design detailed view showing all tickets, features, bugs, and specs
  - [ ] Ensure both views maintain full MOLE/CANYON theme compliance
- [ ] **COMPREHENSIVE INTEGRATION HOOKS**: Connect roadmap to all existing systems
  - [ ] Hook roadmap updates to ticket status changes (reported/inProgress/finished)
  - [ ] Hook roadmap updates to feature lifecycle changes (proposed/approved/inDevelopment/testing/deployed)
  - [ ] Hook roadmap updates to module health status changes
  - [ ] Hook roadmap updates to spec/documentation completion status
- [ ] **GIT AUTOMATION SYSTEM**: Auto-commit and summary generation when items complete
  - [ ] Implement auto git commit when bugs/features closed or milestones completed
  - [ ] Create automatic completion summary generation for closed items
  - [ ] Add git merge functionality for completed feature branches
  - [ ] Ensure all git operations include proper commit messages and metadata
- [ ] **ENHANCED STATUS MANAGEMENT**: Comprehensive state tracking with visual indicators
  - [ ] Implement status color coding (green=completed, orange=in-progress, red=blocked, blue=info)
  - [ ] Add progress calculations based on linked tickets/features/modules
  - [ ] Create status progression hooks with enforcement (no silent updates)
  - [ ] Add milestone dependency tracking and automatic progress updates
- [ ] **THEME INTEGRATION ENHANCEMENT**: Ensure all new components use existing theme system
  - [ ] Audit all new roadmap components for MOLE theme color compliance (`--accent-cyan`, `--danger`, etc.)
  - [ ] Audit all new roadmap components for CANYON theme color compliance (`--accent-orange`, earth tones)
  - [ ] Add theme-aware progress bars and status indicators using CSS custom properties
  - [ ] Ensure all new UI elements transition properly between MOLE/CANYON themes

### Definitive Roadmap Flow
```
1. System monitors all tickets/features/modules for state changes
2. Roadmap automatically updates when any linked item changes status
3. Dual views: Clean minimal (high-level) + Detailed (comprehensive)
4. Auto git commit/merge when milestones or items complete
5. Generate completion summaries for all closed work
6. Full theme compliance with MOLE/CANYON color schemes
7. Real-time state backup to JSON with version control
```

### Roadmap Visualization Flow
```
1. User generates project roadmap from specs/features
2. System creates timeline visualization
3. Roadmap displays on same canvas as modules
4. Milestones linked to specific modules/features
5. Progress tracked and visualized
6. Export roadmap as Gantt/timeline format
```

## SUCCESS CRITERIA
1. User can drop in tickets.json and system works
2. Module detection scans real project structure
3. Canvas shows actual dependency relationships
4. All file operations write to server filesystem
5. Fresh install via install.sh works completely
6. Progressive questioning works properly
7. Complete user flow works end-to-end
8. Roadmap generator creates visual project timelines on canvas

## PROGRESSIVE DOCUMENTATION SYSTEM ✅ COMPLETE

### Implemented Features
- [x] **DOCS TAB**: Complete documentation management interface with file browser
- [x] **FILE BROWSER**: Visual directory-based view of all .md files across entire project (73 files detected)
- [x] **MARKDOWN EDITOR**: In-app editor with live preview and theme integration
- [x] **API INTEGRATION**: Full REST API with `/api/docs/browse`, `/api/docs/read`, `/api/docs/save`
- [x] **TEMPLATE SYSTEM**: Professional document templates (README, API docs, Architecture, Contributing)
- [x] **PROGRESSIVE SPECS**: Integrated with install/decision tree workflow for auto-generation
- [x] **QUESTIONS SYSTEM**: Tabbed, editable interface for managing decision tree questions
- [x] **INSTALL INTEGRATION**: Progressive system triggers during both new and existing project setup

### Architecture Implemented
```
📖 Docs Tab: Static documentation management
├── Browse all .md files in project (73 files across 13 directories)
├── Edit existing documentation with live preview
├── Create new docs from professional templates
└── File browser with directory organization

📋 Specs Tab: Progressive specification generation
├── Decision tree questions → comprehensive spec artifacts
├── Connected to install/setup workflow
└── Auto-generates project analysis, architecture diagrams, etc.

❓ Questions Tab: Decision tree interface
├── Tabbed, editable questions system
├── Used during initial project setup
└── Feeds into progressive spec generation
```

### Markdown Manager Flow
```
1. User clicks "Markdown" tab/button on main page
2. System scans public folder (or designated folder) for .md files
3. Display files in visual grid with icons/previews
4. User clicks on .md file to view in themed markdown renderer
5. User can edit .md files with in-app editor
6. Changes saved back to filesystem via API
7. Support for creating new .md files in the interface
```

### Integration Points
- **API Endpoints**:
  - `GET /api/markdown` - List all .md files
  - `GET /api/markdown/:filename` - Get markdown file content
  - `PUT /api/markdown/:filename` - Save markdown file content
  - `POST /api/markdown` - Create new markdown file
- **Frontend**: New tab in main navigation, grid view component, markdown renderer with theming
- **Backend**: File system operations for .md files in public folder
- **Theming**: Markdown renderer uses MOLE/CANYON theme CSS variables

## LINTING & CODE QUALITY ✅ IN PROGRESS

### ESLint Configuration & CSS Linting ✅ COMPLETE
- [x] **ESLint Setup**: Flat config with Vue.js support, browser globals
- [x] **Stylelint Setup**: CSS/SCSS linting with standard rules
- [x] **Package Manager**: Migrated all scripts from npm to pnpm
- [x] **Tech Stack Update**: Updated documentation with pnpm requirement

### Service Layer Code Quality ✅ COMPLETE
- [x] **Vue Components**: Fixed 28 formatting warnings (property ordering, element attributes)
- [x] **progressiveDocumentSystem.js**: Implemented missing functionality instead of suppression
  - Enhanced `getArtifactTriggers` to analyze response content for intelligent artifact generation
  - Implemented `getModulePatterns` with session-aware pattern detection
- [x] **progressiveQuestionEngine.js**: Added npm-project pattern detection, enhanced `evaluateArtifactTriggers`
- [x] **specGenerator.js**: Removed legacy unused parameters
- [x] **moduleDetector.js**: Fixed unused error parameters, corrected regex escape characters

### Remaining Linting Tasks
- [x] **artifactGenerator.js** (18 warnings): Complex file requiring careful analysis
  - Unused `detectModules` import
  - Multiple unused `responses` and `moduleData` parameters
  - Unused error handlers in try-catch blocks
  - Unused destructured parameters
- [x] **server.js** (19 warnings): Requires delicate handling as noted
  - Multiple unused underscore parameters in route handlers
  - Unused `_mermaid` variable
  - Unused error parameters in catch blocks

**Progress**: 91 → 37 warnings (60% reduction). Services layer clean, only complex backend files remain.
- [x] Ignore third-party reference repo `cc-sessions/**` in ESLint so camelCase enforcement applies only to first-party code.


## CAMELCASE ENFORCEMENT 🔴 CRITICAL

- [x] **ENFORCE CAMELCASE STANDARD**: Tickets/checklists/feature statuses and API hooks migrated to camelCase with legacy normalization, docs/tests updated.

## THEME SWITCHER BUG 🔴 CRITICAL

- [x] **THEME TOGGLE BROKEN**: Theme switcher doesn't properly toggle between MOLE/CANYON
  - Fixed early return logic that prevented theme state updates
  - Cleaned up duplicate code in `setTheme()` method
  - Ensured `this.currentTheme` is updated before localStorage save
  - Simplified DOM class management for better reliability
  - Theme switching now works bidirectionally (MOLE ↔ CANYON)

## FRONTEND RESTRUCTURING NEEDED

### Index Shell Actions
- [x] Action: Externalize all root-level styling into dedicated CSS (`public/css/base.css`, `public/css/theme-mole.css`, `public/css/theme-canyon.css`) and remove inline `<style>` definitions from `public/index.html`.
- [x] Action: Rebuild `public/index.html` with a semantic shell (header, status bar, tab mount points) and minimal placeholders for Vue to hydrate.
- [x] Ticket: Introduce a bundler entry (`src/main.js`) and replace CDN `<script>` tags with the built bundle while keeping Express static delivery working.
- [ ] Ticket: Document required static assets/routes (fonts, CSS, runtime bundle) and verify Express serves `public/css/` correctly.
- [ ] Step: Confirm accessibility/meta tags remain accurate after restructure and that theme toggles update `data-theme` attributes as expected.

### App Decomposition Tickets
- [x] Action: Migrate `public/app.js` into `src/main.js` and a root `App.vue`, preserving initialization for Mermaid, Cytoscape, and CLI listeners.
- [ ] Ticket: Split domain areas into dedicated components under `src/components/` (TicketsBoard.vue, ModulesCanvas.vue, DocsViewer.vue, StatuslinePanel.vue, StorybookFrame.vue).
- [ ] Ticket: Move shared helpers (status normalization, markdown parsing, theme utilities) into `src/composables/` with targeted unit coverage.
- [ ] Ticket: Replace ad-hoc fetch logic with an `src/services/apiClient.js` module that centralizes REST calls for reuse by CLI + UI.
- [ ] Step: Introduce a lightweight global store (Pinia or custom composition) to manage shared state previously held in the monolithic script.

### Personal Execution Checklist
- [x] Step: Run `pnpm run build`/`pnpm start` to ensure Express serves the new bundle; adjust `server.js` static paths if necessary.
- [ ] Step: Exercise CLI flows (`/spec`, `/plan`, `/tasks`) and verify UI hydration still functions after the module split.
- [ ] Step: Update `README.md`, `docs/cli-command-workflows.md`, and onboarding docs with new build instructions and architecture diagrams.
- [ ] Step: Expand automated coverage (Storybook smoke tests, `pnpm test:modules`, new unit specs) to cover the modularized components and store.


## THEME ARCHITECTURE ENHANCEMENT 🎨

- [ ] **MODULAR THEME STYLESHEETS**: Refactor theme system for easier extensibility

### Infrastructure Setup
- [x] Create public/css directory if it doesn't exist
- [x] Create public/css/themes subdirectory
- [x] Verify directory permissions for CSS theme files

### MOLE Theme Extraction
- [x] Identify all MOLE theme CSS variables in index.html
- [x] Create mole.css file with proper CSS structure
- [x] Copy MOLE variables to mole.css with :root selector
- [x] Add mole-theme class selectors to mole.css
- [x] Validate mole.css syntax and formatting

### CANYON Theme Extraction
- [x] Identify all CANYON theme CSS variables in index.html
- [x] Create canyon.css file with proper CSS structure
- [x] Copy CANYON variables to canyon.css with :root selector
- [x] Add canyon-theme class selectors to canyon.css
- [x] Validate canyon.css syntax and formatting

### Base CSS Creation
- [x] Identify shared CSS utilities and base styles
- [x] Create base.css with common theme structure
- [x] Add theme transition animations to base.css
- [x] Add CSS custom property fallbacks to base.css
- [x] Validate base.css syntax and formatting

### Server Configuration
- [ ] Add static route for /css/ in server.js
- [ ] Test CSS file serving via HTTP requests
- [ ] Verify MIME types for CSS files are correct

### Dynamic Loading System
- [ ] Create CSS file loader utility function
- [ ] Update setTheme() to remove old theme CSS links
- [ ] Update setTheme() to add new theme CSS links to document head
- [ ] Add error handling for failed CSS loads in setTheme()
- [ ] Update theme initialization to load base.css first

### Cleanup Inline Styles
- [ ] Identify all inline theme styles in index.html
- [x] Remove MOLE theme inline styles from index.html
- [x] Remove CANYON theme inline styles from index.html
- [x] Remove redundant CSS variable declarations

### Testing & Validation
- [ ] Test MOLE theme loading and switching
- [ ] Test CANYON theme loading and switching
- [ ] Test theme persistence across page reloads
- [ ] Test theme switching performance
- [ ] Verify all components still render correctly
- [ ] Test theme switching with browser dev tools

### Documentation
- [ ] Create docs/theme-architecture.md guide
- [ ] Document CSS file structure in theme guide
- [ ] Document how to add new themes in theme guide
- [ ] Update README.md with theme system information

### Legacy Cleanup
- [ ] Remove any backup or temporary CSS files created
- [ ] Clean up any unused CSS classes or selectors
- [ ] Remove deprecated theme-related code or comments
- [ ] Verify no orphaned CSS files or directories remain
- [ ] Run final validation of theme system integrity


## CLI INTERVIEW COMMANDS 🚀 ENHANCEMENT

- [x] Categorise existing interview sections by domain (spec/feature/module/bug/diagram/api/docs/runbook) in `public/data/interview-sections.json` for reuse by CLI and UI filters.
- [x] Implement a slash-command router in the Claude/Codex CLI endpoint that maps `/spec`, `/new-feature`, `/new-module`, `/new-bug`, `/new-diagram`, `/new-api`, `/runbook` onto the current `ProgressiveQuestionEngine` flows.
- [x] Orchestrate CLI Q&A sessions via `ProgressiveQuestionEngine` and persist transcripts/responses to `data/cli-sessions/` before invoking existing artefact generators.
- [ ] **HOT-RELOAD INTERVIEW QUESTIONS**: Enable interview question updates without server restart
  - Add file watcher for `public/data/interview-sections.json` changes
  - Implement cache invalidation for interview data in `interviewLoader.js`
  - Add `/api/interviews/reload` endpoint to trigger question refresh
  - Update Questions tab UI to show "Reload Questions" button
  - Ensure active interview sessions handle question updates gracefully
- [ ] Mirror Spec Kit's staged flow by chaining existing generators (`specGenerator`, `artifactGenerator`, ticket/module writers) when CLI users issue follow-up commands (e.g. `/spec` → `/plan` → `/tasks`).
- [x] Trigger spec/feature/module generators when CLI interviews finish and return generated artefact paths alongside transcripts.
- [x] Enforce cc-sessions-style alignment hooks: planning commands gate on DAIC/UltraThink/context, log events to CLI + UltraThink compaction files, and expose gating status via `/sessions`.
- [x] Broadcast CLI session state to the Vue Questions tab (and related tabs) so in-progress and completed interviews appear with transcript links (include `/sessions` drill-down in UI).
- [x] Extend README + `docs/cli-command-workflows.md` with CLI usage instructions and ensure the slash-command flow stays covered by `pnpm test:modules`.
- [x] Add `/help` and `/sessions` commands to list available interviews and inspect active/archived sessions from the CLI.

## TECH STACK INSIGHTS 🔍 ENHANCEMENT

- [ ] **Project vs Module Question Sets**
  - Ensure initial interview sections capture project-wide context (new/existing project, core tech stack) before branching into module-specific follow-ups
  - Audit blueprint to confirm tech stack discovery questions appear for both CLI and UI flows
- [ ] **Tech Stack Snapshot Surface**
  - Add dedicated tab or panel (e.g., “Stack”) summarising detected packages/dependencies with categorisation (frontend, backend, tooling)
  - Pull data from module detector + `package.json` (and other ecosystem manifests) to produce a living document
- [ ] **Documentation Hooks**
  - Generate a Markdown export (`spec/docs/tech-stack-*.md`) capturing tech stack inventory, versions, and inferred responsibilities
  - Link the export from the Docs tab and include in audit bundles
- [ ] **CLI Integration**
  - Extend `/new-module` and `/spec` interviews to update tech stack records when new frameworks/tools are declared
  - Surface stack deltas at the end of CLI commands
- [ ] **Testing & Telemetry**
  - Add tests ensuring tech stack summaries update after module detection and interview edits
  - Track last-refresh metadata for the stack snapshot to display staleness warnings

## INSTALLER/DECISION TREE ✨ UPDATE

- [ ] Prompt at the end of `npm run setup:install` decision tree: “Generate AGENTS/CLAUDE/GEMINI guidance file?”
- [ ] If accepted, render project-tailored CLAUDE.md / AGENTS.md / GEMINI.md from templates (reuse project/interview data)
- [ ] Persist generated agent files under project root and surface success message in CLI + Docs tab
- [ ] Document new installer option in README + `docs/install-decision-tree.md`
- [ ] Cover generation path with tests (e.g., run installer in CI fixture, assert files created)

## 🚀 AUTOMATION ENHANCEMENTS GRANULATED TASKS

### CRITICAL PATH: camelCase Enforcement
- [ ] Audit codebase for snake_case violations (scan `public/`, `src/`, backend helpers, and CLI scripts; capture offenders with file and scope notes before refactors).
- [ ] Create camelCase linting rules (extend `eslint.config.js` or add a plugin that enforces camelCase while whitelisting required snake_case payloads).
- [ ] Fix all existing casing violations (rename variables, props, and service methods to camelCase and add adapters when external inputs must stay snake_case).

### SLASH COMMANDS: Command Handlers
- [ ] Create /constitution command handler (use `services/cliInterviewManager.js` to stream governance docs from `docs/` or `agents/` into the CLI response).
- [ ] Create /specify command handler (accept scope filters and call `services/specGenerator.js` so users can narrow follow-up outputs).
- [ ] Create /plan command handler (reuse plan scaffolding logic to write actionable steps into `data/cli-sessions/` and surface them in the UI).
- [ ] Create /tasks command handler (aggregate tickets and checklist states to list open work with owner and status filters).

### SLASH COMMANDS: Infrastructure Wiring
- [ ] Wire new commands to existing /spec infrastructure (register handlers in the router so they share the progressive interview pipeline and artefact exports).
- [ ] Wire new commands to existing /runbook infrastructure (trigger runbook generators when applicable and keep outputs synced under `spec/`).

### MULTI-AGENT ORCHESTRATION: Coordination System
- [ ] Design agent coordination protocol (document roles, state transitions, and communication contracts aligned with `agents/agent-organizer.md`).
- [ ] Create agent handoff metadata system (persist structured JSON handoffs that capture required artefacts, owners, and completion criteria).

### MULTI-AGENT ORCHESTRATION: Chain Implementation
- [ ] Implement spec->plan chaining (launch plan generation automatically when `/spec` sessions complete and pass spec identifiers forward).
- [ ] Implement plan->tasks chaining (convert plans into actionable tickets saved under `data/tickets.json` or `.opnix/scaffold/`).
- [ ] Implement tasks->implementation chaining (spin up code scaffolds or branch automation once tasks lock in, while tracking state).
- [ ] Create rollback mechanisms for failed chains (store checkpoints and clean up partial artefacts if downstream steps fail).

### BRANCH-PER-TASK SYSTEM: Branch Management
- [ ] Define branch naming conventions (publish patterns like `feature/<ticket-id>-slug` and mirror them in the README and CLI prompts).
- [ ] Create automatic feature branch creation (add a CLI helper that shells to git and applies the agreed naming scheme).
- [ ] Create branch cleanup automation (schedule or expose a command that prunes merged branches without touching protected ones).

### BRANCH-PER-TASK SYSTEM: Workspace Provisioning
- [ ] Add workspace folder auto-provisioning (generate `.opnix/workspaces/<branch>` directories whenever new task branches spin up).
- [ ] Add scaffold auto-provisioning (populate each workspace with relevant spec and ticket templates via the Spec Kit exporters).

### CONTEXT PRESERVATION: Session Management
- [ ] Design session state schema (define JSON structure for session metadata, progress markers, and artefact references).
- [ ] Create session auto-save mechanism (persist state to `data/session-state/` on every interaction across CLI and UI flows).
- [ ] Build session restoration system (reload saved state into Vue components so interrupted sessions resume seamlessly).
- [ ] Create context accumulation storage (aggregate historical context per project or persona to inform future sessions).

### WORKFLOW ENFORCEMENT: Approval Gates
- [ ] Design pre-implementation discussion hooks (introduce review checkpoints that must fire before coding begins).
- [ ] Create approval gate system (centralize gate definitions and enforce them server-side with role awareness).
- [ ] Add tool access restriction logic (block specific CLI commands or tools until required gates are cleared).
- [ ] Implement branch naming enforcement (add pre-commit or CI checks that reject branches that violate conventions).

### PROGRESS VISUALIZATION: Progress Indicators
- [ ] Design progress bar component (build a Vue component that maps tasks to stages with accessible labels).
- [ ] Add step completion checkmarks (reflect checklist completion status in both UI and CLI surfaces).
- [ ] Create progress persistence across sessions (store progress snapshots in `data/progress.json` and hydrate on load).

### PROGRESS VISUALIZATION: Navigation
- [ ] Build breadcrumb navigation component (add a reusable Vue component that reflects the current workflow path).
- [ ] Add context-aware breadcrumb updates (inject session and task metadata into breadcrumb labels and routes).
- [ ] Create icon-based visual hierarchy (pair breadcrumbs with icons to reinforce hierarchy without overloading text).

### COGNITIVE LOAD REDUCTION: Interface Simplification
- [ ] Audit interfaces for cognitive overload (review Tickets, Modules, and Questions screens; log complexity hotspots).
- [ ] Redesign complex screens into single-action flows (refactor multi-step views into guided sequences with clear focus).
- [ ] Add primary/secondary action distinction (standardize button visual hierarchy through shared theme tokens).

### COGNITIVE LOAD REDUCTION: Session Resume
- [ ] Create session resume dashboard (surface paused sessions with quick actions in the home view).
- [ ] Add recent session quick-access (list the most recent sessions in the sidebar or `/sessions` CLI output).
- [ ] Implement automatic context restoration (pre-fill forms and state when a paused session resumes).

### COGNITIVE LOAD REDUCTION: Context Management
- [ ] Design context summary cards (build compact cards that summarise specs, tickets, or modules for quick scanning).
- [ ] Add user preference persistence (store layout and context preferences per user so choices survive reloads).
- [ ] Create frequently-used settings shortcuts (surface top configuration knobs in a dedicated quick actions panel).

### COGNITIVE LOAD REDUCTION: Information Architecture
- [ ] Break complex data into digestible panels (segment dense screens into tabs or panels for easier parsing).
- [ ] Add expandable/collapsible content sections (let users hide advanced details by default).
- [ ] Create information density controls (provide toggles for compact versus detailed views and persist the choice).

### COLOR SYSTEM: Status Colors
- [ ] Implement green status colors for completed/healthy states (update theme tokens and verify contrast compliance).
- [ ] Implement amber status colors for in-progress/attention states (differentiate from warnings while staying readable).
- [ ] Implement red status colors for blocked/critical states (apply consistently across alerts, badges, and CLI output).
- [ ] Implement blue status colors for information/context states (use for informational banners and breadcrumb highlights).

### COLOR SYSTEM: Accessibility
- [ ] Create high contrast mode beyond MOLE/CANYON (ship an accessible preset with stronger contrast ratios).
- [ ] Enhance keyboard navigation focus indicators (widen focus rings and ensure visibility across themes).
- [ ] Add custom color palette options (let users define palettes that persist in their preferences).
- [ ] Implement prefers-reduced-motion support (respect OS motion settings across animations and transitions).
- [ ] Add dyslexia-friendly font options (offer fonts such as OpenDyslexic and load them when requested).
- [ ] Create configurable animation controls (allow users to tune animation intensity or disable effects entirely).

### AUTO-RECOVERY: System Reliability
- [ ] Design checkpoint system for session interruptions (capture recovery snapshots during long-running flows).
- [ ] Create automatic session restoration (detect restarts and restore the last checkpoint automatically).
- [ ] Implement graceful failure handling (show recovery prompts and avoid data loss when backend errors occur).

### SMART MONITORING: Proactive Alerts
- [ ] Build proactive alert system for module attention (scan `data/modules-detected.json` and flag stale modules).
- [ ] Add audit staleness notifications (notify operators when audits exceed freshness thresholds).
- [ ] Create dependency health monitoring (integrate npm audit or custom scanners to surface library risks).

### BULK OPERATIONS: Multi-Selection
- [ ] Add multi-select for tickets/features (extend list components with keyboard and mouse selection states).
- [ ] Create bulk status update functionality (add API batch endpoints that update status and expose undo).
- [ ] Implement batch operations UI (show a contextual toolbar for selected items without breaking single-item flows).

### TEMPLATE INTELLIGENCE: Pattern Recognition
- [ ] Create template pattern detection (analyse historical specs or tickets to recommend base templates).
- [ ] Add template auto-suggestion system (surface relevant templates when users create new artefacts).
- [ ] Create template customization interface (let teams edit and save templates under `data/templates/`).

### THEME ARCHITECTURE: Theme System
- [ ] Refactor theme system architecture (modularise tokens under `src/theme/` for easier extension).
- [ ] Create theme plugin system (allow external themes to register through documented hooks).
- [ ] Add theme switching capabilities (expose runtime toggles in UI and CLI that persist per user).

### HOT-RELOAD QUESTIONS: Live Editing
- [ ] Add live editing for interview questions (enable an admin UI that updates `public/data/interview-sections.json` in place).
- [ ] Create question preview system (show formatted previews before publishing updates to sessions).
- [ ] Implement immediate feedback loop for questions (broadcast edits to active sessions with clear change diffs).

### RUNBOOK COMPLETION: Generator System
- [ ] Finish partial runbook implementation (complete missing endpoints or templates referenced in existing runbook flows).
- [ ] Add automated runbook generation (trigger generators after CLI commands or audits and save outputs under `spec/runbook/`).
- [ ] Create runbook template system (curate reusable templates stored in `spec/runbook/templates/`).

### STATUSLINE DASHBOARD: Status Indicators
- [ ] Create branch status indicator (show current git branch and divergence in the terminal status bar).
- [ ] Add task progress indicator (surface checklist or ticket completion stats alongside the status bar).
- [ ] Add token usage tracking (display API token consumption so operators notice quota risk).
- [ ] Add file count monitoring (track files touched in the current session for scope awareness).
- [ ] Create project health dashboard (combine alerts, progress, and blockers into a consolidated status view).
- [ ] Implement color palette customization (tie statusline colors to theme tokens for readability).

### VISUAL SYSTEM: Symbol-Based Navigation
- [ ] Add icon-based navigation (introduce icons in the side navigation for quicker recognition).
- [ ] Create symbol-based status indicators (pair statuses with distinct symbols to reduce text dependence).
- [ ] Add dyslexia-friendly visual cues (ensure icon shapes and labels remain legible for dyslexic users).

### MEMORY RETENTION: Task Logging
- [ ] Add per-task logging system (store chronological notes in `data/task-logs/` with timestamps and authors).
- [ ] Create recap functionality (auto-generate summaries when tasks close and make them available via CLI and UI).
- [ ] Implement narrative manifest system (maintain an ongoing project narrative in `docs/narrative.md`).
- [ ] Create context-compaction alerts (warn when logs grow unwieldy and suggest archival or summarisation).

### SENSORY FEEDBACK: Optional Feedback
- [ ] Add optional sound feedback for state changes (hook audio cues into major events behind a user-toggle).
- [ ] Add optional tactile feedback options (expose hooks for supported devices to vibrate or pulse on key actions).
- [ ] Create context overflow warnings (signal when context size nears limits so users can trim inputs).
- [ ] Implement attention shift management (introduce reminders or pacing prompts when juggling multiple agents).

### Previously Completed Tasks

## COMPLETED WORK SUMMARY (Last Updated: 2025-09-25)

### Recently Completed Tasks

#### Progressive Documentation & Questions System ✅ COMPLETE (Current Session)
- **Documentation Management**: Complete docs tab with file browser for 73 markdown files across 13 directories
- **API Layer**: Full REST API with `/api/docs/browse`, `/api/docs/read`, `/api/docs/save`, `/api/docs/templates`
- **Template System**: 4 professional document templates (README, API docs, Architecture, Contributing)
- **Progressive Specs**: Integrated with install/decision tree workflow for comprehensive artifact generation
- **Questions Interface**: Tabbed, editable system for managing decision tree questions with full CRUD
- **Install Integration**: Progressive system now triggers during both new and existing project setup workflows
- **End-to-End Testing**: All APIs verified working, 73 files detected, templates functional, read/write operational

#### Roadmap Generator System ✅ COMPLETE
- **UI Implementation**: Roadmap tab with timeline visualization, stats, and controls
- **Backend API**: `/api/roadmap/generate-from-tickets` and `/api/roadmap/export` endpoints
- **Frontend Integration**: Auto-generation from tickets with proper Vue.js data binding
- **End-to-End Testing**: Verified complete workflow with real ticket data (10 modules generated)
- **Visual Components**: Timeline items, progress tracking, milestone management

#### Canvas Data Loading Fix ✅ COMPLETE
- **Root Cause**: `setModulesFromPayload()` was calling `ensureCanvas()` but not `refreshCanvas()`
- **Fix Applied**: Added `this.refreshCanvas();` call after canvas initialization
- **Result**: Canvas now automatically populates with module data on app load
- **Verification**: 10 modules with 6 dependencies properly displayed

#### Tab Structure HTML Fix ✅ COMPLETE
- **Root Cause**: Missing closing `</div>` tags for tab-content wrappers
- **Tabs Fixed**: Bugs tab and Roadmap tab structural issues resolved
- **Result**: All tabs now display properly with correct content areas

#### Installer UltraThink Validation ✅ COMPLETE
- **Coverage Added**: `tests/ultraThinkEndpoints.test.mjs` exercises trigger/mode/context routes
- **Installer Guardrail**: Installer now blocks completion if UltraThink/context APIs fail verification
- **State Reset**: Validation restores baseline context/task metrics for clean runtime start
- **Outcome**: Fresh installs guarantee UltraThink + context monitoring before the wizard launches

#### Markdown Manager Feature ✅ COMPLETE
- **Navigation**: Added dedicated Markdown tab with neon-themed toolbar and filters
- **Browser UI**: Grid of markdown cards grouped by root (docs, runtime docs, generated docs) with workspace paths and timestamps
- **Editor**: In-app editor with preview mode, theme-aware rendering, and draft metadata controls
- **API Layer**: `/api/markdown` list endpoint plus create/read/update routes; existing archive routes remain backward compatible
- **Testing**: `tests/markdownManager.test.mjs` covers create/read/update workflows against filesystem

#### Module Detection Persistence ✅ COMPLETE
- **Filesystem Cache**: Detection snapshots now persisted to `data/modules-detected.json` with generatedAt metadata
- **Manual Modules**: `/api/modules` accepts custom modules with path, type, dependencies, and stores them in `data/modules.json`
- **Merged Results**: Detector merges manual entries, annotates sources, and filters only signal-producing directories while keeping authored modules
- **Auto-Refresh**: Modules tab re-runs detection and reloads diagrams after updates without leaving stale placeholders

#### Storybook Auto-Start Enhancement ✅ COMPLETE
- **Server-Level Auto-Start**: Added automatic Storybook startup when server starts
- **No-Open Flag**: Prevents automatic browser window opening (`--no-open`)
- **Background Operation**: Storybook runs silently on port 6006
- **Manual Control**: Only opens in browser when user clicks Storybook button
## COMPLETED WORK SUMMARY (Last Updated: 2025-09-25)

### Recently Completed Tasks

#### Progressive Documentation & Questions System ✅ COMPLETE (Current Session)
- **Documentation Management**: Complete docs tab with file browser for 73 markdown files across 13 directories
- **API Layer**: Full REST API with `/api/docs/browse`, `/api/docs/read`, `/api/docs/save`, `/api/docs/templates`
- **Template System**: 4 professional document templates (README, API docs, Architecture, Contributing)
- **Progressive Specs**: Integrated with install/decision tree workflow for comprehensive artifact generation
- **Questions Interface**: Tabbed, editable system for managing decision tree questions with full CRUD
- **Install Integration**: Progressive system now triggers during both new and existing project setup workflows
- **End-to-End Testing**: All APIs verified working, 73 files detected, templates functional, read/write operational

#### Roadmap Generator System ✅ COMPLETE
- **UI Implementation**: Roadmap tab with timeline visualization, stats, and controls
- **Backend API**: `/api/roadmap/generate-from-tickets` and `/api/roadmap/export` endpoints
- **Frontend Integration**: Auto-generation from tickets with proper Vue.js data binding
- **End-to-End Testing**: Verified complete workflow with real ticket data (10 modules generated)
- **Visual Components**: Timeline items, progress tracking, milestone management

#### Canvas Data Loading Fix ✅ COMPLETE
- **Root Cause**: `setModulesFromPayload()` was calling `ensureCanvas()` but not `refreshCanvas()`
- **Fix Applied**: Added `this.refreshCanvas();` call after canvas initialization
- **Result**: Canvas now automatically populates with module data on app load
- **Verification**: 10 modules with 6 dependencies properly displayed

#### Tab Structure HTML Fix ✅ COMPLETE
- **Root Cause**: Missing closing `</div>` tags for tab-content wrappers
- **Tabs Fixed**: Bugs tab and Roadmap tab structural issues resolved
- **Result**: All tabs now display properly with correct content areas

#### Installer UltraThink Validation ✅ COMPLETE
- **Coverage Added**: `tests/ultraThinkEndpoints.test.mjs` exercises trigger/mode/context routes
- **Installer Guardrail**: Installer now blocks completion if UltraThink/context APIs fail verification
- **State Reset**: Validation restores baseline context/task metrics for clean runtime start
- **Outcome**: Fresh installs guarantee UltraThink + context monitoring before the wizard launches

#### Markdown Manager Feature ✅ COMPLETE
- **Navigation**: Added dedicated Markdown tab with neon-themed toolbar and filters
- **Browser UI**: Grid of markdown cards grouped by root (docs, runtime docs, generated docs) with workspace paths and timestamps
- **Editor**: In-app editor with preview mode, theme-aware rendering, and draft metadata controls
- **API Layer**: `/api/markdown` list endpoint plus create/read/update routes; existing archive routes remain backward compatible
- **Testing**: `tests/markdownManager.test.mjs` covers create/read/update workflows against filesystem

#### Module Detection Persistence ✅ COMPLETE
- **Filesystem Cache**: Detection snapshots now persisted to `data/modules-detected.json` with generatedAt metadata
- **Manual Modules**: `/api/modules` accepts custom modules with path, type, dependencies, and stores them in `data/modules.json`
- **Merged Results**: Detector merges manual entries, annotates sources, and filters only signal-producing directories while keeping authored modules
- **Auto-Refresh**: Modules tab re-runs detection and reloads diagrams after updates without leaving stale placeholders

#### Storybook Auto-Start Enhancement ✅ COMPLETE
- **Server-Level Auto-Start**: Added automatic Storybook startup when server starts
- **No-Open Flag**: Prevents automatic browser window opening (`--no-open`)
- **Background Operation**: Storybook runs silently on port 6006
- **Manual Control**: Only opens in browser when user clicks Storybook button


#### Section 7: FILE OPERATIONS ✅ COMPLETE
- **Canvas Export**: Real file system operations write to `spec/canvas/` directory
- **Spec Generation**: Creates actual files in `spec/blueprints/` directory
- **API Endpoints**: All exports accessible via `/api/exports` and `/api/exports/:filename`
- **Frontend Integration**: Canvas export and spec generation automatically refresh file listings
- **Directory Structure**: All export directories exist with proper write permissions
- **End-to-End Testing**: Verified complete file operations workflow with real data

#### Storybook Auto-Start Integration ✅ COMPLETE
- **Backend API**: Added `/api/storybook/start` endpoint to spawn Storybook process
- **Frontend Integration**: Auto-start Storybook during app bootstrap with 3-second delay
- **Embedded Interface**: Storybook runs in iframe within app, not separate window
- **Empty State Handling**: Storybook starts successfully even without generated stories
- **Process Management**: Proper spawning and tracking of Storybook child process

#### Terminal Status Bar CLI Detection ✅ COMPLETE (Previous Session)
- **CLI Detection Logic**: Terminal status bar only appears when using Claude CLI or Codex CLI
- **Environment Variables**: Uses `CLAUDE_CLI_SESSION`, `CODEX_CLI_SESSION`, `ANTHROPIC_CLI_SESSION`
- **Shell Configuration**: Added wrapper functions to bash/zsh configuration files
- **Selective Display**: Prevents status bar from appearing in all terminal sessions
