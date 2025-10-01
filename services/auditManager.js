const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;

function createAuditManager({
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
    rootDir,
    deriveTechStack,
    inferProjectType,
    inferPrimaryLanguage,
    normaliseTicketStatus,
    withRelativePath,
    statusConstants
}) {
    const {
        statusReported,
        statusInProgress,
        statusFinished,
        priorityMedium,
        priorityHigh
    } = statusConstants;

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
                priority: priorityHigh,
                status: statusReported,
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

    async function loadDiagramContext() {
        const [modulesResult, ticketData, features, packageJson] = await Promise.all([
            moduleDetector.detectModules(rootDir),
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

    async function runInitialAudit() {
        await ensureExportStructure();

        const [modulesResult, ticketData, features, packageJson] = await Promise.all([
            moduleDetector.detectModules(rootDir),
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

        const isNewProject = modulesResult.modules.length === 0
            && tickets.length === 0
            && techStack.dependencies.length === 0
            && techStack.devDependencies.length === 0;

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
            message: isNewProject
                ? 'New project detected. Questionnaire included for scaffolding.'
                : 'Audit complete. Specification, documentation, and canvas exports generated.',
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

    return {
        runInitialAudit,
        loadDiagramContext,
        deriveTicketStats
    };
}

module.exports = {
    createAuditManager
};
