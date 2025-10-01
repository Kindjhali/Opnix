const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;

let modulesDeps = null;

function setModulesDependencies(deps) {
    modulesDeps = deps;
}

function getDeps() {
    if (!modulesDeps) {
        throw new Error('Modules routes not initialised with dependencies');
    }
    return modulesDeps;
}

async function detectModulesRoute(req, res) {
    const { moduleDetector, writeDetectedModules, readDetectedModules, logServerError, ROOT_DIR, syncRoadmapState } = getDeps();
    try {
        const { rootPath } = req.body || {};
        const targetRoot = rootPath ? path.resolve(ROOT_DIR, rootPath) : ROOT_DIR;

        if (!targetRoot.startsWith(ROOT_DIR)) {
            return res.status(400).json({ error: 'Scan path must remain within the Opnix workspace' });
        }

        const result = await moduleDetector.detectModules(targetRoot);
        await writeDetectedModules(result);
        await syncRoadmapState({ reason: 'modules:detect', overrides: { detectedModules: result } });
        res.json(result);
    } catch (error) {
        logServerError('modules:detect', error);
        try {
            const fallback = await readDetectedModules();
            if (fallback) {
                res.json(fallback);
                return;
            }
        } catch (readError) {
            logServerError('modules:detect:fallback', readError);
        }
        res.status(500).json({ error: 'Failed to detect modules' });
    }
}

async function modulesGraphRoute(_req, res) {
    const { moduleDetector, writeDetectedModules, readDetectedModules, logServerError, ROOT_DIR, syncRoadmapState } = getDeps();
    try {
        const result = await moduleDetector.detectModules(ROOT_DIR);
        await writeDetectedModules(result);
        await syncRoadmapState({ reason: 'modules:graph', overrides: { detectedModules: result } });
        res.json(result);
    } catch (error) {
        logServerError('modules:graph', error);
        try {
            const fallback = await readDetectedModules();
            if (fallback) {
                res.json(fallback);
                return;
            }
        } catch (readError) {
            logServerError('modules:graph:fallback', readError);
        }
        res.status(500).json({ error: 'Failed to build module graph' });
    }
}

async function listModuleLinksRoute(_req, res) {
    const { readModuleLinks, logServerError } = getDeps();
    try {
        const links = await readModuleLinks();
        res.json(links);
    } catch (error) {
        logServerError('modules:links:list', error);
        res.status(500).json({ error: 'Failed to read module links' });
    }
}

async function createModuleLinkRoute(req, res) {
    const { moduleDetector, readModuleLinks, writeModuleLinks, logServerError, ROOT_DIR, syncRoadmapState } = getDeps();
    try {
        const { source, target } = req.body || {};
        if (!source || !target) {
            return res.status(400).json({ error: 'Source and target modules are required' });
        }
        if (source === target) {
            return res.status(400).json({ error: 'Cannot create self-dependency' });
        }

        const modules = await moduleDetector.detectModules(ROOT_DIR);
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
        await syncRoadmapState({ reason: 'modules:link:create' });

        res.status(201).json(newLink);
    } catch (error) {
        logServerError('modules:links:create', error);
        res.status(500).json({ error: 'Failed to create module link' });
    }
}

async function deleteModuleLinkRoute(req, res) {
    const { readModuleLinks, writeModuleLinks, logServerError, syncRoadmapState } = getDeps();
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
        await syncRoadmapState({ reason: 'modules:link:delete' });
        res.status(204).send();
    } catch (error) {
        logServerError('modules:links:delete', error);
        res.status(500).json({ error: 'Failed to delete module link' });
    }
}

async function listManualModulesRoute(_req, res) {
    const { ensureDataDirectory, migrateLegacyFile, MANUAL_MODULES_FILE, logServerError, ROOT_DIR } = getDeps();
    try {
        await ensureDataDirectory();
        await migrateLegacyFile(path.join(ROOT_DIR, 'modules.json'), MANUAL_MODULES_FILE);
        let modules = [];
        try {
            const data = await fsPromises.readFile(MANUAL_MODULES_FILE, 'utf8');
            modules = JSON.parse(data);
        } catch {
            // file missing is fine
        }
        res.json(modules);
    } catch (error) {
        logServerError('modules:list', error);
        res.status(500).json({ error: 'Failed to read modules' });
    }
}

async function createManualModuleRoute(req, res) {
    const { ensureDataDirectory, migrateLegacyFile, MANUAL_MODULES_FILE, logServerError, ROOT_DIR, syncRoadmapState } = getDeps();
    try {
        await ensureDataDirectory();
        await migrateLegacyFile(path.join(ROOT_DIR, 'modules.json'), MANUAL_MODULES_FILE);
        let modules = [];
        try {
            const data = await fsPromises.readFile(MANUAL_MODULES_FILE, 'utf8');
            modules = JSON.parse(data);
        } catch {
            // file missing -> start fresh
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

        const normaliseList = value => {
            if (Array.isArray(value)) return value.map(item => String(item).trim()).filter(Boolean);
            if (typeof value === 'string') {
                return value.split(',').map(entry => entry.trim()).filter(Boolean);
            }
            return [];
        };

        const payload = {
            id: moduleId,
            name: trimmedName,
            type: typeof req.body.type === 'string' ? req.body.type.trim().toLowerCase() : 'custom',
            path: typeof req.body.path === 'string' ? req.body.path.trim() : '',
            dependencies: normaliseList(req.body.dependencies),
            externalDependencies: normaliseList(req.body.externalDependencies),
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
        await syncRoadmapState({ reason: 'modules:manual', overrides: { manualModules: modules } });
        console.log(`✓ Saved module: ${payload.name}`);
        res.status(existingIndex >= 0 ? 200 : 201).json(payload);
    } catch (error) {
        logServerError('modules:manual:create', error);
        res.status(500).json({ error: 'Failed to create module' });
    }
}

function createModulesRoutes(deps) {
    setModulesDependencies(deps);
    const router = express.Router();

    router.post('/api/modules/detect', detectModulesRoute);
    router.get('/api/modules/graph', modulesGraphRoute);

    router.get('/api/modules/links', listModuleLinksRoute);
    router.post('/api/modules/links', createModuleLinkRoute);
    router.delete('/api/modules/links', deleteModuleLinkRoute);

    router.get('/api/modules', listManualModulesRoute);
    router.post('/api/modules', createManualModuleRoute);

    return router;
}

module.exports = {
    createModulesRoutes,
    detectModulesRoute,
    modulesGraphRoute,
    createModuleLinkRoute,
    deleteModuleLinkRoute,
    createManualModuleRoute
};
