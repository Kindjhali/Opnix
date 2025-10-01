const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;

let agentsDeps = null;

function setAgentsDependencies(deps) {
    agentsDeps = deps;
}

function getDeps() {
    if (!agentsDeps) {
        throw new Error('Agents routes not initialised with dependencies');
    }
    return agentsDeps;
}

async function claudeNextRoute(req, res) {
    const { readData, statusReported, logServerError } = getDeps();
    try {
        const { tag } = req.query;
        const data = await readData();
        let reportedTickets = data.tickets.filter(t => t.status === statusReported);

        if (tag) {
            const searchTag = tag.toUpperCase();
            reportedTickets = reportedTickets.filter(t => Array.isArray(t.tags) && t.tags.includes(searchTag));
        }

        reportedTickets.sort((a, b) => {
            const priorityOrder = { high: 0, medium: 1, low: 2 };
            return (priorityOrder[a.priority] ?? 3) - (priorityOrder[b.priority] ?? 3);
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
}

async function claudeBatchRoute(req, res) {
    const { readData, statusReported, statusInProgress, logServerError } = getDeps();
    try {
        const { tag } = req.query;
        const data = await readData();
        let needsWork = data.tickets.filter(t => t.status === statusReported || t.status === statusInProgress);

        if (tag) {
            const searchTag = tag.toUpperCase();
            needsWork = needsWork.filter(t => Array.isArray(t.tags) && t.tags.includes(searchTag));
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
}

async function listAgentsRoute(_req, res) {
    const { AGENTS_DIR } = getDeps();
    try {
        const agents = await fsPromises.readdir(AGENTS_DIR);
        const agentList = [];

        for (const item of agents) {
            const itemPath = path.join(AGENTS_DIR, item);
            const stat = await fsPromises.stat(itemPath);

            if (stat.isDirectory()) {
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
}

async function activateAgentRoute(req, res) {
    try {
        const { agentId } = req.body || {};
        if (!agentId) {
            return res.status(400).json({ error: 'Agent ID required' });
        }

        console.log(`Activating agent: ${agentId}`);
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
}

async function claudeExecuteRoute(req, res) {
    const {
        readData,
        writeData,
        statusInProgress,
        runInitialAudit,
        handleSlashCommand
    } = getDeps();

    try {
        let { command } = req.body || {};
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

        if (normalizedCommand.includes('setup') || normalizedCommand.includes('audit')) {
            const audit = await runInitialAudit();
            return res.json({ result: 'Initial audit completed', audit });
        }

        if (command.includes('detect')) {
            return res.json({ result: 'Module detection initiated' });
        }
        if (command.includes('analyze')) {
            return res.json({ result: 'Analysis started' });
        }
        if (command.includes('fix')) {
            const match = command.match(/#(\d+)/);
            if (match) {
                const data = await readData();
                const ticket = data.tickets.find(t => t.id === parseInt(match[1], 10));
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
}

async function listHandoffsRoute(req, res) {
    const { agentHandoffManager, logServerError } = getDeps();
    try {
        const { limit } = req.query || {};
        const handoffs = await agentHandoffManager.listHandoffs({ limit });
        res.json({ handoffs });
    } catch (error) {
        logServerError('agents:handoffs:list', error);
        res.status(500).json({ error: 'Failed to list agent handoffs' });
    }
}

async function getHandoffRoute(req, res) {
    const { agentHandoffManager, logServerError } = getDeps();
    try {
        const { id } = req.params || {};
        const handoff = await agentHandoffManager.getHandoff(id);
        if (!handoff) {
            return res.status(404).json({ error: 'Handoff not found' });
        }
        res.json({ handoff });
    } catch (error) {
        logServerError('agents:handoffs:get', error);
        res.status(500).json({ error: 'Failed to load agent handoff' });
    }
}

async function createHandoffRoute(req, res) {
    const { agentHandoffManager, logServerError } = getDeps();
    try {
        const payload = req.body || {};
        const handoff = await agentHandoffManager.createHandoff(payload);
        res.status(201).json({ success: true, handoff });
    } catch (error) {
        if (error && typeof error.message === 'string' && error.message.includes('required')) {
            return res.status(400).json({ error: error.message });
        }
        logServerError('agents:handoffs:create', error);
        res.status(500).json({ error: 'Failed to create agent handoff' });
    }
}

async function updateHandoffRoute(req, res) {
    const { agentHandoffManager, logServerError } = getDeps();
    try {
        const { id } = req.params || {};
        const updates = req.body || {};
        const handoff = await agentHandoffManager.updateHandoff(id, updates);
        res.json({ success: true, handoff });
    } catch (error) {
        if (error && typeof error.message === 'string') {
            if (error.message.includes('not found')) {
                return res.status(404).json({ error: error.message });
            }
            if (error.message.includes('required')) {
                return res.status(400).json({ error: error.message });
            }
        }
        logServerError('agents:handoffs:update', error);
        res.status(500).json({ error: 'Failed to update agent handoff' });
    }
}

function createAgentsRoutes(deps) {
    setAgentsDependencies(deps);
    const router = express.Router();

    router.get('/api/claude/next', claudeNextRoute);
    router.get('/api/claude/batch', claudeBatchRoute);
    router.get('/api/agents', listAgentsRoute);
    router.post('/api/agents/activate', activateAgentRoute);
    router.post('/api/claude/execute', claudeExecuteRoute);
    router.get('/api/agents/handoffs', listHandoffsRoute);
    router.get('/api/agents/handoffs/:id', getHandoffRoute);
    router.post('/api/agents/handoffs', createHandoffRoute);
    router.patch('/api/agents/handoffs/:id', updateHandoffRoute);

    return router;
}

module.exports = {
    createAgentsRoutes,
    claudeNextRoute,
    claudeBatchRoute,
    claudeExecuteRoute
};
