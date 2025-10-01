const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;
const SessionManager = require('../services/sessionManager');
const runbookTemplates = require('../services/runbookTemplates');

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

function createSpecRoutes({
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
}) {
    const router = express.Router();
    const sessionManager = new SessionManager();

    router.post('/api/api-spec/generate', async (req, res) => {
        try {
            await ensureExportStructure();
            const context = await loadDiagramContext();
            const result = apiSpecGenerator.generateApiSpec({
                spec: req.body?.spec,
                format: req.body?.format,
                context
            });
            res.json({
                success: true,
                spec: result.spec,
                preview: result.preview,
                format: result.format,
                warnings: result.warnings || []
            });
        } catch (error) {
            console.error('API spec generation error:', error);
            res.status(500).json({ error: 'Failed to generate API spec' });
        }
    });

    router.post('/api/api-spec/export', async (req, res) => {
        try {
            await ensureExportStructure();
            const context = await loadDiagramContext();
            const result = await apiSpecGenerator.generateApiSpecFile({
                spec: req.body?.spec,
                format: req.body?.format,
                context,
                exportsDir: EXPORT_SUBDIRS.api
            });
            res.json({
                success: true,
                ...withRelativePath(result),
                spec: result.spec,
                preview: result.preview,
                warnings: result.warnings || []
            });
        } catch (error) {
            console.error('API spec export error:', error);
            res.status(500).json({ error: 'Failed to export API spec' });
        }
    });

    router.post('/api/api-spec/test', async (req, res) => {
        try {
            const context = await loadDiagramContext();
            const result = apiSpecGenerator.generateApiSpec({
                spec: req.body?.spec,
                format: req.body?.format,
                context
            });
            const modulesCount = Array.isArray(context.modules) ? context.modules.length : 0;
            const featuresCount = Array.isArray(context.features) ? context.features.length : 0;
            const ticketsCount = Array.isArray(context.tickets) ? context.tickets.length : 0;
            const pathCount = Object.keys(result.spec.paths || {}).length;

            const checks = [
                { check: 'modules', status: modulesCount > 0 ? 'pass' : 'warn', detail: `Detected ${modulesCount} modules` },
                { check: 'features', status: featuresCount > 0 ? 'pass' : 'warn', detail: `Loaded ${featuresCount} features` },
                { check: 'tickets', status: ticketsCount > 0 ? 'pass' : 'warn', detail: `Loaded ${ticketsCount} tickets` },
                { check: 'paths', status: pathCount > 0 ? 'pass' : 'warn', detail: `Spec contains ${pathCount} paths` }
            ];
            const success = checks.every(item => item.status === 'pass');
            res.json({
                success,
                results: checks,
                warnings: [...(result.warnings || [])]
            });
        } catch (error) {
            console.error('API spec test error:', error);
            res.status(500).json({ success: false, error: 'Failed to run API checks' });
        }
    });

    router.post('/api/specs/generate', async (req, res) => {
        try {
            const { spec, format } = req.body || {};
            await ensureExportStructure();
            const safeSpec = spec && typeof spec === 'object' ? spec : {};
            const result = withRelativePath(await specGenerator.generateSpecFile({
                spec: safeSpec,
                format,
                exportsDir: EXPORT_SUBDIRS.blueprints
            }));
            console.log(`✓ Spec generated: ${result.filename}`);

            if (typeof syncRoadmapState === 'function') {
                try {
                    await syncRoadmapState({ reason: 'specs:generate' });
                } catch (stateError) {
                    console.error('Roadmap sync failed after spec generate:', stateError);
                }
            }

            res.json({ success: true, ...result });
        } catch (error) {
            console.error('Spec generation error:', error);
            res.status(500).json({ error: 'Failed to generate spec' });
        }
    });

    if (cliExtraCommands && typeof cliExtraCommands.generateScopedSpecExport === 'function') {
        router.post('/api/specs/export/scoped', async (req, res) => {
            try {
                const payload = req.body || {};
                const includeSections = payload.includeSections ?? payload.include ?? [];
                const excludeSections = payload.excludeSections ?? payload.exclude ?? [];
                const moduleFilters = payload.moduleFilters ?? payload.modules ?? payload.module;
                const featureFilters = payload.featureFilters ?? payload.features ?? payload.feature;
                const ticketFilters = payload.ticketFilters ?? payload.tickets ?? payload.ticket ?? payload.issues;
                const ticketStatuses = payload.ticketStatuses ?? payload.statuses ?? payload.status;

                const result = await cliExtraCommands.generateScopedSpecExport({
                    includeSections,
                    excludeSections,
                    moduleFilters,
                    featureFilters,
                    ticketFilters,
                    ticketStatuses,
                    format: payload.format
                });

                if (!result.success) {
                    return res.status(400).json({
                        success: false,
                        messages: result.messages || ['Failed to generate scoped specification']
                    });
                }

                res.json({
                    success: true,
                    artifact: result.artifact,
                    metadata: result.metadata,
                    messages: result.messages
                });
            } catch (error) {
                console.error('Scoped spec export failed:', error);
                res.status(500).json({ success: false, error: 'Failed to generate scoped specification' });
            }
        });
    }

    if (cliExtraCommands && typeof cliExtraCommands.generateGovernanceDigest === 'function') {
        router.post('/api/runbooks/constitution', async (req, res) => {
            try {
                const { docs, docKeys, excerptLines, full } = req.body || {};
                const digest = await cliExtraCommands.generateGovernanceDigest({
                    docKeys: docs ?? docKeys,
                    excerptLines,
                    full
                });

                if (!digest.success) {
                    return res.status(404).json({
                        success: false,
                        messages: digest.messages || ['No governance documents available'],
                        missingDocs: digest.missingDocs
                    });
                }

                res.json({
                    success: true,
                    artifact: digest.artifact,
                    includedDocs: digest.includedDocs,
                    missingDocs: digest.missingDocs,
                    excerptLines: digest.excerptLines,
                    messages: digest.messages
                });
            } catch (error) {
                console.error('Constitution digest generation failed:', error);
                res.status(500).json({ success: false, error: 'Failed to prepare governance digest' });
            }
        });
    }

    router.post('/api/runbooks/interview/start', async (_req, res) => {
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

    router.post('/api/runbooks/interview/answer', async (req, res) => {
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

    router.get('/api/runbooks/templates', async (_req, res) => {
        try {
            const templates = await runbookTemplates.listTemplates();
            res.json({ success: true, templates });
        } catch (error) {
            console.error('Failed to list runbook templates:', error);
            res.status(500).json({ success: false, error: error.message || 'Failed to list templates' });
        }
    });

    router.post('/api/runbooks/generate', async (req, res) => {
        try {
            const { sessionId, projectName, responses, templates, includeContextHistory = true } = req.body || {};
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
                moduleDetector.detectModules(ROOT_DIR),
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

            let contextHistory = [];
            if (includeContextHistory) {
                try {
                    const history = await sessionManager.readContextHistory();
                    contextHistory = Array.isArray(history?.history) ? history.history : [];
                } catch (error) {
                    console.warn('[Opnix][runbook] Failed to read context history:', error.message || error);
                }
            }

            const runbookMeta = await runbookGenerator.generateRunbook({
                projectName: resolvedProjectName,
                session,
                responses,
                modulesResult,
                tickets,
                techStack,
                exportsDir: EXPORT_SUBDIRS.runbooks,
                templates,
                contextHistory
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

    return router;
}

module.exports = createSpecRoutes;
