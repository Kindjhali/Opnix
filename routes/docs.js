const express = require('express');
const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const glob = require('glob');

let docsDeps = null;

function setDocsDependencies(deps) {
    docsDeps = deps;
}

function getDeps() {
    if (!docsDeps) {
        throw new Error('Docs routes not initialised with dependencies');
    }
    return docsDeps;
}

async function docsBrowseRoute(_req, res) {
    const { rootDir } = getDeps();
    try {
        const markdownFiles = glob.sync('**/*.md', {
            cwd: rootDir,
            ignore: ['node_modules/**', '.git/**', 'exports/**']
        });

        const fileTree = {};

        for (const filePath of markdownFiles) {
            const dirname = path.dirname(filePath);
            const basename = path.basename(filePath);

            if (!fileTree[dirname]) {
                fileTree[dirname] = [];
            }

            const fullPath = path.join(rootDir, filePath);
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
}

async function docsReadRoute(req, res) {
    const { rootDir } = getDeps();
    try {
        const { filePath } = req.query;
        if (!filePath) {
            return res.status(400).json({ error: 'filePath parameter required' });
        }

        const fullPath = path.join(rootDir, filePath);
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
}

async function docsSaveRoute(req, res) {
    const { rootDir } = getDeps();
    try {
        const { filePath, content } = req.body || {};
        if (!filePath || content === undefined) {
            return res.status(400).json({ error: 'filePath and content required' });
        }

        const fullPath = path.join(rootDir, filePath);
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
}

async function docsTemplatesRoute(_req, res) {
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
}

async function docsCreateFromTemplateRoute(req, res) {
    const { rootDir } = getDeps();
    try {
        const { templateId, fileName, customPath } = req.body || {};

        const templates = {
            readme: `# ${fileName ? fileName.replace('.md', '') : 'Project'}\n\n## Description\n\nA brief description of your project.\n\n## Installation\n\n\`\`\`bash\nnpm install\n\`\`\`\n\n## Usage\n\n\`\`\`bash\nnpm start\n\`\`\`\n\n## Contributing\n\nPlease read [CONTRIBUTING.md](CONTRIBUTING.md) for details.\n\n## License\n\nThis project is licensed under the MIT License.`,
            'api-docs': `# API Documentation\n\n## Overview\n\nThis document describes the REST API endpoints.\n\n## Base URL\n\n\`\`\`\nhttp://localhost:3000/api\n\`\`\`\n\n## Endpoints\n\n### GET /api/example\n\nDescription of endpoint.\n\n**Response:**\n\`\`\`json\n{\n  "status": "success",\n  "data": {}\n}\n\`\`\``,
            architecture: `# System Architecture\n\n## Overview\n\nThis document describes the high-level architecture.\n\n## Components\n\n- Frontend: User interface\n- Backend: API and business logic\n- Database: Data persistence\n\n## Data Flow\n\n1. User interacts with frontend\n2. Frontend sends requests to backend\n3. Backend processes and returns response`,
            contributing: `# Contributing Guidelines\n\n## Welcome\n\nThank you for contributing!\n\n## How to Contribute\n\n1. Fork the repository\n2. Create feature branch\n3. Make changes\n4. Submit pull request\n\n## Development Setup\n\n\`\`\`bash\nnpm install\nnpm test\n\`\`\``
        };

        const templateContent = templates[templateId];
        if (!templateContent) {
            return res.status(404).json({ error: 'Template not found' });
        }

        if (!fileName) {
            return res.status(400).json({ error: 'fileName is required' });
        }

        const filePath = customPath ? path.join(customPath, fileName) : fileName;
        const fullPath = path.join(rootDir, filePath);

        fs.mkdirSync(path.dirname(fullPath), { recursive: true });
        fs.writeFileSync(fullPath, templateContent, 'utf8');

        res.json({
            success: true,
            filePath,
            content: templateContent
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
}


async function docsGenerateRoute(_req, res) {
    const {
        rootDir,
        docsGenerator,
        moduleDetector,
        readData,
        readFeaturesFile,
        loadPackageJson,
        deriveTechStack,
        normaliseTicketStatus,
        syncRoadmapState,
        statusConstants,
        exportsDir
    } = getDeps();

    try {
        const [modulesResult, ticketPayload, featuresCollection, packageJson] = await Promise.all([
            moduleDetector.detectModules(rootDir),
            readData(),
            readFeaturesFile(),
            loadPackageJson()
        ]);

        const modules = modulesResult && Array.isArray(modulesResult.modules) ? modulesResult.modules : [];
        const moduleEdges = modulesResult && Array.isArray(modulesResult.edges) ? modulesResult.edges : [];
        const tickets = ticketPayload && Array.isArray(ticketPayload.tickets) ? ticketPayload.tickets : [];
        const features = Array.isArray(featuresCollection) ? featuresCollection : [];
        const summary = modulesResult && typeof modulesResult.summary === 'object' ? modulesResult.summary : {};
        const projectName = packageJson && packageJson.name ? packageJson.name : 'Opnix Project';

        const {
            statusReported = 'reported',
            statusInProgress = 'inProgress',
            statusFinished = 'finished'
        } = statusConstants || {};

        const ticketStats = {
            reported: 0,
            inProgress: 0,
            finished: 0
        };

        tickets.forEach(ticket => {
            const canonicalStatus = normaliseTicketStatus(ticket.status, { fallback: statusReported }) || statusReported;
            if (canonicalStatus === statusFinished) {
                ticketStats.finished += 1;
            } else if (canonicalStatus === statusInProgress) {
                ticketStats.inProgress += 1;
            } else {
                ticketStats.reported += 1;
            }
        });

        const techStack = deriveTechStack(packageJson || {}, modules);

        const docMeta = await docsGenerator.generateDocsFile({
            projectName,
            stats: {
                reported: ticketStats.reported,
                inProgress: ticketStats.inProgress,
                finished: ticketStats.finished,
                externalDependencies: summary.externalDependencyCount || 0,
                totalLines: summary.totalLines || 0
            },
            modules,
            moduleEdges,
            features,
            tickets,
            techStack,
            exportsDir
        });

        let content = '';
        try {
            content = await fsPromises.readFile(docMeta.path, 'utf8');
        } catch {
            content = '';
        }

        const relativePath = path.relative(rootDir, docMeta.path);

        if (typeof syncRoadmapState === 'function') {
            try {
                await syncRoadmapState({ reason: 'docs:generate' });
            } catch (stateError) {
                console.error('Roadmap sync failed after docs generate:', stateError);
            }
        }

        res.json({
            success: true,
            doc: {
                ...docMeta,
                relativePath,
                content
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message || 'Failed to generate documentation' });
    }
}

function createDocsRoutes(deps) {
    setDocsDependencies(deps);
    const router = express.Router();

    router.get('/api/docs/browse', docsBrowseRoute);
    router.get('/api/docs/read', docsReadRoute);
    router.post('/api/docs/save', docsSaveRoute);
    router.get('/api/docs/templates', docsTemplatesRoute);
    router.post('/api/docs/create-from-template', docsCreateFromTemplateRoute);
    router.post('/api/docs/generate', docsGenerateRoute);

    return router;
}

module.exports = {
    createDocsRoutes
};
