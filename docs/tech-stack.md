# Opnix Tech Stack

## Stack Tab Interface

- The main navigation now exposes a **Tech Stack** tab (🧰) that renders the latest stack snapshot from `/api/tech-stack`.
- Snapshot cards surface package metadata, dependency counts, module breakdowns, and detected frameworks.
- A module catalogue table lists source, health, coverage, and dependency details for every module.
- Age indicators flag when the snapshot is older than six hours so operators can refresh before relying on it.
- Dependency categories group runtime, tooling, testing, and infrastructure packages so the Stack tab highlights hotspots at a glance.
- Each audit run now produces a tech stack Markdown export that lands under `spec/docs/` and is listed alongside other Docs artefacts.
- CLI insights are split into project vs module context so interview answers stay actionable at a glance.
- Refresh requests re-run the stack summariser, while **Export Markdown** saves a versioned `spec/docs/tech-stack-<timestamp>.md` file and refreshes the Docs tab archives.
- Completing any CLI interview (e.g. `/spec`, `/new-module`, `/new-feature`) now auto-refreshes the tech stack summary so the tab stays aligned with the latest answers.

## Question Context Metadata

- Interview sections now expose a `context` field (`project` or `module`) so stack reporting can differentiate high-level discovery responses from module governance prompts.
- CLI sessions attach the same context to each question, allowing the Stack tab and upcoming exports to filter by scope.
- Foundation questionnaire includes a new `project-status` prompt (new build vs modernization) so tech stack summaries reflect lifecycle context.
- The module interview flow now includes a `module-tech-stack` section that records per-module languages, frameworks, and integration touchpoints.

## Package Management Policy (MANDATORY)

**ALL packages MUST be the latest stable versions as of September 2025.**

### Package Manager
- **pnpm** (MANDATORY for all Node.js dependencies and script execution)
- Ensures consistent package resolution and latest available versions
- Use `pnpm add` for all new dependencies
- Use `pnpm exec` for running tools like Storybook
- Faster installs and better disk space efficiency than npm

---

## Backend Technologies

### Server Framework & Runtime
- **Express.js** v5.1.0 - Main web framework for the REST API server
- **Node.js** - Server runtime environment (ES2024 support configured)
- **CORS** v2.8.5 - Cross-origin resource sharing middleware

### Backend Services & Architecture
- **Custom Service Layer** including:
  - `moduleDetector.js` - Project structure analysis and module detection
  - `specGenerator.js` - Dynamic specification generation
  - `docsGenerator.js` - Documentation generation service
  - `diagramGenerator.js` - Mermaid diagram generation
  - `runtimeBundler.js` - Artifact bundling and management system
  - `scaffolder.js` - Project scaffolding service
  - `interviewLoader.js` - Interactive specification interviews
  - `progressiveQuestionEngine.js` - Adaptive questioning with pattern detection
  - `artifactGenerator.js` - Comprehensive artifact generation (1,700+ lines)
  - `progressiveDocumentSystem.js` - Central orchestration system

### REST API Architecture
- Comprehensive REST API with endpoints for:
  - Ticket management (`/api/tickets`)
  - Feature management (`/api/features`)
  - Module management (`/api/modules`)
  - Canvas operations (`/api/canvas`)
  - Specification generation (`/api/specs`)
  - Export system (`/api/exports`)
  - Claude AI integration (`/api/claude`)
  - **Documentation management** (`/api/docs/browse`, `/api/docs/read`, `/api/docs/save`, `/api/docs/templates`)
  - **Progressive questioning** (`/api/progressive/status`, `/api/progressive/questions/*`, `/api/progressive/generate-package`)
  - **Setup integration** (Progressive system integrated with `scripts/setupWizard.js`)

---

## Frontend Technologies

### Core Frontend Framework
- **Vue.js** v3.3.4 - Main frontend framework (loaded via CDN)
- **Vue Composition API** - Modern Vue development patterns

### Frontend Libraries & Visualization
- **Mermaid.js** v10.6.1 - Diagram rendering and visualization
- **Cytoscape.js** v3.28.1 - Interactive graph visualization for module dependencies
- **Cytoscape EdgeHandles** v4.0.1 - Extension for interactive edge drawing
- **Marked.js** - Markdown parsing and rendering (loaded via CDN)

### UI Framework & Styling
- **Custom CSS Framework** with dual theme system:
  - Mole theme (dark blue/cyan accent)
  - Canyon theme (warm orange/brown accent)
- **CSS Custom Properties** - Extensive theming system
- **CSS Grid & Flexbox** - Modern layout systems
- **Google Fonts** - JetBrains Mono and Share Tech Mono font families
- **Custom CSS Animations** - Pulse, glow, scanline, and slideIn effects

---

## Development Tools & Build System

### Storybook Integration
- **Storybook** v8.6.14 - Component development and documentation
- **@storybook/vue3-vite** v8.6.14 - Vue 3 integration for Storybook
- **@storybook/addon-essentials** v8.6.14 - Core Storybook addons
- **@storybook/addon-interactions** v8.6.14 - Interaction testing
- **@storybook/addon-a11y** v8.6.14 - Accessibility testing
- **@storybook/addon-themes** v8.6.14 - Theme switching
- **@storybook/test** v8.6.14 - Testing utilities

### Build Tools & Bundlers
- **Vite** v6.3.6 - Build tool and development server
- **@vitejs/plugin-vue** v6.0.1 - Vue 3 support for Vite

### Code Quality & Linting
- **ESLint** v9.36.0 - JavaScript and Vue.js linting with custom configuration
- **@eslint/js** v9.36.0 - ESLint JavaScript rules
- **eslint-plugin-vue** v10.5.0 - Vue.js specific linting rules
- **vue-eslint-parser** v10.2.0 - Vue single-file component parser
- **Stylelint** v16.24.0 - CSS/SCSS linting and code quality
- **stylelint-config-standard** v39.0.0 - Standard CSS linting rules
- **stylelint-config-standard-scss** v16.0.0 - Standard SCSS linting rules
- **stylelint-scss** v6.12.1 - SCSS-specific linting rules
- Custom linting rules for Node.js, browser, Vue, and module environments

### Development Utilities
- **Nodemon** v3.1.10 - Development server auto-restart
- **Glob** - File pattern matching for markdown file discovery
- **Path** - Node.js path utilities for file operations
- **FS** - File system operations for document management

---

## Testing Framework

### Custom Testing System
- **Native Node.js testing** - Custom test runners without external frameworks
- Test files:
  - `moduleDetector.test.js` - Module detection testing
  - `featuresStatus.test.js` - Feature status validation
  - `checklistStatus.test.js` - Checklist status testing
  - `specScaffold.test.mjs` - Specification scaffolding tests

### Test Fixtures
- Mock project structures for testing module detection
- Monorepo test fixtures with multiple packages

---

## Data Management & Storage

### File-based Data Storage
- **JSON data files** - Tickets, features, modules, setup state
- **Markdown exports** - Documentation generation
- **Canvas snapshots** - Visual state persistence
- **Spec archives** - Generated specifications and blueprints

### Data Structure
- Organized under `/data/` directory for application data
- `/spec/` directory with categorized artifacts (blueprints, docs, audits, canvas, diagrams)

---

## Specialized Features

### Canvas System
- **Interactive module visualization** using Cytoscape.js
- **Drag-and-drop dependency creation**
- **Multiple layout algorithms** (force, tree, circle)
- **Health status visualization** with color coding

### Progressive Documentation & Specification System
- **Progressive Questions Engine** - Adaptive questioning with pattern detection and phase progression
- **Comprehensive Artifact Generation** - 40+ methods generating project analysis, architecture diagrams, technical specs
- **Documentation Management** - File browser for 73+ markdown files across project directories
- **Template System** - Professional document templates (README, API docs, Architecture, Contributing)
- **Install Workflow Integration** - Progressive system triggers during new/existing project setup
- **Decision Tree Interface** - Tabbed, editable questions system with full CRUD capabilities
- **Multi-format exports** (JSON, Markdown, GitHub spec kit, complete document packages)

### Theme System
- **Dual theme support** (Mole/Canyon)
- **CSS custom properties** for theming
- **Storybook theme synchronization**
- **Persistent theme preferences**

---

## Documentation & Visualization

### Documentation Tools
- **Progressive Documentation System** - Complete file browser, editor, and template system
- **Markdown processing** with custom renderer and live preview
- **Mermaid diagram generation** with custom themes
- **Template-based document creation** - 4 professional templates with customization
- **Cross-project file discovery** - Automatically scans entire project for markdown files
- **Multi-format exports** (Markdown, JSON, HTML, complete document packages)

### Diagram Types
- Architecture diagrams
- Sequence diagrams
- Entity relationship diagrams
- Delivery flow diagrams
- Module dependency graphs

---

## Development Scripts & Automation

### pnpm Scripts
- `start` - Production server
- `dev` - Development server with Nodemon
- `lint` - Combined JavaScript and CSS linting (uses pnpm internally)
- `lint:js` - ESLint JavaScript/Vue code quality checks
- `lint:css` - Stylelint CSS/SCSS code quality checks
- `storybook` - Storybook development server (via pnpm exec)
- `build-storybook` - Storybook production build (via pnpm exec)
- `test:modules` - Test suite execution
- `setup:wizard` - Interactive project setup
- `terminal:install/uninstall/status` - Terminal status bar management
- `claude:*` - Claude AI integration commands

### Setup & Installation
- **Interactive setup wizard** (`setupWizard.js`)
- **CLI installation script** (`installCli.js`)
- **Story generation automation** (`generateStories.js`)

---

## External Integrations

### AI & Automation
- **Claude AI Integration** - Command execution and audit functionality
- **GitHub Integration** (via gh CLI) - Planned for pull requests
- **Runtime bundling system** - Custom artifact management

---

## Version Enforcement & Compliance

- All package installations MUST use pnpm with the latest stable versions available as of September 2025
- Regular audits required to maintain currency
- No legacy or outdated packages permitted in production builds
- ESLint + Stylelint enforce code quality standards across all JavaScript/Vue/CSS files
- pnpm MANDATORY for all dependency management and script execution

## Future Additions
- Python projects: **Ruff** for Python linting (when Python files are present)
- Additional tooling to be evaluated against September 2025 standards

---

**This policy is MANDATORY for all development work. All contributors must ensure package versions meet these requirements before committing code.**