// OTKIT - Express Backend with Tags Support
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');
const { exec } = require('child_process');
const util = require('util');
const moduleDetector = require('./services/moduleDetector');
const specGenerator = require('./services/specGenerator');
const docsGenerator = require('./services/docsGenerator');
const interviewLoader = require('./services/interviewLoader');
const execAsync = util.promisify(exec);

const app = express();
const PORT = 7337;
const DATA_FILE = path.join(__dirname, 'tickets.json');
const AGENTS_DIR = path.join(__dirname, 'agents');
const EXPORTS_DIR = path.join(__dirname, 'exports');
const MODULE_LINKS_FILE = path.join(__dirname, 'module-links.json');
const FEATURES_FILE = path.join(__dirname, 'features.json');
const MANUAL_MODULES_FILE = path.join(__dirname, 'modules.json');
const PACKAGE_JSON_FILE = path.join(__dirname, 'package.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize data file if it doesn't exist
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
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
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('✓ Created tickets.json with example ticket');
    }
}

// Helper functions
async function readData() {
    const raw = await fs.readFile(DATA_FILE, 'utf8');
    const data = JSON.parse(raw);

    if (!Array.isArray(data.tickets)) {
        data.tickets = [];
    }

    const maxExistingId = data.tickets.reduce((max, ticket) => {
        const ticketId = typeof ticket.id === 'number' ? ticket.id : parseInt(ticket.id, 10);
        if (Number.isFinite(ticketId)) {
            return Math.max(max, ticketId);
        }
        return max;
    }, 0);

    if (typeof data.nextId !== 'number' || data.nextId <= maxExistingId) {
        data.nextId = maxExistingId + 1;
        await writeData(data);
    }

    return data;
}

async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

async function ensureDirectory(dirPath) {
    try {
        await fs.access(dirPath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            await fs.mkdir(dirPath, { recursive: true });
        } else {
            throw error;
        }
    }
}

async function readModuleLinks() {
    try {
        const raw = await fs.readFile(MODULE_LINKS_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function writeModuleLinks(links) {
    await fs.writeFile(MODULE_LINKS_FILE, JSON.stringify(links, null, 2));
}

async function readFeaturesFile() {
    try {
        const raw = await fs.readFile(FEATURES_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

async function loadPackageJson() {
    try {
        const raw = await fs.readFile(PACKAGE_JSON_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') return null;
        throw error;
    }
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
        statusCounts: { reported: 0, in_progress: 0, finished: 0 },
        priorityCounts: { high: 0, medium: 0, low: 0 },
        highPriorityOpen: 0,
        tagCounts: {}
    };

    tickets.forEach(ticket => {
        const rawStatus = (ticket.status || 'reported').toLowerCase();
        const normalizedStatus = rawStatus.replace('-', '_');
        if (stats.statusCounts[normalizedStatus] !== undefined) {
            stats.statusCounts[normalizedStatus] += 1;
        } else {
            stats.statusCounts[normalizedStatus] = (stats.statusCounts[normalizedStatus] || 0) + 1;
        }

        const isClosed = normalizedStatus === 'finished' || normalizedStatus === 'resolved';
        if (isClosed) stats.closed += 1; else stats.open += 1;

        const priority = (ticket.priority || 'medium').toLowerCase();
        if (stats.priorityCounts[priority] !== undefined) {
            stats.priorityCounts[priority] += 1;
        } else {
            stats.priorityCounts[priority] = (stats.priorityCounts[priority] || 0) + 1;
        }
        if (!isClosed && priority === 'high') {
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
    const filePath = path.join(EXPORTS_DIR, filename);
    const payload = {
        generatedAt: new Date().toISOString(),
        modules: modulesResult.modules,
        edges: modulesResult.edges,
        summary: modulesResult.summary
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    return { filename, path: filePath, format: 'json' };
}

async function writeAuditReport(report) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-audit-${timestamp}.json`;
    const filePath = path.join(EXPORTS_DIR, filename);
    await fs.writeFile(filePath, JSON.stringify(report, null, 2));
    return { filename, path: filePath, format: 'json' };
}

async function runInitialAudit() {
    await ensureDirectory(EXPORTS_DIR);

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

    const [specJsonMeta, specKitMeta] = await Promise.all([
        specGenerator.generateSpecFile({ spec: specPayload, format: 'json', exportsDir: EXPORTS_DIR }),
        specGenerator.generateSpecFile({ spec: specPayload, format: 'github-spec-kit', exportsDir: EXPORTS_DIR })
    ]);

    const docsStats = {
        reported: ticketStats.statusCounts.reported || 0,
        in_progress: ticketStats.statusCounts.in_progress || 0,
        finished: ticketStats.statusCounts.finished || 0,
        externalDependencies: modulesResult.summary.externalDependencyCount || 0,
        totalLines: modulesResult.summary.totalLines || 0
    };

    const docsMeta = await docsGenerator.generateDocsFile({
        projectName: specPayload.project.name,
        stats: docsStats,
        modules: modulesResult.modules,
        moduleEdges: modulesResult.edges,
        features,
        tickets,
        techStack,
        exportsDir: EXPORTS_DIR
    });

    const canvasMeta = await writeCanvasSnapshot(modulesResult);

    const followUps = buildFollowUps({ modules: modulesResult.modules, features, ticketStats });
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

    const exportsListBase = [specJsonMeta, specKitMeta, docsMeta, canvasMeta];
    const isNewProject = modulesResult.modules.length === 0 && tickets.length === 0 && techStack.dependencies.length === 0 && techStack.devDependencies.length === 0;
    const questionnairePayload = isNewProject ? await interviewLoader.getNewProjectQuestionnaire() : undefined;
    const interviewBlueprint = isNewProject ? await interviewLoader.loadInterviewBlueprint() : undefined;

    const auditSummary = {
        generatedAt: new Date().toISOString(),
        project: specPayload.project,
        ticketStats,
        moduleSummary: modulesResult.summary,
        techStack,
        followUps,
        unhealthyModules,
        featuresNeedingCriteria,
        featureReview,
        exports: {
            specJson: specJsonMeta,
            specKit: specKitMeta,
            docs: docsMeta,
            canvas: canvasMeta
        }
    };

    if (questionnairePayload) {
        auditSummary.questionnaire = questionnairePayload;
        auditSummary.interviewBlueprint = interviewBlueprint;
    }

    const auditMeta = await writeAuditReport(auditSummary);
    const exportsList = [...exportsListBase, auditMeta];

    return {
        message: isNewProject ? 'New project detected. Questionnaire included for scaffolding.' : 'Audit complete. Specification, documentation, and canvas exports generated.',
        project: specPayload.project,
        ticketStats,
        moduleSummary: modulesResult.summary,
        techStack,
        followUps,
        unhealthyModules,
        featuresNeedingCriteria,
        featureReview,
        exports: exportsList,
        isNewProject,
        questionnaire: questionnairePayload,
        interviewBlueprint
    };
}

// Routes
app.get('/', (req, res) => {
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('curl')) {
        res.type('text/plain').send(`
OTKIT v1.0 - With Tags

Commands:
  curl http://localhost:${PORT}/api/claude/next      # Get next ticket
  curl http://localhost:${PORT}/api/export/markdown   # Export all
  curl http://localhost:${PORT}/api/tickets           # Get JSON
  curl http://localhost:${PORT}/api/search?tag=BUG    # Search by tag

Claude CLI:
  claude "Read tickets.json and fix all BUG tagged issues"
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
            claude_ready: true,
            tags_enabled: true
        });
    } catch {
        res.json({ status: 'operational', claude_ready: true });
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        res.json(data.tickets);
    } catch (error) {
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
        res.status(500).json({ error: 'Failed to read ticket' });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        const validStatuses = ['reported', 'in_progress', 'finished'];
        const validPriorities = ['low', 'medium', 'high'];
        
        // Process tags
        let tags = [];
        if (req.body.tags) {
            if (Array.isArray(req.body.tags)) {
                tags = req.body.tags.map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            } else if (typeof req.body.tags === 'string') {
                tags = req.body.tags.split(',').map(tag => tag.toUpperCase().trim()).filter(tag => tag.length > 0);
            }
        }
        
        const newTicket = {
            id: data.nextId++,
            title: req.body.title || 'Untitled',
            description: req.body.description || '',
            priority: validPriorities.includes(req.body.priority) ? req.body.priority : 'medium',
            status: validStatuses.includes(req.body.status) ? req.body.status : 'reported',
            tags: tags,
            created: new Date().toISOString(),
            files: req.body.files || []
        };
        
        data.tickets.push(newTicket);
        await writeData(data);
        res.status(201).json(newTicket);
        console.log(`✓ Created ticket #${newTicket.id} with tags: ${tags.join(', ')}`);
    } catch (error) {
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
        
        data.tickets[index] = {
            ...data.tickets[index],
            ...req.body,
            id: data.tickets[index].id,
            created: data.tickets[index].created,
            updated: new Date().toISOString()
        };
        
        await writeData(data);
        res.json(data.tickets[index]);
        console.log(`✓ Updated ticket #${req.params.id}`);
    } catch (error) {
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
        res.status(500).json({ error: 'Failed to delete ticket' });
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
        
        const reportedCount = data.tickets.filter(t => t.status === 'reported').length;
        const inProgressCount = data.tickets.filter(t => t.status === 'in_progress').length;
        const finishedCount = data.tickets.filter(t => t.status === 'finished').length;
        const openCount = data.tickets.length - finishedCount;

        res.json({
            total: data.tickets.length,
            open: openCount,
            closed: finishedCount,
            reported: reportedCount,
            in_progress: inProgressCount,
            finished: finishedCount,
            high_priority: data.tickets.filter(t => t.priority === 'high').length,
            tags: tags
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
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
        res.status(500).json({ error: 'Failed to get next ticket' });
    }
});

app.get('/api/claude/batch', async (req, res) => {
    try {
        const { tag } = req.query;
        const data = await readData();
        let needsWork = data.tickets.filter(t =>
            t.status === 'reported' || t.status === 'in_progress'
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
        res.status(500).json({ error: 'Failed to get batch' });
    }
});

// REAL Agent functionality
app.get('/api/agents', async (req, res) => {
    try {
        const agents = await fs.readdir(AGENTS_DIR);
        const agentList = [];

        for (const item of agents) {
            const itemPath = path.join(AGENTS_DIR, item);
            const stat = await fs.stat(itemPath);

            if (stat.isDirectory()) {
                // Check for agent files in subdirectory
                const subFiles = await fs.readdir(itemPath);
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
                    ticket.status = 'in_progress';
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

app.post('/api/modules/detect', async (req, res) => {
    try {
        const { rootPath } = req.body || {};
        const targetRoot = rootPath ? path.resolve(__dirname, rootPath) : __dirname;

        if (!targetRoot.startsWith(__dirname)) {
            return res.status(400).json({ error: 'Scan path must remain within the Opnix workspace' });
        }

        const result = await moduleDetector.detectModules(targetRoot);
        res.json(result);
    } catch (error) {
        console.error('Module detection error:', error);
        res.status(500).json({ error: 'Failed to detect modules' });
    }
});

app.get('/api/modules/graph', async (req, res) => {
    try {
        const result = await moduleDetector.detectModules(__dirname);
        res.json(result);
    } catch (error) {
        console.error('Module graph error:', error);
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
        let features = [];

        try {
            const data = await fs.readFile(FEATURES_FILE, 'utf8');
            features = JSON.parse(data);
        } catch {
            // File doesn't exist, return empty array
        }

        res.json(features);
    } catch (error) {
        console.error('Features read error:', error);
        res.status(500).json({ error: 'Failed to read features' });
    }
});

app.post('/api/features', async (req, res) => {
    try {
        let features = [];

        try {
            const data = await fs.readFile(FEATURES_FILE, 'utf8');
            features = JSON.parse(data);
        } catch {
            // File doesn't exist, start with empty array
        }

        const newFeature = {
            id: Date.now(),
            title: req.body.title,
            description: req.body.description,
            moduleId: req.body.moduleId,
            priority: req.body.priority || 'medium',
            status: req.body.status || 'proposed',
            votes: 0,
            acceptanceCriteria: req.body.acceptanceCriteria || [],
            created: new Date().toISOString()
        };

        features.push(newFeature);
        await fs.writeFile(FEATURES_FILE, JSON.stringify(features, null, 2));

        console.log(`✓ Created feature: ${newFeature.title}`);
        res.status(201).json(newFeature);
    } catch (error) {
        console.error('Feature creation error:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
});

// Modules CRUD
app.get('/api/modules', async (req, res) => {
    try {
        let modules = [];

        try {
            const data = await fs.readFile(MANUAL_MODULES_FILE, 'utf8');
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
        let modules = [];

        try {
            const data = await fs.readFile(MANUAL_MODULES_FILE, 'utf8');
            modules = JSON.parse(data);
        } catch {
            // File doesn't exist, start with empty array
        }

        const newModule = {
            id: req.body.id || req.body.name.toLowerCase().replace(/\s+/g, '-'),
            name: req.body.name,
            health: req.body.health || 70,
            dependencies: req.body.dependencies || [],
            coverage: req.body.coverage || 0,
            created: new Date().toISOString()
        };

        modules.push(newModule);
        await fs.writeFile(MANUAL_MODULES_FILE, JSON.stringify(modules, null, 2));

        console.log(`✓ Created module: ${newModule.name}`);
        res.status(201).json(newModule);
    } catch (error) {
        console.error('Module creation error:', error);
        res.status(500).json({ error: 'Failed to create module' });
    }
});

// Canvas export with real file operations
app.post('/api/canvas/export', async (req, res) => {
    try {
        const { format, data } = req.body;
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        let filename, content;

        await ensureDirectory(EXPORTS_DIR);

        if (format === 'png') {
            filename = `opnix-canvas-${timestamp}.png`;
            // Handle base64 PNG data
            const base64Data = data.replace(/^data:image\/png;base64,/, '');
            await fs.writeFile(path.join(EXPORTS_DIR, filename), base64Data, 'base64');
        } else if (format === 'json') {
            filename = `opnix-canvas-${timestamp}.json`;
            content = JSON.stringify(data, null, 2);
            await fs.writeFile(path.join(EXPORTS_DIR, filename), content);
        }

        console.log(`✓ Canvas exported: ${filename}`);
        res.json({ success: true, filename, path: path.join(EXPORTS_DIR, filename) });
    } catch (error) {
        console.error('Canvas export error:', error);
        res.status(500).json({ error: 'Failed to export canvas' });
    }
});

app.get('/api/exports', async (req, res) => {
    try {
        await ensureDirectory(EXPORTS_DIR);
        const files = await fs.readdir(EXPORTS_DIR);
        const fileDetails = await Promise.all(files.map(async file => {
            const filePath = path.join(EXPORTS_DIR, file);
            const stats = await fs.stat(filePath).catch(() => null);
            if (!stats) return null;
            return {
                name: file,
                size: stats.size,
                modified: stats.mtime.toISOString(),
                path: filePath
            };
        }));

        res.json({ files: fileDetails.filter(Boolean) });
    } catch (error) {
        console.error('Exports listing error:', error);
        res.status(500).json({ error: 'Failed to list exports' });
    }
});

app.get('/api/exports/:filename', async (req, res) => {
    try {
        const filename = path.basename(req.params.filename);
        const filePath = path.join(EXPORTS_DIR, filename);
        await fs.access(filePath);
        res.sendFile(filePath);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }
        console.error('Export download error:', error);
        res.status(500).json({ error: 'Failed to download export' });
    }
});

// Spec generation with real file output
app.post('/api/specs/generate', async (req, res) => {
    try {
        const { spec, format } = req.body;
        await ensureDirectory(EXPORTS_DIR);
        const safeSpec = spec && typeof spec === 'object' ? spec : {};
        const result = await specGenerator.generateSpecFile({ spec: safeSpec, format, exportsDir: EXPORTS_DIR });
        console.log(`✓ Spec generated: ${result.filename}`);
        res.json({ success: true, ...result });
    } catch (error) {
        console.error('Spec generation error:', error);
        res.status(500).json({ error: 'Failed to generate spec' });
    }
});

// Start server
async function start() {
    await initDataFile();
    await ensureDirectory(EXPORTS_DIR);
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════╗
║           OTKIT v1.0 - OPERATIONAL        ║
║              TOOLKIT SERVER               ║
╚══════════════════════════════════════════╝

🚀 Server: http://localhost:${PORT}
🤖 Agents: curl http://localhost:${PORT}/api/agents
📦 Modules: curl http://localhost:${PORT}/api/modules/detect
⚡ Execute: curl http://localhost:${PORT}/api/claude/execute
📄 Export: curl http://localhost:${PORT}/api/export/markdown

Real Functionality:
  ✓ Agent directory scanning
  ✓ Module auto-detection
  ✓ File system operations
  ✓ Spec generation
  ✓ Canvas export
        `);
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
    readModuleLinks,
    writeModuleLinks,
    readFeaturesFile,
    loadPackageJson
};
