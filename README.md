# Opnix — Operational Toolkit

A comprehensive visual command center for auditing, managing, and visualizing software projects. Opnix combines a modern Vue 3 interface with an Express backend to deliver real-time project insights, automated audits, and intelligent workflow automation.

## ✨ Key Features

### 🚀 Automated Project Management
- **Intelligent Setup Wizard** — Adaptive installation that detects project type and guides configuration
- **Module Detection** — Automatic discovery and mapping of project dependencies and architecture
- **CLI Interview System** — Progressive questionnaires for specs, features, bugs, and runbooks
- **Automated Audits** — Comprehensive project analysis with exportable reports

### 📊 Visual Interfaces
- **Interactive Module Canvas** — Cytoscape-powered dependency visualization with drag-and-drop editing
- **Roadmap Management** — Plan and track features with detailed/minimal views and version history
- **Tech Stack Dashboard** — Real-time technology inventory and dependency tracking
- **Diagram Generation** — Mermaid-based architecture, sequence, and flow diagrams

### 🎯 Development Workflows
- **Ticket Management** — Complete CRUD operations with filtering, tagging, and completion tracking
- **Bug Workflow Enforcement** — Structured bug lifecycle with validation and automation
- **Feature Planning** — Acceptance criteria, module mapping, and priority management
- **Session Recovery** — Checkpoint-based recovery system for interrupted workflows

### 🔧 Developer Tools
- **Terminal Integration** — Built-in xterm.js terminal with WebSocket support
- **Storybook Integration** — Component library with auto-generated stories
- **E2E Testing** — Playwright-based end-to-end test suite
- **API Documentation** — OpenAPI-compliant specs with auto-generation

### 🎨 User Experience
- **MOLE Theme** — High-contrast, neurodivergent-friendly color palette
- **Responsive Design** — Optimized for all screen sizes
- **Progressive Disclosure** — Chunked information architecture
- **Accessibility** — WCAG AA/AAA compliant with screen reader support

## 📋 Prerequisites

- **Node.js** ≥ 18
- **pnpm** ≥ 8 (required for all package operations)
- **Git** (for repository management)
- **Platform**: macOS, Linux, or Windows (WSL recommended)

## 🚀 Quick Start

### Automated Installation

Clone and install with automated setup:

```bash
# Clone repository
git clone https://github.com/Kindjhali/Opnix.git
cd opnix

# Install and setup (runs postinstall automation)
pnpm install

# Start the server
pnpm start
```

The `pnpm install` command automatically:
- Installs all dependencies
- Creates required directories (data/, spec/, .opnix/)
- Builds the production bundle
- Runs the interactive setup wizard

Open http://localhost:7337 in your browser.

### Manual Installation

For development or granular control:

```bash
# Clone repository
git clone https://github.com/Kindjhali/Opnix.git
cd opnix

# Install dependencies only (skip automation)
pnpm install --ignore-scripts

# Run setup manually
pnpm run setup:install

# Build production bundle
pnpm build

# Start server
pnpm start
```

## 📁 Project Structure

```
opnix/
├── data/                    # Runtime data and state
│   ├── tickets.json        # Ticket backlog
│   ├── features.json       # Feature catalog
│   ├── modules-detected.json # Module detection cache
│   ├── roadmap-state.json  # Roadmap data
│   ├── checkpoints/        # Recovery checkpoints
│   └── cli-sessions/       # CLI interview sessions
├── docs/                    # Documentation
├── routes/                  # Express API routes
├── scripts/                 # CLI tools and automation
├── services/                # Backend business logic
├── src/                     # Vue 3 frontend
│   ├── components/         # UI components (38 total)
│   ├── composables/        # Vue composition functions
│   ├── blocs/              # State management
│   └── services/           # Frontend API clients
├── spec/                    # Generated specifications
├── tests/                   # Test suites
└── public/                  # Static assets
```

## 🎮 Command Reference

### Server Commands

```bash
# Start production server
pnpm start

# Development mode (with auto-reload)
pnpm dev

# Build for production
pnpm build
```

### Setup Commands

```bash
# Run interactive setup wizard
pnpm run setup:wizard

# Manual installer (directories, agent files)
pnpm run setup:install
```

### Bug Workflow

```bash
# Start bug workflow
pnpm bug:start

# Mark bug complete
pnpm bug:complete

# Pause/resume bug workflow
pnpm bug:pause
pnpm bug:resume

# Check workflow status
pnpm bug:status
pnpm bug:active
pnpm bug:validate
```

### Terminal Integration

```bash
# Install terminal status bar
pnpm terminal:install

# Uninstall terminal status bar
pnpm terminal:uninstall

# Check terminal status
pnpm terminal:status
```

### Progress Tracking

```bash
# Show progress dashboard
pnpm progress

# Display summary
pnpm progress:summary

# Show help
pnpm progress:help
```

### Testing

```bash
# Run all module tests
pnpm test:modules

# E2E tests
pnpm test:e2e
pnpm test:e2e:ui        # Interactive mode
pnpm test:e2e:headed    # Headed browser mode
pnpm test:e2e:debug     # Debug mode
pnpm test:e2e:report    # Show test report
```

### Development Tools

```bash
# Linting
pnpm lint               # Lint JS and CSS
pnpm lint:js           # Lint JavaScript only
pnpm lint:css          # Lint CSS only

# Storybook
pnpm storybook          # Start Storybook dev server (port 6006)
pnpm storybook:generate # Generate component stories
pnpm build-storybook    # Build static Storybook
```

### API Commands

```bash
# Get next Claude task
pnpm claude:next

# Export tickets to Markdown
pnpm claude:export
```

## 🌐 API Endpoints

### Core APIs

- `GET /api/tickets` — List all tickets
- `POST /api/tickets` — Create ticket
- `PUT /api/tickets/:id` — Update ticket
- `DELETE /api/tickets/:id` — Delete ticket
- `GET /api/modules/graph` — Module dependency graph
- `GET /api/modules/detect` — Run module detection
- `POST /api/canvas/export` — Export canvas as image

### CLI Interview Endpoints

- `POST /api/claude/execute` — Execute slash commands
- `GET /api/cli/sessions` — List CLI sessions
- `GET /api/cli/sessions/:id` — Get session details
- `POST /api/specs/export/scoped` — Export scoped specs
- `POST /api/runbooks/constitution` — Generate governance digest

### Roadmap APIs

- `GET /api/roadmap` — Get roadmap state
- `POST /api/roadmap/milestone` — Create milestone
- `POST /api/roadmap/rollback/:version` — Rollback to version
- `GET /api/roadmap/history` — Get version history

### System APIs

- `GET /api/diagrams/:type` — Generate diagram (architecture, sequence, flow)
- `GET /api/tech-stack` — Technology inventory
- `POST /api/context/update` — Update context state
- `GET /api/progress` — Progress dashboard data

## 🎨 UI Components

### Main Tabs

- **Canvas** — Module visualization with Cytoscape
- **Modules** — Module management and editing
- **Tickets** — Ticket board with filtering
- **Features** — Feature planning and tracking
- **Roadmap** — Timeline and milestone management
- **Specs** — Specification browser
- **Diagrams** — Architecture diagrams
- **Docs** — Documentation viewer
- **API** — API explorer
- **Tech Stack** — Technology dashboard
- **Terminal** — Integrated terminal
- **Storybook** — Component library

### Modal Components

- Ticket Completion Modal
- Feature Modal
- Bug Modal
- Runbook Modal
- Add Module Modal

## 🔄 CLI Interview System

Interactive command-line questionnaires for structured project documentation:

### Available Commands

| Command | Purpose | Output |
|---------|---------|--------|
| `/spec` | Full specification interview | Spec JSON/Markdown/Spec Kit |
| `/new-feature` | Feature intake | Feature record + tickets |
| `/new-module` | Module onboarding | Module stub + diagram |
| `/new-bug` | Bug/incident intake | Ticket + checklists |
| `/new-diagram` | Diagram briefing | Mermaid source |
| `/new-api` | API specification | OpenAPI draft |
| `/runbook` | Operational playbook | Markdown runbook |
| `/plan` | Delivery plan | Plan Markdown |
| `/tasks` | Task queue snapshot | Task summary |
| `/constitution` | Governance digest | Guidance Markdown |
| `/specify` | Scoped spec export | Filtered spec output |

### Usage Example

```bash
# Start specification interview
curl -X POST http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/spec"}'

# Answer question
curl -X POST http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/answer <session-id> <question-id> <your-answer>"}'
```

## 🗄️ Data Storage

All state is persisted to JSON files in the `data/` directory:

- `tickets.json` — Ticket backlog
- `features.json` — Feature catalog
- `modules-detected.json` — Module detection cache
- `module-links.json` — Manual canvas edges
- `roadmap-state.json` — Roadmap data
- `bug-workflow-state.json` — Bug workflow state
- `setup-state.json` — Installation configuration
- `tech-stack.json` — Technology inventory
- `cli-gating-log.json` — Alignment gate events
- `terminal-history.json` — Terminal command history

### Generated Artifacts

Specifications and exports are saved to `spec/`:

- `spec/blueprints/` — Spec JSON and Markdown
- `spec/runbooks/` — Generated runbooks
- `spec/cli-sessions/` — Interview transcripts
- `spec/canvas/` — Canvas snapshots
- `spec/docs/` — Documentation exports

## 🧪 Testing

### Test Suites

- **Unit Tests** — Module-level testing (19 test files)
- **Integration Tests** — API workflow testing
- **E2E Tests** — Playwright end-to-end tests
- **Component Tests** — Storybook visual testing

### Run Tests

```bash
# All module tests
pnpm test:modules

# E2E tests
pnpm test:e2e

# Specific test
node tests/roadmapStatusTransitions.test.mjs
```

## 🎨 Theming

Opnix uses the MOLE color palette optimized for accessibility:

- **Primary**: #E94560 (Neon Pink)
- **Accent 1**: #1FB6FF (Electric Blue)
- **Accent 2**: #06B6D4 (Cyan)
- **Warning**: #FF8C3B (Orange)
- **Success**: #10B981 (Green)
- **Danger**: #DC2626 (Red)

Theme variables are defined in CSS custom properties and support both light and dark modes.

## 🛠️ Development

### Prerequisites for Development

```bash
# Install dependencies
pnpm install --ignore-scripts

# Setup development environment
pnpm run setup:wizard

# Start development server
pnpm dev
```

### Code Quality

```bash
# Run linters
pnpm lint

# Auto-fix issues
pnpm lint:js --fix
pnpm lint:css --fix
```

### Git Hooks

Husky pre-commit hooks enforce:
- ESLint validation
- Stylelint validation
- Automatic code formatting

## 📝 Documentation

- `docs/spec.md` — Project specification
- `docs/cli-command-workflows.md` — CLI interview system
- `docs/tech-stack.md` — Technology documentation
- `docs/storybook.md` — Component library guide
- `docs/e2e-testing.md` — E2E testing guide
- `docs/narrative.md` — Project narrative

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`pnpm test:modules`)
5. Commit changes (`git commit -m 'Add amazing feature'`)
6. Push to branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📄 License

This project is licensed under the MIT License.

## 🔗 Links

- **Repository**: https://github.com/Kindjhali/Opnix
- **Issues**: https://github.com/Kindjhali/Opnix/issues
- **Discussions**: https://github.com/Kindjhali/Opnix/discussions

## 💡 Tips

### First-Time Setup

1. Run `pnpm install` to trigger automated setup
2. Follow the setup wizard prompts
3. Access the UI at http://localhost:7337
4. Explore the Canvas tab for module visualization
5. Use `/spec` command to create project documentation

### Common Workflows

**Creating a Feature:**
1. Use Features tab or `/new-feature` command
2. Define acceptance criteria
3. Link to modules
4. Set priority and tags
5. Generate tickets automatically

**Running an Audit:**
1. Use setup wizard or CLI
2. Review generated specs in Specs tab
3. Export Markdown documentation
4. Update roadmap with findings

**Managing Bugs:**
1. Start with `pnpm bug:start`
2. Use `/new-bug` for structured intake
3. Track in Tickets board
4. Complete with `pnpm bug:complete`

## 🆘 Troubleshooting

### Installation Issues

**Problem**: Postinstall fails
```bash
# Solution: Run manual installation
pnpm install --ignore-scripts
pnpm run setup:install
pnpm build
```

**Problem**: Port 7337 already in use
```bash
# Solution: Change port in server.js or kill existing process
lsof -ti:7337 | xargs kill
```

### Runtime Issues

**Problem**: Module detection fails
```bash
# Solution: Clear cache and re-detect
rm data/modules-detected.json
curl http://localhost:7337/api/modules/detect
```

**Problem**: Terminal not connecting
```bash
# Solution: Restart server and check WebSocket
pnpm start
# Check browser console for WebSocket errors
```

## 🚀 What's Next

- GraphQL API integration
- Real-time collaboration features
- Enhanced AI-powered code analysis
- Cloud deployment templates
- Mobile responsive improvements
- Advanced reporting and analytics

---

**Built with ❤️ using Vue 3, Express, Cytoscape, and modern web technologies.**
