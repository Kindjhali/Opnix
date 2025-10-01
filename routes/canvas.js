const express = require('express');
const path = require('path');
const fs = require('fs').promises;

function createCanvasRoutes({ ensureExportStructure, EXPORT_SUBDIRS, EXPORTS_DIR, ensureRoadmapStateFile, writeRoadmapState, readRoadmapState, syncRoadmapState, listRoadmapVersions, rollbackRoadmapState, updateRoadmapMilestone }) {
    const router = express.Router();

    router.post('/api/canvas/export', async (req, res) => {
        try {
            const { format, data } = req.body || {};
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            let filename;
            let content;

            await ensureExportStructure();

            if (format === 'png') {
                filename = `opnix-canvas-${timestamp}.png`;
                if (typeof data !== 'string') {
                    return res.status(400).json({ error: 'PNG export requires base64 string payload' });
                }
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
                await fs.writeFile(filePath, content);
            } else if (typeof content === 'string') {
                await fs.writeFile(filePath, content);
            } else {
                return res.status(400).json({ error: 'Invalid canvas data payload' });
            }

            const relativePath = path.relative(EXPORTS_DIR, filePath);
            console.log(`✓ Canvas exported: ${filename}`);
            res.json({ success: true, filename, path: filePath, relativePath });
        } catch (error) {
            console.error('Canvas export error:', error);
            res.status(500).json({ error: 'Failed to export canvas' });
        }
    });

    router.post('/api/roadmap/generate-from-tickets', async (req, res) => {
        try {
            const { tickets = [], modules = [], features = [] } = req.body || {};

            const milestones = [];
            let milestoneId = 1;

            const moduleGroups = {};
            tickets.forEach(ticket => {
                const moduleId = (Array.isArray(ticket.modules) && ticket.modules[0]) || 'general';
                moduleGroups[moduleId] = moduleGroups[moduleId] || [];
                moduleGroups[moduleId].push(ticket);
            });

            Object.entries(moduleGroups).forEach(([moduleId, moduleTickets]) => {
                if (!moduleTickets.length) return;

                const module = modules.find(m => m.id === moduleId);
                const moduleName = module ? module.name : moduleId.charAt(0).toUpperCase() + moduleId.slice(1);

                const finishedCount = moduleTickets.filter(t => t.status === 'finished').length;
                const progress = Math.round((finishedCount / moduleTickets.length) * 100);

                const startDate = new Date();
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + Math.max(30, moduleTickets.length * 7));

                milestones.push({
                    id: milestoneId++,
                    name: `${moduleName} Implementation`,
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0],
                    progress,
                    linkedModule: moduleId,
                    linkedTickets: moduleTickets.map(t => t.id)
                });
            });

            features.forEach(feature => {
                if (!feature || !['approved', 'inDevelopment', 'testing', 'deployed'].includes(feature.status)) {
                    return;
                }

                const startDate = new Date();
                const endDate = new Date(startDate);
                endDate.setDate(endDate.getDate() + 45);

                let progress = 0;
                if (feature.status === 'inDevelopment') progress = 30;
                else if (feature.status === 'testing') progress = 70;
                else if (feature.status === 'deployed') progress = 100;

                milestones.push({
                    id: milestoneId++,
                    name: feature.title,
                    start: startDate.toISOString().split('T')[0],
                    end: endDate.toISOString().split('T')[0],
                    progress,
                    linkedModule: feature.moduleId,
                    linkedTickets: []
                });
            });

            const summary = {
                source: 'auto',
                ticketCount: tickets.length,
                moduleCount: modules.length,
                featureCount: features.length,
                generatedAt: new Date().toISOString()
            };

            const state = await writeRoadmapState({ milestones, summary });

            console.log(`✓ Generated ${state.milestones.length} roadmap milestones from ${tickets.length} tickets and ${features.length} features`);
            res.json({ success: true, milestones: state.milestones, state });
        } catch (error) {
            console.error('Roadmap generation error:', error);
            res.status(500).json({ error: 'Failed to generate roadmap from tickets' });
        }
    });

    router.get('/api/roadmap/state', async (_req, res) => {
        try {
            await ensureRoadmapStateFile();
            const state = await readRoadmapState();
            res.json({ success: true, state });
        } catch (error) {
            console.error('Roadmap state read error:', error);
            res.status(500).json({ error: 'Failed to read roadmap state' });
        }
    });

    router.patch('/api/roadmap/milestones/:id', async (req, res) => {
        const { id } = req.params;
        try {
            if (!id) {
                return res.status(400).json({ error: 'Milestone id is required' });
            }

            const body = req.body || {};
            const updates = { ...(body.updates && typeof body.updates === 'object' ? body.updates : {}) };
            if (Object.prototype.hasOwnProperty.call(body, 'field')) {
                updates.field = body.field;
                updates.value = body.value;
            }

            const options = {};
            if (body.actor) {
                options.actor = body.actor;
            }
            if (body.reason) {
                options.reason = body.reason;
            }

            const result = await updateRoadmapMilestone(id, updates, options);
            const { state, changedFields = [], reason, timestamp, change, statusTransition } = result || {};
            const label = Array.isArray(changedFields) && changedFields.length ? changedFields.join(', ') : 'fields';
            const message = statusTransition
              ? `Milestone status updated (${statusTransition.from} → ${statusTransition.to})`
              : `Milestone updated (${label})`;
            res.json({ success: true, state, changedFields, reason, timestamp, change, statusTransition, message });
        } catch (error) {
            const message = error?.message || 'Failed to update roadmap milestone';
            const status = /unknown milestone/i.test(message) ? 404 : /updates provided/i.test(message) ? 400 : 500;
            console.error('Roadmap milestone update error:', error);
            res.status(status).json({ error: message });
        }
    });

    router.get('/api/roadmap/versions', async (_req, res) => {
        try {
            const versions = await listRoadmapVersions();
            res.json({ success: true, versions });
        } catch (error) {
            console.error('Roadmap versions read error:', error);
            res.status(500).json({ error: 'Failed to list roadmap versions' });
        }
    });

    router.post('/api/roadmap/rollback', async (req, res) => {
        try {
            const { version } = req.body || {};
            if (!version) {
                return res.status(400).json({ error: 'Version filename is required' });
            }
            const state = await rollbackRoadmapState(version);
            // Ensure derived progress values stay aligned with latest tickets/features data
            await syncRoadmapState({ reason: 'roadmap:rollback-sync' });
            res.json({ success: true, state });
        } catch (error) {
            console.error('Roadmap rollback error:', error);
            res.status(500).json({ error: 'Failed to rollback roadmap state' });
        }
    });

    router.post('/api/roadmap/export', async (req, res) => {
        try {
            const roadmapData = req.body;
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = `opnix-roadmap-${timestamp}.json`;

            await ensureExportStructure();

            const roadmapDir = EXPORT_SUBDIRS.roadmaps || path.join(EXPORTS_DIR, 'roadmaps');
            try {
                await fs.access(roadmapDir);
            } catch {
                await fs.mkdir(roadmapDir, { recursive: true });
            }

            const filePath = path.join(roadmapDir, filename);
            await fs.writeFile(filePath, JSON.stringify(roadmapData, null, 2));

            const relativePath = path.relative(EXPORTS_DIR, filePath);
            console.log(`✓ Roadmap exported: ${filename}`);
            res.json({ success: true, filename, path: filePath, relativePath });
        } catch (error) {
            console.error('Roadmap export error:', error);
            res.status(500).json({ error: 'Failed to export roadmap' });
        }
    });

    return router;
}

module.exports = createCanvasRoutes;
