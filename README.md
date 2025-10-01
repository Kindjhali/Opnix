```
   ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄    ▄ ▄▄▄ ▄▄   ▄▄
  █       █       █  █  █ █   █  █ █  █
  █   ▄   █    ▄  █   █▄█ █   █  █▄█  █
  █  █ █  █   █▄█ █       █   █       █
  █  █▄█  █    ▄▄▄█  ▄    █   █       █
  █       █   █   █ █ █   █   █ ██▄██ █
  █▄▄▄▄▄▄▄█▄▄▄█   █▄█  █▄▄█▄▄▄█▄█   █▄█

  Operational Toolkit · Visual Canvas · Audit Engine
```

<div align="center">

[![MOLE Theme](https://img.shields.io/badge/Theme-MOLE-E94560?style=for-the-badge)](https://github.com/Kindjhali/Opnix)
[![License](https://img.shields.io/badge/License-MIT-1FB6FF?style=for-the-badge)](LICENSE)
[![Node](https://img.shields.io/badge/Node-%E2%89%A518-06B6D4?style=for-the-badge)](https://nodejs.org)
[![Vue](https://img.shields.io/badge/Vue-3-FF8C3B?style=for-the-badge)](https://vuejs.org)

**A visual command center for understanding, managing, and documenting software projects.**

Opnix combines intelligent project analysis with interactive visualizations to help teams maintain clarity across complex codebases.

[Installation](#installation) · [Features](#core-features) · [Workflows](#common-workflows) · [Documentation](#links)

</div>

---

## 🎯 What is Opnix?

<table>
<tr>
<td width="50%">

### 🗺️ Visual Architecture Maps
Interactive dependency graphs showing how your modules connect

### 📚 Automated Documentation
Generate specs, runbooks, and technical docs from your code

### 🎯 Intelligent Project Management
Track features, tickets, and roadmaps with smart automation

</td>
<td width="50%">

### 💻 CLI-Driven Workflows
Progressive questionnaires that guide you through specs, bugs, and features

### 📊 Real-Time Insights
Live tech stack analysis, module health, and architecture diagrams

### 🎨 MOLE Theme
High-contrast colors optimized for accessibility

</td>
</tr>
</table>

## 🚀 Why Use Opnix?

<table>
<tr>
<td width="33%">

### 👤 Solo Developers
✨ Maintain clarity on growing projects
🔗 Visualize dependencies
📝 Generate professional specs automatically

</td>
<td width="33%">

### 👥 Teams
🎓 Onboard with auto-generated diagrams
📖 Keep docs in sync with code
🎯 Track features and tech debt

</td>
<td width="33%">

### 📊 Project Managers
👁️ Real-time project visibility
🗓️ Automated roadmap generation
📤 Export-ready documentation

</td>
</tr>
</table>

## ⚡ Installation

### Install into Your Project

```bash
# Navigate to your project
cd your-project

# Install Opnix
pnpm add opnix

# Or use npx to run without installing
npx opnix
```

**🌐 Open http://localhost:7337**

> Opnix automatically:
> - Detects your project structure
> - Creates required directories (data/, spec/, .opnix/)
> - Builds the production bundle
> - Runs the setup wizard
> - Starts the server

### For Opnix Development

```bash
# Clone the Opnix repository
git clone https://github.com/Kindjhali/Opnix.git
cd opnix

# Install dependencies
pnpm install

# Start development server
pnpm dev
```

## Core Features

### 1. Visual Module Canvas

**What it does:** Automatically detects and visualizes your project's module architecture using Cytoscape.

**Key capabilities:**
- Drag-and-drop dependency editing
- Real-time module health indicators
- Export as PNG or JSON
- Manual override support for custom connections

**Use case:** You're refactoring a monolith. The canvas shows you exactly which modules depend on the one you're changing, preventing accidental breaks.

**Access:** Canvas tab in the UI or `GET /api/modules/graph`

### 2. Smart Module Detection

**What it does:** Scans your codebase to identify modules, analyze dependencies, and assess health metrics.

**Detects:**
- Package manifests (package.json, requirements.txt, etc.)
- Import/export patterns
- Directory structure and aliases
- Circular dependencies and coupling issues

**Use case:** After adding a new service, run detection to see how it fits into your existing architecture and catch any problematic dependencies early.

**Access:** Auto-runs on startup or trigger with `GET /api/modules/detect`

### 3. CLI Interview System

**What it does:** Interactive command-line questionnaires that guide you through creating structured documentation.

**Available interviews:**
- `/spec` — Full project specification
- `/new-feature` — Feature planning with acceptance criteria
- `/new-module` — Module onboarding and documentation
- `/new-bug` — Structured bug intake
- `/runbook` — Operational playbooks for deployment/incidents
- `/new-api` — API endpoint specifications

**Use case:** A stakeholder requests a new feature. Run `/new-feature`, answer guided questions, and automatically generate tickets, acceptance criteria, and module mappings.

**Example:**
```bash
curl -X POST http://localhost:7337/api/claude/execute \
  -H 'Content-Type: application/json' \
  -d '{"command":"/new-feature"}'
```

### 4. Automated Specification Generation

**What it does:** Analyzes your codebase and generates comprehensive technical specifications.

**Outputs:**
- JSON spec with complete project metadata
- Markdown documentation ready for GitHub
- Spec Kit format for standardized docs
- Architecture diagrams in Mermaid format

**Use case:** Your team needs updated documentation for a quarterly review. Run the spec generator and export professional docs in minutes instead of days.

**Access:** Setup wizard or Specs tab

### 5. Roadmap Management

**What it does:** Plan features, track milestones, and visualize project timelines.

**Features:**
- Drag-and-drop milestone organization
- Automatic version history with rollback
- Dependency tracking between features
- Export to Markdown or JSON

**Use case:** Planning a v2.0 release. Create milestones for each major feature, link dependencies, and export a timeline for your team.

**Access:** Roadmap tab or `GET /api/roadmap`

### 6. Ticket & Feature Tracking

**What it does:** Complete project management with smart automation.

**Capabilities:**
- Create tickets from feature definitions
- Filter by priority, status, tags
- Completion workflows with validation
- Export to Markdown for reporting

**Use case:** During sprint planning, create a feature with acceptance criteria. Opnix automatically generates individual tickets for each criterion.

**Access:** Tickets tab or `/api/tickets` endpoints

### 7. Tech Stack Dashboard

**What it does:** Real-time inventory of all technologies used in your project.

**Tracks:**
- Dependencies and versions
- Framework usage across modules
- Technology categories and trends
- Potential security or compatibility issues

**Use case:** Auditing dependencies before a major upgrade. See exactly which modules use the outdated library and plan your migration strategy.

**Access:** Tech Stack tab or `GET /api/tech-stack`

### 8. Live Architecture Diagrams

**What it does:** Auto-generates Mermaid diagrams from your codebase structure.

**Diagram types:**
- Architecture overview (module relationships)
- Sequence diagrams (API flows)
- Entity diagrams (data models)
- Flow diagrams (business logic)

**Use case:** Explaining system architecture to a new team member. Generate an up-to-date diagram that shows actual current structure, not outdated documentation.

**Access:** Diagrams tab or `GET /api/diagrams/:type`

### 9. Integrated Terminal

**What it does:** Built-in terminal with WebSocket support for running commands directly in the UI.

**Features:**
- Full terminal emulation with xterm.js
- Command history and persistence
- Theme integration matching UI
- Real-time command output

**Use case:** Running build commands or git operations without leaving the Opnix interface.

**Access:** Terminal tab

### 10. Runbook Generator

**What it does:** Creates operational playbooks for deployment, incidents, and maintenance.

**Templates include:**
- Deployment procedures
- Incident response guides
- Release checklists
- Compliance documentation

**Use case:** Creating a runbook for your on-call rotation. Answer structured questions and generate a complete incident response guide.

**Access:** `/runbook` CLI command or Runbook modal

## Common Workflows

### Starting a New Project

1. **Install Opnix** in your project directory
2. **Run the setup wizard** — Answer questions about your project
3. **Review the Canvas** — See your initial architecture
4. **Generate baseline docs** — Export specs and diagrams
5. **Set up roadmap** — Plan your first features

### Managing an Existing Project

1. **Run module detection** — Get current architecture state
2. **Create features** — Use `/new-feature` for new work
3. **Track in roadmap** — Organize by milestone
4. **Generate tickets** — Auto-create from acceptance criteria
5. **Export documentation** — Keep stakeholders informed

### Onboarding New Team Members

1. **Export architecture diagram** — Show system overview
2. **Share auto-generated specs** — Up-to-date technical docs
3. **Provide module canvas** — Interactive exploration
4. **Generate runbooks** — Operational procedures

### Refactoring & Technical Debt

1. **Visualize dependencies** — See what's coupled
2. **Identify problem modules** — Health indicators
3. **Plan refactoring** — Create features with clear criteria
4. **Track progress** — Use roadmap milestones
5. **Document changes** — Auto-update specs

## Quick Reference

### Essential Commands

```bash
# Start the server
pnpm start

# Run setup wizard
pnpm run setup:wizard

# Development mode with auto-reload
pnpm dev

# Build production bundle
pnpm build
```

### Key API Endpoints

| Endpoint | Purpose |
|----------|---------|
| `POST /api/claude/execute` | Run CLI commands |
| `GET /api/modules/graph` | Get module dependencies |
| `GET /api/roadmap` | Fetch roadmap data |
| `GET /api/tickets` | List all tickets |
| `GET /api/diagrams/architecture` | Generate architecture diagram |
| `GET /api/tech-stack` | Get technology inventory |

### CLI Commands

| Command | What it does |
|---------|--------------|
| `/spec` | Generate full project specification |
| `/new-feature` | Create feature with acceptance criteria |
| `/new-module` | Document a new module |
| `/new-bug` | Structured bug intake |
| `/runbook` | Generate operational runbook |
| `/new-api` | Specify API endpoints |

## Project Structure

```
opnix/
├── src/                    # Vue 3 frontend
│   ├── components/         # 38 UI components
│   ├── composables/        # Reactive state management
│   └── services/           # API clients
├── routes/                 # Express API routes
├── services/               # Backend logic
├── scripts/                # CLI tools & automation
├── data/                   # JSON state storage
│   ├── tickets.json
│   ├── features.json
│   ├── roadmap-state.json
│   └── modules-detected.json
└── spec/                   # Generated documentation
    ├── blueprints/
    ├── runbooks/
    └── diagrams/
```

## Data Storage

Opnix stores all state as JSON files in the `data/` directory:

- **tickets.json** — Task backlog and completion tracking
- **features.json** — Feature definitions with acceptance criteria
- **roadmap-state.json** — Milestones and timeline data
- **modules-detected.json** — Cached module analysis
- **tech-stack.json** — Technology inventory
- **module-links.json** — Manual dependency overrides

Generated documentation lives in `spec/`:

- **spec/blueprints/** — Auto-generated specifications
- **spec/runbooks/** — Operational playbooks
- **spec/diagrams/** — Mermaid architecture diagrams

## UI Overview

### Main Interface Tabs

- **Canvas** — Interactive module visualization
- **Modules** — Module management and health metrics
- **Tickets** — Task board with filtering
- **Features** — Feature planning with criteria
- **Roadmap** — Timeline and milestone tracking
- **Specs** — Generated documentation browser
- **Diagrams** — Architecture visualization
- **Tech Stack** — Technology inventory
- **Terminal** — Integrated command line
- **Docs** — Documentation viewer
- **API** — API endpoint explorer

### Modal Workflows

- **Ticket Completion** — Capture work summaries before closing
- **Feature Creation** — Guided feature definition
- **Bug Intake** — Structured bug reporting
- **Runbook Generation** — Operational playbook creation
- **Module Addition** — New module onboarding

## Configuration

### Setup Wizard

The interactive wizard configures:
- Project type detection (greenfield vs existing)
- Technology stack identification
- Initial module scanning
- Documentation preferences
- Agent file generation (CLAUDE.md, etc.)

### Manual Configuration

Skip automation with:
```bash
pnpm install --ignore-scripts
pnpm run setup:install  # Manual setup
pnpm build              # Build bundle
pnpm start              # Start server
```

## Exporting & Integration

### Export Formats

- **Markdown** — GitHub-ready documentation
- **JSON** — Structured data for tooling
- **PNG/SVG** — Visual diagrams and canvases
- **Spec Kit** — Standardized specification format

### Integration Points

- **Git Hooks** — Husky integration for quality checks
- **CI/CD** — Automated spec generation on builds
- **Storybook** — Component documentation (port 6006)
- **APIs** — REST endpoints for external tools

## Use Case Examples

### Example 1: Microservices Migration
*"We're breaking up our monolith into microservices"*

1. Use Canvas to visualize current dependencies
2. Identify clean separation boundaries
3. Create features for each new service
4. Track migration progress in Roadmap
5. Generate architecture diagrams for documentation

### Example 2: Compliance Documentation
*"We need SOC2 documentation"*

1. Run `/runbook` for compliance templates
2. Generate tech stack inventory
3. Export architecture diagrams
4. Create operational runbooks
5. Maintain version history for audit trail

### Example 3: Developer Onboarding
*"New team member starts Monday"*

1. Export current architecture diagram
2. Generate up-to-date specification
3. Provide module canvas for exploration
4. Share feature roadmap
5. Link to auto-generated runbooks

### Example 4: Technical Debt Planning
*"We need to tackle accumulated debt"*

1. Module detection identifies problem areas
2. Create features for refactoring work
3. Map dependencies to avoid breaks
4. Track progress with tickets
5. Update documentation automatically

## Advanced Features

### Bug Workflow Enforcement

Structured bug lifecycle with commands:
- `pnpm bug:start` — Begin bug workflow
- `pnpm bug:complete` — Finish with validation
- `pnpm bug:status` — Check current state

### Session Recovery

Checkpoint-based recovery for interrupted work:
- Automatic state snapshots
- Rollback to previous versions
- Resume from last checkpoint

### Progress Tracking

Monitor project health:
- `pnpm progress` — Dashboard view
- `pnpm progress:summary` — Quick overview
- Real-time metrics and KPIs

## Requirements

- Node.js ≥ 18
- pnpm ≥ 8
- Modern browser (Chrome, Firefox, Safari, Edge)
- 500MB disk space for dependencies

## Links

- **Repository**: https://github.com/Kindjhali/Opnix
- **Issues**: https://github.com/Kindjhali/Opnix/issues
- **Discussions**: https://github.com/Kindjhali/Opnix/discussions

## License

MIT License - see LICENSE file for details

---

<div align="center">

### 🎨 MOLE Color Palette

<table>
<tr>
<td align="center" bgcolor="#E94560" style="color: white;"><b>Primary</b><br>#E94560</td>
<td align="center" bgcolor="#1FB6FF" style="color: white;"><b>Accent 1</b><br>#1FB6FF</td>
<td align="center" bgcolor="#06B6D4" style="color: white;"><b>Accent 2</b><br>#06B6D4</td>
<td align="center" bgcolor="#FF8C3B" style="color: white;"><b>Warning</b><br>#FF8C3B</td>
<td align="center" bgcolor="#10B981" style="color: white;"><b>Success</b><br>#10B981</td>
</tr>
</table>

**Opnix** — Transform your codebase into clear, maintainable documentation and visual insights.

*Built with ❤️ using Vue 3, Express, Cytoscape, and modern web technologies.*

</div>
