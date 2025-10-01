const express = require('express');

let checklistDeps = null;

function setChecklistDependencies(deps) {
    checklistDeps = deps;
}

function getDeps() {
    if (!checklistDeps) {
        throw new Error('Checklist routes not initialised with dependencies');
    }
    return checklistDeps;
}

async function listChecklistsRoute(_req, res) {
    const { readChecklistsFile, logServerError } = getDeps();
    try {
        const checklists = await readChecklistsFile();
        res.json(checklists);
    } catch (error) {
        logServerError('checklists:list', error);
        res.status(500).json({ error: 'Failed to read checklists' });
    }
}

async function createChecklistRoute(req, res) {
    const {
        readChecklistsFile,
        writeChecklistsFile,
        normaliseChecklistStatus,
        checklistPending,
        normaliseChecklist,
        logServerError
    } = getDeps();

    try {
        const checklists = await readChecklistsFile();
        const items = Array.isArray(req.body.items)
            ? req.body.items.map((item, index) => ({
                id: item?.id || `item-${index + 1}`,
                text: (item?.text || '').trim(),
                status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
            })).filter(item => item.text.length > 0)
            : [];

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
        logServerError('checklists:create', error);
        res.status(500).json({ error: 'Failed to create checklist' });
    }
}

async function updateChecklistRoute(req, res) {
    const {
        readChecklistsFile,
        writeChecklistsFile,
        normaliseChecklistStatus,
        checklistPending,
        normaliseChecklist,
        validateChecklistStatusChange,
        normaliseStatusHook,
        logServerError
    } = getDeps();

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

        const items = Array.isArray(req.body.items)
            ? req.body.items.map(item => ({
                id: item?.id || Date.now().toString(),
                text: (item?.text || '').trim(),
                status: normaliseChecklistStatus(item?.status, { fallback: checklistPending }) || checklistPending
            }))
            : current.items;

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
        logServerError('checklists:update', error);
        res.status(500).json({ error: 'Failed to update checklist' });
    }
}

function createChecklistsRoutes(deps) {
    setChecklistDependencies(deps);
    const router = express.Router();

    router.get('/api/checklists', listChecklistsRoute);
    router.post('/api/checklists', createChecklistRoute);
    router.put('/api/checklists/:id', updateChecklistRoute);

    return router;
}

module.exports = {
    createChecklistsRoutes,
    listChecklistsRoute,
    createChecklistRoute,
    updateChecklistRoute
};
