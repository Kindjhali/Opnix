// OPNIX - Express Backend with Tags Support
const express = require('express');
const cors = require('cors');
const compression = require('compression');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const os = require('os');
const { exec } = require('child_process');
const util = require('util');
const WebSocket = require('ws');
const http = require('http');
const terminalManager = require('./services/terminalPty');
const moduleDetector = require('./services/moduleDetector');
const specGenerator = require('./services/specGenerator');
const docsGenerator = require('./services/docsGenerator');
const { interviewLoader } = require('./services/interviewLoader');
const questionFileWatcher = require('./services/questionFileWatcher');
const diagramGenerator = require('./services/diagramGenerator');
const apiSpecGenerator = require('./services/apiSpecGenerator');
const { ProgressiveDocumentSystem } = require('./services/progressiveDocumentSystem');
const cliInterviewManager = require('./services/cliInterviewManager');
const runbookGenerator = require('./services/runbookGenerator');
const { createCliStagedFlow } = require('./services/cliStagedFlow');
const { createCliExtraCommands } = require('./services/cliExtraCommands');
const { createPlanTaskChainer } = require('./services/planTaskChainer');
const { createImplementationChainer } = require('./services/implementationChainer');
const { createPreImplementationDiscussionManager } = require('./services/preImplementationDiscussionManager');
const ApprovalGatesManager = require('./services/approvalGatesManager');
const SessionManager = require('./services/sessionManager');
const runbookTemplates = require('./services/runbookTemplates');
const { createCliBranchHandler } = require('./services/cliBranchHandler');
const techStackManager = require('./services/techStackManager');
const agentHandoffManager = require('./services/agentHandoffManager');
const { ensureRoadmapStateFile, readRoadmapState, writeRoadmapState, syncRoadmapState, listRoadmapVersions, rollbackRoadmapState, updateRoadmapMilestone } = require('./services/roadmapState');
const { startRoadmapSyncWatchers, stopRoadmapSyncWatchers } = require('./services/roadmapSyncWatcher');
require('./services/roadmapEventAggregator');
const taskLogger = require('./services/taskLogger');
const compactionAlerter = require('./services/compactionAlerter');
const { createTicketUtils } = require('./services/ticketUtils');
const { createFeatureUtils } = require('./services/featureUtils');
const { createChecklistUtils } = require('./services/checklistUtils');
const execAsync = util.promisify(exec);
const runtimeBundler = require('./services/runtimeBundler');
const createPreImplementationDiscussionRoutes = require('./routes/preImplementationDiscussions');
const { createAuditManager } = require('./services/auditManager');
const createSpecRoutes = require('./routes/specs');
const createTicketRoutes = require('./routes/tickets');
const gitAutomationManager = require('./services/gitAutomationManager');
const { createModulesRoutes } = require('./routes/modules');
const { createFeaturesRoutes } = require('./routes/features');
const { createChecklistsRoutes } = require('./routes/checklists');
const createCanvasRoutes = require('./routes/canvas');
const createDiagramRoutes = require('./routes/diagrams');
const { createStorybookRoutes, startStorybookProcess } = require('./routes/storybook');
const { createContextRoutes } = require('./routes/context');
const { createRootRoutes } = require('./routes/root');
const { createStaticRoutes } = require('./routes/static');

const { createDocsRoutes } = require('./routes/docs');
const { createTechStackRoutes } = require('./routes/techStack');
const createProgressiveRoutes = require('./routes/progressive');
const { createCliRoutes, terminalHistoryRoute, terminalExecuteRoute } = require('./routes/cli');
const { createAgentsRoutes } = require('./routes/agents');
const { createInterviewsRoutes } = require('./routes/interviews');
const recoveryRoutes = require('./routes/recovery');
const sessionsRoutes = require('./routes/sessions');
const preferencesRoutes = require('./routes/preferences');
const checkpointManager = require('./services/checkpointManager');
const sessionRestoration = require('./services/sessionRestoration');
const taskLogsRoutes = require('./routes/taskLogs');
const statusDashboardRoutes = require('./routes/statusDashboard');
const bulkOperationsRoutes = require('./routes/bulkOperations');
const progressRoutes = require('./routes/progress');
const branchesRoutes = require('./routes/branches');
const createApprovalGatesRoutes = require('./routes/approvalGates');
const {
    initializeStatusTracking,
    trackTokenUsage,
    addStatusContext,
    healthCheckMiddleware
} = require('./middleware/statusTracking');
const {
    createExportsRoutes,
    markdownListRoute,
    markdownReadRoute,
    markdownCreateRoute,
    markdownUpdateRoute
} = require('./routes/exports');

const app = express();
// Disable Express 5 security defaults that break static file serving
app.disable('x-powered-by');
app.set('trust proxy', false);

const PORT = 7337;
// Project root directory (where user's project is, NOT where opnix is installed)
const ROOT_DIR = process.cwd();
// Opnix installation directory (for static assets, routes, etc)
// Use OPNIX_ROOT env var if set by bin/opnix.js, otherwise fallback to __dirname for direct node server.js
const OPNIX_DIR = process.env.OPNIX_ROOT || __dirname;

console.log(`📂 ROOT_DIR: ${ROOT_DIR}`);
console.log(`📦 OPNIX_DIR: ${OPNIX_DIR}`);
console.log(`🎨 PUBLIC_DIR: ${path.join(OPNIX_DIR, 'public')}`);

// Data directory in the user's project
const DATA_DIR = path.join(ROOT_DIR, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');
const LEGACY_TICKETS_FILE = path.join(__dirname, 'tickets.json');
const LEGACY_IMPORT_DIR = path.join(DATA_DIR, 'legacy-imports');
const AGENTS_DIR = path.join(__dirname, 'agents');
const EXPORTS_DIR = path.join(__dirname, 'spec');
const SCAFFOLD_ROOT = path.join(__dirname, '.opnix', 'scaffold');
const EXPORT_SUBDIRS = {
    blueprints: path.join(EXPORTS_DIR, 'blueprints'),
    docs: path.join(EXPORTS_DIR, 'docs'),
    revision: path.join(EXPORTS_DIR, 'revision'),
    audits: path.join(EXPORTS_DIR, 'audits'),
    canvas: path.join(EXPORTS_DIR, 'canvas'),
    diagrams: path.join(EXPORTS_DIR, 'diagrams'),
    roadmaps: path.join(EXPORTS_DIR, 'roadmaps'),
    api: path.join(EXPORTS_DIR, 'api'),
    runbooks: path.join(EXPORTS_DIR, 'runbooks')
};
const DIAGRAM_TYPES = ['architecture', 'sequence', 'entity', 'delivery-flow'];
const SETUP_STATE_FILE = path.join(DATA_DIR, 'setup-state.json');
const MODULE_LINKS_FILE = path.join(DATA_DIR, 'module-links.json');
const DETECTED_MODULES_FILE = path.join(DATA_DIR, 'modules-detected.json');
const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
const CHECKLIST_FILE = path.join(DATA_DIR, 'checklists.json');
const MANUAL_MODULES_FILE = path.join(DATA_DIR, 'modules.json');
const TERMINAL_HISTORY_FILE = path.join(DATA_DIR, 'terminal-history.json');
const CLI_GATE_LOG_FILE = path.join(DATA_DIR, 'cli-gating-log.json');
const ULTRATHINK_COMPACTION_LOG_FILE = path.join(DATA_DIR, 'ultrathink-compaction-log.json');
const APPROVAL_GATES_FILE = path.join(DATA_DIR, 'approval-gates.json');
const MAX_GATING_LOG_ENTRIES = 50;
const PACKAGE_JSON_FILE = path.join(__dirname, 'package.json');
const MARKDOWN_ARCHIVE_ROOTS = [
    {
        id: 'docs',
        label: 'Documentation',
        dir: path.join(__dirname, 'docs')
    },
    {
        id: 'runtime-docs',
        label: 'Runtime Docs',
        dir: path.join(__dirname, '.opnix', 'runtime', 'docs')
    },
    {
        id: 'spec-docs',
        label: 'Generated Docs',
        dir: path.join(EXPORTS_DIR, 'docs')
    },
    {
        id: 'runbooks',
        label: 'Runbooks',
        dir: path.join(EXPORTS_DIR, 'runbooks')
    }
];
const MARKDOWN_EXTENSIONS = new Set(['.md', '.mdx', '.markdown']);
const MARKDOWN_ARCHIVE_DENYLIST = new Set(['node_modules', '.git', 'dist', 'build', 'coverage']);
const statusReported = 'reported';
const statusInProgress = 'inProgress';
const statusFinished = 'finished';
const priorityLow = 'low';
const priorityMedium = 'medium';
const priorityHigh = 'high';

const VALID_TICKET_STATUSES = [statusReported, statusInProgress, statusFinished];
const VALID_TICKET_PRIORITIES = [priorityLow, priorityMedium, priorityHigh];
const TICKET_STATUS_TRANSITIONS = {
    [statusReported]: {
        [statusInProgress]: 'startWork',
        [statusFinished]: 'resolveDirect'
    },
    [statusInProgress]: {
        [statusFinished]: 'completeWork'
    },
    [statusFinished]: {}
};

let planTaskChainer = null;
let implementationChainer = null;
let cliBranchHandler = null;
const sessionManager = new SessionManager();
const approvalGatesManager = new ApprovalGatesManager({
    dataFile: APPROVAL_GATES_FILE,
    logger: console
});
const preImplementationDiscussionManager = createPreImplementationDiscussionManager({
    filePath: path.join(DATA_DIR, 'pre-implementation-discussions.json'),
    logger: console,
    approvalGatesManager
});

const {
    normaliseStatusHook,
    normaliseTicketStatus,
    validateTicketStatusChange,
    normaliseTicketsPayload
} = createTicketUtils({
    statusReported,
    statusInProgress,
    statusFinished,
    validTicketStatuses: VALID_TICKET_STATUSES,
    ticketStatusTransitions: TICKET_STATUS_TRANSITIONS
});

async function readBranchStatus() {
    const status = {
        branch: 'unknown',
        ahead: 0,
        behind: 0,
        dirty: false,
        detached: false,
        notGitRepo: false,
        timestamp: new Date().toISOString()
    };

    try {
        const { stdout } = await execAsync('git status --porcelain=2 --branch', { cwd: ROOT_DIR });
        const lines = stdout.split('\n');
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line) continue;
            if (line.startsWith('# branch.head ')) {
                const name = line.replace('# branch.head ', '').trim();
                status.branch = name === '(detached)' ? 'detached HEAD' : name;
                status.detached = name === '(detached)';
            } else if (line.startsWith('# branch.ab ')) {
                const parts = line.replace('# branch.ab ', '').trim().split(' ');
                for (const part of parts) {
                    if (part.startsWith('+')) {
                        status.ahead = Number.parseInt(part.slice(1), 10) || 0;
                    }
                    if (part.startsWith('-')) {
                        status.behind = Number.parseInt(part.slice(1), 10) || 0;
                    }
                }
            } else if (!line.startsWith('#')) {
                status.dirty = true;
            }
        }
        status.timestamp = new Date().toISOString();
    } catch (error) {
        const message = error && error.message ? error.message : '';
        if (/not a git repository/i.test(message)) {
            status.branch = 'not-a-git-repo';
            status.notGitRepo = true;
            status.timestamp = new Date().toISOString();
        } else {
            throw error;
        }
    }

    return status;
}

const VALID_FEATURE_STATUSES = ['proposed', 'approved', 'inDevelopment', 'testing', 'deployed'];
const FEATURE_STATUS_ORDER = new Map(
    VALID_FEATURE_STATUSES.map((status, index) => [status, index])
);
const STATUS_REQUIRES_CRITERIA = new Set(['approved', 'inDevelopment', 'testing', 'deployed']);
const checklistPending = 'pending';
const checklistInProgress = 'inProgress';
const checklistComplete = 'complete';
const VALID_CHECKLIST_STATUSES = [checklistPending, checklistInProgress, checklistComplete];
const CHECKLIST_STATUS_TRANSITIONS = {
    [checklistPending]: {
        [checklistInProgress]: 'startChecklist'
    },
    [checklistInProgress]: {
        [checklistComplete]: 'completeChecklist',
        [checklistPending]: 'restartChecklist'
    },
    [checklistComplete]: {
        [checklistInProgress]: 'reopenChecklist'
    }
};
const {
    normaliseChecklistStatus,
    normaliseChecklist,
    validateChecklistStatusChange
} = createChecklistUtils({
    checklistPending,
    checklistInProgress,
    checklistComplete,
    validChecklistStatuses: VALID_CHECKLIST_STATUSES,
    checklistStatusTransitions: CHECKLIST_STATUS_TRANSITIONS,
    normaliseStatusHook
});
const {
    normaliseFeatureStatus,
    normaliseFeatureRecord,
    normaliseFeatureCollection,
    normaliseAcceptanceCriteria,
    validateFeatureStatusChange
} = createFeatureUtils({
    validFeatureStatuses: VALID_FEATURE_STATUSES,
    featureStatusOrder: FEATURE_STATUS_ORDER,
    statusRequiresCriteria: STATUS_REQUIRES_CRITERIA
});

const MAX_TERMINAL_HISTORY = 100;

const {
    runInitialAudit,
    loadDiagramContext
} = createAuditManager({
    moduleDetector,
    specGenerator,
    docsGenerator,
    diagramGenerator,
    interviewLoader,
    runtimeBundler,
    readData,
    writeData,
    readFeaturesFile,
    loadPackageJson,
    ensureExportStructure,
    EXPORT_SUBDIRS,
    EXPORTS_DIR,
    rootDir: ROOT_DIR,
    deriveTechStack,
    inferProjectType,
    inferPrimaryLanguage,
    normaliseTicketStatus,
    withRelativePath,
    techStackManager,
    statusConstants: {
        statusReported,
        statusInProgress,
        statusFinished,
        priorityLow,
        priorityMedium,
        priorityHigh
    }
});

const CLI_COMMANDS = {
    '/spec': { mode: 'interview', category: 'spec', label: 'Specification Interview' },
    '/new-feature': { mode: 'interview', category: 'feature', label: 'Feature Interview' },
    '/new-module': { mode: 'interview', category: 'module', label: 'Module Interview' },
    '/new-bug': { mode: 'interview', category: 'bug', label: 'Bug Interview' },
    '/new-diagram': { mode: 'interview', category: 'diagram', label: 'Diagram Interview' },
    '/new-api': { mode: 'interview', category: 'api', label: 'API Interview' },
    '/runbook': { mode: 'interview', category: 'runbook', label: 'Runbook Interview' },
    '/constitution': { mode: 'utility', handler: 'constitution', label: 'Governance Constitution Digest' },
    '/specify': { mode: 'utility', handler: 'specify', label: 'Scoped Spec Export' },
    '/branch': { mode: 'utility', handler: 'branch', label: 'Create Feature Branch' },
    '/plan': { mode: 'staged', stage: 'plan', label: 'Delivery Plan Summary' },
    '/tasks': { mode: 'staged', stage: 'tasks', label: 'Task Queue Summary' }
};

const CLI_ALIGNMENT_RULES = {
    '/spec': { requireDiscussion: true, requireUltraThink: true },
    '/new-feature': { requireDiscussion: true, requireUltraThink: true },
    '/new-module': { requireDiscussion: true, requireUltraThink: true },
    '/new-diagram': { requireDiscussion: true, requireUltraThink: true },
    '/new-api': { requireDiscussion: true, requireUltraThink: true },
    '/runbook': { requireDiscussion: true, requireUltraThink: true },
    '/specify': { requireDiscussion: true, requireUltraThink: true },
    '/plan': { requireDiscussion: true, requireUltraThink: true },
    '/tasks': { requireDiscussion: true, requireUltraThink: true }
};

const CLI_COMMAND_LIST = Object.entries(CLI_COMMANDS)
    .map(([command, meta]) => `${command} — ${meta.label}`)
    .join('\n');

const PLANNING_COMMAND_LIST = Object.keys(CLI_ALIGNMENT_RULES).join(', ');

const ULTRATHINK_TRIGGER_REGEX = /\[\[\s*ultrathink\s*\]\]/i;
const CONTEXT_GATING_THRESHOLD = 0.9;

function extractCategoryCounts(summary) {
    if (!summary || !summary.dependencyCategories) {
        return {};
    }
    const entries = {};
    Object.entries(summary.dependencyCategories).forEach(([key, bucket]) => {
        const label = bucket && bucket.label ? bucket.label : key;
        const items = Array.isArray(bucket && bucket.items) ? bucket.items : [];
        entries[key] = { label, count: items.length };
    });
    return entries;
}

function buildTechStackDeltaMessages(previousSummary, currentSummary) {
    if (!currentSummary) {
        return [];
    }

    const messages = [];

    if (!previousSummary) {
        const runtimeTotal = currentSummary.dependencies?.total ?? 0;
        const toolingTotal = currentSummary.devDependencies?.total ?? 0;
        messages.push(`Tech stack snapshot generated (${runtimeTotal} runtime / ${toolingTotal} tooling packages).`);
        return messages;
    }

    const prevRuntime = previousSummary.dependencies?.total ?? 0;
    const prevTooling = previousSummary.devDependencies?.total ?? 0;
    const nextRuntime = currentSummary.dependencies?.total ?? 0;
    const nextTooling = currentSummary.devDependencies?.total ?? 0;

    const runtimeDelta = nextRuntime - prevRuntime;
    const toolingDelta = nextTooling - prevTooling;

    if (runtimeDelta > 0) {
        messages.push(`Runtime package count increased by ${runtimeDelta} (now ${nextRuntime}).`);
    }
    if (toolingDelta > 0) {
        messages.push(`Tooling package count increased by ${toolingDelta} (now ${nextTooling}).`);
    }

    const prevCategories = extractCategoryCounts(previousSummary);
    const nextCategories = extractCategoryCounts(currentSummary);
    const categoryDiffs = [];
    Object.entries(nextCategories).forEach(([key, value]) => {
        const prevCount = prevCategories[key]?.count ?? 0;
        const diff = value.count - prevCount;
        if (diff > 0) {
            categoryDiffs.push(`${value.label}: +${diff}`);
        }
    });
    if (categoryDiffs.length) {
        messages.push(`New dependencies detected → ${categoryDiffs.slice(0, 3).join(', ')}`);
    }

    const prevFrameworks = new Set(previousSummary.frameworks || []);
    const nextFrameworks = new Set(currentSummary.frameworks || []);
    const newFrameworks = [...nextFrameworks].filter(framework => !prevFrameworks.has(framework));
    if (newFrameworks.length) {
        messages.push(`New frameworks recorded: ${newFrameworks.slice(0, 5).join(', ')}.`);
    }

    return messages;
}

let getContextTelemetry = () => ({
    contextUsed: 0,
    contextLimit: 160000,
    currentTask: 'System Ready',
    filesEdited: 0,
    daicState: 'Discussion',
    ultraThinkMode: 'api'
});

async function evaluateAlignmentGate(slashCommand, originalCommand) {
    const rules = CLI_ALIGNMENT_RULES[slashCommand];
    if (!rules) {
        return null;
    }

    const {
        contextUsed,
        contextLimit,
        daicState,
        ultraThinkMode
    } = getContextTelemetry();

    const issues = [];

    if (rules.requireDiscussion && daicState !== 'Discussion') {
        issues.push(`DAIC alignment required: current mode is "${daicState}". Reset via POST /api/context/update {"daicState":"Discussion"} or wait for hooks to unwind before running ${slashCommand}.`);
    }

    const ratio = contextLimit ? contextUsed / contextLimit : 0;
    if (ratio >= CONTEXT_GATING_THRESHOLD) {
        issues.push(`Context usage is at ${Math.round(ratio * 100)}%. Summarise and POST /api/context/update to reduce usage before retrying.`);
    }

    if (rules.requireUltraThink && ultraThinkMode === 'api' && !ULTRATHINK_TRIGGER_REGEX.test(originalCommand)) {
        issues.push('UltraThink gating: append [[ ultrathink ]] to the command (e.g. `/spec [[ ultrathink ]]`) or switch modes via POST /api/ultrathink/mode {"mode":"max"} before retrying.');
    }

    if (approvalGatesManager) {
        try {
            const gateStatus = await approvalGatesManager.checkCommand(slashCommand);
            if (!gateStatus.passed && gateStatus.missing.length) {
                issues.push(
                    'Approval gate(s) pending: ' +
                    gateStatus.missing
                        .map(entry => `${entry.label}${entry.description ? ` — ${entry.description}` : ''}`)
                        .join('; ')
                );
            }
        } catch (error) {
            console.warn('[Opnix][approval-gates] command check failed:', error.message || error);
        }
    }

    if (!issues.length) {
        return null;
    }

    return {
        blocked: true,
        messages: [
            'Alignment gate active — resolve the following before retrying:',
            ...issues.map(issue => `• ${issue}`)
        ],
        issues,
        diagnostics: {
            daicState,
            contextUsed,
            contextLimit,
            ultraThinkMode
        }
    };
}

async function appendLogEntry(filePath, entry, maxEntries = null) {
    let entries = [];
    try {
        const raw = await fsPromises.readFile(filePath, 'utf8');
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
            entries = parsed;
        }
    } catch (error) {
        if (error.code !== 'ENOENT') {
            throw error;
        }
    }

    entries.push(entry);
    if (maxEntries && entries.length > maxEntries) {
        entries = entries.slice(-maxEntries);
    }

    await fsPromises.writeFile(filePath, JSON.stringify(entries, null, 2));
    return entry;
}

async function logCliAlignmentGate(slashCommand, fullCommand, gateResult) {
    const timestamp = new Date().toISOString();
    const reasons = Array.isArray(gateResult?.issues) && gateResult.issues.length
        ? gateResult.issues
        : (gateResult?.messages || []).filter(line => line.startsWith('• ')).map(line => line.replace(/^•\s+/, ''));

    const {
        contextUsed,
        contextLimit,
        daicState,
        ultraThinkMode
    } = getContextTelemetry();

    const gateEntry = {
        timestamp,
        command: slashCommand,
        fullCommand,
        reasons,
        diagnostics: gateResult?.diagnostics || {
            daicState,
            contextUsed,
            contextLimit,
            ultraThinkMode
        }
    };

    await appendLogEntry(CLI_GATE_LOG_FILE, gateEntry, MAX_GATING_LOG_ENTRIES);

    const ultraThinkEntry = {
        timestamp,
        type: 'cli-gate',
        command: slashCommand,
        reasons,
        contextUsed,
        contextLimit,
        daicState,
        ultraThinkMode
    };

    await appendLogEntry(ULTRATHINK_COMPACTION_LOG_FILE, ultraThinkEntry, MAX_GATING_LOG_ENTRIES * 2);

    return gateEntry;
}

async function readCliGateLog(limit = 10) {
    try {
        const raw = await fsPromises.readFile(CLI_GATE_LOG_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed) || !parsed.length) {
            return [];
        }
        if (limit && parsed.length > limit) {
            return parsed.slice(-limit);
        }
        return parsed;
    } catch (error) {
        if (error.code === 'ENOENT') {
            return [];
        }
        throw error;
    }
}

const CLI_HELP_LINES = [
    'Available commands:',
    CLI_COMMAND_LIST,
    '/sessions — list existing CLI interview sessions',
    '/help — display this help text',
    '',
    'Alignment gates:',
    `• Planning commands (${PLANNING_COMMAND_LIST}) require the DAIC state to be Discussion before they can run.`,
    '• When UltraThink mode is `api`, append [[ ultrathink ]] to planning commands or switch modes via POST /api/ultrathink/mode.',
    '• Commands pause if context usage exceeds 90%; summarise or POST /api/context/update to reset before retrying.',
    '',
    'Answer prompts with: /answer <sessionId> <questionId> <your response>'
].join('\n');

function toPosixPath(value) {
    if (!value) return '';
    return value.split(path.sep).join('/');
}


function deriveRunbookTemplateSelection(session) {
    if (!session || !Array.isArray(session.responses)) {
        return null;
    }
    const templateResponse = session.responses.find(entry => {
        if (!entry || !entry.questionId) {
            return false;
        }
        return /template/i.test(entry.questionId);
    });
    if (!templateResponse || !templateResponse.answer) {
        return null;
    }
    return String(templateResponse.answer)
        .split(/[,\n]/)
        .map(value => value.trim())
        .filter(Boolean)
        .map(value => value.toLowerCase());
}

async function readContextHistorySnapshots() {
    try {
        const history = await sessionManager.readContextHistory();
        return Array.isArray(history?.history) ? history.history : [];
    } catch (error) {
        console.warn('[Opnix][runbook] Unable to read context history:', error.message || error);
        return [];
    }
}


function logServerError(scope, error) {
    if (!error) {
        console.error(`[Opnix][${scope}] Unknown server error`);
        return;
    }
    const message = error.message ? error.message : String(error);
    console.error(`[Opnix][${scope}] ${message}`, error);
}


async function handleSlashCommand(command) {
    const trimmed = command.trim();
    const [slash] = trimmed.split(/\s+/);

    if (slash.toLowerCase() === '/help') {
        return {
            result: 'CLI help',
            messages: [CLI_HELP_LINES]
        };
    }

    if (slash.toLowerCase() === '/sessions') {
        const sessions = await cliInterviewManager.listSessions();
        const recentGates = await readCliGateLog(5);
        const {
            contextUsed,
            contextLimit,
            daicState,
            ultraThinkMode
        } = getContextTelemetry();
        const fallbackContextRatio = contextLimit ? contextUsed / contextLimit : 0;

        if (sessions.length === 0 && recentGates.length === 0) {
            return {
                result: 'No CLI sessions yet',
                messages: ['No CLI interview sessions found. Start one with /spec or /new-feature.']
            };
        }

        const lines = ['CLI sessions:'];
        if (sessions.length) {
            sessions.forEach(session => {
                const status = session.completed ? 'completed' : 'in-progress';
                const updated = session.updatedAt || session.createdAt || 'unknown';
                lines.push(`${session.sessionId} — ${session.category} (${status}) [updated ${updated}]`);
            });
        } else {
            lines.push('  (no active or archived sessions yet)');
        }

        if (recentGates.length) {
            lines.push('', 'Recent alignment gates:');
            recentGates.forEach(gate => {
                const reasonText = (gate.reasons || []).join('; ') || 'See diagnostics for details';
                const diag = gate.diagnostics || {};
                const daic = diag.daicState || daicState;
                const ultra = diag.ultraThinkMode || ultraThinkMode;
                const hasDiagContext = typeof diag.contextUsed === 'number' && typeof diag.contextLimit === 'number' && diag.contextLimit > 0;
                const ratioText = hasDiagContext ? `${Math.round((diag.contextUsed / diag.contextLimit) * 100)}%` : null;
                const fallbackPercent = Number.isFinite(fallbackContextRatio) ? Math.round(fallbackContextRatio * 100) : 0;
                const contextNote = ratioText ? `Context ${ratioText}` : `Context ${fallbackPercent}%`;
                lines.push(`${gate.timestamp} — ${gate.command}: ${reasonText} (DAIC: ${daic}, UltraThink: ${ultra}, ${contextNote})`);
            });
        }

        return {
            result: 'CLI sessions',
            sessions,
            gates: recentGates,
            messages: lines
        };
    }

    if (slash.toLowerCase() === '/answer') {
        let previousTechStackSummary = null;
        if (techStackManager && typeof techStackManager.getTechStackSummary === 'function') {
            try {
                previousTechStackSummary = await techStackManager.getTechStackSummary({ refresh: false });
            } catch (error) {
                console.warn('CLI tech stack summary baseline failed', error.message);
            }
        }

        const answerMatch = trimmed.match(/^\/answer\s+(\S+)\s+(\S+)\s+([\s\S]+)$/i);
        if (!answerMatch) {
            return {
                error: 'Usage: /answer <sessionId> <questionId> <your answer>'
            };
        }
        const [, sessionId, questionId, answerText] = answerMatch;
        const submission = await cliInterviewManager.submitAnswer({
            sessionId,
            questionId,
            answer: answerText
        });

        const messages = [`Recorded answer for ${questionId}.`];

        if (submission.completed) {
            messages.push('Interview complete.');
            if (submission.summary) {
                messages.push(submission.summary);
            }
            const initialArtifacts = Array.isArray(submission.artifacts) ? submission.artifacts : [];
            initialArtifacts.forEach(artifact => {
                messages.push(`Generated ${path.relative(ROOT_DIR, artifact.path)}`);
            });

            const followUp = await generateCliCategoryArtifacts(submission.session);
            if (followUp.messages.length) {
                messages.push(...followUp.messages);
            }
            let combinedArtifacts = [...initialArtifacts];
            if (followUp.artifacts.length) {
                await cliInterviewManager.appendSessionArtifacts(submission.session.sessionId, followUp.artifacts);
                combinedArtifacts = [...combinedArtifacts, ...followUp.artifacts];
            }

            if (techStackManager && ['spec', 'module'].includes(submission.session.category)) {
                try {
                    const refreshedSummary = await techStackManager.getTechStackSummary({ refresh: true });
                    const deltaMessages = buildTechStackDeltaMessages(previousTechStackSummary, refreshedSummary);
                    if (deltaMessages.length) {
                        messages.push(...deltaMessages);
                    }
                } catch (error) {
                    console.warn('CLI tech stack delta failed', error.message);
                }
            }

            const refreshedSession = await cliInterviewManager.getSession(submission.session.sessionId);

            return {
                result: `Interview ${sessionId} complete`,
                sessionId,
                messages,
                completed: true,
                artifacts: combinedArtifacts,
                session: refreshedSession
            };
        }

        const nextQuestion = submission.nextQuestion;
        const formattedQuestion = cliInterviewManager.formatQuestionForDisplay(nextQuestion);
        messages.push(formattedQuestion);
        messages.push(`Reply with /answer ${sessionId} ${nextQuestion.id} <your response>`);

        return {
            result: `Awaiting response for ${nextQuestion.id}`,
            sessionId,
            questionId: nextQuestion.id,
            messages,
            completed: false
        };
    }

    const commandMeta = CLI_COMMANDS[slash];
    if (!commandMeta) {
        return { error: `Unknown slash command: ${slash}` };
    }

    const alignmentGate = await evaluateAlignmentGate(slash, trimmed);
    if (alignmentGate && alignmentGate.blocked) {
        await logCliAlignmentGate(slash, trimmed, alignmentGate);
        return {
            result: 'Alignment gate active',
            gated: true,
            messages: alignmentGate.messages,
            diagnostics: alignmentGate.diagnostics
        };
    }

    if (commandMeta.handler === 'constitution') {
        try {
            return await cliExtraCommands.handleConstitutionCommand(trimmed);
        } catch (error) {
            logServerError('cli:constitution', error);
            return { error: 'Failed to prepare governance digest' };
        }
    }

    if (commandMeta.handler === 'specify') {
        try {
            return await cliExtraCommands.handleSpecifyCommand(trimmed);
        } catch (error) {
            logServerError('cli:specify', error);
            return { error: 'Failed to generate scoped specification' };
        }
    }

    if (commandMeta.handler === 'branch') {
        if (!cliBranchHandler) {
            return { error: 'Branch handler not initialised' };
        }
        try {
            const branchResponse = await cliBranchHandler.handleCommand(trimmed);
            if (!branchResponse) {
                return {
                    result: 'Branch command',
                    messages: ['Branch handler returned no response.']
                };
            }
            if (!Array.isArray(branchResponse.messages)) {
                branchResponse.messages = branchResponse.messages ? [branchResponse.messages] : [];
            }
            return branchResponse;
        } catch (error) {
            logServerError('cli:branch', error);
            return { error: error.message || 'Failed to execute branch command' };
        }
    }

    if (commandMeta.mode === 'staged') {
        if (!cliStagedFlow) {
            return { error: 'CLI staged flow not initialised' };
        }

        let stagedResponse;
        if (commandMeta.stage === 'plan') {
            stagedResponse = await cliStagedFlow.generatePlanStage();
        } else if (commandMeta.stage === 'tasks') {
            stagedResponse = await cliStagedFlow.generateTasksStage();
        } else {
            return { error: `Unsupported staged command: ${slash}` };
        }

        return {
            result: stagedResponse.result,
            messages: stagedResponse.messages,
            artifacts: stagedResponse.artifacts,
            staged: true,
            metadata: stagedResponse.metadata || null
        };
    }

    const sessionData = await cliInterviewManager.startSession({
        category: commandMeta.category,
        command: trimmed
    });

    const { session, question } = sessionData;
    const formattedQuestion = cliInterviewManager.formatQuestionForDisplay(question);

    const messages = [
        `${commandMeta.label} started (Session ${session.sessionId}).`,
        formattedQuestion,
        `Reply with /answer ${session.sessionId} ${question.id} <your response>`
    ];

    return {
        result: `${commandMeta.label} ready`,
        sessionId: session.sessionId,
        questionId: question.id,
        messages,
        started: true
    };
}

async function ensureCliArtifactsDirectory() {
    try {
        await fsPromises.access(cliInterviewManager.CLI_ARTIFACTS_DIR);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fsPromises.mkdir(cliInterviewManager.CLI_ARTIFACTS_DIR, { recursive: true });
        } else {
            throw error;
        }
    }
}

const cliStagedFlow = createCliStagedFlow({
    auditManager: {
        runInitialAudit
    },
    cliInterviewManager,
    ensureArtifactsDirectory: ensureCliArtifactsDirectory,
    readData,
    normaliseTicketStatus,
    statusConstants: {
        statusReported,
        statusInProgress,
        statusFinished,
        priorityHigh,
        priorityMedium,
        priorityLow
    },
    rootDir: ROOT_DIR
});

const cliExtraCommands = createCliExtraCommands({
    rootDir: ROOT_DIR,
    cliArtifactsDir: cliInterviewManager.CLI_ARTIFACTS_DIR,
    ensureCliArtifactsDirectory,
    moduleDetector,
    readData,
    readFeaturesFile,
    loadPackageJson,
    ensureExportStructure,
    EXPORT_SUBDIRS,
    deriveTechStack,
    inferProjectType,
    inferPrimaryLanguage,
    specGenerator
});

async function writeCliMarkdownArtifact(prefix, title, session) {
    await ensureCliArtifactsDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.md`;
    const filepath = path.join(cliInterviewManager.CLI_ARTIFACTS_DIR, filename);

    const lines = [
        `# ${title}`,
        '',
        `Session: ${session.sessionId}`,
        `Category: ${session.category}`,
        `Generated: ${new Date().toISOString()}`,
        ''
    ];

    const questions = Array.isArray(session.questions) ? session.questions : [];
    (session.responses || []).forEach(entry => {
        const question = questions.find(q => q && q.id === entry.questionId);
        const prompt = question?.prompt || entry.questionId;
        lines.push(`## ${prompt}`, entry.answer || '[no response]', '');
    });

    await fsPromises.writeFile(filepath, lines.join('\n'));
    return {
        type: `${prefix}-summary`,
        path: filepath,
        filename,
        category: session.category
    };
}

async function writeCliModuleSummary(session) {
    await ensureCliArtifactsDirectory();
    const modulesResult = await moduleDetector.detectModules(__dirname);
    const payload = {
        generatedAt: new Date().toISOString(),
        sessionId: session.sessionId,
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        summary: modulesResult.summary
    };
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `cli-module-summary-${timestamp}.json`;
    const filepath = path.join(cliInterviewManager.CLI_ARTIFACTS_DIR, filename);
    await fsPromises.writeFile(filepath, JSON.stringify(payload, null, 2));
    return {
        type: 'module-summary',
        path: filepath,
        filename,
        category: session.category
    };
}

async function appendPlanStageIfAvailable({ collector = { messages: [], artifacts: [] }, flow = cliStagedFlow } = {}) {
    if (!flow || typeof flow.generatePlanStage !== 'function') {
        return null;
    }
    const planResult = await flow.generatePlanStage();
    if (!planResult) {
        return null;
    }

    if (planResult.messages && Array.isArray(planResult.messages) && planResult.messages.length) {
        collector.messages.push(...planResult.messages);
    }
    if (planResult.artifacts && Array.isArray(planResult.artifacts) && planResult.artifacts.length) {
        collector.artifacts.push(...planResult.artifacts);
    }
    return planResult;
}

async function appendTasksStageIfAvailable({ collector = { messages: [], artifacts: [] }, flow = cliStagedFlow } = {}) {
    if (!flow || typeof flow.generateTasksStage !== 'function') {
        return null;
    }
    const tasksResult = await flow.generateTasksStage();
    if (!tasksResult) {
        return null;
    }

    if (tasksResult.messages && Array.isArray(tasksResult.messages) && tasksResult.messages.length) {
        collector.messages.push(...tasksResult.messages);
    }
    if (tasksResult.artifacts && Array.isArray(tasksResult.artifacts) && tasksResult.artifacts.length) {
        collector.artifacts.push(...tasksResult.artifacts);
    }
    return tasksResult;
}

async function generateCliCategoryArtifacts(session) {
    if (!session || !session.category) {
        return { artifacts: [], messages: [] };
    }

    const { category } = session;
    const artifacts = [];
    const messages = [];

    try {
        if (category === 'spec') {
            const audit = await runInitialAudit();
            const exportsList = Array.isArray(audit.exports) ? audit.exports : [];
            exportsList.forEach(item => {
                artifacts.push({
                    type: item.category || item.format || 'export',
                    path: item.path,
                    relativePath: item.relativePath || null,
                    description: item.filename || item.name || item.relativePath || ''
                });
            });
            exportsList.forEach(item => {
                messages.push(`Generated ${item.relativePath || item.path}`);
            });
            const stagedCollector = { messages: [], artifacts: [] };
            const sessionId = session?.sessionId || null;
            const checkpointSessionId = sessionId || 'system';
            let planResult = null;
            let planChainRollback = null;
            try {
                planResult = await appendPlanStageIfAvailable({ collector: stagedCollector });
            } catch (error) {
                logServerError('cli:plan-stage', error);
                stagedCollector.messages.push(`Plan stage failed: ${error.message || error}`);
            }

            if (planResult && planTaskChainer && typeof planTaskChainer.chainPlanToTasks === 'function') {
                let preChainDataSnapshot = null;
                try {
                    try {
                        const existing = await readData();
                        preChainDataSnapshot = existing ? JSON.parse(JSON.stringify(existing)) : { tickets: [], nextId: null };
                    } catch (snapshotError) {
                        logServerError('cli:plan-chain-snapshot', snapshotError);
                    }

                    const planArtifact = Array.isArray(planResult.artifacts) && planResult.artifacts.length
                        ? planResult.artifacts[0]
                        : null;
                    const planArtifactRelativePath = planArtifact?.relativePath
                        || (planArtifact?.path ? path.relative(ROOT_DIR, planArtifact.path) : null);
                    const chainResult = await planTaskChainer.chainPlanToTasks({
                        planResult,
                        sessionId,
                        planArtifactRelativePath
                    });
                    if (chainResult) {
                        const createdTicketIds = Array.isArray(chainResult.createdTickets)
                            ? chainResult.createdTickets
                                .map(ticket => ticket?.id)
                                .filter(id => id !== undefined && id !== null)
                            : [];
                        if (preChainDataSnapshot && (createdTicketIds.length || chainResult.scaffold)) {
                            planChainRollback = {
                                checkpointId: null,
                                snapshot: preChainDataSnapshot,
                                createdTicketIds,
                                scaffoldPath: chainResult.scaffold?.path || null,
                                scaffoldRelativePath: chainResult.scaffold?.relativePath || null,
                                planArtifactRelativePath
                            };
                            try {
                                const checkpointPayload = {
                                    stage: 'plan-chain',
                                    ticketsBefore: Array.isArray(preChainDataSnapshot.tickets) ? preChainDataSnapshot.tickets : [],
                                    nextIdBefore: preChainDataSnapshot.nextId ?? null,
                                    createdTicketIds,
                                    scaffoldRelativePath: chainResult.scaffold?.relativePath || null,
                                    planArtifactRelativePath
                                };
                                planChainRollback.checkpointId = await checkpointManager.createCheckpoint(
                                    checkpointSessionId,
                                    checkpointPayload,
                                    {
                                        type: 'plan-chain',
                                        description: 'Pre-implementation plan->task checkpoint',
                                        critical: true,
                                        context: {
                                            sessionId,
                                            planArtifactRelativePath,
                                            createdTicketCount: createdTicketIds.length
                                        }
                                    }
                                );
                            } catch (checkpointError) {
                                logServerError('cli:plan-chain-checkpoint', checkpointError);
                            }
                        }
                        if (preImplementationDiscussionManager && typeof preImplementationDiscussionManager.ensureDiscussion === 'function') {
                            try {
                                const discussionResult = await preImplementationDiscussionManager.ensureDiscussion({
                                    sessionId,
                                    planArtifactRelativePath,
                                    tasks: chainResult.tasks,
                                    createdTicketIds,
                                    planSummary: planResult?.summary || planResult?.metadata?.summary || null,
                                    checkpointId: planChainRollback?.checkpointId || null
                                });
                                if (discussionResult?.created) {
                                    stagedCollector.messages.push('Pre-implementation discussion checkpoint created — capture review notes via /api/pre-implementation-discussions.');
                                }
                            } catch (discussionError) {
                                logServerError('cli:pre-implementation-discussion', discussionError);
                            }
                        }
                        if (Array.isArray(chainResult.createdTickets) && chainResult.createdTickets.length) {
                            const createdCount = chainResult.createdTickets.length;
                            stagedCollector.messages.push(`${createdCount} ticket${createdCount === 1 ? '' : 's'} created from plan chaining.`);
                        }
                        if (chainResult.scaffold) {
                            stagedCollector.artifacts.push({
                                type: 'plan-task-scaffold',
                                path: chainResult.scaffold.path,
                                relativePath: chainResult.scaffold.relativePath,
                                description: 'Plan-derived task queue'
                            });
                            stagedCollector.messages.push(`Plan tasks saved to ${chainResult.scaffold.relativePath}`);
                        }
                        if (implementationChainer && typeof implementationChainer.chainTasksToImplementation === 'function' && Array.isArray(chainResult.tasks) && chainResult.tasks.length) {
                            try {
                                const implementationResult = await implementationChainer.chainTasksToImplementation({
                                    tasks: chainResult.tasks,
                                    sessionId,
                                    planArtifactRelativePath,
                                    planTasksScaffold: chainResult.scaffold?.relativePath || null
                                });

                                if (implementationResult?.workspaces?.length) {
                                    implementationResult.workspaces.forEach(workspace => {
                                        if (workspace.relativePath) {
                                            stagedCollector.artifacts.push({
                                                type: 'workspace',
                                                path: path.join(ROOT_DIR, workspace.relativePath),
                                                relativePath: workspace.relativePath,
                                                description: `Workspace for ${workspace.title || `ticket ${workspace.ticketId ?? 'N/A'}`}`
                                            });
                                        }
                                        stagedCollector.messages.push(`Workspace created for ${workspace.branchName}: ${workspace.relativePath}`);
                                        if (workspace.branchScript) {
                                            stagedCollector.messages.push(`Branch helper script ready: ${workspace.branchScript}`);
                                        }
                                    });
                                }

                                if (implementationResult?.manifestPath) {
                                    stagedCollector.messages.push(`Workspace manifest updated: ${implementationResult.manifestPath}`);
                                }
                            } catch (error) {
                                logServerError('cli:implementation-chain', error);
                                stagedCollector.messages.push(`Task-to-implementation chaining failed: ${error.message || error}`);
                                if (planChainRollback && Array.isArray(planChainRollback.createdTicketIds) && planChainRollback.createdTicketIds.length) {
                                    try {
                                        if (planChainRollback.snapshot) {
                                            await writeData(planChainRollback.snapshot);
                                            stagedCollector.messages.push('Restored ticket store from pre-plan checkpoint after implementation failure.');
                                        }
                                        if (planChainRollback.scaffoldPath) {
                                            try {
                                                const scaffoldAbsolute = path.isAbsolute(planChainRollback.scaffoldPath)
                                                    ? planChainRollback.scaffoldPath
                                                    : path.join(ROOT_DIR, planChainRollback.scaffoldPath);
                                                await fsPromises.rm(scaffoldAbsolute, { force: true });
                                                stagedCollector.messages.push('Removed plan-task scaffold created before failure.');
                                            } catch (scaffoldError) {
                                                logServerError('cli:rollback-scaffold', scaffoldError);
                                            }
                                        }
                                    } catch (rollbackError) {
                                        logServerError('cli:rollback-tickets', rollbackError);
                                    }
                                }
                            }
                        }
                    }
                } catch (error) {
                    logServerError('cli:plan-chain', error);
                    stagedCollector.messages.push(`Plan-to-task chaining failed: ${error.message || error}`);
                    if (preChainDataSnapshot) {
                        try {
                            await writeData(preChainDataSnapshot);
                            stagedCollector.messages.push('Reverted ticket store to state before plan->task chaining attempt.');
                        } catch (rollbackError) {
                            logServerError('cli:plan-chain-rollback', rollbackError);
                        }
                    }
                }
            }

            try {
                await appendTasksStageIfAvailable({ collector: stagedCollector });
            } catch (error) {
                logServerError('cli:tasks-stage', error);
                stagedCollector.messages.push(`Task stage failed: ${error.message || error}`);
            }

            artifacts.push(...stagedCollector.artifacts);
            messages.push(...stagedCollector.messages);

            try {
                await ensureExportStructure();
                const [modulesResult, ticketData, packageJson] = await Promise.all([
                    moduleDetector.detectModules(__dirname),
                    readData(),
                    loadPackageJson()
                ]);
                const tickets = Array.isArray(ticketData.tickets) ? ticketData.tickets : [];
                const techStack = deriveTechStack(packageJson || {}, modulesResult.modules);
                const projectName = (packageJson && packageJson.name)
                    || (Array.isArray(session.responses)
                        ? session.responses.find(entry => entry.questionId === 'project-name')?.answer
                        : null)
                    || 'Opnix Project';
                const contextHistory = await readContextHistorySnapshots();
                const runbookMeta = await runbookGenerator.generateRunbook({
                    projectName,
                    session,
                    modulesResult,
                    tickets,
                    techStack,
                    exportsDir: EXPORT_SUBDIRS.runbooks,
                    templates: runbookTemplates.defaultTemplates(),
                    contextHistory
                });
                const normalisedRunbook = withRelativePath(runbookMeta);
                artifacts.push(normalisedRunbook);
                messages.push(`Runbook drafted at ${normalisedRunbook.relativePath}`);
            } catch (error) {
                logServerError('cli:runbook-auto', error);
                messages.push('Runbook automation warning: generation failed (see server logs).');
            }
        } else if (category === 'feature') {
            const featureSummary = await writeCliMarkdownArtifact('feature-plan', 'Feature Interview Plan', session);
            artifacts.push(featureSummary);
            messages.push(`Generated ${path.relative(ROOT_DIR, featureSummary.path)}`);
        } else if (category === 'module') {
            const moduleSummary = await writeCliModuleSummary(session);
            artifacts.push(moduleSummary);
            messages.push(`Generated ${path.relative(ROOT_DIR, moduleSummary.path)}`);
        } else if (category === 'runbook') {
            await ensureExportStructure();
            const [modulesResult, ticketData, packageJson] = await Promise.all([
                moduleDetector.detectModules(__dirname),
                readData(),
                loadPackageJson()
            ]);
            const tickets = Array.isArray(ticketData.tickets) ? ticketData.tickets : [];
            const techStack = deriveTechStack(packageJson || {}, modulesResult.modules);
            const projectName = (packageJson && packageJson.name)
                || (Array.isArray(session.responses)
                    ? session.responses.find(entry => entry.questionId === 'project-name')?.answer
                    : null)
                || 'Opnix Project';
            const templateSelection = deriveRunbookTemplateSelection(session) || runbookTemplates.defaultTemplates();
            const contextHistory = await readContextHistorySnapshots();
            const runbookMeta = await runbookGenerator.generateRunbook({
                projectName,
                session,
                modulesResult,
                tickets,
                techStack,
                exportsDir: EXPORT_SUBDIRS.runbooks,
                templates: templateSelection,
                contextHistory
            });
            const normalisedRunbook = withRelativePath(runbookMeta);
            artifacts.push(normalisedRunbook);
            messages.push(`Generated ${path.relative(ROOT_DIR, normalisedRunbook.path)}`);
        }
    } catch (error) {
        logServerError('cli:artifacts', error);
        messages.push(`Artifact generation failed: ${error.message || error}`);
    }

    return { artifacts, messages };
}

// Serve static files FIRST before any middleware
const PUBLIC_DIR = path.join(OPNIX_DIR, 'public');
console.log(`📁 Serving static files from: ${PUBLIC_DIR}`);
app.use(express.static(PUBLIC_DIR, {
    maxAge: '1h',
    fallthrough: true,
    index: false  // Don't serve index.html from static, let createRootRoutes handle it
}));

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(compression({ threshold: 1024 }));

// Status tracking middleware
app.use(healthCheckMiddleware);
app.use(addStatusContext);
app.use(trackTokenUsage);

// Bulk operations dependencies middleware
app.use((req, res, next) => {
    req.bulkOpsDeps = {
        readData,
        writeData,
        readFeaturesFile,
        writeFeaturesFile,
        validateTicketStatusChange,
        validateFeatureStatusChange,
        syncRoadmapState
    };
    next();
});

app.use(createRootRoutes({
    rootDir: OPNIX_DIR,  // Serve index.html from opnix installation
    port: PORT
}));
const {
    router: contextRouter,
    getContextTelemetry: contextTelemetryAccessor,
    ultraThinkTriggerRoute,
    contextStatusRoute,
    contextUpdateRoute,
    ultraThinkModeRoute
} = createContextRoutes({
    logger: console,
    contextLimit: 160000
});
getContextTelemetry = contextTelemetryAccessor;
app.use(contextRouter);
app.use(createTicketRoutes({
    readData,
    writeData,
    syncRoadmapState,
    logServerError,
    validateTicketStatusChange,
    VALID_TICKET_STATUSES,
    VALID_TICKET_PRIORITIES,
    statusReported,
    statusInProgress,
    statusFinished,
    priorityHigh,
    gitAutomationManager
}));
app.use(createModulesRoutes({
    moduleDetector,
    writeDetectedModules,
    readDetectedModules,
    logServerError,
    ROOT_DIR,
    readModuleLinks,
    writeModuleLinks,
    ensureDataDirectory,
    migrateLegacyFile,
    MANUAL_MODULES_FILE,
    syncRoadmapState
}));
app.use(createFeaturesRoutes({
    readFeaturesFile,
    writeFeaturesFile,
    syncRoadmapState,
    normaliseAcceptanceCriteria,
    normaliseFeatureStatus,
    validateFeatureStatusChange,
    normaliseFeatureRecord,
    VALID_FEATURE_STATUSES,
    gitAutomationManager
}));
app.use(createCanvasRoutes({
    ensureExportStructure,
    EXPORT_SUBDIRS,
    EXPORTS_DIR,
    ensureRoadmapStateFile,
    writeRoadmapState,
    readRoadmapState,
    syncRoadmapState,
    listRoadmapVersions,
    rollbackRoadmapState,
    updateRoadmapMilestone
}));
app.use(createDiagramRoutes({
    ensureExportStructure,
    listExportFiles,
    withRelativePath,
    loadDiagramContext,
    getDiagramSources,
    EXPORT_SUBDIRS,
    EXPORTS_DIR,
    DIAGRAM_TYPES,
    diagramGenerator
}));
app.use(createStorybookRoutes());
app.use(createAgentsRoutes({
    readData,
    writeData,
    statusReported,
    statusInProgress,
    runInitialAudit,
    handleSlashCommand,
    logServerError,
    AGENTS_DIR,
    agentHandoffManager
}));
app.use(createInterviewsRoutes());
app.use(createChecklistsRoutes({
    readChecklistsFile,
    writeChecklistsFile,
    normaliseChecklistStatus,
    checklistPending,
    normaliseChecklist,
    validateChecklistStatusChange,
    normaliseStatusHook
}));
app.use(createTechStackRoutes({ techStackManager }));
app.use('/api/recovery', recoveryRoutes);
app.use('/api/sessions', sessionsRoutes);
app.use('/api/approvals', createApprovalGatesRoutes({
    approvalGatesManager,
    discussionManager: preImplementationDiscussionManager
}));
app.use('/api/pre-implementation-discussions', createPreImplementationDiscussionRoutes({
    discussionManager: preImplementationDiscussionManager,
    approvalGatesManager
}));
app.use('/api/preferences', preferencesRoutes);
app.use('/api/task-logs', taskLogsRoutes);
app.use('/api/status', statusDashboardRoutes);
app.use('/api/bulk', bulkOperationsRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/branches', branchesRoutes);
app.use(createDocsRoutes({
    rootDir: ROOT_DIR,
    docsGenerator,
    moduleDetector,
    readData,
    readFeaturesFile,
    loadPackageJson,
    deriveTechStack,
    normaliseTicketStatus,
    syncRoadmapState,
    statusConstants: {
        statusReported,
        statusInProgress,
        statusFinished
    },
    exportsDir: EXPORT_SUBDIRS.docs
}));
app.use(createSpecRoutes({
    ensureExportStructure,
    loadDiagramContext,
    apiSpecGenerator,
    specGenerator,
    runbookGenerator,
    moduleDetector,
    readData,
    loadPackageJson,
    deriveTechStack,
    syncRoadmapState,
    EXPORT_SUBDIRS,
    EXPORTS_DIR,
    ROOT_DIR,
    toPosixPath,
    withRelativePath,
    cliInterviewManager,
    generateCliCategoryArtifacts,
    cliExtraCommands
}));
app.use(createProgressiveRoutes({
    initializeProgressiveSystem,
    logServerError,
    moduleDetector,
    ROOT_DIR
}));
app.use(createCliRoutes({
    fsPromises,
    resolveWorkingDirectory,
    execAsync,
    logServerError,
    readTerminalHistory,
    writeTerminalHistory,
    normaliseTerminalEntry,
    MAX_TERMINAL_HISTORY,
    ROOT_DIR,
    getContextTelemetry,
    clearTerminalHistory,
    cliInterviewManager,
    readCliGateLog,
    readBranchStatus
}));
app.use(createExportsRoutes({
    rootDir: ROOT_DIR,
    markdownArchiveRoots: MARKDOWN_ARCHIVE_ROOTS,
    markdownArchiveDenylist: MARKDOWN_ARCHIVE_DENYLIST,
    markdownExtensions: MARKDOWN_EXTENSIONS,
    toPosixPath,
    ensureDirectory,
    readData,
    logServerError,
    ensureExportStructure,
    listExportFiles,
    exportsDir: EXPORTS_DIR
}));

// Initialize data file if it doesn't exist
async function initDataFile() {
    await ensureDataDirectory();
    await importLegacyTicketsIfPresent();
    try {
        await fsPromises.access(DATA_FILE);
    } catch {
        const initialData = {
            tickets: [
                {
                    id: 1,
                    title: "Example: Fix Authentication Bug",
                    description: "Users cannot login with @ symbol. Review auth validation logic and provide fix. Check /src/auth/validator.js line 45.",
                    priority: "high",
                    status: "reported",
                    tags: ["BUG", "AUTH", "BACKEND"],
                    created: new Date().toISOString(),
                    files: ["src/auth/validator.js"]
                }
            ],
            nextId: 2
        };
        await fsPromises.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('✓ Created data/tickets.json with example ticket');
    }

    try {
        await fsPromises.access(CHECKLIST_FILE);
    } catch {
        const initialChecklists = [];
        await fsPromises.writeFile(CHECKLIST_FILE, JSON.stringify(initialChecklists, null, 2));
        console.log('✓ Prepared data/checklists.json');
    }

    try {
        await fsPromises.access(TERMINAL_HISTORY_FILE);
    } catch {
        await fsPromises.writeFile(TERMINAL_HISTORY_FILE, JSON.stringify([], null, 2));
        console.log('✓ Prepared data/terminal-history.json');
    }
}

// Helper functions
async function readData() {
    await ensureDataDirectory();
    await importLegacyTicketsIfPresent();

    let parsed;
    try {
        const raw = await fsPromises.readFile(DATA_FILE, 'utf8');
        parsed = JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            const baseline = { tickets: [], nextId: 1 };
            await writeData(baseline);
            return baseline;
        }
        throw error;
    }

    const data = normaliseTicketsPayload(parsed);

    const maxExistingId = data.tickets.reduce((max, ticket) => {
        const ticketId = typeof ticket.id === 'number' ? ticket.id : parseInt(ticket.id, 10);
        if (Number.isFinite(ticketId)) {
            return Math.max(max, ticketId);
        }
        return max;
    }, 0);

    if (typeof data.nextId !== 'number' || data.nextId <= maxExistingId) {
        data.nextId = maxExistingId + 1;
    }

    const original = JSON.stringify(parsed, null, 2);
    const normalised = JSON.stringify(data, null, 2);

    if (original !== normalised) {
        await writeData(data);
    }

    return data;
}

async function writeData(data) {
    await ensureDataDirectory();
    const payload = normaliseTicketsPayload(data);
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(payload, null, 2));
    return payload;
}

planTaskChainer = createPlanTaskChainer({
    readData,
    writeData,
    scaffoldRoot: SCAFFOLD_ROOT,
    rootDir: ROOT_DIR,
    statusConstants: {
        statusReported,
        statusInProgress,
        statusFinished,
        priorityLow,
        priorityMedium,
        priorityHigh
    },
    logger: console
});

implementationChainer = createImplementationChainer({
    rootDir: ROOT_DIR,
    workspaceRoot: path.join(ROOT_DIR, '.opnix', 'workspaces'),
    logger: console,
    approvalGatesManager
});
cliBranchHandler = createCliBranchHandler({
    rootDir: ROOT_DIR,
    workspaceRoot: path.join(ROOT_DIR, '.opnix', 'workspaces'),
    execAsync,
    fsImpl: fsPromises,
    logger: console,
    approvalGatesManager
});

async function ensureDirectory(dirPath) {
    try {
        await fsPromises.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            try {
                await fsPromises.mkdir(dirPath, { recursive: true });
            } catch (mkdirError) {
                if (mkdirError.code === 'EACCES') {
                    const parentDir = path.dirname(dirPath);
                    console.error(`\n❌ Permission Error: Cannot create directory`);
                    console.error(`   Directory: ${dirPath}`);
                    console.error(`   \n   The parent directory exists but you don't have write permission.`);
                    console.error(`   Fix with: sudo chown -R $USER:$USER ${parentDir}\n`);
                }
                throw mkdirError;
            }
        } else if (error.code === 'EACCES') {
            console.error(`\n❌ Permission Error: Cannot write to existing directory`);
            console.error(`   Directory: ${dirPath}`);
            console.error(`   \n   This directory exists but is owned by another user (likely root).`);
            console.error(`   Fix with: sudo chown -R $USER:$USER ${dirPath}\n`);
            throw error;
        } else {
            throw error;
        }
    }
}

async function ensureDataDirectory() {
    await ensureDirectory(DATA_DIR);
}

async function readTerminalHistory() {
    await ensureDataDirectory();
    try {
        const raw = await fsPromises.readFile(TERMINAL_HISTORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fsPromises.writeFile(TERMINAL_HISTORY_FILE, JSON.stringify([], null, 2));
            return [];
        }
        throw error;
    }
}

async function writeTerminalHistory(entries) {
    await ensureDataDirectory();
    const serialisable = Array.isArray(entries) ? entries : [];
    await fsPromises.writeFile(TERMINAL_HISTORY_FILE, JSON.stringify(serialisable, null, 2));
}

async function clearTerminalHistory() {
    await writeTerminalHistory([]);
    return [];
}

async function migrateLegacyFile(legacyPath, targetPath) {
    if (!legacyPath || legacyPath === targetPath) return;
    try {
        await fsPromises.access(targetPath);
        return;
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    try {
        await fsPromises.access(legacyPath);
        await ensureDataDirectory();
        await fsPromises.rename(legacyPath, targetPath);
        console.log(`✓ Migrated ${path.basename(legacyPath)} to ${path.relative(__dirname, DATA_DIR)}/`);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }
}

async function archiveLegacyTicketsFile() {
    try {
        await ensureDirectory(LEGACY_IMPORT_DIR);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const destination = path.join(LEGACY_IMPORT_DIR, `tickets.${timestamp}.legacy.json`);
        await fsPromises.rename(LEGACY_TICKETS_FILE, destination);
        return destination;
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function importLegacyTicketsIfPresent() {
    let legacyStats;
    try {
        legacyStats = await fsPromises.stat(LEGACY_TICKETS_FILE);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }

    let targetStats;
    try {
        targetStats = await fsPromises.stat(DATA_FILE);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
    }

    if (targetStats && targetStats.mtimeMs >= legacyStats.mtimeMs) {
        return null;
    }

    let parsed;
    try {
        const raw = await fsPromises.readFile(LEGACY_TICKETS_FILE, 'utf8');
        parsed = JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        console.warn('⚠️  Legacy tickets.json is not valid JSON. Skipping import.');
        return null;
    }

    const normalised = normaliseTicketsPayload(parsed);
    await ensureDataDirectory();
    await fsPromises.writeFile(DATA_FILE, JSON.stringify(normalised, null, 2));
    await archiveLegacyTicketsFile();
    console.log('✓ Imported legacy tickets.json into data/tickets.json');
    return normalised;
}

async function ensureExportStructure() {
    await ensureDirectory(EXPORTS_DIR);
    await Promise.all(Object.values(EXPORT_SUBDIRS).map(dir => ensureDirectory(dir)));
}

async function listExportFiles(dir = EXPORTS_DIR) {
    const entries = await fsPromises.readdir(dir, { withFileTypes: true }).catch(() => []);
    const results = await Promise.all(entries.map(async entry => {
        const fullPath = path.join(dir, entry.name);
        if (entry.isDirectory()) {
            return listExportFiles(fullPath);
        }
        const stats = await fsPromises.stat(fullPath).catch(() => null);
        if (!stats) return null;
        const relativePath = path.relative(EXPORTS_DIR, fullPath);
        const [category] = relativePath.split(path.sep);
        return {
            name: entry.name,
            size: stats.size,
            modified: stats.mtime.toISOString(),
            path: fullPath,
            relativePath,
            category
        };
    }));
    return results.flat().filter(Boolean);
}

function withRelativePath(meta) {
    if (!meta || !meta.path) return meta;
    return {
        ...meta,
        relativePath: path.relative(EXPORTS_DIR, meta.path)
    };
}

function getDiagramSources(type) {
    switch (type) {
    case 'architecture':
        return ['modules', 'moduleEdges'];
    case 'sequence':
        return ['features', 'modules'];
    case 'entity':
        return ['modules'];
    case 'delivery-flow':
        return ['project', 'techStack', 'features', 'tickets'];
    default:
        return [];
    }
}

function resolveWorkingDirectory(requestedCwd) {
    if (!requestedCwd || typeof requestedCwd !== 'string') return ROOT_DIR;
    const absolute = path.resolve(ROOT_DIR, requestedCwd);
    if (!absolute.startsWith(ROOT_DIR)) {
        return ROOT_DIR;
    }
    return absolute;
}

function normaliseTerminalEntry(entry) {
    if (!entry || typeof entry !== 'object') return null;
    const clone = { ...entry };
    clone.stdout = typeof clone.stdout === 'string' ? clone.stdout : '';
    clone.stderr = typeof clone.stderr === 'string' ? clone.stderr : '';
    if (clone.stdout.length > 8000) {
        clone.stdout = `${clone.stdout.slice(0, 8000)}\n… output truncated`;
    }
    if (clone.stderr.length > 8000) {
        clone.stderr = `${clone.stderr.slice(0, 8000)}\n… output truncated`;
    }
    return clone;
}

async function readModuleLinks() {
    await ensureDataDirectory();
    await migrateLegacyFile(path.join(__dirname, 'module-links.json'), MODULE_LINKS_FILE);
    try {
        const raw = await fsPromises.readFile(MODULE_LINKS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function writeModuleLinks(links) {
    await ensureDataDirectory();
    await fsPromises.writeFile(MODULE_LINKS_FILE, JSON.stringify(links, null, 2));
}

async function readFeaturesFile() {
    await ensureDataDirectory();
    await migrateLegacyFile(path.join(__dirname, 'features.json'), FEATURES_FILE);
    try {
        const raw = await fsPromises.readFile(FEATURES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? normaliseFeatureCollection(parsed) : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function writeFeaturesFile(features) {
    await ensureDataDirectory();
    const serialisable = normaliseFeatureCollection(features);
    await fsPromises.writeFile(FEATURES_FILE, JSON.stringify(serialisable, null, 2));
    return serialisable;
}

async function loadPackageJson() {
    try {
        const raw = await fsPromises.readFile(PACKAGE_JSON_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}

async function readChecklistsFile() {
    await ensureDataDirectory();
    try {
        const raw = await fsPromises.readFile(CHECKLIST_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(normaliseChecklist).filter(Boolean) : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function writeChecklistsFile(checklists) {
    await ensureDataDirectory();
    const serialisable = Array.isArray(checklists) ? checklists.map(normaliseChecklist).filter(Boolean) : [];
    await fsPromises.writeFile(CHECKLIST_FILE, JSON.stringify(serialisable, null, 2));
    return serialisable;
}

function inferPrimaryLanguage(packageJson) {
    if (!packageJson) return null;
    const names = Object.keys({
        ...(packageJson.dependencies || {}),
        ...(packageJson.devDependencies || {})
    }).map(name => name.toLowerCase());

    if (names.some(name => name.includes('typescript'))) return 'TypeScript';
    if (names.some(name => name.includes('python'))) return 'Python';
    if (names.some(name => name.includes('go'))) return 'Go';
    if (names.some(name => name.includes('rust'))) return 'Rust';
    if (names.length === 0) return null;
    return 'JavaScript';
}

function deriveTechStack(packageJson, modules) {
    const dependencies = Object.keys(packageJson?.dependencies || {}).sort();
    const devDependencies = Object.keys(packageJson?.devDependencies || {}).sort();
    const dependencyNames = dependencies.map(name => name.toLowerCase());
    const devDependencyNames = devDependencies.map(name => name.toLowerCase());
    const frameworksSet = new Set();

    (modules || []).forEach(module => {
        (module.frameworks || []).forEach(framework => frameworksSet.add(framework));
    });

    const frameworkHints = ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt', 'express', 'fastify', 'koa', 'nest', 'electron', 'react-native', 'expo', 'django', 'flask'];
    frameworkHints.forEach(name => {
        if (dependencyNames.includes(name) || devDependencyNames.includes(name)) {
            frameworksSet.add(name);
        }
    });

    return {
        dependencies,
        devDependencies,
        frameworks: Array.from(frameworksSet).sort((a, b) => a.localeCompare(b)),
        packageManager: packageJson?.packageManager || null
    };
}

function inferProjectType({ modules, techStack }) {
    const moduleTypes = new Set((modules || []).map(module => module.type));
    const surfaceSet = new Set([
        ...(techStack.dependencies || []).map(name => name.toLowerCase()),
        ...(techStack.devDependencies || []).map(name => name.toLowerCase()),
        ...(techStack.frameworks || []).map(name => name.toLowerCase())
    ]);

    if (moduleTypes.has('frontend')) return 'Web Application';
    if (surfaceSet.has('react-native') || surfaceSet.has('expo')) return 'Mobile App';
    if (surfaceSet.has('electron')) return 'Desktop Software';
    if (surfaceSet.has('express') || surfaceSet.has('fastify') || surfaceSet.has('koa') || surfaceSet.has('nest')) {
        return 'API Service';
    }
    if (moduleTypes.has('documentation')) return 'Documentation System';
    if ((modules || []).length === 0 && surfaceSet.size === 0) return 'New Project';
    return 'Operational Toolkit';
}

async function readSetupState() {
    await ensureDataDirectory();
    try {
        const raw = await fsPromises.readFile(SETUP_STATE_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return {};
        throw error;
    }
}

async function writeSetupState(state) {
    await ensureDataDirectory();
    await fsPromises.writeFile(SETUP_STATE_FILE, JSON.stringify(state, null, 2));
}

async function writeDetectedModules(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    await ensureDataDirectory();
    const payload = {
        generatedAt: new Date().toISOString(),
        modules: Array.isArray(snapshot.modules) ? snapshot.modules : [],
        edges: Array.isArray(snapshot.edges) ? snapshot.edges : [],
        summary: snapshot.summary && typeof snapshot.summary === 'object' ? snapshot.summary : {}
    };
    await fsPromises.writeFile(DETECTED_MODULES_FILE, JSON.stringify(payload, null, 2));
    return payload;
}

async function readDetectedModules() {
    try {
        const raw = await fsPromises.readFile(DETECTED_MODULES_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
}


// Progressive Document System Routes
let progressiveSystem = null;

// Initialize Progressive Document System
async function initializeProgressiveSystem() {
    if (!progressiveSystem) {
        progressiveSystem = new ProgressiveDocumentSystem(ROOT_DIR);
    }
    return progressiveSystem;
}

// Auto-trigger analysis on server start (runs in background)
async function runInitialProgressiveAnalysis() {
    try {
        console.log('🔍 Running initial progressive analysis...');
        const system = await initializeProgressiveSystem();
        await system.initialize();
        console.log('✅ Progressive analysis complete - artifacts available in /exports');
    } catch (error) {
        console.error('⚠️  Initial progressive analysis failed:', error.message);
        // Non-blocking - server should still start
    }
}

// Initialize auto-recovery system
async function initializeAutoRecoverySystem() {
    try {
        console.log('🔄 Initializing auto-recovery system...');

        // Initialize checkpoint manager
        checkpointManager.initialize();

        // Detect and restore any interrupted sessions
        const restoredSessions = await sessionRestoration.detectAndRestoreInterruptedSessions();

        if (restoredSessions.length > 0) {
            console.log(`🔄 Auto-recovery: Restored ${restoredSessions.length} interrupted sessions`);
            restoredSessions.forEach(session => {
                console.log(`   ↳ Session ${session.sessionId} (${session.category || 'unknown'})`);
            });
        } else {
            console.log('🔄 Auto-recovery: No interrupted sessions found');
        }

        // Start background cleanup tasks
        checkpointManager.startPeriodicCleanup();

        console.log('✅ Auto-recovery system initialized successfully');

    } catch (error) {
        console.error('⚠️  Auto-recovery system initialization failed:', error.message);
        // Non-blocking - server should still start even if recovery fails
    }
}

// Start server
async function start() {
    await initDataFile();
    await ensureExportStructure();
    await ensureRoadmapStateFile();
    
    // Initialize question file watcher for hot-reload
    try {
        questionFileWatcher.start();
        
        // Connect watcher to interview loader for cache invalidation
        questionFileWatcher.on('questions-changed', (data) => {
            interviewLoader.invalidateCache();
            console.log(`📝 Questions hot-reloaded: ${data.questionCount} questions`);
        });
        
        questionFileWatcher.on('error', (error) => {
            console.error('❌ Question watcher error:', error);
        });
        
        console.log('🔄 Question hot-reload enabled');
    } catch (error) {
        console.error('⚠️  Failed to start question file watcher:', error);
        // Continue without hot-reload - not critical
    }

    try {
        startRoadmapSyncWatchers();
        console.log('🛰️  Roadmap sync watchers active');
        // Force flush stdout to ensure output appears immediately in npx
        if (process.stdout.write && typeof process.stdout.write === 'function') {
            process.stdout.write('');
        }
    } catch (error) {
        console.error('⚠️  Failed to start roadmap sync watchers:', error);
    }

    // Initialize task logger and compaction alerter with correct ROOT_DIR
    try {
        await taskLogger.initialize();
        await compactionAlerter.initialize(ROOT_DIR);
    } catch (error) {
        console.error('⚠️  Failed to initialize task logger/compaction alerter:', error);
    }

    // Create PID file for terminal status bar detection (in project directory)
    const pidFile = path.join(ROOT_DIR, '.opnix', 'server.pid');

    // Ensure .opnix directory exists in project directory
    try {
        await fsPromises.access(path.join(ROOT_DIR, '.opnix'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            fs.mkdirSync(path.join(ROOT_DIR, '.opnix'), { recursive: true });
        } else {
            throw error;
        }
    }

    // Write PID file
    fs.writeFileSync(pidFile, process.pid.toString());

    // Clean up PID file on exit
    process.on('exit', () => {
        try {
            fs.unlinkSync(pidFile);
        } catch {
            // Ignore errors silently
        }
        stopRoadmapSyncWatchers().catch(() => {});
    });

    const server = http.createServer(app);
    const wss = new WebSocket.Server({ noServer: true });

    server.on('upgrade', (request, socket, head) => {
        const pathname = new URL(request.url, `http://${request.headers.host}`).pathname;

        if (pathname === '/api/terminal') {
            wss.handleUpgrade(request, socket, head, (ws) => {
                wss.emit('connection', ws, request);
            });
        } else {
            socket.destroy();
        }
    });

    wss.on('connection', (ws) => {
        const terminalId = `term-${Date.now()}-${Math.random().toString(36).substring(7)}`;
        console.log(`Terminal ${terminalId} connected`);

        try {
            const ptyProcess = terminalManager.createTerminal(terminalId, ws, {
                cols: 80,
                rows: 24
            });

            ws.on('message', (data) => {
                try {
                    const message = JSON.parse(data);

                    if (message.type === 'input') {
                        terminalManager.writeToTerminal(terminalId, message.data);
                    } else if (message.type === 'resize') {
                        terminalManager.resizeTerminal(terminalId, message.cols, message.rows);
                    }
                } catch (error) {
                    console.error('Error processing terminal message:', error);
                }
            });

            ws.on('close', () => {
                console.log(`Terminal ${terminalId} disconnected`);
                terminalManager.killTerminal(terminalId);
            });

            ws.on('error', (error) => {
                console.error(`Terminal ${terminalId} error:`, error);
                terminalManager.killTerminal(terminalId);
            });
        } catch (error) {
            console.error('Error creating terminal:', error);
            ws.close();
        }
    });

    process.on('SIGTERM', () => {
        console.log('SIGTERM received, cleaning up terminals...');
        terminalManager.cleanup();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

    process.on('SIGINT', () => {
        console.log('SIGINT received, cleaning up terminals...');
        terminalManager.cleanup();
        server.close(() => {
            console.log('Server closed');
            process.exit(0);
        });
    });

    server.listen(PORT, async () => {
        console.log(`
╔══════════════════════════════════════════╗
║           OPNIX v1.0 - OPERATIONAL        ║
║              TOOLKIT SERVER               ║
╚══════════════════════════════════════════╝

🚀 Server: http://localhost:${PORT}
🤖 Agents: curl http://localhost:${PORT}/api/agents
📦 Modules: curl http://localhost:${PORT}/api/modules/detect
❓ Progressive: curl http://localhost:${PORT}/api/progressive/status
⚡ Execute: curl http://localhost:${PORT}/api/claude/execute
🔄 Recovery: curl http://localhost:${PORT}/api/recovery/status
📝 Task Logs: curl http://localhost:${PORT}/api/task-logs/cli/summary
📊 Status Dashboard: curl http://localhost:${PORT}/api/status/complete
📄 Export: curl http://localhost:${PORT}/api/export/markdown
📊 Context: curl http://localhost:${PORT}/api/context/status

Real Functionality:
  ✓ Agent directory scanning
  ✓ Module auto-detection
  ✓ Progressive questioning system
  ✓ Auto-artifact generation
  ✓ Pattern detection
  ✓ File system operations
  ✓ Spec generation
  ✓ Canvas export
  ✓ Terminal status bar active (PID: ${process.pid})
        `);

        // Force flush stdout to ensure banner appears immediately in npx
        if (process.stdout.write && typeof process.stdout.write === 'function') {
            process.stdout.write('');
        }

        // Auto-run progressive analysis on server startup
        setTimeout(() => {
            runInitialProgressiveAnalysis().catch(err => {
                console.error('Background progressive analysis failed:', err.message);
            });
        }, 2000); // Give server time to fully start

        // Auto-start Storybook on server startup
        setTimeout(() => {
            startStorybookProcess()
                .then(result => {
                    if (result?.alreadyRunning) {
                        console.log('🎨 Storybook: Already running');
                    } else {
                        console.log('🎨 Storybook: Auto-started on port 6006');
                    }
                })
                .catch(error => {
                    console.error('🎨 Storybook: Auto-start failed:', error);
                });
        }, 2000); // Wait 2 seconds after server starts

        // Initialize auto-recovery system on server startup
        setTimeout(() => {
            initializeAutoRecoverySystem().catch(err => {
                console.error('Auto-recovery system initialization failed:', err.message);
            });
        }, 1000); // Start recovery early, before other services

        // Initialize status dashboard tracking
        setTimeout(() => {
            initializeStatusTracking();
        }, 1500); // Start after recovery system
    });
}

if (require.main === module) {
    start().catch((error) => {
        console.error('Fatal error starting server:', error);
        process.exit(1);
    });
}

module.exports = {
    app,
    start,
    runInitialAudit,
    initDataFile,
    readData,
    writeData,
    ensureDirectory,
    ensureDataDirectory,
    ensureExportStructure,
    importLegacyTicketsIfPresent,
    readModuleLinks,
    writeModuleLinks,
    readFeaturesFile,
    loadPackageJson,
    listExportFiles,
    deriveTechStack,
    inferProjectType,
    EXPORTS_DIR,
    EXPORT_SUBDIRS,
    DATA_DIR,
    SETUP_STATE_FILE,
    readSetupState,
    writeSetupState,
    validateFeatureStatusChange,
    normaliseAcceptanceCriteria,
    validateChecklistStatusChange,
    readTerminalHistory,
    writeTerminalHistory,
    clearTerminalHistory,
    TERMINAL_HISTORY_FILE,
    MAX_TERMINAL_HISTORY,
    terminalExecuteRoute,
    terminalHistoryRoute,
    ultraThinkTriggerRoute,
    contextStatusRoute,
    contextUpdateRoute,
    ultraThinkModeRoute,
    markdownListRoute,
    markdownReadRoute,
    markdownCreateRoute,
    markdownUpdateRoute,
    writeDetectedModules,
    readDetectedModules,
    ensureRoadmapStateFile,
    readRoadmapState,
    writeRoadmapState
};

module.exports.__internals = { appendPlanStageIfAvailable, appendTasksStageIfAvailable };
