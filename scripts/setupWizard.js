#!/usr/bin/env node
/*
 * OTKit Setup Wizard
 * Guides installation-time decision tree between new project discovery and existing repo audit flows.
 */

const path = require('path');
const fs = require('fs').promises;
const readline = require('readline');
const moduleDetector = require('../services/moduleDetector');
const interviewLoader = require('../services/interviewLoader');
const server = require('../server');

const ROOT_DIR = path.join(__dirname, '..');
const EXPORTS_DIR = path.join(ROOT_DIR, 'exports');

async function collectContext() {
    await server.initDataFile();
    await server.ensureDirectory(EXPORTS_DIR);

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

async function promptForMode(defaultMode, context) {
    if (!process.stdin.isTTY) {
        console.log(`[OTKit Setup] Non-interactive terminal detected; defaulting to ${defaultMode === 'new' ? 'new project discovery' : 'existing repo audit'} flow.`);
        return defaultMode;
    }

    console.log('────────────────────────────────────────');
    console.log('OTKit Installation Decision Tree');
    console.log('────────────────────────────────────────');
    console.log(formatSummary(context));
    console.log('\nFlow options:');
    console.log('  [1] New project discovery & scope blueprint');
    console.log('  [2] Existing repository automated audit');
    const promptDefault = defaultMode === 'new' ? '1' : '2';

    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const answer = await new Promise(resolve => {
        rl.question(`Select flow [1/2] (default ${promptDefault}): `, input => {
            rl.close();
            resolve(input.trim());
        });
    });

    if (answer === '1' || (/^n/i.test(answer))) return 'new';
    if (answer === '2' || (/^e/i.test(answer))) return 'existing';
    return defaultMode;
}

function buildDecisionTreeMermaid() {
    return `flowchart TD\n  Install[[Install Opnix]] --> Decision{Workspace type?}\n  Decision -->|New project| Scope[Scope discovery tree]\n  Decision -->|Existing repository| Audit[Automated audit]\n  Scope --> Questionnaire[Interview blueprint rollout]\n  Scope --> Docs[Generate scope docs in exports/]\n  Audit --> RunSetup[Run claude$ setup / API audit]\n  Audit --> Exports[Inspect exports/ artefacts]\n`;
}

function extractSectionHighlights(questionnaire) {
    return questionnaire.slice(0, 8).map(section => {
        const count = Array.isArray(section.questions) ? section.questions.length : 0;
        return `- **${section.title}** (${count} questions)`;
    });
}

async function handleNewProject(context) {
    const questionnaire = await interviewLoader.getNewProjectQuestionnaire();
    const sectionsHighlight = extractSectionHighlights(questionnaire);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-new-project-scope-${timestamp}.md`;
    const filePath = path.join(EXPORTS_DIR, filename);

    const content = `# OTKit Installation Decision Tree — New Project Path\n\n## Decision Tree\n\n\`\`\`mermaid\n${buildDecisionTreeMermaid()}\`\`\`\n\n## Why you landed here\n- No significant modules, tickets, or dependencies were detected, so OTKit assumes a greenfield project.\n- The interview blueprint will drive scope capture before any code is written.\n\n## Immediate Actions\n1. Run \`node server.js\` and open http://localhost:7337.\n2. Launch the Spec Builder tab and walk through the staged interview.\n3. Use the Playbook pane to capture stakeholder answers.\n4. Save generated specs from the Exports panel.\n\n## Blueprint Highlights\n${sectionsHighlight.join('\n')}\n\nFull blueprint: \`public/data/interview-sections.json\` and \`docs/interview-playbook.md\`.\n\n## Next Steps\n- Share the generated spec kit with stakeholders for validation.\n- Iterate through follow-up questions flagged in the Playbook.\n- Once modules/tickets exist, re-run this wizard to switch to the audit flow.\n`;

    await fs.writeFile(filePath, content, 'utf8');
    console.log(`\n[OTKit Setup] New project discovery package generated at ${path.relative(ROOT_DIR, filePath)}.`);
    console.log('[OTKit Setup] Open the Spec Builder to progress through the decision tree.');
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
    console.log('\n[OTKit Setup] Running automated audit...');
    const audit = await server.runInitialAudit();
    const { moduleCount, dependencyCount, openTickets, highPriority, followUps } = summarizeAudit(audit);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-existing-project-entry-${timestamp}.md`;
    const filePath = path.join(EXPORTS_DIR, filename);
    const exportList = Array.isArray(audit?.exports) ? audit.exports.map(item => `- ${item.filename}`).join('\n') : '- (no artefacts reported)';

    const followUpList = followUps.length > 0 ? followUps.map(item => `- ${item}`).join('\n') : '- Review audit JSON for recommended follow-ups.';

    const content = `# OTKit Installation Decision Tree — Existing Repository Path\n\n## Decision Tree\n\n\`\`\`mermaid\n${buildDecisionTreeMermaid()}\`\`\`\n\n## Automated Audit Summary\n- Modules detected: ${moduleCount}\n- Internal dependencies: ${dependencyCount}\n- Open tickets: ${openTickets}\n- High-priority tickets: ${highPriority}\n\n## Recommended Follow-Ups\n${followUpList}\n\n## Generated Artefacts\n${exportList}\n\nAll artefacts are stored in \`exports/\`. Re-run \`claude$ setup\` after addressing follow-ups to refresh the audit.\n`;

    await fs.writeFile(filePath, content, 'utf8');
    console.log(`[OTKit Setup] Audit complete. Summary written to ${path.relative(ROOT_DIR, filePath)}.`);
    console.log('[OTKit Setup] Check the exports/ directory for spec kits, docs, canvas snapshots, and audit payloads.');
}

async function main() {
    try {
        const context = await collectContext();
        const defaultMode = inferDefaultMode(context);
        const mode = await promptForMode(defaultMode, context);
        if (mode === 'new') {
            await handleNewProject(context);
        } else {
            await handleExistingProject();
        }
        console.log('\n[OTKit Setup] Decision tree complete.');
    } catch (error) {
        console.error('[OTKit Setup] Failed to run setup wizard:', error);
        process.exitCode = 1;
    }
}

main();
