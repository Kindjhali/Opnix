const express = require('express');
const path = require('path');

let cliDeps = null;

function setCliDependencies(deps) {
    cliDeps = deps;
}

function getDeps() {
    if (!cliDeps) {
        throw new Error('CLI routes not initialised with dependencies');
    }
    return cliDeps;
}

async function terminalHistoryRoute(req, res) {
    const { readTerminalHistory, logServerError } = getDeps();
    try {
        const history = await readTerminalHistory();
        res.json(history);
    } catch (error) {
        logServerError('terminal:history', error);
        res.status(500).json({ error: 'Failed to read terminal history' });
    }
}

async function terminalExecuteRoute(req, res) {
    const {
        fsPromises,
        resolveWorkingDirectory,
        execAsync,
        logServerError,
        readTerminalHistory,
        writeTerminalHistory,
        normaliseTerminalEntry,
        MAX_TERMINAL_HISTORY,
        ROOT_DIR,
        getContextTelemetry
    } = getDeps();

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

    const {
        contextUsed,
        contextLimit,
        currentTask,
        filesEdited,
        daicState
    } = getContextTelemetry();

    const limit = contextLimit || 1;
    const percentage = (contextUsed / limit) * 100;
    const barLength = 10;
    const filledBars = Math.max(0, Math.min(barLength, Math.floor(percentage / 10)));
    const visualBar = '█'.repeat(filledBars) + '░'.repeat(barLength - filledBars);

    let colorCode = '';
    if (percentage >= 90) colorCode = '\x1b[31m';
    else if (percentage >= 75) colorCode = '\x1b[33m';
    else colorCode = '\x1b[36m';

    const resetCode = '\x1b[0m';
    const displayText = `${colorCode}${visualBar} ${percentage.toFixed(1)}% (${Math.floor(contextUsed / 1000)}k/${Math.floor(contextLimit / 1000)}k)${resetCode}`;
    const taskDisplay = hasUltraThink ? 'UltraThink Analysis' : currentTask;
    const contextStatusLine = `\n${displayText} | Task: ${taskDisplay} | Files: ${filesEdited} | DAIC: ${daicState}${percentage >= 90 ? ' | ⚠️  CONTEXT LIMIT APPROACHING' : ''}`;

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

function createCliRoutes(deps) {
    setCliDependencies(deps);
    const router = express.Router();

    router.get('/api/terminal/history', terminalHistoryRoute);
    router.post('/api/terminal/execute', terminalExecuteRoute);

    router.get('/api/terminal/status', async (_req, res) => {
        const { readBranchStatus, logServerError } = getDeps();
        try {
            const status = await readBranchStatus();
            res.json(status);
        } catch (error) {
            logServerError('terminal:branch-status', error);
            res.status(500).json({ error: 'Failed to read git branch status' });
        }
    });

    router.delete('/api/terminal/history', async (req, res) => {
        const { clearTerminalHistory, logServerError } = getDeps();
        try {
            const cleared = await clearTerminalHistory();
            res.json({ cleared: true, history: cleared });
        } catch (error) {
            logServerError('terminal:clear', error);
            res.status(500).json({ error: 'Failed to clear terminal history' });
        }
    });

    router.get('/api/cli/sessions', async (_req, res) => {
        const { cliInterviewManager, readCliGateLog, logServerError } = getDeps();
        try {
            const sessions = await cliInterviewManager.listSessions();
            const gates = await readCliGateLog(25);
            res.json({ sessions, gates });
        } catch (error) {
            logServerError('cli:sessions:list', error);
            res.status(500).json({ error: 'Failed to list CLI sessions' });
        }
    });

    router.get('/api/cli/sessions/:id', async (req, res) => {
        const { cliInterviewManager, logServerError } = getDeps();
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

    return router;
}

module.exports = {
    createCliRoutes,
    terminalHistoryRoute,
    terminalExecuteRoute
};
