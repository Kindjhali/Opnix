const express = require('express');
const BugWorkflowManager = require('../services/bugWorkflowManager');

function createTicketRoutes({
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
}) {
    const router = express.Router();
    const bugWorkflow = new BugWorkflowManager();

    router.get('/api/health', async (_req, res) => {
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

    router.get('/api/tickets', async (_req, res) => {
        try {
            const data = await readData();
            res.json(data.tickets);
        } catch (error) {
            logServerError('tickets:list', error);
            res.status(500).json({ error: 'Failed to read tickets' });
        }
    });

    router.get('/api/tickets/:id', async (req, res) => {
        try {
            const data = await readData();
            const ticket = data.tickets.find(t => t.id === parseInt(req.params.id, 10));
            if (!ticket) {
                return res.status(404).json({ error: 'Ticket not found' });
            }
            res.json(ticket);
        } catch (error) {
            logServerError('tickets:detail', error);
            res.status(500).json({ error: 'Failed to read ticket' });
        }
    });

    router.post('/api/tickets', async (req, res) => {
        try {
            const data = await readData();

            let tags = [];
            if (req.body.tags) {
                if (Array.isArray(req.body.tags)) {
                    tags = req.body.tags.map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
                } else if (typeof req.body.tags === 'string') {
                    tags = req.body.tags.split(',').map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
                }
            }

            let nextStatus = statusReported;
            if (typeof req.body.status === 'string') {
                const requestedStatus = req.body.status;
                if (!VALID_TICKET_STATUSES.includes(requestedStatus)) {
                    return res.status(400).json({ error: `Unsupported ticket status: ${requestedStatus}` });
                }
                if (!validateTicketStatusChange(statusReported, requestedStatus, req.body.statusHook)) {
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
                tags,
                created: new Date().toISOString(),
                files: req.body.files || []
            };

            data.tickets.push(newTicket);
            await writeData(data);
            await syncRoadmapState({ reason: 'ticket:create', overrides: { tickets: data } });
            res.status(201).json(newTicket);
            console.log(`✓ Created ticket #${newTicket.id} with tags: ${tags.join(', ')}`);
        } catch (error) {
            logServerError('tickets:create', error);
            res.status(500).json({ error: 'Failed to create ticket' });
        }
    });

    router.put('/api/tickets/:id', async (req, res) => {
        try {
            const data = await readData();
            const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id, 10));

            if (index === -1) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

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

                if (payload.status === statusFinished && currentTicket.status !== statusFinished) {
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
                } else if (payload.status !== statusFinished && payload.completedAt !== undefined) {
                    payload.completedAt = null;
                }
            }

            if (payload.priority !== undefined && !VALID_TICKET_PRIORITIES.includes(payload.priority)) {
                return res.status(400).json({ error: `Unsupported ticket priority: ${payload.priority}` });
            }

            if (payload.completionSummary !== undefined && payload.status !== statusFinished) {
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
            await syncRoadmapState({ reason: 'ticket:update', overrides: { tickets: data } });

            // Auto-commit if ticket was completed
            if (payload.status === statusFinished && currentTicket.status !== statusFinished) {
                try {
                    const commitResult = await gitAutomationManager.autoCommitTicket(data.tickets[index]);
                    if (commitResult.success) {
                        console.log(`✓ Auto-committed ticket #${req.params.id}: ${commitResult.commitMessage.split('\n')[0]}`);
                    } else {
                        console.log(`⚠ Auto-commit failed for ticket #${req.params.id}: ${commitResult.reason}`);
                    }
                } catch (error) {
                    console.error(`✗ Git automation error for ticket #${req.params.id}:`, error.message);
                }
            }

            res.json(data.tickets[index]);
            console.log(`✓ Updated ticket #${req.params.id}`);
        } catch (error) {
            logServerError('tickets:update', error);
            res.status(500).json({ error: 'Failed to update ticket' });
        }
    });

    router.delete('/api/tickets/:id', async (req, res) => {
        try {
            const data = await readData();
            const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id, 10));

            if (index === -1) {
                return res.status(404).json({ error: 'Ticket not found' });
            }

            data.tickets.splice(index, 1);
            await writeData(data);
            await syncRoadmapState({ reason: 'ticket:delete', overrides: { tickets: data } });
            res.status(204).send();
            console.log(`✓ Deleted ticket #${req.params.id}`);
        } catch (error) {
            logServerError('tickets:delete', error);
            res.status(500).json({ error: 'Failed to delete ticket' });
        }
    });

    router.post('/api/bug/start/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
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

    router.post('/api/bug/complete/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
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

    router.post('/api/bug/pause/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
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

    router.post('/api/bug/resume/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
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

    router.get('/api/bug/status/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
            const result = await bugWorkflow.getWorkflowStatus(ticketId);
            res.json(result);
        } catch (error) {
            logServerError('bug:status', error);
            res.status(400).json({ error: error.message });
        }
    });

    router.get('/api/bug/active', async (_req, res) => {
        try {
            const activeWorkflows = await bugWorkflow.listActiveWorkflows();
            res.json(activeWorkflows);
        } catch (error) {
            logServerError('bug:active', error);
            res.status(500).json({ error: 'Failed to get active workflows' });
        }
    });

    router.get('/api/bug/validate/:id', async (req, res) => {
        try {
            const ticketId = parseInt(req.params.id, 10);
            const validation = await bugWorkflow.validateWorkflow(ticketId);
            res.json(validation);
        } catch (error) {
            logServerError('bug:validate', error);
            res.status(500).json({ error: 'Failed to validate workflow' });
        }
    });

    router.get('/api/search', async (req, res) => {
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
                results = results.filter(t => Array.isArray(t.tags) && t.tags.includes(searchTag));
            }

            res.json(results);
        } catch (error) {
            logServerError('tickets:search', error);
            res.status(500).json({ error: 'Failed to search' });
        }
    });

    router.get('/api/tags', async (_req, res) => {
        try {
            const data = await readData();
            const tags = new Set();
            data.tickets.forEach(ticket => {
                if (Array.isArray(ticket.tags)) {
                    ticket.tags.forEach(tag => tags.add(tag));
                }
            });
            res.json(Array.from(tags).sort());
        } catch (error) {
            logServerError('tickets:tags', error);
            res.status(500).json({ error: 'Failed to get tags' });
        }
    });

    router.get('/api/stats', async (_req, res) => {
        try {
            const data = await readData();
            const tags = {};
            data.tickets.forEach(ticket => {
                if (Array.isArray(ticket.tags)) {
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
                tags
            });
        } catch (error) {
            logServerError('tickets:stats', error);
            res.status(500).json({ error: 'Failed to get stats' });
        }
    });

    return router;
}

module.exports = createTicketRoutes;
