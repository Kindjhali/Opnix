#!/usr/bin/env node
/*
 * Opnix Setup Wizard
 * Guides installation-time decision tree between new project discovery and existing repo audit flows.
 */

const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');
const moduleDetector = require('../services/moduleDetector');
const interviewLoader = require('../services/interviewLoader');
const server = require('../server');
const scaffolder = require('../services/scaffolder');
const { ProgressiveDocumentSystem } = require('../services/progressiveDocumentSystem');

const ROOT_DIR = path.join(__dirname, '..');
const SPEC_DIR = server.EXPORTS_DIR || path.join(ROOT_DIR, 'spec');
const SPEC_SUBDIRS = server.EXPORT_SUBDIRS || {
    blueprints: path.join(SPEC_DIR, 'blueprints'),
    docs: path.join(SPEC_DIR, 'docs'),
    revision: path.join(SPEC_DIR, 'revision'),
    audits: path.join(SPEC_DIR, 'audits'),
    canvas: path.join(SPEC_DIR, 'canvas')
};

function parseCliOptions(argv) {
    const options = {
        mode: null,
        nonInteractive: false
    };

    for (let index = 0; index < argv.length; index += 1) {
        const arg = argv[index];

        if (!arg) continue;
        if (arg === '--non-interactive' || arg === '--noninteractive' || arg === '--ci') {
            options.nonInteractive = true;
            continue;
        }

        if (arg === '--mode' && typeof argv[index + 1] === 'string') {
            options.mode = argv[index + 1];
            index += 1;
            continue;
        }

        if (arg.startsWith('--mode=')) {
            options.mode = arg.split('=')[1];
            continue;
        }
    }

    if (typeof options.mode === 'string') {
        const normalised = options.mode.trim().toLowerCase();
        if (normalised === 'new' || normalised === 'existing') {
            options.mode = normalised;
        } else {
            console.warn(`Ignoring unsupported mode "${options.mode}" (expected "new" or "existing").`);
            options.mode = null;
        }
    } else {
        options.mode = null;
    }

    return options;
}

async function loadSetupState() {
    if (typeof server.readSetupState === 'function') {
        return server.readSetupState().catch(() => ({}));
    }
    return {};
}

async function persistSetupState(nextState) {
    if (typeof server.writeSetupState === 'function') {
        await server.writeSetupState(nextState);
    }
}

async function collectContext() {
    await server.initDataFile();
    if (typeof server.ensureExportStructure === 'function') {
        await server.ensureExportStructure();
    } else {
        await server.ensureDirectory(SPEC_DIR);
        await Promise.all(Object.values(SPEC_SUBDIRS).map(dir => server.ensureDirectory(dir)));
    }

    const [modulesResult, ticketData, features, packageJson] = await Promise.all([
        moduleDetector.detectModules(ROOT_DIR),
        server.readData().catch(() => ({ tickets: [], nextId: 1 })),
        server.readFeaturesFile().catch(() => []),
        server.loadPackageJson().catch(() => null)
    ]);

    return {
        modulesResult,
        ticketData,
        features: Array.isArray(features) ? features : [],
        packageJson: packageJson || {}
    };
}

function inferDefaultMode({ modulesResult, ticketData, features, packageJson }) {
    const hasModules = Array.isArray(modulesResult?.modules) && modulesResult.modules.length > 0;
    const hasTickets = Array.isArray(ticketData?.tickets) && ticketData.tickets.length > 0;
    const hasFeatures = Array.isArray(features) && features.length > 0;
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});
    const hasDependencies = deps.length > 0 || devDeps.length > 0;
    return hasModules || hasTickets || hasFeatures || hasDependencies ? 'existing' : 'new';
}

function formatSummary(context) {
    const moduleCount = context.modulesResult?.modules?.length || 0;
    const dependencyCount = context.modulesResult?.summary?.dependencyCount || 0;
    const ticketCount = context.ticketData?.tickets?.length || 0;
    const featureCount = context.features?.length || 0;
    const deps = Object.keys(context.packageJson?.dependencies || {});
    const devDeps = Object.keys(context.packageJson?.devDependencies || {});
    return [
        `Modules detected: ${moduleCount} (dependencies: ${dependencyCount})`,
        `Tickets loaded: ${ticketCount}`,
        `Features captured: ${featureCount}`,
        `package.json dependencies: ${deps.length} prod / ${devDeps.length} dev`
    ].join('\n');
}

function printSummary(context, state, currentMode) {
    if (!process.stdin.isTTY) {
        return;
    }
    console.log('────────────────────────────────────────');
    console.log('Opnix Installation Decision Tree');
    console.log('────────────────────────────────────────');
    console.log(formatSummary(context));
    console.log(`\nCurrent selection: ${currentMode === 'new' ? 'New project discovery' : 'Existing repo audit'}`);
    if (state?.history?.length) {
        const latest = state.history[0];
        console.log(`Last run: ${latest.mode} (${latest.timestamp}) → ${latest.output || 'n/a'}`);
    }
    console.log('\nActions:');
    console.log('  [1] Choose new project discovery');
    console.log('  [2] Choose existing repository audit');
    console.log('  [c] Continue with current selection');
    console.log('  [v] View run history');
    console.log('  [q] Quit');
}

function printHistory(state) {
    const entries = state?.history || [];
    if (entries.length === 0) {
        console.log('\n[Opnix Setup] No previous runs recorded.');
        return;
    }
    console.log('\nPrevious runs (newest first):');
    entries.slice(0, 5).forEach((entry, index) => {
        console.log(`  ${index + 1}. ${entry.timestamp} — ${entry.mode} → ${entry.output || 'n/a'}`);
    });
    console.log('');
}

async function promptForMode(defaultMode, context, state, options) {
    if (options?.mode) {
        console.log(`[Opnix Setup] Mode forced via CLI flag: ${options.mode === 'new' ? 'new project discovery' : 'existing repo audit'}.`);
        return options.mode;
    }

    if (options?.nonInteractive || !process.stdin.isTTY) {
        const mode = state?.lastSelectedMode || defaultMode;
        console.log(`[Opnix Setup] Non-interactive terminal detected; defaulting to ${mode === 'new' ? 'new project discovery' : 'existing repo audit'} flow.`);
        return mode;
    }

    let currentMode = state?.lastSelectedMode || defaultMode;

    while (true) {
        printSummary(context, state, currentMode);

        const answer = await new Promise(resolve => {
            const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
            rl.question('Select option: ', input => {
                rl.close();
                resolve(input.trim().toLowerCase());
            });
        });

        if (answer === '1' || answer === 'new') {
            currentMode = 'new';
            continue;
        }
        if (answer === '2' || answer === 'existing') {
            currentMode = 'existing';
            continue;
        }
        if (answer === 'v') {
            printHistory(state);
            continue;
        }
        if (answer === 'q' || answer === 'quit' || answer === 'exit') {
            console.log('[Opnix Setup] Exiting without running.');
            process.exit(0);
        }
        if (answer === 'c' || answer === '') {
            return currentMode;
        }

        console.log('[Opnix Setup] Unrecognised option. Please choose again.');
    }
}

function buildDecisionTreeMermaid() {
    return `flowchart TD\n  Install[[Install Opnix]] --> Decision{Workspace type?}\n  Decision -->|New project| Scope[Scope discovery tree]\n  Decision -->|Existing repository| Audit[Automated audit]\n  Scope --> Questionnaire[Interview blueprint rollout]\n  Scope --> Docs[Generate scope docs in spec/]\n  Audit --> RunSetup[Run claude$ setup / API audit]\n  Audit --> Archive[Inspect spec/ artefacts]\n`;
}

function extractSectionHighlights(questionnaire) {
    return questionnaire.slice(0, 8).map(section => {
        const count = Array.isArray(section.questions) ? section.questions.length : 0;
        return `- **${section.title}** (${count} questions)`;
    });
}

function recordHistory(state, entry) {
    const nextHistory = Array.isArray(state?.history) ? [entry, ...state.history] : [entry];
    return {
        ...state,
        lastSelectedMode: entry.mode,
        history: nextHistory.slice(0, 20)
    };
}

async function handleNewProject(context) {
    const questionnaire = await interviewLoader.getNewProjectQuestionnaire();
    const sectionsHighlight = extractSectionHighlights(questionnaire);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-new-project-scope-${timestamp}.md`;
    const filePath = path.join(SPEC_SUBDIRS.revision, filename);

    const content = `# Opnix Installation Decision Tree — New Project Path\n\n## Decision Tree\n\n\`\`\`mermaid\n${buildDecisionTreeMermaid()}\`\`\`\n\n## Why you landed here\n- No significant modules, tickets, or dependencies were detected, so Opnix assumes a greenfield project.\n- The interview blueprint will drive scope capture before any code is written.\n\n## Immediate Actions\n1. Run \`node server.js\` and open http://localhost:7337.\n2. Launch the Spec Builder tab and walk through the staged interview.\n3. Use the Playbook pane to capture stakeholder answers.\n4. Review the Spec Archive panel to download generated artefacts.\n\n## Blueprint Highlights\n${sectionsHighlight.join('\n')}\n\nFull blueprint: \`public/data/interview-sections.json\` and \`docs/interview-playbook.md\`.\n\n## Next Steps\n- Share the generated spec kit with stakeholders for validation.\n- Iterate through follow-up questions flagged in the Playbook.\n- Once modules/tickets exist, re-run this wizard to switch to the audit flow.\n`;

    await fs.writeFile(filePath, content, 'utf8');

    // Initialize progressive document system for new project
    console.log('[Opnix Setup] Initializing progressive document system...');
    try {
        const progressiveSystem = new ProgressiveDocumentSystem();
        await progressiveSystem.initialize();
        console.log('[Opnix Setup] ✓ Progressive artifact generation ready');
    } catch (error) {
        console.log('[Opnix Setup] ⚠️  Progressive system initialization failed:', error.message);
    }

    await persistSetupState(recordHistory(await loadSetupState(), {
        mode: 'new',
        timestamp: new Date().toISOString(),
        output: path.relative(ROOT_DIR, filePath)
    }));
    console.log(`\n[Opnix Setup] New project discovery package generated at ${path.relative(ROOT_DIR, filePath)}.`);
    console.log('[Opnix Setup] Open the Spec Builder to progress through the decision tree.');

    await runScaffoldingStage({
        mode: 'new',
        context,
        questionnaire
    });

    await promptForAgentFiles(context, 'new');

    return { questionnaire };
}

function summarizeAudit(audit) {
    const moduleCount = audit?.moduleSummary?.moduleCount || 0;
    const dependencyCount = audit?.moduleSummary?.dependencyCount || 0;
    const openTickets = audit?.ticketStats?.open || 0;
    const highPriority = audit?.ticketStats?.highPriorityOpen || 0;
    const followUps = Array.isArray(audit?.followUps) ? audit.followUps.slice(0, 5) : [];
    return {
        moduleCount,
        dependencyCount,
        openTickets,
        highPriority,
        followUps
    };
}

async function handleExistingProject() {
    console.log('\n[Opnix Setup] Running automated audit...');
    const audit = await server.runInitialAudit();
    const { moduleCount, dependencyCount, openTickets, highPriority, followUps } = summarizeAudit(audit);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-existing-project-entry-${timestamp}.md`;
    const filePath = path.join(SPEC_SUBDIRS.audits, filename);
    const exportList = Array.isArray(audit?.exports) ? audit.exports.map(item => `- ${item.filename}`).join('\n') : '- (no artefacts reported)';

    const followUpList = followUps.length > 0 ? followUps.map(item => `- ${item}`).join('\n') : '- Review audit JSON for recommended follow-ups.';

    const content = `# Opnix Installation Decision Tree — Existing Repository Path\n\n## Decision Tree\n\n\`\`\`mermaid\n${buildDecisionTreeMermaid()}\`\`\`\n\n## Automated Audit Summary\n- Modules detected: ${moduleCount}\n- Internal dependencies: ${dependencyCount}\n- Open tickets: ${openTickets}\n- High-priority tickets: ${highPriority}\n\n## Recommended Follow-Ups\n${followUpList}\n\n## Generated Artefacts\n${exportList}\n\nAll artefacts are stored in \`spec/\`. Re-run \`claude$ setup\` after addressing follow-ups to refresh the audit.\n`;

    await fs.writeFile(filePath, content, 'utf8');

    // Initialize progressive document system for existing project
    console.log('[Opnix Setup] Initializing progressive document system...');
    try {
        const progressiveSystem = new ProgressiveDocumentSystem();
        await progressiveSystem.initialize();
        console.log('[Opnix Setup] ✓ Progressive artifact generation ready');
    } catch (error) {
        console.log('[Opnix Setup] ⚠️  Progressive system initialization failed:', error.message);
    }
    await persistSetupState(recordHistory(await loadSetupState(), {
        mode: 'existing',
        timestamp: new Date().toISOString(),
        output: path.relative(ROOT_DIR, filePath)
    }));
    console.log(`[Opnix Setup] Audit complete. Summary written to ${path.relative(ROOT_DIR, filePath)}.`);
    console.log('[Opnix Setup] Check the spec/ directory for blueprints, docs, canvas snapshots, and audit payloads.');

    await runScaffoldingStage({
        mode: 'existing',
        audit
    });

    await promptForAgentFiles({ modulesResult: { modules: audit.modules || [] }, packageJson: audit.packageJson || {} }, 'existing');

    return audit;
}

async function runScaffoldingStage({ mode, context, questionnaire, audit }) {
    try {
        if (mode === 'new' && context) {
            const modules = Array.isArray(context.modulesResult?.modules) ? context.modulesResult.modules : [];
            const features = Array.isArray(context.features) ? context.features : [];
            const tickets = Array.isArray(context.ticketData?.tickets) ? context.ticketData.tickets : [];
            const packageJson = context.packageJson || {};
            const techStack = server.deriveTechStack(packageJson, modules);
            const projectType = server.inferProjectType({ modules, techStack });
            const project = {
                name: packageJson.name || 'Opnix Project',
                type: projectType,
                goal: packageJson.description || 'Discovery scaffold generated by Opnix',
                packageJson
            };

            const scaffold = await scaffolder.generateProjectScaffold({
                rootDir: ROOT_DIR,
                project,
                techStack,
                modules,
                features,
                tickets,
                questionnaire
            });

            const manifestRelative = path.relative(ROOT_DIR, scaffold.manifestPath);
            const fileCount = scaffold.summary.files.filter(item => item.type === 'file').length;
            console.log(`[Opnix Setup] Scaffold initialised in ${path.relative(ROOT_DIR, scaffold.scaffoldRoot)} (${fileCount} files).`);
            console.log(`[Opnix Setup] Review ${manifestRelative} for the detailed scaffold manifest.`);
            return scaffold;
        }

        if (mode === 'existing' && audit) {
            const modules = Array.isArray(audit.modules) ? audit.modules : [];
            const features = Array.isArray(audit.features) ? audit.features : [];
            const tickets = Array.isArray(audit.tickets) ? audit.tickets : [];
            const project = {
                ...(audit.project || {}),
                packageJson: audit.packageJson || {}
            };
            const techStack = audit.techStack || server.deriveTechStack(project.packageJson, modules);
            const scaffold = await scaffolder.generateProjectScaffold({
                rootDir: ROOT_DIR,
                project,
                techStack,
                modules,
                features,
                tickets,
                questionnaire: audit.questionnaire
            });

            const manifestRelative = path.relative(ROOT_DIR, scaffold.manifestPath);
            const fileCount = scaffold.summary.files.filter(item => item.type === 'file').length;
            console.log(`[Opnix Setup] Scaffold refreshed in ${path.relative(ROOT_DIR, scaffold.scaffoldRoot)} (${fileCount} files).`);
            console.log(`[Opnix Setup] Review ${manifestRelative} for the detailed scaffold manifest.`);
            return scaffold;
        }
    } catch (error) {
        console.error('[Opnix Setup] Scaffolding stage failed:', error);
    }
    return null;
}

async function promptForAgentFiles(context, mode) {
    if (!process.stdin.isTTY) {
        console.log('[Opnix Setup] Non-interactive terminal detected; skipping agent files generation.');
        return;
    }

    console.log('\n────────────────────────────────────────');
    console.log('Agent Files Generation');
    console.log('────────────────────────────────────────');
    console.log('Generate AI agent guidance files (CLAUDE.md, AGENTS.md, GEMINI.md) tailored to your project?');
    console.log('These files help AI assistants understand your project structure and conventions.');
    console.log('');

    const answer = await new Promise(resolve => {
        const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
        rl.question('Generate agent guidance files? [Y/n]: ', input => {
            rl.close();
            resolve(input.trim().toLowerCase());
        });
    });

    if (answer === 'n' || answer === 'no') {
        console.log('[Opnix Setup] Skipping agent files generation.');
        return;
    }

    console.log('[Opnix Setup] Generating project-tailored agent files...');
    
    try {
        const agentFiles = await generateAgentFiles(context, mode);
        
        console.log('[Opnix Setup] ✓ Agent files generated successfully:');
        agentFiles.forEach(file => {
            console.log(`  - ${path.relative(ROOT_DIR, file.path)}`);
        });
        
        return agentFiles;
    } catch (error) {
        console.error('[Opnix Setup] ⚠️  Agent files generation failed:', error.message);
        return [];
    }
}

async function generateAgentFiles(context, mode) {
    const timestamp = new Date().toISOString();
    const projectName = context.packageJson?.name || 'Opnix Project';
    const description = context.packageJson?.description || 'Project managed with Opnix';
    const modules = context.modulesResult?.modules || [];
    const techStack = extractTechStack(context.packageJson);
    
    const templateData = {
        projectName,
        description,
        techStack,
        moduleCount: modules.length,
        mode,
        timestamp,
        conventions: extractConventions(context),
        architecture: extractArchitecture(modules)
    };

    const files = [];

    // Generate CLAUDE.md
    const claudeContent = renderClaudeTemplate(templateData);
    const claudePath = path.join(ROOT_DIR, 'CLAUDE.md');
    await fs.writeFile(claudePath, claudeContent, 'utf8');
    files.push({ type: 'CLAUDE.md', path: claudePath });

    // Generate AGENTS.md
    const agentsContent = renderAgentsTemplate(templateData);
    const agentsPath = path.join(ROOT_DIR, 'AGENTS.md');
    await fs.writeFile(agentsPath, agentsContent, 'utf8');
    files.push({ type: 'AGENTS.md', path: agentsPath });

    // Generate GEMINI.md
    const geminiContent = renderGeminiTemplate(templateData);
    const geminiPath = path.join(ROOT_DIR, 'GEMINI.md');
    await fs.writeFile(geminiPath, geminiContent, 'utf8');
    files.push({ type: 'GEMINI.md', path: geminiPath });

    return files;
}

function extractTechStack(packageJson) {
    const dependencies = Object.keys(packageJson?.dependencies || {});
    const devDependencies = Object.keys(packageJson?.devDependencies || {});
    const frameworks = [];
    
    // Detect common frameworks
    if (dependencies.includes('react')) frameworks.push('React');
    if (dependencies.includes('vue')) frameworks.push('Vue.js');
    if (dependencies.includes('express')) frameworks.push('Express');
    if (dependencies.includes('next')) frameworks.push('Next.js');
    if (dependencies.includes('nuxt')) frameworks.push('Nuxt.js');
    if (devDependencies.includes('vite')) frameworks.push('Vite');
    if (devDependencies.includes('webpack')) frameworks.push('Webpack');
    
    return {
        dependencies: dependencies.slice(0, 10), // Top 10 deps
        devDependencies: devDependencies.slice(0, 10),
        frameworks
    };
}

function extractConventions(context) {
    const conventions = [];
    
    // Check if using TypeScript
    if (context.packageJson?.devDependencies?.typescript) {
        conventions.push('TypeScript for type safety');
    }
    
    // Check if using ESLint
    if (context.packageJson?.devDependencies?.eslint) {
        conventions.push('ESLint for code quality');
    }
    
    // Check if using Prettier
    if (context.packageJson?.devDependencies?.prettier) {
        conventions.push('Prettier for code formatting');
    }
    
    // Add camelCase convention since we enforce it
    conventions.push('camelCase naming convention enforced');
    
    return conventions.length > 0 ? conventions : ['Standard JavaScript conventions'];
}

function extractArchitecture(modules) {
    if (!modules || modules.length === 0) {
        return 'Modular architecture to be determined';
    }
    
    const types = [...new Set(modules.map(m => m.type).filter(Boolean))];
    const hasApi = types.includes('api');
    const hasFrontend = types.includes('frontend') || types.includes('component');
    const hasBackend = types.includes('backend') || types.includes('service');
    
    if (hasApi && hasFrontend) {
        return 'Full-stack application with API and frontend components';
    } else if (hasApi) {
        return 'API-focused architecture';
    } else if (hasFrontend) {
        return 'Frontend-focused application';
    } else if (hasBackend) {
        return 'Backend service architecture';
    }
    
    return 'Modular component-based architecture';
}

function renderClaudeTemplate(data) {
    return `# CLAUDE.md - Claude AI Assistant Guidelines

## Project Overview

**Project**: ${data.projectName}
**Description**: ${data.description}
**Architecture**: ${data.architecture}
**Generated**: ${data.timestamp}

## Technology Stack

### Core Dependencies
${data.techStack.dependencies.map(dep => `- ${dep}`).join('\n')}

### Development Tools
${data.techStack.devDependencies.map(dep => `- ${dep}`).join('\n')}

### Frameworks & Libraries
${data.techStack.frameworks.map(fw => `- ${fw}`).join('\n')}

## Code Conventions

${data.conventions.map(conv => `- ${conv}`).join('\n')}

## Project Structure

This project uses Opnix for project management and follows modular architecture principles with ${data.moduleCount} detected modules.

## Development Guidelines

1. **Code Quality**: Follow existing patterns and maintain consistency
2. **Testing**: Write tests for new functionality
3. **Documentation**: Update relevant docs when making changes
4. **Commits**: Use clear, descriptive commit messages

## Opnix Integration

This project uses Opnix for:
- Module detection and dependency mapping
- Ticket and feature management
- Documentation generation
- Canvas visualization
- Progressive project analysis

When working with this codebase, use Opnix's APIs and conventions for managing project state.

## File Locations

- **Modules**: Detected automatically, managed via Opnix canvas
- **Documentation**: \`docs/\` directory, accessible via Docs tab
- **Specs**: \`spec/\` directory for generated specifications
- **Tests**: Follow existing test patterns in the project

## AI Assistant Notes

- Always read existing code before making changes
- Use Opnix APIs when available instead of direct file manipulation
- Respect the camelCase naming convention
- Consider module dependencies when making changes
- Update documentation for significant changes
`;
}

function renderAgentsTemplate(data) {
    return `# AGENTS.md - Multi-Agent Coordination Guidelines

## Project Context

**Project**: ${data.projectName}
**Mode**: ${data.mode} project setup
**Architecture**: ${data.architecture}
**Modules**: ${data.moduleCount} detected
**Generated**: ${data.timestamp}

## Agent Roles & Responsibilities

### Primary Development Agent
- **Focus**: Core feature implementation and bug fixes
- **Scope**: Module development, API endpoints, frontend components
- **Tools**: Full access to codebase, Opnix management interface

### Documentation Agent
- **Focus**: Documentation maintenance and generation
- **Scope**: README updates, API docs, architectural documentation
- **Tools**: Docs tab, markdown generation, template system

### Testing Agent
- **Focus**: Test coverage and quality assurance
- **Scope**: Unit tests, integration tests, end-to-end validation
- **Tools**: Test runners, coverage tools, validation scripts

### Architecture Agent
- **Focus**: System design and module coordination
- **Scope**: Module relationships, dependency management, scaffolding
- **Tools**: Canvas visualization, module detector, dependency analysis

## Coordination Protocols

### Handoff Requirements
1. **Clear State Documentation**: Document current implementation status
2. **Dependency Mapping**: Note which modules/files are affected
3. **Test Status**: Report test coverage and any failing tests
4. **Next Steps**: Provide actionable next steps for the receiving agent

### Communication Format
\`\`\`
Agent: [ROLE]
Status: [COMPLETE|IN_PROGRESS|BLOCKED]
Changes: [List of modified files/modules]
Dependencies: [List of affected systems]
Next: [Specific actions for next agent]
Notes: [Any important context or blockers]
\`\`\`

## Technology Context

### Stack Overview
${data.techStack.frameworks.map(fw => `- ${fw}`).join('\n')}

### Code Conventions
${data.conventions.map(conv => `- ${conv}`).join('\n')}

### Opnix Integration Points
- Module detection and management
- Ticket lifecycle tracking
- Canvas dependency visualization
- Progressive documentation system
- CLI interview workflows

## Quality Gates

### Before Handoff
- [ ] Code follows project conventions
- [ ] Tests pass for modified functionality
- [ ] Documentation updated for changes
- [ ] Opnix state reflects current project status
- [ ] No broken dependencies or circular references

### Implementation Standards
- Real, working code only (no placeholders)
- Complete end-to-end functionality
- Proper error handling
- Integration with existing Opnix systems

## Agent-Specific Notes

### Development Agent
- Use Opnix APIs for state management
- Respect module boundaries and dependencies
- Follow camelCase naming throughout
- Test changes with existing workflows

### Documentation Agent
- Use Docs tab for markdown management
- Generate specs via progressive system
- Maintain consistency with existing docs
- Link documentation to relevant modules

### Testing Agent
- Cover new functionality with appropriate tests
- Validate Opnix integration points
- Test module detection and canvas rendering
- Ensure CLI workflows remain functional

### Architecture Agent
- Use canvas for dependency visualization
- Validate module health and relationships
- Ensure scaffolding remains consistent
- Monitor for architectural debt
`;
}

function renderGeminiTemplate(data) {
    return `# GEMINI.md - Google Gemini Assistant Guidelines

## Project Profile

**Name**: ${data.projectName}
**Type**: ${data.architecture}
**Setup Mode**: ${data.mode}
**Module Count**: ${data.moduleCount}
**Generated**: ${data.timestamp}

## Technology Landscape

### Primary Technologies
${data.techStack.frameworks.length > 0 ? data.techStack.frameworks.map(fw => `- ${fw}`).join('\n') : '- JavaScript/Node.js based'}

### Key Dependencies
${data.techStack.dependencies.slice(0, 5).map(dep => `- ${dep}`).join('\n')}

### Development Environment
${data.techStack.devDependencies.slice(0, 5).map(dep => `- ${dep}`).join('\n')}

## Development Context

### Code Standards
${data.conventions.map(conv => `- ${conv}`).join('\n')}

### Project Management
This project uses **Opnix** for comprehensive project management:
- Automated module detection and dependency mapping
- Visual canvas for architecture understanding
- Progressive documentation and specification generation
- Integrated ticket and feature lifecycle management
- CLI-driven interview and analysis workflows

## Interaction Guidelines

### When Reading Code
1. Start with the project structure via Opnix canvas
2. Understand module relationships before making changes
3. Check existing patterns and conventions
4. Review relevant documentation in \`docs/\` directory

### When Writing Code
1. Follow camelCase naming strictly (enforced by ESLint)
2. Use Opnix APIs when available for project state
3. Maintain module boundaries and dependencies
4. Write complete, functional implementations only

### When Documenting
1. Use the Docs tab for markdown management
2. Follow existing documentation patterns
3. Link to relevant modules and specifications
4. Update architectural docs for significant changes

## Opnix System Integration

### Key Components
- **Canvas**: Visual module and dependency management
- **Tickets**: Issue tracking and lifecycle management
- **Features**: Feature planning and implementation tracking
- **Docs**: Integrated documentation system
- **Specs**: Progressive specification generation
- **CLI**: Interview-driven analysis and generation

### API Integration Points
- Module detection: \`/api/modules/detect\`
- Canvas operations: \`/api/canvas/export\`
- Documentation: \`/api/docs/*\`
- Ticket management: \`/api/tickets\`
- Feature tracking: \`/api/features\`

## Quality Expectations

### Code Quality
- No placeholder code or incomplete implementations
- Proper error handling and edge case coverage
- Integration with existing Opnix workflows
- Comprehensive testing of new functionality

### Documentation Quality
- Clear, actionable documentation
- Consistent formatting and structure
- Links to relevant code and specifications
- Regular updates to reflect current state

### Architecture Quality
- Respect module boundaries and dependencies
- Maintain clean separation of concerns
- Consider performance and scalability
- Document architectural decisions

## Gemini-Specific Capabilities

Leverage your strengths in:
- **Code Analysis**: Deep understanding of complex codebases
- **Pattern Recognition**: Identifying architectural patterns and anti-patterns
- **Documentation**: Creating comprehensive, well-structured documentation
- **Problem Solving**: Breaking down complex problems into manageable tasks
- **Integration**: Understanding how components work together

## Project Context for AI

This is a ${data.mode === 'new' ? 'new project' : 'existing project'} being managed with Opnix. The system provides:
- Automated project analysis and module detection
- Visual representation of project structure
- Progressive documentation and specification generation
- Integrated development workflow management

Focus on understanding the existing patterns and extending them consistently rather than introducing new paradigms that might conflict with the Opnix methodology.
`;
}

async function main() {
    try {
        const cliOptions = parseCliOptions(process.argv.slice(2));
        const state = await loadSetupState();
        const context = await collectContext();
        const defaultMode = inferDefaultMode(context);
        const mode = await promptForMode(defaultMode, context, state, cliOptions);
        await persistSetupState({ ...state, lastSelectedMode: mode });
        if (mode === 'new') {
            await handleNewProject(context);
        } else {
            await handleExistingProject();
        }
        console.log('\n[Opnix Setup] Decision tree complete.');
    } catch (error) {
        console.error('[Opnix Setup] Failed to run setup wizard:', error);
        process.exitCode = 1;
    }
}

main();
