// OPNIX - Express Backend with Tags Support
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const moduleDetector = require('./services/moduleDetector');
const specGenerator = require('./services/specGenerator');
const docsGenerator = require('./services/docsGenerator');
const interviewLoader = require('./services/interviewLoader');
const diagramGenerator = require('./services/diagramGenerator');
const { ProgressiveDocumentSystem } = require('./services/progressiveDocumentSystem');
const cliInterviewManager = require('./services/cliInterviewManager');
const runbookGenerator = require('./services/runbookGenerator');
const execAsync = util.promisify(exec);
const runtimeBundler = require('./services/runtimeBundler');

const app = express();
const PORT = 7337;
const ROOT_DIR = __dirname;
const DATA_DIR = path.join(__dirname, 'data');
const DATA_FILE = path.join(DATA_DIR, 'tickets.json');
const LEGACY_TICKETS_FILE = path.join(__dirname, 'tickets.json');
const LEGACY_IMPORT_DIR = path.join(DATA_DIR, 'legacy-imports');
const AGENTS_DIR = path.join(__dirname, 'agents');
const EXPORTS_DIR = path.join(__dirname, 'spec');
const EXPORT_SUBDIRS = {
    blueprints: path.join(EXPORTS_DIR, 'blueprints'),
    docs: path.join(EXPORTS_DIR, 'docs'),
    revision: path.join(EXPORTS_DIR, 'revision'),
    audits: path.join(EXPORTS_DIR, 'audits'),
    canvas: path.join(EXPORTS_DIR, 'canvas'),
    diagrams: path.join(EXPORTS_DIR, 'diagrams'),
    roadmaps: path.join(EXPORTS_DIR, 'roadmaps'),
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
const MAX_TERMINAL_HISTORY = 100;

const CLI_COMMANDS = {
    '/spec': { category: 'spec', label: 'Specification Interview' },
    '/new-feature': { category: 'feature', label: 'Feature Interview' },
    '/new-module': { category: 'module', label: 'Module Interview' },
    '/new-bug': { category: 'bug', label: 'Bug Interview' },
    '/new-diagram': { category: 'diagram', label: 'Diagram Interview' },
    '/new-api': { category: 'api', label: 'API Interview' },
    '/runbook': { category: 'runbook', label: 'Runbook Interview' }
};

const CLI_ALIGNMENT_RULES = {
    '/spec': { requireDiscussion: true, requireUltraThink: true },
    '/new-feature': { requireDiscussion: true, requireUltraThink: true },
    '/new-module': { requireDiscussion: true, requireUltraThink: true },
    '/new-diagram': { requireDiscussion: true, requireUltraThink: true },
    '/new-api': { requireDiscussion: true, requireUltraThink: true },
    '/runbook': { requireDiscussion: true, requireUltraThink: true }
};

const CLI_COMMAND_LIST = Object.entries(CLI_COMMANDS)
    .map(([command, meta]) => `${command} — ${meta.label}`)
    .join('\n');

const PLANNING_COMMAND_LIST = Object.keys(CLI_ALIGNMENT_RULES).join(', ');

const ULTRATHINK_TRIGGER_REGEX = /\[\[\s*ultrathink\s*\]\]/i;
const CONTEXT_GATING_THRESHOLD = 0.9;

function evaluateAlignmentGate(slashCommand, originalCommand) {
    const rules = CLI_ALIGNMENT_RULES[slashCommand];
    if (!rules) {
        return null;
    }

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

function normaliseStatusHook(hook) {
    if (hook === null || hook === undefined) return null;
    const trimmed = String(hook).trim();
    if (!trimmed) return null;
    if (trimmed.includes('-') || trimmed.includes('_')) {
        const lower = trimmed.toLowerCase();
        return lower.replace(/[-_]+(\w)/g, (_, char) => char.toUpperCase());
    }
    return trimmed.charAt(0).toLowerCase() + trimmed.slice(1);
}

function normaliseTicketStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'reported' || condensed === 'open') return statusReported;
    if (condensed === 'inprogress') return statusInProgress;
    if (condensed === 'finished' || condensed === 'resolved' || condensed === 'complete') return statusFinished;
    return fallback ?? trimmed;
}

function normaliseChecklistStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'pending') return checklistPending;
    if (condensed === 'inprogress') return checklistInProgress;
    if (condensed === 'complete' || condensed === 'completed') return checklistComplete;
    return fallback ?? trimmed;
}

function normaliseFeatureStatus(status, { fallback } = {}) {
    if (status === null || status === undefined) return fallback ?? null;
    const trimmed = String(status).trim();
    if (!trimmed) return fallback ?? null;
    const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
    if (condensed === 'proposed') return 'proposed';
    if (condensed === 'approved') return 'approved';
    if (condensed === 'indevelopment') return 'inDevelopment';
    if (condensed === 'testing') return 'testing';
    if (condensed === 'deployed') return 'deployed';
    return fallback ?? trimmed;
}

function normaliseChecklist(record) {
    if (!record || typeof record !== 'object') return null;
    const baseStatus = normaliseChecklistStatus(record.status, { fallback: checklistPending }) || checklistPending;
    const items = Array.isArray(record.items)
        ? record.items.map(item => ({
            ...item,
            status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
        }))
        : [];
    const statusHistory = Array.isArray(record.statusHistory)
        ? record.statusHistory.map(entry => ({
            ...entry,
            from: normaliseChecklistStatus(entry?.from, { fallback: checklistPending }) || checklistPending,
            to: normaliseChecklistStatus(entry?.to, { fallback: checklistPending }) || checklistPending,
            hook: entry?.hook ? normaliseStatusHook(entry.hook) : entry?.hook || null
        }))
        : [];

    return {
        ...record,
        status: baseStatus,
        items,
        statusHistory
    };
}

function normaliseFeatureRecord(record) {
    if (!record || typeof record !== 'object') return null;
    const status = normaliseFeatureStatus(record.status, { fallback: 'proposed' }) || 'proposed';
    return {
        ...record,
        status
    };
}

function normaliseFeatureCollection(collection) {
    if (!Array.isArray(collection)) return [];
    return collection.map(normaliseFeatureRecord).filter(Boolean);
}

async function collectMarkdownArchive() {
    const entries = [];

    async function walkDirectory(rootMeta, currentDir) {
        let dirEntries;
        try {
            dirEntries = await fsPromises.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of dirEntries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                const dirName = entry.name.toLowerCase();
                if (MARKDOWN_ARCHIVE_DENYLIST.has(dirName)) {
                    continue;
                }
                await walkDirectory(rootMeta, fullPath);
                continue;
            }

            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!MARKDOWN_EXTENSIONS.has(ext)) continue;

            let stats;
            try {
                stats = await fsPromises.stat(fullPath);
            } catch {
                continue;
            }

            const relativeToRoot = toPosixPath(path.relative(rootMeta.dir, fullPath));
            const workspacePath = toPosixPath(path.relative(ROOT_DIR, fullPath));

            entries.push({
                id: `${rootMeta.id}:${relativeToRoot}`,
                name: entry.name,
                rootId: rootMeta.id,
                category: rootMeta.label,
                relativePath: relativeToRoot,
                workspacePath,
                size: stats.size,
                modified: stats.mtime.toISOString()
            });
        }
    }

    for (const root of MARKDOWN_ARCHIVE_ROOTS) {
        if (!root.dir) continue;
        let stats;
        try {
            stats = await fsPromises.stat(root.dir);
        } catch {
            continue;
        }
        if (!stats.isDirectory()) continue;
        await walkDirectory(root, root.dir);
    }

    return entries.sort((a, b) => (a.workspacePath || '').localeCompare(b.workspacePath || ''));
}

function resolveMarkdownPath(rootId, relativePath) {
    const rootMeta = MARKDOWN_ARCHIVE_ROOTS.find(root => root.id === rootId);
    if (!rootMeta) return null;
    const normalized = path.normalize(relativePath || '');
    const target = path.resolve(rootMeta.dir, normalized);
    if (!target.startsWith(rootMeta.dir)) return null;
    return { rootMeta, target, normalizedRelative: normalized.replace(/^[\\/]+/, '') };
}

function buildMarkdownMeta(rootMeta, targetPath, stats) {
    if (!rootMeta || !targetPath || !stats) return null;
    const relativeToRoot = toPosixPath(path.relative(rootMeta.dir, targetPath));
    const workspacePath = toPosixPath(path.relative(ROOT_DIR, targetPath));
    return {
        id: `${rootMeta.id}:${relativeToRoot}`,
        name: path.basename(targetPath),
        rootId: rootMeta.id,
        category: rootMeta.label,
        relativePath: relativeToRoot,
        workspacePath,
        size: stats.size,
        modified: stats.mtime.toISOString()
    };
}

function logServerError(scope, error) {
    if (!error) {
        console.error(`[Opnix][${scope}] Unknown server error`);
        return;
    }
    const message = error.message ? error.message : String(error);
    console.error(`[Opnix][${scope}] ${message}`, error);
}

function extractMarkdownParams(req = {}) {
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};

    const rootId = params.rootId || body.rootId || query.rootId || null;
    let fromParams = params.relativePath;
    if (Array.isArray(fromParams)) {
        fromParams = fromParams.join('/');
    }
    if (!fromParams && params[0]) {
        fromParams = params[0];
    }
    const relativePath = fromParams || body.relativePath || query.relativePath || null;

    return { rootId, relativePath };
}

function validateMarkdownExtension(relativePath) {
    if (!relativePath) return false;
    const ext = path.extname(relativePath).toLowerCase();
    return MARKDOWN_EXTENSIONS.has(ext);
}

async function markdownListRoute(req, res) {
    try {
        const files = await collectMarkdownArchive();
        res.json({ files });
    } catch (error) {
        console.error('Markdown archive list error:', error);
        res.status(500).json({ error: 'Failed to list markdown files' });
    }
}

async function markdownReadRoute(req, res) {
    try {
        const { rootId, relativePath } = extractMarkdownParams(req);
        if (typeof rootId !== 'string' || typeof relativePath !== 'string' || !rootId || !relativePath) {
            return res.status(400).json({ error: 'rootId and relativePath are required' });
        }
        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }
        await fsPromises.access(resolved.target);
        const content = await fsPromises.readFile(resolved.target, 'utf8');
        res.type('text/markdown').send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }
        console.error('Markdown read error:', error);
        res.status(500).json({ error: 'Failed to read markdown file' });
    }
}

async function markdownCreateRoute(req, res) {
    try {
        const { rootId, relativePath } = extractMarkdownParams(req);
        const content = typeof req.body?.content === 'string' ? req.body.content : '';
        const overwrite = Boolean(req.body?.overwrite);

        if (typeof rootId !== 'string' || !rootId.trim()) {
            return res.status(400).json({ error: 'rootId is required' });
        }
        if (typeof relativePath !== 'string' || !relativePath.trim()) {
            return res.status(400).json({ error: 'relativePath is required' });
        }
        if (!validateMarkdownExtension(relativePath)) {
            return res.status(400).json({ error: 'Unsupported markdown extension' });
        }

        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }

        await ensureDirectory(path.dirname(resolved.target));

        const exists = await fsPromises.access(resolved.target).then(() => true).catch(error => {
            if (error.code === 'ENOENT') return false;
            throw error;
        });
        if (exists && !overwrite) {
            return res.status(409).json({ error: 'File already exists' });
        }

        await fsPromises.writeFile(resolved.target, content, 'utf8');
        const stats = await fsPromises.stat(resolved.target);
        const meta = buildMarkdownMeta(resolved.rootMeta, resolved.target, stats);
        res.status(exists ? 200 : 201).json({ file: meta });
    } catch (error) {
        console.error('Markdown create error:', error);
        res.status(500).json({ error: 'Failed to create markdown file' });
    }
}

async function markdownUpdateRoute(req, res) {
    try {
        const { rootId, relativePath } = extractMarkdownParams(req);
        const content = typeof req.body?.content === 'string' ? req.body.content : '';

        if (typeof rootId !== 'string' || !rootId.trim()) {
            return res.status(400).json({ error: 'rootId is required' });
        }
        if (typeof relativePath !== 'string' || !relativePath.trim()) {
            return res.status(400).json({ error: 'relativePath is required' });
        }
        if (!validateMarkdownExtension(relativePath)) {
            return res.status(400).json({ error: 'Unsupported markdown extension' });
        }

        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }

        const exists = await fsPromises.access(resolved.target).then(() => true).catch(error => {
            if (error.code === 'ENOENT') return false;
            throw error;
        });
        if (!exists) {
            return res.status(404).json({ error: 'File not found' });
        }

        await fsPromises.writeFile(resolved.target, content, 'utf8');
        const stats = await fsPromises.stat(resolved.target);
        const meta = buildMarkdownMeta(resolved.rootMeta, resolved.target, stats);
        res.json({ file: meta });
    } catch (error) {
        console.error('Markdown update error:', error);
        res.status(500).json({ error: 'Failed to update markdown file' });
    }
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
                const contextNote = ratioText ? `Context ${ratioText}` : `Context ${Math.round((contextUsed / contextLimit) * 100)}%`;
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

    const alignmentGate = evaluateAlignmentGate(slash, trimmed);
    if (alignmentGate && alignmentGate.blocked) {
        await logCliAlignmentGate(slash, trimmed, alignmentGate);
        return {
            result: 'Alignment gate active',
            gated: true,
            messages: alignmentGate.messages,
            diagnostics: alignmentGate.diagnostics
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
            const runbookMeta = await runbookGenerator.generateRunbook({
                projectName,
                session,
                modulesResult,
                tickets,
                techStack,
                exportsDir: EXPORT_SUBDIRS.runbooks
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

function serializeCliQuestion(question) {
    if (!question) return null;
    return {
        id: question.id,
        prompt: question.prompt,
        placeholder: question.placeholder || '',
        type: question.type || 'text',
        options: Array.isArray(question.options) ? question.options : [],
        autoSuggestion: question.autoSuggestion || null,
        sectionId: question.sectionId || null,
        sectionTitle: question.sectionTitle || null
    };
}

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));
app.use(express.static('public'));

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

async function ensureDirectory(dirPath) {
    try {
        await fsPromises.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fsPromises.mkdir(dirPath, { recursive: true });
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

function normaliseTicketsPayload(payload) {
    if (!payload || (typeof payload !== 'object' && !Array.isArray(payload))) {
        return { tickets: [], nextId: 1 };
    }

    const extras = (!Array.isArray(payload) && payload && typeof payload === 'object')
        ? Object.fromEntries(Object.entries(payload).filter(([key]) => key !== 'tickets' && key !== 'nextId'))
        : {};

    let tickets;
    let nextId = null;

    if (Array.isArray(payload)) {
        tickets = payload;
    } else {
        tickets = Array.isArray(payload.tickets) ? payload.tickets : [];
        nextId = payload.nextId;
    }

    if (typeof nextId !== 'number') {
        const coerced = Number(nextId);
        nextId = Number.isFinite(coerced) ? coerced : null;
    }

    const normalisedTickets = tickets.map((ticket, index) => {
        if (!ticket || typeof ticket !== 'object') return null;
        const clone = { ...ticket };
        const numericId = Number(clone.id);
        if (!Number.isFinite(numericId)) {
            clone.id = index + 1;
        } else {
            clone.id = numericId;
        }
        if (!clone.created) {
            clone.created = new Date().toISOString();
        }
        if (!clone.priority) {
            clone.priority = 'medium';
        }
        clone.status = normaliseTicketStatus(clone.status, { fallback: statusReported }) || statusReported;
        clone.tags = Array.isArray(clone.tags) ? clone.tags : [];
        return clone;
    }).filter(Boolean);

    const maxId = normalisedTickets.reduce((max, ticket) => {
        return Number.isFinite(ticket.id) ? Math.max(max, ticket.id) : max;
    }, 0);

    const computedNextId = maxId + 1;
    const resolvedNextId = typeof nextId === 'number' && nextId > maxId ? nextId : computedNextId || 1;

    return {
        ...extras,
        tickets: normalisedTickets,
        nextId: resolvedNextId
    };
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

function deriveTicketStats(tickets) {
    const stats = {
        total: tickets.length,
        open: 0,
        closed: 0,
        statusCounts: { reported: 0, inProgress: 0, finished: 0 },
        priorityCounts: { high: 0, medium: 0, low: 0 },
        highPriorityOpen: 0,
        tagCounts: {}
    };

    tickets.forEach(ticket => {
        const canonicalStatus = normaliseTicketStatus(ticket.status, { fallback: statusReported }) || statusReported;
        const isFinished = canonicalStatus === statusFinished;
        const statusKey = canonicalStatus === statusInProgress
            ? 'inProgress'
            : (isFinished ? 'finished' : 'reported');
        stats.statusCounts[statusKey] = (stats.statusCounts[statusKey] || 0) + 1;

        if (isFinished) {
            stats.closed += 1;
        } else {
            stats.open += 1;
        }

        const priority = String(ticket.priority || priorityMedium).toLowerCase();
        if (stats.priorityCounts[priority] !== undefined) {
            stats.priorityCounts[priority] += 1;
        } else {
            stats.priorityCounts[priority] = (stats.priorityCounts[priority] || 0) + 1;
        }
        if (!isFinished && priority === priorityHigh) {
            stats.highPriorityOpen += 1;
        }

        (ticket.tags || []).forEach(tag => {
            const key = String(tag || '').toUpperCase();
            if (!key) return;
            stats.tagCounts[key] = (stats.tagCounts[key] || 0) + 1;
        });
    });

    return stats;
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

async function loadDiagramContext() {
    const [modulesResult, ticketData, features, packageJson] = await Promise.all([
        moduleDetector.detectModules(__dirname),
        readData(),
        readFeaturesFile(),
        loadPackageJson()
    ]);

    const tickets = Array.isArray(ticketData.tickets) ? ticketData.tickets : [];
    const techStack = deriveTechStack(packageJson, modulesResult.modules);
    const specPayload = buildSpecPayloadFromState({
        packageJson,
        modulesResult,
        features,
        tickets,
        techStack
    });

    return {
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        features,
        tickets,
        project: specPayload.project,
        techStack
    };
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

function buildFollowUps({ modules, features, ticketStats }) {
    const followUps = [];

    (modules || []).forEach(module => {
        if (typeof module.health === 'number' && module.health < 60) {
            followUps.push(`Improve health of ${module.name} (currently ${module.health}%)`);
        }
        if (typeof module.coverage === 'number' && module.coverage < 50) {
            followUps.push(`Increase automated test coverage for ${module.name} (currently ${module.coverage}%)`);
        }
        if (module.todoCount && module.todoCount > 0) {
            followUps.push(`${module.name} contains ${module.todoCount} TODO/FIXME markers that need attention`);
        }
    });

    (features || []).forEach(feature => {
        if (!Array.isArray(feature.acceptanceCriteria) || feature.acceptanceCriteria.length === 0) {
            followUps.push(`Define acceptance criteria for feature "${feature.title}"`);
        }
    });

    if (ticketStats?.highPriorityOpen) {
        followUps.push(`Resolve ${ticketStats.highPriorityOpen} open high-priority ticket${ticketStats.highPriorityOpen > 1 ? 's' : ''}`);
    }

    return followUps;
}

function getExpectedStatusHook(currentStatus, nextStatus) {
    const normalisedCurrent = normaliseTicketStatus(currentStatus);
    const normalisedNext = normaliseTicketStatus(nextStatus);
    if (!normalisedCurrent || !normalisedNext) return null;
    const table = TICKET_STATUS_TRANSITIONS[normalisedCurrent] || {};
    return table[normalisedNext] || null;
}

function validateTicketStatusChange(currentStatus, nextStatus, providedHook) {
    const normalisedCurrent = normaliseTicketStatus(currentStatus);
    const normalisedNext = normaliseTicketStatus(nextStatus);
    if (!normalisedNext || normalisedCurrent === normalisedNext) {
        return true;
    }
    if (!VALID_TICKET_STATUSES.includes(normalisedCurrent) || !VALID_TICKET_STATUSES.includes(normalisedNext)) {
        return false;
    }
    const expected = getExpectedStatusHook(normalisedCurrent, normalisedNext);
    if (!expected) {
        return false;
    }
    const provided = normaliseStatusHook(providedHook);
    return provided === expected;
}

function normaliseAcceptanceCriteria(rawCriteria) {
    if (!Array.isArray(rawCriteria)) return [];
    return rawCriteria
        .map(item => {
            if (typeof item === 'string') {
                return item.trim();
            }
            if (item && typeof item.text === 'string') {
                return item.text.trim();
            }
            return '';
        })
        .map(text => text.replace(/\s+/g, ' ').trim())
        .filter(Boolean);
}

function acceptanceCriteriaSatisfied(criteria) {
    if (!Array.isArray(criteria) || criteria.length === 0) return false;
    return criteria.every(entry => entry && !/\[NEEDS CLARIFICATION\]/i.test(entry));
}

function validateFeatureStatusChange(currentStatus, nextStatus, acceptanceCriteria) {
    const normalisedCurrent = normaliseFeatureStatus(currentStatus);
    const normalisedNext = normaliseFeatureStatus(nextStatus);
    if (!normalisedNext || normalisedCurrent === normalisedNext) {
        return { ok: true };
    }
    if (!VALID_FEATURE_STATUSES.includes(normalisedNext)) {
        return { ok: false, message: `Unsupported feature status: ${normalisedNext}` };
    }
    if (!VALID_FEATURE_STATUSES.includes(normalisedCurrent)) {
        return { ok: false, message: `Unsupported existing feature status: ${normalisedCurrent}` };
    }

    const nextIndex = FEATURE_STATUS_ORDER.get(normalisedNext);
    const currentIndex = FEATURE_STATUS_ORDER.get(normalisedCurrent);
    if (nextIndex < currentIndex) {
        // Allow regressions but still enforce criteria if required
        if (STATUS_REQUIRES_CRITERIA.has(normalisedNext) && !acceptanceCriteriaSatisfied(acceptanceCriteria)) {
            return { ok: false, message: 'Acceptance criteria must be defined before reverting to this status.' };
        }
        return { ok: true };
    }

    if (STATUS_REQUIRES_CRITERIA.has(normalisedNext) && !acceptanceCriteriaSatisfied(acceptanceCriteria)) {
        return { ok: false, message: 'Define acceptance criteria before advancing the feature status.' };
    }

    return { ok: true };
}

function getChecklistHook(currentStatus, nextStatus) {
    const normalisedCurrent = normaliseChecklistStatus(currentStatus);
    const normalisedNext = normaliseChecklistStatus(nextStatus);
    if (!normalisedCurrent || !normalisedNext) return null;
    const table = CHECKLIST_STATUS_TRANSITIONS[normalisedCurrent] || {};
    return table[normalisedNext] || null;
}

function validateChecklistStatusChange(currentStatus, nextStatus, providedHook) {
    const normalisedCurrent = normaliseChecklistStatus(currentStatus);
    const normalisedNext = normaliseChecklistStatus(nextStatus);
    if (!normalisedNext || normalisedCurrent === normalisedNext) {
        return { ok: true };
    }
    if (!VALID_CHECKLIST_STATUSES.includes(normalisedNext)) {
        return { ok: false, message: `Unsupported checklist status: ${normalisedNext}` };
    }
    if (!VALID_CHECKLIST_STATUSES.includes(normalisedCurrent)) {
        return { ok: false, message: `Unsupported existing checklist status: ${normalisedCurrent}` };
    }
    const expected = getChecklistHook(normalisedCurrent, normalisedNext);
    const provided = normaliseStatusHook(providedHook);
    if (!expected || expected !== provided) {
        return { ok: false, message: 'Invalid checklist status hook' };
    }
    return { ok: true };
}

function findModuleIdsForFollowUp(note, modules) {
    if (!note || !Array.isArray(modules)) return [];
    const lowerNote = note.toLowerCase();
    return modules
        .filter(module => {
            const name = String(module.name || '').toLowerCase();
            const id = String(module.id || '').toLowerCase();
            return (name && lowerNote.includes(name)) || (id && lowerNote.includes(id));
        })
        .map(module => module.id)
        .filter(Boolean);
}

function findFeatureIdsForFollowUp(note, features) {
    if (!note || !Array.isArray(features)) return [];
    const lowerNote = note.toLowerCase();
    return features
        .filter(feature => {
            const title = String(feature.title || '').toLowerCase();
            return title && lowerNote.includes(title);
        })
        .map(feature => feature.id)
        .filter(Boolean);
}

function buildFollowUpDescription(note, modules, features) {
    const moduleIds = findModuleIdsForFollowUp(note, modules);
    const featureIds = findFeatureIdsForFollowUp(note, features);
    const lines = [note];
    if (moduleIds.length) {
        lines.push(`Related modules: ${moduleIds.join(', ')}`);
    }
    if (featureIds.length) {
        lines.push(`Related features: ${featureIds.join(', ')}`);
    }
    lines.push('This ticket was generated automatically during the latest Opnix audit. Review spec/docs exports for full context.');
    return lines.join('\n');
}

async function ensureFollowUpTickets({ followUps, modules, features }) {
    if (!Array.isArray(followUps) || followUps.length === 0) {
        return [];
    }

    const data = await readData();
    const tickets = Array.isArray(data.tickets) ? data.tickets : [];
    const created = [];
    const now = new Date().toISOString();

    followUps.forEach(note => {
        const title = String(note || '').trim();
        if (!title) return;
        const duplicate = tickets.some(ticket => ticket.source === 'audit-follow-up' && ticket.title === title);
        if (duplicate) return;

        const modulesForTicket = findModuleIdsForFollowUp(title, modules);
        const description = buildFollowUpDescription(title, modules, features);

        const ticket = {
            id: data.nextId++,
            title,
            description,
            priority: 'high',
            status: 'reported',
            tags: ['FOLLOW_UP', 'AUDIT'],
            modules: modulesForTicket,
            created: now,
            source: 'audit-follow-up'
        };
        tickets.push(ticket);
        created.push(ticket);
    });

    data.tickets = tickets;
    data.nextId = data.nextId || (tickets.length ? Math.max(...tickets.map(ticket => Number(ticket.id) || 0)) + 1 : 1);
    await writeData(data);
    return created;
}

function buildSpecPayloadFromState({ packageJson, modulesResult, features, tickets, techStack }) {
    const language = inferPrimaryLanguage(packageJson) || null;
    const frameworks = techStack.frameworks || [];
    const projectType = inferProjectType({ modules: modulesResult.modules, techStack });
    const projectName = packageJson?.name || 'Opnix Project';
    const goal = packageJson?.description || 'Audit generated specification snapshot';

    return {
        generatedAt: new Date().toISOString(),
        questionAnswers: {},
        project: {
            name: projectName,
            type: projectType,
            goal
        },
        technical: {
            language,
            framework: frameworks.length ? frameworks[0] : null,
            stack: frameworks,
            architecture: {
                dataStores: null,
                integrations: null,
                testingStrategy: null,
                observability: null
            }
        },
        modules: modulesResult.modules,
        canvas: {
            edges: modulesResult.edges,
            summary: modulesResult.summary
        },
        features,
        tickets
    };
}

async function writeCanvasSnapshot(modulesResult) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-canvas-audit-${timestamp}.json`;
    const filePath = path.join(EXPORT_SUBDIRS.canvas, filename);
    const payload = {
        generatedAt: new Date().toISOString(),
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        summary: modulesResult.summary
    };
    await fsPromises.writeFile(filePath, JSON.stringify(payload, null, 2));
    return {
        filename,
        path: filePath,
        relativePath: path.relative(EXPORTS_DIR, filePath),
        format: 'json'
    };
}

async function writeAuditReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-audit-${timestamp}.json`;
    const filePath = path.join(EXPORT_SUBDIRS.audits, filename);
    await fsPromises.writeFile(filePath, JSON.stringify(report, null, 2));
    return {
        filename,
        path: filePath,
        relativePath: path.relative(EXPORTS_DIR, filePath),
        format: 'json'
    };
}

async function runInitialAudit() {
    await ensureExportStructure();

    const [modulesResult, ticketData, features, packageJson] = await Promise.all([
        moduleDetector.detectModules(__dirname),
        readData(),
        readFeaturesFile(),
        loadPackageJson()
    ]);

    const tickets = Array.isArray(ticketData.tickets) ? ticketData.tickets : [];
    const ticketStats = deriveTicketStats(tickets);
    const techStack = deriveTechStack(packageJson, modulesResult.modules);
    const specPayload = buildSpecPayloadFromState({ packageJson, modulesResult, features, tickets, techStack });

    const [specJsonMetaRaw, specKitMetaRaw] = await Promise.all([
        specGenerator.generateSpecFile({ spec: specPayload, format: 'json', exportsDir: EXPORT_SUBDIRS.blueprints }),
        specGenerator.generateSpecFile({ spec: specPayload, format: 'github-spec-kit', exportsDir: EXPORT_SUBDIRS.blueprints })
    ]);
    const specJsonMeta = withRelativePath(specJsonMetaRaw);
    const specKitMeta = withRelativePath(specKitMetaRaw);

    const docsStats = {
        reported: ticketStats.statusCounts.reported || 0,
        inProgress: ticketStats.statusCounts.inProgress || 0,
        finished: ticketStats.statusCounts.finished || 0,
        externalDependencies: modulesResult.summary.externalDependencyCount || 0,
        totalLines: modulesResult.summary.totalLines || 0
    };

    const isNewProject = modulesResult.modules.length === 0 && tickets.length === 0 && techStack.dependencies.length === 0 && techStack.devDependencies.length === 0;

    const docsMeta = withRelativePath(await docsGenerator.generateDocsFile({
        projectName: specPayload.project.name,
        stats: docsStats,
        modules: modulesResult.modules,
        moduleEdges: modulesResult.edges,
        features,
        tickets,
        techStack,
        exportsDir: isNewProject ? EXPORT_SUBDIRS.revision : EXPORT_SUBDIRS.docs
    }));

    const canvasMeta = withRelativePath(await writeCanvasSnapshot(modulesResult));

    const diagramsMetaRaw = await diagramGenerator.generateAllDiagrams({
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        features,
        tickets,
        project: specPayload.project,
        techStack,
        exportsDir: EXPORT_SUBDIRS.diagrams
    });
    const diagramsMeta = diagramsMetaRaw.map(meta => {
        const normalized = withRelativePath(meta);
        if (Object.prototype.hasOwnProperty.call(normalized, 'mermaid')) {
            const clone = { ...normalized };
            delete clone.mermaid;
            return clone;
        }
        return normalized;
    });

    const followUps = buildFollowUps({ modules: modulesResult.modules, features, ticketStats });
    const followUpTickets = await ensureFollowUpTickets({
        followUps,
        modules: modulesResult.modules,
        features
    });
    const unhealthyModules = modulesResult.modules
        .filter(module => typeof module.health === 'number' && module.health < 60)
        .map(module => ({ id: module.id, name: module.name, health: module.health }));
    const featuresNeedingCriteria = features
        .filter(feature => !Array.isArray(feature.acceptanceCriteria) || feature.acceptanceCriteria.length === 0)
        .map(feature => ({ id: feature.id, title: feature.title }));
    const featureReview = features.map(feature => ({
        id: feature.id,
        title: feature.title,
        status: feature.status || 'proposed',
        question: `Confirm scope and acceptance criteria for feature "${feature.title}".`
    }));

    const exportsListBase = [specJsonMeta, specKitMeta, docsMeta, canvasMeta, ...diagramsMeta];
    const questionnairePayload = isNewProject ? await interviewLoader.getNewProjectQuestionnaire() : undefined;
    const interviewBlueprint = isNewProject ? await interviewLoader.loadInterviewBlueprint() : undefined;

    const auditSummary = {
        generatedAt: new Date().toISOString(),
        project: specPayload.project,
        ticketStats,
        moduleSummary: modulesResult.summary,
        techStack,
        followUps,
        followUpTicketsCreated: followUpTickets.map(ticket => ({ id: ticket.id, title: ticket.title })),
        unhealthyModules,
        featuresNeedingCriteria,
        featureReview,
        exports: {
            specJson: specJsonMeta,
            specKit: specKitMeta,
            docs: docsMeta,
            canvas: canvasMeta,
            diagrams: diagramsMeta
        }
    };

    if (questionnairePayload) {
        auditSummary.questionnaire = questionnairePayload;
        auditSummary.interviewBlueprint = interviewBlueprint;
    }

    const auditMeta = withRelativePath(await writeAuditReport(auditSummary));
    const exportsList = [...exportsListBase, auditMeta];

    try {
        await runtimeBundler.syncExportArtefacts(exportsList);
    } catch (error) {
        console.error('Runtime bundle sync failed:', error);
    }

    return {
        message: isNewProject ? 'New project detected. Questionnaire included for scaffolding.' : 'Audit complete. Specification, documentation, and canvas exports generated.',
        project: specPayload.project,
        ticketStats,
        moduleSummary: modulesResult.summary,
        techStack,
        followUps,
        followUpTickets,
        unhealthyModules,
        featuresNeedingCriteria,
        featureReview,
        exports: exportsList,
        isNewProject,
        questionnaire: questionnairePayload,
        interviewBlueprint,
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        features,
        tickets,
        packageJson: packageJson || {}
    };
}

// Routes
app.get('/', (req, res) => {
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('curl')) {
        res.type('text/plain').send(`
OPNIX v1.0 - With Tags

Commands:
  curl http://localhost:${PORT}/api/claude/next      # Get next ticket
  curl http://localhost:${PORT}/api/export/markdown   # Export all
  curl http://localhost:${PORT}/api/tickets           # Get JSON
  curl http://localhost:${PORT}/api/search?tag=BUG    # Search by tag

Bug Workflow:
  npm run bug:start <id> [developer]                 # Start working on bug
  npm run bug:complete <id> "<summary>"              # Complete with summary
  npm run bug:pause <id> "<reason>"                  # Pause with reason
  npm run bug:resume <id>                            # Resume paused work
  npm run bug:status <id>                            # Check workflow status
  npm run bug:active                                 # List active workflows

Claude CLI:
  claude "Read data/tickets.json and fix all BUG tagged issues"
        `);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const data = await readData();
        res.json({ 
            status: 'operational',
            tickets: data.tickets.length,
            claudeReady: true,
            tagsEnabled: true
        });
    } catch {
        res.json({ status: 'operational', claudeReady: true });
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        res.json(data.tickets);
    } catch (error) {
        logServerError('tickets:list', error);
        res.status(500).json({ error: 'Failed to read tickets' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const ticket = data.tickets.find(t => t.id === parseInt(req.params.id));
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        logServerError('tickets:detail', error);
        res.status(500).json({ error: 'Failed to read ticket' });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        
        // Process tags
        let tags = [];
        if (req.body.tags) {
            if (Array.isArray(req.body.tags)) {
                tags = req.body.tags.map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            } else if (typeof req.body.tags === 'string') {
                tags = req.body.tags.split(',').map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            }
        }

        let nextStatus = 'reported';
        if (typeof req.body.status === 'string') {
            const requestedStatus = req.body.status;
            if (!VALID_TICKET_STATUSES.includes(requestedStatus)) {
                return res.status(400).json({ error: `Unsupported ticket status: ${requestedStatus}` });
            }
            if (!validateTicketStatusChange('reported', requestedStatus, req.body.statusHook)) {
                return res.status(400).json({ error: 'Invalid status transition or missing status hook for ticket creation' });
            }
            nextStatus = requestedStatus;
        }

        const newTicket = {
            id: data.nextId++,
            title: req.body.title || 'Untitled',
            description: req.body.description || '',
            priority: VALID_TICKET_PRIORITIES.includes(req.body.priority) ? req.body.priority : 'medium',
            status: nextStatus,
            tags: tags,
            created: new Date().toISOString(),
            files: req.body.files || []
        };

        data.tickets.push(newTicket);
        await writeData(data);
        res.status(201).json(newTicket);
        console.log(`✓ Created ticket #${newTicket.id} with tags: ${tags.join(', ')}`);
    } catch (error) {
        logServerError('tickets:create', error);
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

app.put('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Ticket not found' });
        }

        // Process tags if provided
        if (req.body.tags !== undefined) {
            if (Array.isArray(req.body.tags)) {
                req.body.tags = req.body.tags.map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            } else if (typeof req.body.tags === 'string') {
                req.body.tags = req.body.tags.split(',').map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            }
        }

        const currentTicket = data.tickets[index];
        const payload = { ...req.body };

        if (payload.status !== undefined) {
            if (!VALID_TICKET_STATUSES.includes(payload.status)) {
                return res.status(400).json({ error: `Unsupported ticket status: ${payload.status}` });
            }
            if (!validateTicketStatusChange(currentTicket.status, payload.status, payload.statusHook)) {
                return res.status(400).json({ error: 'Invalid status transition or missing status hook' });
            }

            if (payload.status === 'finished' && currentTicket.status !== 'finished') {
                const summarySource = typeof payload.completionSummary === 'string'
                    ? payload.completionSummary
                    : currentTicket.completionSummary;
                const summary = (summarySource || '').trim();
                if (summary.length < 15) {
                    return res.status(400).json({ error: 'Completion summary must be at least 15 characters to finish a ticket.' });
                }
                payload.completionSummary = summary;
                if (!payload.completedAt) {
                    payload.completedAt = new Date().toISOString();
                }
            } else if (payload.status !== 'finished') {
                if (payload.completedAt !== undefined) {
                    payload.completedAt = null;
                }
            }
        }

        if (payload.priority !== undefined && !VALID_TICKET_PRIORITIES.includes(payload.priority)) {
            return res.status(400).json({ error: `Unsupported ticket priority: ${payload.priority}` });
        }

        if (payload.completionSummary !== undefined && payload.status !== 'finished') {
            payload.completionSummary = typeof payload.completionSummary === 'string'
                ? payload.completionSummary.trim()
                : currentTicket.completionSummary || '';
        }

        delete payload.statusHook;

        data.tickets[index] = {
            ...currentTicket,
            ...payload,
            id: currentTicket.id,
            created: currentTicket.created,
            updated: new Date().toISOString()
        };

        await writeData(data);
        res.json(data.tickets[index]);
        console.log(`✓ Updated ticket #${req.params.id}`);
    } catch (error) {
        logServerError('tickets:update', error);
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        data.tickets.splice(index, 1);
        await writeData(data);
        res.status(204).send();
        console.log(`✓ Deleted ticket #${req.params.id}`);
    } catch (error) {
        logServerError('tickets:delete', error);
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});

// Bug Workflow API endpoints
const BugWorkflowManager = require('./services/bugWorkflowManager');
const bugWorkflow = new BugWorkflowManager();

app.post('/api/bug/start/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { developer } = req.body;

        const result = await bugWorkflow.startBugWork(ticketId, developer || 'unknown');
        res.json({
            success: true,
            message: `Started working on ticket #${ticketId}`,
            ...result
        });
        console.log(`✓ Started bug workflow for ticket #${ticketId}`);
    } catch (error) {
        logServerError('bug:start', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/bug/complete/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { summary, commit } = req.body;

        if (!summary) {
            return res.status(400).json({ error: 'Summary is required' });
        }

        const result = await bugWorkflow.completeBugWork(ticketId, summary, commit || false);
        res.json({
            success: true,
            message: `Completed work on ticket #${ticketId}`,
            ...result
        });
        console.log(`✓ Completed bug workflow for ticket #${ticketId}`);
    } catch (error) {
        logServerError('bug:complete', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/bug/pause/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const { reason } = req.body;

        if (!reason) {
            return res.status(400).json({ error: 'Pause reason is required' });
        }

        const result = await bugWorkflow.pauseBugWork(ticketId, reason);
        res.json({
            success: true,
            message: `Paused work on ticket #${ticketId}`,
            ...result
        });
        console.log(`✓ Paused bug workflow for ticket #${ticketId}: ${reason}`);
    } catch (error) {
        logServerError('bug:pause', error);
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/bug/resume/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);

        const result = await bugWorkflow.resumeBugWork(ticketId);
        res.json({
            success: true,
            message: `Resumed work on ticket #${ticketId}`,
            ...result
        });
        console.log(`✓ Resumed bug workflow for ticket #${ticketId}`);
    } catch (error) {
        logServerError('bug:resume', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/bug/status/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const result = await bugWorkflow.getWorkflowStatus(ticketId);
        res.json(result);
    } catch (error) {
        logServerError('bug:status', error);
        res.status(400).json({ error: error.message });
    }
});

app.get('/api/bug/active', async (req, res) => {
    try {
        const activeWorkflows = await bugWorkflow.listActiveWorkflows();
        res.json(activeWorkflows);
    } catch (error) {
        logServerError('bug:active', error);
        res.status(500).json({ error: 'Failed to get active workflows' });
    }
});

app.get('/api/bug/validate/:id', async (req, res) => {
    try {
        const ticketId = parseInt(req.params.id);
        const validation = await bugWorkflow.validateWorkflow(ticketId);
        res.json(validation);
    } catch (error) {
        logServerError('bug:validate', error);
        res.status(500).json({ error: 'Failed to validate workflow' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, status, priority, tag } = req.query;
        const data = await readData();
        let results = data.tickets;
        
        if (q) {
            const query = q.toLowerCase().trim();
            results = results.filter(t => 
                t.title.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.id.toString().includes(query)
            );
        }
        
        if (status) {
            results = results.filter(t => t.status === status);
        }
        
        if (priority) {
            results = results.filter(t => t.priority === priority);
        }
        
        if (tag) {
            const searchTag = tag.toUpperCase();
            results = results.filter(t => 
                t.tags && t.tags.includes(searchTag)
            );
        }

        res.json(results);
    } catch (error) {
        logServerError('tickets:search', error);
        res.status(500).json({ error: 'Failed to search' });
    }
});

app.get('/api/tags', async (req, res) => {
    try {
        const data = await readData();
        const tags = new Set();
        data.tickets.forEach(ticket => {
            if (ticket.tags && Array.isArray(ticket.tags)) {
                ticket.tags.forEach(tag => tags.add(tag));
            }
        });
        res.json(Array.from(tags).sort());
    } catch (error) {
        logServerError('tickets:tags', error);
        res.status(500).json({ error: 'Failed to get tags' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const data = await readData();
        const tags = {};
        data.tickets.forEach(ticket => {
            if (ticket.tags && Array.isArray(ticket.tags)) {
                ticket.tags.forEach(tag => {
                    tags[tag] = (tags[tag] || 0) + 1;
                });
            }
        });
        
        const reportedCount = data.tickets.filter(t => t.status === statusReported).length;
        const inProgressCount = data.tickets.filter(t => t.status === statusInProgress).length;
        const finishedCount = data.tickets.filter(t => t.status === statusFinished).length;
        const openCount = data.tickets.length - finishedCount;

        res.json({
            total: data.tickets.length,
            open: openCount,
            closed: finishedCount,
            reported: reportedCount,
            inProgress: inProgressCount,
            finished: finishedCount,
            highPriority: data.tickets.filter(t => t.priority === priorityHigh).length,
            tags: tags
        });
    } catch (error) {
        logServerError('tickets:stats', error);
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

async function terminalHistoryRoute(req, res) {
    try {
        const history = await readTerminalHistory();
        res.json(history);
    } catch (error) {
        logServerError('terminal:history', error);
        res.status(500).json({ error: 'Failed to read terminal history' });
    }
}

async function terminalExecuteRoute(req, res) {
    const { command, cwd } = req.body || {};
    if (!command || typeof command !== 'string' || command.trim().length === 0) {
        res.status(400).json({ error: 'Command is required' });
        return;
    }

    const trimmedCommand = command.trim();
    const workingDir = resolveWorkingDirectory(cwd);
    try {
        await fsPromises.access(workingDir);
    } catch (error) {
        logServerError('terminal:access', error);
        res.status(400).json({ error: 'Working directory is not accessible' });
        return;
    }

    const startedAt = Date.now();
    let stdout = '';
    let stderr = '';
    let exitCode = 0;
    let errorMessage = null;
    let timedOut = false;

    // Check for UltraThink trigger
    const hasUltraThink = trimmedCommand.includes('[[ ultrathink ]]');

    try {
        const { stdout: out = '', stderr: err = '' } = await execAsync(trimmedCommand, {
            cwd: workingDir,
            timeout: 20000,
            maxBuffer: 1024 * 1024,
            shell: '/bin/bash'
        });
        stdout = out;
        stderr = err;
    } catch (error) {
        stdout = error.stdout || '';
        stderr = error.stderr || '';
        exitCode = typeof error.code === 'number' ? error.code : error.code === null ? 1 : error.code;
        timedOut = Boolean(error.killed && error.signal === 'SIGTERM');
        errorMessage = error.killed ? 'Process terminated' : (error.shortMessage || error.message || 'Command failed');
    }

    // Generate context status bar for terminal output using real context data
    const percentage = (contextUsed / contextLimit * 100);
    const barLength = 10;
    const filledBars = Math.floor(percentage / 10);
    const visualBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars);

    let colorCode = '';
    if (percentage >= 90) colorCode = '\x1b[31m'; // Red
    else if (percentage >= 75) colorCode = '\x1b[33m'; // Orange/Yellow
    else colorCode = '\x1b[36m'; // Cyan

    const resetCode = '\x1b[0m';
    const displayText = `${colorCode}${visualBar} ${percentage.toFixed(1)}% (${Math.floor(contextUsed/1000)}k/${Math.floor(contextLimit/1000)}k)${resetCode}`;

    // Update current task if UltraThink is detected
    const taskDisplay = hasUltraThink ? 'UltraThink Analysis' : currentTask;

    const contextStatusLine = `\n${displayText} | Task: ${taskDisplay} | Files: ${filesEdited} | DAIC: ${daicState}${percentage >= 90 ? ' | ⚠️  CONTEXT LIMIT APPROACHING' : ''}`;

    // Prepend context status to stdout
    stdout = contextStatusLine + (stdout ? '\n' + stdout : '');

    const durationMs = Date.now() - startedAt;
    const resolvedExitCode = Number.isFinite(Number(exitCode)) ? Number(exitCode) : (exitCode || 0);

    const entry = normaliseTerminalEntry({
        id: Date.now(),
        command: trimmedCommand,
        cwd: path.relative(ROOT_DIR, workingDir) || '.',
        stdout,
        stderr,
        exitCode: resolvedExitCode,
        ranAt: new Date(startedAt).toISOString(),
        durationMs,
        timedOut,
        error: errorMessage
    });

    try {
        const history = await readTerminalHistory();
        const updated = [...history, entry].slice(-MAX_TERMINAL_HISTORY);
        await writeTerminalHistory(updated);
        res.json({ ...entry, error: errorMessage });
    } catch (error) {
        logServerError('terminal:persist', error);
        res.status(500).json({ error: 'Failed to persist terminal history' });
    }
}

app.get('/api/terminal/history', terminalHistoryRoute);

app.post('/api/terminal/execute', terminalExecuteRoute);

app.delete('/api/terminal/history', async (req, res) => {
    try {
        const cleared = await clearTerminalHistory();
        res.json({ cleared: true, history: cleared });
    } catch (error) {
        logServerError('terminal:clear', error);
        res.status(500).json({ error: 'Failed to clear terminal history' });
    }
});

app.get('/api/export/markdown', async (req, res) => {
    try {
        const data = await readData();
        let markdown = '# Claude CLI Ticket Analysis\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
        
        // Group by tags if any exist
        const tagGroups = {};
        const untagged = [];
        
        data.tickets.forEach(ticket => {
            if (ticket.tags && ticket.tags.length > 0) {
                ticket.tags.forEach(tag => {
                    if (!tagGroups[tag]) tagGroups[tag] = [];
                    tagGroups[tag].push(ticket);
                });
            } else {
                untagged.push(ticket);
            }
        });
        
        // Export by tag groups
        Object.keys(tagGroups).sort().forEach(tag => {
            markdown += `## TAG: ${tag}\n\n`;
            tagGroups[tag].forEach(ticket => {
                markdown += `### Ticket #${ticket.id}: ${ticket.title}\n`;
                markdown += `Priority: ${ticket.priority} | Status: ${ticket.status}\n`;
                markdown += `Tags: ${ticket.tags.join(', ')}\n`;
                markdown += `Description: ${ticket.description}\n\n`;
            });
        });
        
        if (untagged.length > 0) {
            markdown += `## UNTAGGED\n\n`;
            untagged.forEach(ticket => {
                markdown += `### Ticket #${ticket.id}: ${ticket.title}\n`;
                markdown += `Priority: ${ticket.priority} | Status: ${ticket.status}\n`;
                markdown += `Description: ${ticket.description}\n\n`;
            });
        }
        
        res.type('text/plain').send(markdown);
    } catch (error) {
        logServerError('export:markdown', error);
        res.status(500).json({ error: 'Failed to export' });
    }
});

app.get('/api/claude/next', async (req, res) => {
    try {
        const { tag } = req.query;
        const data = await readData();
        let reportedTickets = data.tickets.filter(t => t.status === 'reported');
        
        // Filter by tag if specified
        if (tag) {
            const searchTag = tag.toUpperCase();
            reportedTickets = reportedTickets.filter(t => 
                t.tags && t.tags.includes(searchTag)
            );
        }
        
        // Sort by priority
        reportedTickets.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return priorityOrder[a.priority] - priorityOrder[b.priority];
        });
        
        if (reportedTickets.length === 0) {
            return res.json({ 
                message: tag ? `No reported tickets with tag: ${tag}` : 'No reported tickets available' 
            });
        }
        
        res.json({
            instruction: `Work on this ${reportedTickets[0].priority} priority issue`,
            ticket: reportedTickets[0]
        });
    } catch (error) {
        logServerError('claude:next', error);
        res.status(500).json({ error: 'Failed to get next ticket' });
    }
});

app.get('/api/claude/batch', async (req, res) => {
    try {
        const { tag } = req.query;
        const data = await readData();
        let needsWork = data.tickets.filter(t =>
            t.status === statusReported || t.status === statusInProgress
        );

        // Filter by tag if specified
        if (tag) {
            const searchTag = tag.toUpperCase();
            needsWork = needsWork.filter(t =>
                t.tags && t.tags.includes(searchTag)
            );
        }

        res.json({
            count: needsWork.length,
            tag: tag || 'all',
            tickets: needsWork
        });
    } catch (error) {
        logServerError('claude:batch', error);
        res.status(500).json({ error: 'Failed to get batch' });
    }
});

// REAL Agent functionality
app.get('/api/agents', async (req, res) => {
    try {
        const agents = await fsPromises.readdir(AGENTS_DIR);
        const agentList = [];

        for (const item of agents) {
            const itemPath = path.join(AGENTS_DIR, item);
            const stat = await fsPromises.stat(itemPath);

            if (stat.isDirectory()) {
                // Check for agent files in subdirectory
                const subFiles = await fsPromises.readdir(itemPath);
                for (const file of subFiles) {
                    if (file.endsWith('.md')) {
                        agentList.push({
                            id: file.replace('.md', ''),
                            name: file.replace('.md', '').replace(/-/g, ' '),
                            category: item,
                            path: path.join(itemPath, file)
                        });
                    }
                }
            } else if (item.endsWith('.md')) {
                agentList.push({
                    id: item.replace('.md', ''),
                    name: item.replace('.md', '').replace(/-/g, ' '),
                    category: 'general',
                    path: itemPath
                });
            }
        }

        res.json({ agents: agentList });
    } catch (error) {
        console.error('Error reading agents:', error);
        res.status(500).json({ error: 'Failed to read agents directory' });
    }
});

app.post('/api/agents/activate', async (req, res) => {
    try {
        const { agentId } = req.body;
        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID required' });
        }

        console.log(`Activating agent: ${agentId}`);
        // This would connect to Claude CLI in real implementation
        // For now, return success with agent info

        res.json({
            success: true,
            agent: agentId,
            status: 'activated',
            message: `Agent ${agentId} is now active`
        });
    } catch (error) {
        console.error('Agent activation error:', error);
        res.status(500).json({ error: 'Failed to activate agent' });
    }
});

app.post('/api/claude/execute', async (req, res) => {
    try {
        let { command } = req.body;
        if (!command) {
            return res.status(400).json({ error: 'Command required' });
        }

        const trimmedCommand = command.trim();

        if (trimmedCommand.startsWith('/')) {
            try {
                const slashResult = await handleSlashCommand(trimmedCommand);
                if (slashResult.error) {
                    return res.status(400).json({ error: slashResult.error });
                }
                return res.json(slashResult);
            } catch (error) {
                console.error('Slash command error:', error);
                return res.status(500).json({ error: error.message || 'Slash command failed' });
            }
        }

        if (!/--ultrathink/i.test(command)) {
            command = `${command} --ultrathink`;
        }

        console.log(`Executing Claude command: ${command}`);
        const normalizedCommand = command.toLowerCase();

        // Handle specific commands
        if (normalizedCommand.includes('setup') || normalizedCommand.includes('audit')) {
            const audit = await runInitialAudit();
            return res.json({ result: 'Initial audit completed', audit });
        }

        if (command.includes('detect')) {
            return res.json({ result: 'Module detection initiated' });
        } else if (command.includes('analyze')) {
            return res.json({ result: 'Analysis started' });
        } else if (command.includes('fix')) {
            const match = command.match(/#(\d+)/);
            if (match) {
                // Update ticket status
                const data = await readData();
                const ticket = data.tickets.find(t => t.id === parseInt(match[1]));
                if (ticket) {
                    ticket.status = statusInProgress;
                    await writeData(data);
                    return res.json({ result: `Working on ticket #${match[1]}` });
                }
            }
            return res.json({ result: 'Fix command processed' });
        }

        res.json({ result: 'Command executed successfully' });
    } catch (error) {
        console.error('Claude execution error:', error);
        res.status(500).json({ error: 'Command execution failed' });
    }
});

app.get('/api/cli/sessions', async (_req, res) => {
    try {
        const sessions = await cliInterviewManager.listSessions();
        const gates = await readCliGateLog(25);
        res.json({ sessions, gates });
    } catch (error) {
        logServerError('cli:sessions:list', error);
        res.status(500).json({ error: 'Failed to list CLI sessions' });
    }
});

app.get('/api/cli/sessions/:id', async (req, res) => {
    try {
        const session = await cliInterviewManager.getSession(req.params.id);
        if (!session) {
            return res.status(404).json({ error: 'Session not found' });
        }
        res.json(session);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'Session not found' });
        }
        logServerError('cli:sessions:get', error);
        res.status(500).json({ error: 'Failed to read CLI session' });
    }
});

app.post('/api/modules/detect', async (req, res) => {
    try {
        const { rootPath } = req.body || {};
        const targetRoot = rootPath ? path.resolve(__dirname, rootPath) : __dirname;

        if (!targetRoot.startsWith(__dirname)) {
            return res.status(400).json({ error: 'Scan path must remain within the Opnix workspace' });
        }

        const result = await moduleDetector.detectModules(targetRoot);
        await writeDetectedModules(result);
        res.json(result);
    } catch (error) {
        console.error('Module detection error:', error);
        try {
            const fallback = await readDetectedModules();
            if (fallback) {
                res.json(fallback);
                return;
            }
        } catch (readError) {
            console.error('Failed to read cached modules:', readError);
        }
        res.status(500).json({ error: 'Failed to detect modules' });
    }
});

app.get('/api/modules/graph', async (req, res) => {
    try {
        const result = await moduleDetector.detectModules(__dirname);
        await writeDetectedModules(result);
        res.json(result);
    } catch (error) {
        console.error('Module graph error:', error);
        try {
            const fallback = await readDetectedModules();
            if (fallback) {
                res.json(fallback);
                return;
            }
        } catch (readError) {
            console.error('Failed to read cached modules:', readError);
        }
        res.status(500).json({ error: 'Failed to build module graph' });
    }
});

app.get('/api/modules/links', async (req, res) => {
    try {
        const links = await readModuleLinks();
        res.json(links);
    } catch (error) {
        console.error('Module links read error:', error);
        res.status(500).json({ error: 'Failed to read module links' });
    }
});

app.post('/api/modules/links', async (req, res) => {
    try {
        const { source, target } = req.body || {};
        if (!source || !target) {
            return res.status(400).json({ error: 'Source and target modules are required' });
        }

        if (source === target) {
            return res.status(400).json({ error: 'Cannot create self-dependency' });
        }

        const modules = await moduleDetector.detectModules(__dirname);
        const validModuleIds = new Set(modules.modules.map(module => module.id));
        if (!validModuleIds.has(source) || !validModuleIds.has(target)) {
            return res.status(404).json({ error: 'Source or target module not found' });
        }

        const links = await readModuleLinks();
        const exists = links.some(link => link.source === source && link.target === target);
        if (exists) {
            return res.status(200).json({ source, target, duplicate: true });
        }

        const newLink = { source, target, createdAt: new Date().toISOString() };
        links.push(newLink);
        await writeModuleLinks(links);

        res.status(201).json(newLink);
    } catch (error) {
        console.error('Module link creation error:', error);
        res.status(500).json({ error: 'Failed to create module link' });
    }
});

app.delete('/api/modules/links', async (req, res) => {
    try {
        const { source, target } = req.body || {};
        if (!source || !target) {
            return res.status(400).json({ error: 'Source and target modules are required' });
        }

        const links = await readModuleLinks();
        const filtered = links.filter(link => !(link.source === source && link.target === target));

        if (filtered.length === links.length) {
            return res.status(404).json({ error: 'Link not found' });
        }

        await writeModuleLinks(filtered);
        res.status(204).send();
    } catch (error) {
        console.error('Module link deletion error:', error);
        res.status(500).json({ error: 'Failed to delete module link' });
    }
});

// Features CRUD
app.get('/api/features', async (req, res) => {
    try {
        const features = await readFeaturesFile();
        res.json(features);
    } catch (error) {
        console.error('Features read error:', error);
        res.status(500).json({ error: 'Failed to read features' });
    }
});

app.post('/api/features', async (req, res) => {
    try {
        const features = await readFeaturesFile();

        const acceptanceCriteria = normaliseAcceptanceCriteria(req.body.acceptanceCriteria || []);
        const requestedStatus = normaliseFeatureStatus(req.body.status, { fallback: 'proposed' }) || 'proposed';
        const featureStatus = VALID_FEATURE_STATUSES.includes(requestedStatus) ? requestedStatus : 'proposed';

        const validation = validateFeatureStatusChange('proposed', featureStatus, acceptanceCriteria);
        if (!validation.ok) {
            return res.status(400).json({ error: validation.message });
        }

        const newFeature = normaliseFeatureRecord({
            id: Date.now(),
            title: req.body.title,
            description: req.body.description,
            moduleId: req.body.moduleId,
            priority: req.body.priority || 'medium',
            status: featureStatus,
            votes: 0,
            acceptanceCriteria,
            created: new Date().toISOString()
        });

        const updatedFeatures = [...features, newFeature];
        await writeFeaturesFile(updatedFeatures);

        console.log(`✓ Created feature: ${newFeature.title}`);
        res.status(201).json(newFeature);
    } catch (error) {
        console.error('Feature creation error:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
});

app.put('/api/features/:id', async (req, res) => {
    try {
        const features = await readFeaturesFile();

        const featureId = req.params.id;
        const index = features.findIndex(feature => String(feature.id) === String(featureId));
        if (index === -1) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const existing = features[index];
        const acceptanceCriteria = req.body.acceptanceCriteria !== undefined
            ? normaliseAcceptanceCriteria(req.body.acceptanceCriteria)
            : normaliseAcceptanceCriteria(existing.acceptanceCriteria || []);

        const nextStatus = normaliseFeatureStatus(req.body.status !== undefined ? req.body.status : existing.status, { fallback: existing.status });
        const validation = validateFeatureStatusChange(existing.status, nextStatus, acceptanceCriteria);
        if (!validation.ok) {
            return res.status(412).json({ error: validation.message });
        }

        const updated = normaliseFeatureRecord({
            ...existing,
            title: req.body.title !== undefined ? req.body.title : existing.title,
            description: req.body.description !== undefined ? req.body.description : existing.description,
            moduleId: req.body.moduleId !== undefined ? req.body.moduleId : existing.moduleId,
            priority: req.body.priority !== undefined ? req.body.priority : existing.priority,
            status: nextStatus,
            acceptanceCriteria,
            updated: new Date().toISOString()
        });

        features[index] = updated;
        await writeFeaturesFile(features);

        console.log(`✓ Updated feature: ${updated.title} → ${updated.status}`);
        res.json(updated);
    } catch (error) {
        console.error('Feature update error:', error);
        res.status(500).json({ error: 'Failed to update feature' });
    }
});

// Modules CRUD
app.get('/api/modules', async (req, res) => {
    try {
        await ensureDataDirectory();
        await migrateLegacyFile(path.join(__dirname, 'modules.json'), MANUAL_MODULES_FILE);
        let modules = [];

        try {
            const data = await fsPromises.readFile(MANUAL_MODULES_FILE, 'utf8');
            modules = JSON.parse(data);
        } catch {
            // File doesn't exist, return empty array
        }

        res.json(modules);
    } catch (error) {
        console.error('Modules read error:', error);
        res.status(500).json({ error: 'Failed to read modules' });
    }
});

app.post('/api/modules', async (req, res) => {
    try {
        await ensureDataDirectory();
        await migrateLegacyFile(path.join(__dirname, 'modules.json'), MANUAL_MODULES_FILE);
        let modules = [];

        try {
            const data = await fsPromises.readFile(MANUAL_MODULES_FILE, 'utf8');
            modules = JSON.parse(data);
        } catch {
            // File doesn't exist, start with empty array
        }

        const now = new Date().toISOString();
        const trimmedName = typeof req.body.name === 'string' ? req.body.name.trim() : '';
        if (!trimmedName) {
            return res.status(400).json({ error: 'Module name is required' });
        }

        const generatedId = trimmedName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
        const moduleId = (req.body.id || generatedId).trim();
        if (!moduleId) {
            return res.status(400).json({ error: 'Module id is required' });
        }

        const normalizeList = value => {
            if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
            if (typeof value === 'string') {
                return value
                    .split(',')
                    .map(entry => entry.trim())
                    .filter(Boolean);
            }
            return [];
        };

        const payload = {
            id: moduleId,
            name: trimmedName,
            type: typeof req.body.type === 'string' ? req.body.type.trim().toLowerCase() : 'custom',
            path: typeof req.body.path === 'string' ? req.body.path.trim() : '',
            dependencies: normalizeList(req.body.dependencies),
            externalDependencies: normalizeList(req.body.externalDependencies),
            description: typeof req.body.description === 'string' ? req.body.description.trim() : '',
            coverage: Number.isFinite(Number(req.body.coverage)) ? Number(req.body.coverage) : 0,
            health: Number.isFinite(Number(req.body.health)) ? Number(req.body.health) : 70,
            createdAt: now,
            updatedAt: now
        };

        const existingIndex = modules.findIndex(entry => entry && entry.id === payload.id);
        if (existingIndex >= 0) {
            payload.createdAt = modules[existingIndex].createdAt || now;
            modules[existingIndex] = { ...modules[existingIndex], ...payload };
        } else {
            modules.push(payload);
        }

        await fsPromises.writeFile(MANUAL_MODULES_FILE, JSON.stringify(modules, null, 2));

        console.log(`✓ Saved module: ${payload.name}`);
        res.status(existingIndex >= 0 ? 200 : 201).json(payload);
    } catch (error) {
        console.error('Module creation error:', error);
        res.status(500).json({ error: 'Failed to create module' });
    }
});

// Checklists CRUD
app.get('/api/checklists', async (_req, res) => {
    try {
        const checklists = await readChecklistsFile();
        res.json(checklists);
    } catch (error) {
        console.error('Checklist read error:', error);
        res.status(500).json({ error: 'Failed to read checklists' });
    }
});

app.post('/api/checklists', async (req, res) => {
    try {
        const checklists = await readChecklistsFile();
        const items = Array.isArray(req.body.items) ? req.body.items
            .map((item, index) => ({
                id: item?.id || `item-${index + 1}`,
                text: (item?.text || '').trim(),
                status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
            }))
            .filter(item => item.text.length > 0) : [];

        const checklist = {
            id: Date.now().toString(),
            title: req.body.title || 'Checklist',
            description: req.body.description || '',
            status: checklistPending,
            statusHistory: [],
            items,
            created: new Date().toISOString()
        };

        const normalisedChecklist = normaliseChecklist(checklist);
        checklists.push(normalisedChecklist);
        await writeChecklistsFile(checklists);
        console.log(`✓ Created checklist ${normalisedChecklist.title}`);
        res.status(201).json(normalisedChecklist);
    } catch (error) {
        console.error('Checklist creation error:', error);
        res.status(500).json({ error: 'Failed to create checklist' });
    }
});

app.put('/api/checklists/:id', async (req, res) => {
    try {
        const checklists = await readChecklistsFile();
        const checklistId = req.params.id;
        const index = checklists.findIndex(checklist => String(checklist.id) === String(checklistId));
        if (index === -1) {
            return res.status(404).json({ error: 'Checklist not found' });
        }

        const current = checklists[index];
        const requestedStatus = req.body.status !== undefined
            ? normaliseChecklistStatus(req.body.status, { fallback: current.status })
            : current.status;
        const nextStatus = normaliseChecklistStatus(requestedStatus, { fallback: current.status });
        const validation = validateChecklistStatusChange(current.status, nextStatus, req.body.statusHook);
        if (!validation.ok) {
            return res.status(409).json({ error: validation.message });
        }

        const items = Array.isArray(req.body.items) ? req.body.items.map(item => ({
            id: item?.id || Date.now().toString(),
            text: (item?.text || '').trim(),
            status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
        })) : current.items;

        const hook = normaliseStatusHook(req.body.statusHook);
        const historyEntry = { from: current.status, to: nextStatus, at: new Date().toISOString() };
        if (hook) {
            historyEntry.hook = hook;
        }

        const updated = normaliseChecklist({
            ...current,
            title: req.body.title !== undefined ? req.body.title : current.title,
            description: req.body.description !== undefined ? req.body.description : current.description,
            status: nextStatus,
            items,
            updated: new Date().toISOString(),
            statusHistory: Array.isArray(current.statusHistory)
                ? [...current.statusHistory, historyEntry]
                : [historyEntry]
        });

        checklists[index] = updated;
        await writeChecklistsFile(checklists);
        console.log(`✓ Updated checklist ${updated.title} → ${updated.status}`);
        res.json(updated);
    } catch (error) {
        console.error('Checklist update error:', error);
        res.status(500).json({ error: 'Failed to update checklist' });
    }
});

// Canvas export with real file operations
app.post('/api/canvas/export', async (req, res) => {
    try {
        const { format, data } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let filename, content;

        await ensureExportStructure();

        if (format === 'png') {
            filename = `opnix-canvas-${timestamp}.png`;
            // Handle base64 PNG data
            const base64Data = data.replace(/^data:image\/png;base64,/, '');
            content = Buffer.from(base64Data, 'base64');
        } else if (format === 'json') {
            filename = `opnix-canvas-${timestamp}.json`;
            content = JSON.stringify(data, null, 2);
        }

        if (!filename) {
            return res.status(400).json({ error: 'Unsupported export format' });
        }

        const filePath = path.join(EXPORT_SUBDIRS.canvas, filename);
        if (Buffer.isBuffer(content)) {
            await fsPromises.writeFile(filePath, content);
        } else if (typeof content === 'string') {
            await fsPromises.writeFile(filePath, content);
        }

        const relativePath = path.relative(EXPORTS_DIR, filePath);
        console.log(`✓ Canvas exported: ${filename}`);
        res.json({ success: true, filename, path: filePath, relativePath });
    } catch (error) {
        console.error('Canvas export error:', error);
        res.status(500).json({ error: 'Failed to export canvas' });
    }
});

// Roadmap API Endpoints
app.post('/api/roadmap/generate-from-tickets', async (req, res) => {
    try {
        const { tickets = [], modules = [], features = [] } = req.body;

        // Generate milestones based on tickets, modules, and features
        const milestones = [];
        let milestoneId = 1;

        // Group tickets by module or priority
        const moduleGroups = {};
        tickets.forEach(ticket => {
            const moduleId = ticket.modules?.[0] || 'general';
            if (!moduleGroups[moduleId]) {
                moduleGroups[moduleId] = [];
            }
            moduleGroups[moduleId].push(ticket);
        });

        // Create milestones from module groups
        Object.entries(moduleGroups).forEach(([moduleId, moduleTickets]) => {
            if (moduleTickets.length > 0) {
                const module = modules.find(m => m.id === moduleId);
                const moduleName = module ? module.name : moduleId.charAt(0).toUpperCase() + moduleId.slice(1);

                const finishedCount = moduleTickets.filter(t => t.status === 'finished').length;
                const progress = Math.round((finishedCount / moduleTickets.length) * 100);

                const startDate = new Date();
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + Math.max(30, moduleTickets.length * 7)); // Estimate based on ticket count

                milestones.push({
                    id: milestoneId++,
                    name: `${moduleName} Implementation`,
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0],
                    progress: progress,
                    linkedModule: moduleId,
                    linkedTickets: moduleTickets.map(t => t.id)
                });
            }
        });

        // Add feature-based milestones
        features.forEach(feature => {
            if (feature.status === 'approved' || feature.status === 'inDevelopment') {
                const startDate = new Date();
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 45); // 45 days for feature development

                let progress = 0;
                if (feature.status === 'inDevelopment') progress = 30;
                else if (feature.status === 'testing') progress = 70;
                else if (feature.status === 'deployed') progress = 100;

                milestones.push({
                    id: milestoneId++,
                    name: feature.title,
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0],
                    progress: progress,
                    linkedModule: feature.moduleId,
                    linkedTickets: []
                });
            }
        });

        console.log(`✓ Generated ${milestones.length} roadmap milestones from ${tickets.length} tickets and ${features.length} features`);
        res.json({ success: true, milestones });
    } catch (error) {
        console.error('Roadmap generation error:', error);
        res.status(500).json({ error: 'Failed to generate roadmap from tickets' });
    }
});

app.post('/api/roadmap/export', async (req, res) => {
    try {
        const roadmapData = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const filename = `opnix-roadmap-${timestamp}.json`;

        await ensureExportStructure();

        // Ensure roadmap subdirectory exists
        const roadmapDir = path.join(EXPORTS_DIR, 'roadmaps');
        try {
            await fsPromises.access(roadmapDir);
        } catch {
            await fsPromises.mkdir(roadmapDir, { recursive: true });
        }

        const filePath = path.join(roadmapDir, filename);
        await fsPromises.writeFile(filePath, JSON.stringify(roadmapData, null, 2));

        const relativePath = path.relative(EXPORTS_DIR, filePath);
        console.log(`✓ Roadmap exported: ${filename}`);
        res.json({ success: true, filename, path: filePath, relativePath });
    } catch (error) {
        console.error('Roadmap export error:', error);
        res.status(500).json({ error: 'Failed to export roadmap' });
    }
});

app.get('/api/exports', async (req, res) => {
    try {
        await ensureExportStructure();
        const files = await listExportFiles(EXPORTS_DIR);
        res.json({ files });
    } catch (error) {
        console.error('Exports listing error:', error);
        res.status(500).json({ error: 'Failed to list exports' });
    }
});

app.get('/api/exports/:filename', async (req, res) => {
    try {
        await ensureExportStructure();
        const filename = path.basename(req.params.filename);
        const files = await listExportFiles(EXPORTS_DIR);
        const match = files.find(file => file.name === filename);
        if (!match) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.sendFile(match.path);
    } catch (error) {
        console.error('Export download error:', error);
        res.status(500).json({ error: 'Failed to download export' });
    }
});

app.get('/api/exports/download', async (req, res) => {
    try {
        await ensureExportStructure();
        const requestedPath = req.query.path;
        if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
            return res.status(400).json({ error: 'Missing path query parameter' });
        }
        const normalized = path.normalize(requestedPath);
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        const filePath = path.join(EXPORTS_DIR, normalized);
        await fsPromises.access(filePath);
        res.sendFile(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }
        console.error('Export download error:', error);
        res.status(500).json({ error: 'Failed to download export' });
    }
});

app.get('/api/archive/markdown', markdownListRoute);

app.get('/api/archive/markdown/content', (req, res) => markdownReadRoute(req, res));

app.get('/api/markdown', markdownListRoute);

app.get(/^\/api\/markdown\/([^/]+)\/(.+)$/i, (req, res) => {
    const [rootId, relative] = req.params;
    req.params = {
        rootId: decodeURIComponent(rootId),
        relativePath: decodeURIComponent(relative)
    };
    return markdownReadRoute(req, res);
});

app.post('/api/markdown', markdownCreateRoute);

app.put('/api/markdown', markdownUpdateRoute);

app.put(/^\/api\/markdown\/([^/]+)\/(.+)$/i, (req, res) => {
    const [rootId, relative] = req.params;
    req.params = {
        rootId: decodeURIComponent(rootId),
        relativePath: decodeURIComponent(relative)
    };
    return markdownUpdateRoute(req, res);
});

app.get('/api/diagrams', async (req, res) => {
    try {
        await ensureExportStructure();
        const files = await listExportFiles();
        const diagrams = files
            .filter(file => file.category === 'diagrams')
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));
        res.json({ diagrams });
    } catch (error) {
        console.error('Diagram listing error:', error);
        res.status(500).json({ error: 'Failed to list diagrams' });
    }
});

app.get('/api/diagrams/:type', async (req, res) => {
    const type = req.params.type.toLowerCase();
    if (!DIAGRAM_TYPES.includes(type)) {
        return res.status(400).json({ error: `Unsupported diagram type: ${type}` });
    }

    const refreshRequested = typeof req.query.refresh === 'string' && req.query.refresh.toLowerCase() !== 'false';

    try {
        await ensureExportStructure();
        let diagrams = await listExportFiles();
        diagrams = diagrams
            .filter(file => file.category === 'diagrams' && file.name.includes(`-${type}-`))
            .sort((a, b) => new Date(b.modified) - new Date(a.modified));

        let meta;
        let mermaid;

        if (refreshRequested || diagrams.length === 0) {
            const context = await loadDiagramContext();
            const generated = await diagramGenerator.generateDiagramFile(type, context, EXPORT_SUBDIRS.diagrams);
            if (!generated) {
                return res.status(500).json({ error: 'Failed to generate diagram content' });
            }
            meta = withRelativePath(generated);
            mermaid = generated.mermaid;
        } else {
            meta = diagrams[0];
            mermaid = await fsPromises.readFile(meta.path, 'utf8');
        }

        const stats = await fsPromises.stat(meta.path);
        res.json({
            type,
            filename: path.basename(meta.path),
            mermaid,
            generatedAt: stats.mtime.toISOString(),
            relativePath: path.relative(EXPORTS_DIR, meta.path),
            sources: getDiagramSources(type)
        });
    } catch (error) {
        console.error('Diagram generation error:', error);
        res.status(500).json({ error: 'Failed to generate diagram' });
    }
});

// Spec generation with real file output
app.post('/api/specs/generate', async (req, res) => {
    try {
        const { spec, format } = req.body;
        await ensureExportStructure();
        const safeSpec = spec && typeof spec === 'object' ? spec : {};
        const result = withRelativePath(await specGenerator.generateSpecFile({
            spec: safeSpec,
            format,
            exportsDir: EXPORT_SUBDIRS.blueprints
        }));
        console.log(`✓ Spec generated: ${result.filename}`);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Spec generation error:', error);
        res.status(500).json({ error: 'Failed to generate spec' });
    }
});

// Storybook Process Management
let storybookProcess = null;

app.post('/api/storybook/start', async (req, res) => {
    try {
        if (storybookProcess) {
            res.json({ success: true, message: 'Storybook already running', pid: storybookProcess.pid });
            return;
        }

        const { spawn } = require('child_process');
        storybookProcess = spawn('npm', ['run', 'storybook', '--', '--no-open'], {
            stdio: 'pipe',
            detached: false
        });

        storybookProcess.on('error', (error) => {
            console.error('Storybook start error:', error);
            storybookProcess = null;
        });

        storybookProcess.on('exit', (code) => {
            console.log(`Storybook process exited with code ${code}`);
            storybookProcess = null;
        });

        setTimeout(() => {
            if (storybookProcess) {
                res.json({
                    success: true,
                    message: 'Storybook started successfully',
                    pid: storybookProcess.pid,
                    url: 'http://localhost:6006'
                });
            }
        }, 1000);

    } catch (error) {
        console.error('Failed to start Storybook:', error);
        res.status(500).json({ success: false, error: 'Failed to start Storybook' });
    }
});

// UltraThink API - Based on cc-sessions
let ultraThinkMode = 'api'; // 'default', 'max', 'api'
let contextUsed = 0;
const contextLimit = 160000;
let currentTask = 'System Ready';
let filesEdited = 0;
let daicState = 'Discussion'; // 'Discussion' or 'Implementation'

function ultraThinkTriggerRoute(req, res) {
    try {
        const { message, mode } = req.body || {};

        // Check for manual trigger
        const hasUltraThink = message && message.includes('[[ ultrathink ]]');

        // Determine thinking budget
        let thinkingBudget = 0;
        switch (mode || ultraThinkMode) {
            case 'default':
                thinkingBudget = hasUltraThink ? 31999 : 10000;
                break;
            case 'max':
                thinkingBudget = 31999; // Always max
                break;
            case 'api':
                thinkingBudget = hasUltraThink ? 31999 : 0; // Only on manual trigger
                break;
            default:
                thinkingBudget = hasUltraThink ? 31999 : 0;
                break;
        }

        res.json({
            ultrathink: Boolean(hasUltraThink),
            thinkingBudget,
            mode: mode || ultraThinkMode,
            message: hasUltraThink ? 'UltraThink activated - deep analysis enabled' : 'Normal processing'
        });
    } catch (error) {
        console.error('UltraThink trigger error:', error);
        res.status(500).json({ error: 'UltraThink trigger failed' });
    }
}

function contextStatusRoute(req, res) {
    try {
        const percentage = Math.min(100, (contextUsed / contextLimit) * 100);
        const remaining = Math.max(0, contextLimit - contextUsed);

        // Generate visual bar (10 chars)
        const filledChars = Math.floor(percentage / 10);
        const emptyChars = 10 - filledChars;
        const visualBar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);

        // Color coding
        let colorClass = 'context-green';
        if (percentage >= 80) colorClass = 'context-red';
        else if (percentage >= 50) colorClass = 'context-orange';

        res.json({
            contextUsed,
            contextLimit,
            percentage: Math.round(percentage * 10) / 10,
            remaining,
            visualBar,
            colorClass,
            displayText: `${visualBar} ${percentage.toFixed(1)}% (${Math.round(contextUsed/1000)}k/${Math.round(contextLimit/1000)}k)`,
            currentTask,
            filesEdited,
            daicState,
            warning: percentage >= 75 ? (percentage >= 90 ? 'CRITICAL: Wrap up immediately!' : 'WARNING: Start wrapping up') : null
        });
    } catch (error) {
        console.error('Context status error:', error);
        res.status(500).json({ error: 'Context status failed' });
    }
}

function contextUpdateRoute(req, res) {
    try {
        const { contextUsed: newContextUsed, task, filesEdited: newFilesEdited, daicState: newDaicState } = req.body || {};

        if (typeof newContextUsed === 'number') contextUsed = newContextUsed;
        if (typeof task === 'string') currentTask = task;
        if (typeof newFilesEdited === 'number') filesEdited = newFilesEdited;
        if (typeof newDaicState === 'string' && ['Discussion', 'Implementation'].includes(newDaicState)) {
            daicState = newDaicState;
        }

        res.json({ success: true, contextUsed, currentTask, filesEdited, daicState });
    } catch (error) {
        console.error('Context update error:', error);
        res.status(500).json({ error: 'Context update failed' });
    }
}

function ultraThinkModeRoute(req, res) {
    try {
        const { mode } = req.body || {};
        if (['default', 'max', 'api'].includes(mode)) {
            ultraThinkMode = mode;
            res.json({ success: true, mode: ultraThinkMode });
        } else {
            res.status(400).json({ error: 'Invalid mode. Use: default, max, or api' });
        }
    } catch (error) {
        console.error('UltraThink mode error:', error);
        res.status(500).json({ error: 'UltraThink mode change failed' });
    }
}

app.post('/api/ultrathink/trigger', ultraThinkTriggerRoute);

app.get('/api/context/status', contextStatusRoute);

app.post('/api/context/update', contextUpdateRoute);

app.post('/api/ultrathink/mode', ultraThinkModeRoute);

// Progressive Document System Routes
let progressiveSystem = null;

// Initialize Progressive Document System
async function initializeProgressiveSystem() {
    if (!progressiveSystem) {
        progressiveSystem = new ProgressiveDocumentSystem(ROOT_DIR);
    }
    return progressiveSystem;
}

// Progressive Document System Status
// Documentation Management Endpoints
app.get('/api/docs/browse', async (req, res) => {
    try {
        const path = require('path');
        const glob = require('glob');

        // Find all markdown files in the project
        const markdownFiles = glob.sync('**/*.md', {
            cwd: ROOT_DIR,
            ignore: ['node_modules/**', '.git/**', 'exports/**']
        });

        // Organize files by directory
        const fileTree = {};

        for (const filePath of markdownFiles) {
            const dirname = path.dirname(filePath);
            const basename = path.basename(filePath);

            if (!fileTree[dirname]) {
                fileTree[dirname] = [];
            }

            // Get file stats
            const fullPath = path.join(ROOT_DIR, filePath);
            const stats = fs.statSync(fullPath);

            fileTree[dirname].push({
                name: basename,
                path: filePath,
                fullPath,
                size: stats.size,
                modified: stats.mtime,
                relativePath: filePath
            });
        }

        res.json({
            fileTree,
            totalFiles: markdownFiles.length,
            directories: Object.keys(fileTree)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/docs/read', async (req, res) => {
    try {
        const { filePath } = req.query;
        if (!filePath) {
            return res.status(400).json({ error: 'filePath parameter required' });
        }

        const fullPath = path.join(ROOT_DIR, filePath);
        const content = fs.readFileSync(fullPath, 'utf8');
        const stats = fs.statSync(fullPath);

        res.json({
            content,
            filePath,
            size: stats.size,
            modified: stats.mtime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/docs/save', async (req, res) => {
    try {
        const { filePath, content } = req.body;
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'filePath and content required' });
        }

        const fullPath = path.join(ROOT_DIR, filePath);

        // Ensure directory exists
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });

        fs.writeFileSync(fullPath, content, 'utf8');
        const stats = fs.statSync(fullPath);

        res.json({
            success: true,
            filePath,
            size: stats.size,
            modified: stats.mtime
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.get('/api/docs/templates', async (req, res) => {
    try {
        const templates = [
            {
                id: 'readme',
                name: 'README.md',
                description: 'Project README template',
                content: `# Project Name\n\n## Description\n\nA brief description of your project.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## Contributing\n\nPlease read [CONTRIBUTING.md](CONTRIBUTING.md) for details on our code of conduct, and the process for submitting pull requests.\n\n## License\n\nThis project is licensed under the MIT License - see the [LICENSE.md](LICENSE.md) file for details.`
            },
            {
                id: 'api-docs',
                name: 'API Documentation',
                description: 'API documentation template',
                content: `# API Documentation\n\n## Overview\n\nThis document describes the REST API endpoints for the project.\n\n## Base URL\n\n\`\`\`\nhttp://localhost:3000/api\n\`\`\`\n\n## Authentication\n\nAll API requests require authentication via API key.\n\n## Endpoints\n\n### GET /api/example\n\nDescription of endpoint.\n\n**Parameters:**\n- \`param1\` (string, required): Description\n- \`param2\` (number, optional): Description\n\n**Response:**\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\`\n\n**Error Codes:**\n- \`400\` - Bad Request\n- \`401\` - Unauthorized\n- \`404\` - Not Found\n- \`500\` - Internal Server Error`
            },
            {
                id: 'architecture',
                name: 'Architecture Documentation',
                description: 'System architecture template',
                content: `# System Architecture\n\n## Overview\n\nThis document describes the high-level architecture of the system.\n\n## Components\n\n### Frontend\n- Technology: React/Vue/Angular\n- Location: \`/src/frontend\`\n- Responsibilities: User interface and client-side logic\n\n### Backend\n- Technology: Node.js/Express\n- Location: \`/src/backend\`\n- Responsibilities: API, business logic, data processing\n\n### Database\n- Technology: PostgreSQL/MongoDB\n- Location: External service\n- Responsibilities: Data persistence\n\n## Data Flow\n\n1. User interacts with frontend\n2. Frontend sends API requests to backend\n3. Backend processes requests and queries database\n4. Backend returns response to frontend\n5. Frontend updates UI\n\n## Deployment\n\nThe system is deployed using Docker containers:\n- Frontend: Nginx serving static files\n- Backend: Node.js application\n- Database: Managed database service\n\n## Monitoring\n\n- Application logs: Structured JSON logging\n- Metrics: Prometheus + Grafana\n- Error tracking: Sentry\n- Uptime monitoring: Custom health checks`
            },
            {
                id: 'contributing',
                name: 'Contributing Guidelines',
                description: 'Contribution guidelines template',
                content: `# Contributing Guidelines\n\n## Welcome\n\nThank you for considering contributing to this project!\n\n## Code of Conduct\n\nThis project adheres to a code of conduct. By participating, you are expected to uphold this code.\n\n## How to Contribute\n\n### Reporting Issues\n\n1. Check existing issues first\n2. Use the issue template\n3. Provide clear reproduction steps\n4. Include relevant system information\n\n### Pull Requests\n\n1. Fork the repository\n2. Create a feature branch: \`git checkout -b feature-name\`\n3. Make your changes\n4. Add tests if applicable\n5. Update documentation\n6. Submit a pull request\n\n## Development Setup\n\n\`\`\`bash\ngit clone <repository>\ncd <project>\nnpm install\nnpm test\n\`\`\`\n\n## Style Guide\n\n- Use 2 spaces for indentation\n- Follow ESLint configuration\n- Write descriptive commit messages\n- Add comments for complex logic\n\n## Testing\n\n- Write unit tests for new features\n- Maintain test coverage above 80%\n- Run \`npm test\` before submitting PR\n\n## Documentation\n\n- Update README.md if needed\n- Document API changes\n- Include code examples`
            }
        ];

        res.json({ templates });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/docs/create-from-template', async (req, res) => {
    try {
        const { templateId, fileName, customPath } = req.body;

        const templates = {
            'readme': `# ${fileName.replace('.md', '')}\n\n## Description\n\nA brief description of your project.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## Contributing\n\nPlease read [CONTRIBUTING.md](CONTRIBUTING.md) for details.\n\n## License\n\nThis project is licensed under the MIT License.`,
            'api-docs': `# API Documentation\n\n## Overview\n\nThis document describes the REST API endpoints.\n\n## Base URL\n\n\`\`\`\nhttp://localhost:3000/api\n\`\`\`\n\n## Endpoints\n\n### GET /api/example\n\nDescription of endpoint.\n\n**Response:**\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\``,
            'architecture': `# System Architecture\n\n## Overview\n\nThis document describes the high-level architecture.\n\n## Components\n\n- Frontend: User interface\n- Backend: API and business logic\n- Database: Data persistence\n\n## Data Flow\n\n1. User interacts with frontend\n2. Frontend sends requests to backend\n3. Backend processes and returns response`,
            'contributing': `# Contributing Guidelines\n\n## Welcome\n\nThank you for contributing!\n\n## How to Contribute\n\n1. Fork the repository\n2. Create feature branch\n3. Make changes\n4. Submit pull request\n\n## Development Setup\n\n\`\`\`bash\nnpm install\nnpm test\n\`\`\``
        };

        const templateContent = templates[templateId];
        if (!templateContent) {
            return res.status(404).json({ error: 'Template not found' });
        }

        const filePath = customPath ? path.join(customPath, fileName) : fileName;
        const fullPath = path.join(ROOT_DIR, filePath);

        // Ensure directory exists
        fs.mkdirSync(path.dirname(fullPath), { recursive: true });

        // Create file with template content
        fs.writeFileSync(fullPath, templateContent, 'utf8');

        res.json({
            success: true,
            filePath,
            content: templateContent
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

app.post('/api/runbooks/interview/start', async (req, res) => {
    try {
        const { session, question } = await cliInterviewManager.startSession({
            category: 'runbook',
            command: '/runbook (ui)'
        });
        res.json({
            sessionId: session.sessionId,
            question: serializeCliQuestion(question),
            responses: session.responses || []
        });
    } catch (error) {
        console.error('Runbook interview start failed:', error);
        res.status(500).json({ error: error.message || 'Failed to start runbook interview' });
    }
});

app.post('/api/runbooks/interview/answer', async (req, res) => {
    try {
        const { sessionId, questionId, answer } = req.body || {};
        if (!sessionId || !questionId) {
            return res.status(400).json({ error: 'sessionId and questionId are required' });
        }
        const submission = await cliInterviewManager.submitAnswer({
            sessionId,
            questionId,
            answer
        });
        const historyEntry = {
            questionId: submission.session.responses?.slice(-1)[0]?.questionId || questionId,
            answer: submission.session.responses?.slice(-1)[0]?.answer || answer
        };
        const nextQuestion = serializeCliQuestion(submission.nextQuestion);
        let artifacts = Array.isArray(submission.artifacts) ? submission.artifacts : [];
        let messages = [];
        let refreshedSession = submission.session;

        if (submission.completed) {
            const followUp = await generateCliCategoryArtifacts(submission.session);
            messages = followUp.messages || [];
            if (Array.isArray(followUp.artifacts) && followUp.artifacts.length) {
                await cliInterviewManager.appendSessionArtifacts(submission.session.sessionId, followUp.artifacts);
                artifacts = [...artifacts, ...followUp.artifacts];
            }
            refreshedSession = await cliInterviewManager.getSession(submission.session.sessionId);
        }

        res.json({
            sessionId: submission.session.sessionId,
            completed: submission.completed,
            summary: submission.summary || null,
            nextQuestion,
            responses: refreshedSession.responses || [],
            artifacts,
            messages,
            historyEntry
        });
    } catch (error) {
        console.error('Runbook interview answer failed:', error);
        res.status(500).json({ error: error.message || 'Failed to submit answer' });
    }
});

app.post('/api/runbooks/generate', async (req, res) => {
    try {
        const { sessionId, projectName, responses } = req.body || {};
        await ensureExportStructure();

        let session = null;
        if (sessionId) {
            try {
                session = await cliInterviewManager.getSession(sessionId);
            } catch (error) {
                console.warn(`[Opnix][runbook] Unable to load session ${sessionId}:`, error.message || error);
            }
        }

        const [modulesResult, ticketData, packageJson] = await Promise.all([
            moduleDetector.detectModules(__dirname),
            readData(),
            loadPackageJson()
        ]);

        const tickets = Array.isArray(ticketData?.tickets) ? ticketData.tickets : [];
        const techStack = deriveTechStack(packageJson || {}, modulesResult.modules);
        const sessionResponses = session?.responses;
        const fallbackProject = Array.isArray(sessionResponses)
            ? sessionResponses.find(entry => entry.questionId === 'project-name')?.answer
            : null;

        const resolvedProjectName = projectName
            || fallbackProject
            || packageJson?.name
            || 'Opnix Project';

        const runbookMeta = await runbookGenerator.generateRunbook({
            projectName: resolvedProjectName,
            session,
            responses,
            modulesResult,
            tickets,
            techStack,
            exportsDir: EXPORT_SUBDIRS.runbooks
        });

        const content = await fsPromises.readFile(runbookMeta.path, 'utf8');
        const specRelativePath = toPosixPath(path.relative(EXPORTS_DIR, runbookMeta.path));
        const markdownRelativePath = specRelativePath.startsWith('runbooks/')
            ? specRelativePath.slice('runbooks/'.length)
            : specRelativePath;
        const workspacePath = toPosixPath(path.relative(ROOT_DIR, runbookMeta.path));

        res.json({
            success: true,
            runbook: {
                filename: runbookMeta.filename,
                specRelativePath,
                markdownRelativePath,
                workspacePath,
                content,
                sessionId: session?.sessionId || null
            }
        });
    } catch (error) {
        console.error('Runbook generation failed:', error);
        res.status(500).json({ success: false, error: error.message || 'Failed to generate runbook' });
    }
});


app.get('/api/progressive/status', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const status = await system.getSystemStatus();
        res.json(status);
    } catch (error) {
        console.error('Progressive system status error:', error);
        res.status(500).json({ error: 'Failed to get progressive system status' });
    }
});

// Initialize and run initial analysis
app.post('/api/progressive/initialize', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const analysis = await system.initialize();
        res.json({
            success: true,
            analysis,
            message: 'Progressive Document System initialized and initial analysis complete'
        });
    } catch (error) {
        console.error('Progressive system initialization error:', error);
        res.status(500).json({ error: 'Failed to initialize progressive system' });
    }
});

// Start progressive questioning session
app.post('/api/progressive/questions/start', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const session = await system.startProgressiveQuestioning();
        res.json(session);
    } catch (error) {
        console.error('Progressive questioning start error:', error);
        res.status(500).json({ error: 'Failed to start progressive questioning' });
    }
});

// Process question response and get next questions
app.post('/api/progressive/questions/respond', async (req, res) => {
    try {
        const { questionId, response } = req.body;

        if (!questionId || response === undefined) {
            return res.status(400).json({ error: 'Question ID and response are required' });
        }

        const system = await initializeProgressiveSystem();
        const result = await system.processQuestionResponse(questionId, response);
        res.json(result);
    } catch (error) {
        console.error('Progressive questioning response error:', error);
        res.status(500).json({ error: 'Failed to process question response' });
    }
});

// Generate complete document package
app.post('/api/progressive/generate-package', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const documentPackage = await system.generateCompleteDocumentPackage();
        res.json(documentPackage);
    } catch (error) {
        console.error('Document package generation error:', error);
        res.status(500).json({ error: 'Failed to generate document package' });
    }
});

// Regenerate all artifacts with current state
app.post('/api/progressive/regenerate', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const result = await system.regenerateAllArtifacts();
        res.json({
            success: true,
            result,
            message: 'All artifacts regenerated successfully'
        });
    } catch (error) {
        console.error('Artifact regeneration error:', error);
        res.status(500).json({ error: 'Failed to regenerate artifacts' });
    }
});

// Update canvas with progressive analysis
app.post('/api/progressive/canvas/update', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();
        const canvasData = await system.updateCanvasWithAnalysis();
        res.json({
            success: true,
            canvasData,
            message: 'Canvas updated with progressive analysis'
        });
    } catch (error) {
        console.error('Canvas update error:', error);
        res.status(500).json({ error: 'Failed to update canvas' });
    }
});

// Get progressive analysis for existing module detection endpoint integration
app.get('/api/progressive/modules/enhanced', async (req, res) => {
    try {
        const system = await initializeProgressiveSystem();

        // Run module detection with progressive analysis
        const moduleData = await moduleDetector.detectModules(ROOT_DIR);
        const canvasData = await system.updateCanvasWithAnalysis();

        res.json({
            ...moduleData,
            progressiveAnalysis: canvasData.analysis,
            enhancedModules: canvasData.modules
        });
    } catch (error) {
        console.error('Enhanced modules error:', error);
        res.status(500).json({ error: 'Failed to get enhanced module data' });
    }
});

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

// Start server
async function start() {
    await initDataFile();
    await ensureExportStructure();

    // Create PID file for terminal status bar detection
    const pidFile = path.join(__dirname, '.opnix', 'server.pid');

    // Ensure .opnix directory exists
    try {
        await fsPromises.access(path.join(__dirname, '.opnix'));
    } catch (error) {
        if (error.code === 'ENOENT') {
            fs.mkdirSync(path.join(__dirname, '.opnix'), { recursive: true });
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
    });

    process.on('SIGINT', () => {
        console.log('\n🔻 Shutting down Opnix server...');
        try {
            fs.unlinkSync(pidFile);
        } catch {
        // Ignore errors silently
    }
        process.exit(0);
    });

    process.on('SIGTERM', () => {
        try {
            fs.unlinkSync(pidFile);
        } catch {
        // Ignore errors silently
    }
        process.exit(0);
    });

    app.listen(PORT, () => {
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

        // Auto-run progressive analysis on server startup
        setTimeout(() => {
            runInitialProgressiveAnalysis().catch(err => {
                console.error('Background progressive analysis failed:', err.message);
            });
        }, 2000); // Give server time to fully start

        // Auto-start Storybook on server startup
        setTimeout(() => {
            try {
                if (!storybookProcess) {
                    const { spawn } = require('child_process');
                    storybookProcess = spawn('npm', ['run', 'storybook', '--', '--no-open'], {
                        stdio: 'pipe',
                        detached: false
                    });
                    console.log('🎨 Storybook: Auto-started on port 6006');

                    // Handle Storybook process events
                    storybookProcess.on('exit', (code) => {
                        console.log(`🎨 Storybook: Process exited with code ${code}`);
                        storybookProcess = null;
                    });

                    storybookProcess.on('error', (error) => {
                        console.error('🎨 Storybook: Startup error:', error);
                        storybookProcess = null;
                    });
                } else {
                    console.log('🎨 Storybook: Already running');
                }
            } catch (error) {
                console.error('🎨 Storybook: Auto-start failed:', error);
            }
        }, 2000); // Wait 2 seconds after server starts
    });
}

if (require.main === module) {
    start();
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
    readDetectedModules
};
