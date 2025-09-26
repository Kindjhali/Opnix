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
