const path = require('path');
const fs = require('fs').promises;

const runtimeBundler = require('./runtimeBundler');

function slugify(value) {
    return String(value || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .replace(/--+/g, '-');
}

async function ensureDirectory(dir) {
    await fs.mkdir(dir, { recursive: true });
}

async function writeFileVersioned(targetPath, content) {
    try {
        await fs.access(targetPath);
        const parsed = path.parse(targetPath);
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const versionedPath = path.join(parsed.dir, `${parsed.name}.${timestamp}${parsed.ext}`);
        await fs.writeFile(versionedPath, content, 'utf8');
        return { path: versionedPath, created: true, versioned: true };
    } catch (error) {
        if (error.code !== 'ENOENT') throw error;
        await fs.writeFile(targetPath, content, 'utf8');
        return { path: targetPath, created: true, versioned: false };
    }
}

function renderModuleReadme(module, projectName) {
    const dependencies = (module.dependencies || []).length
        ? module.dependencies.map(dep => `- ${dep}`).join('\n')
        : '- None';
    const external = (module.externalDependencies || []).length
        ? module.externalDependencies.map(dep => `- ${dep}`).join('\n')
        : '- None recorded';
    const pathHints = (module.pathHints || []).length
        ? module.pathHints.map(hint => `- ${hint}`).join('\n')
        : '- (detector could not determine files)';

    return `# ${projectName} — Module: ${module.name}

- **Identifier**: ${module.id}
- **Type**: ${module.type || 'code'}
- **Health**: ${typeof module.health === 'number' ? `${module.health}%` : 'n/a'}
- **Test Coverage**: ${typeof module.coverage === 'number' ? `${module.coverage}%` : 'n/a'}
- **TODO Count**: ${module.todoCount ?? 0}
- **Internal Dependencies**:\n${dependencies}
- **External Packages**:\n${external}
- **Path Hints**:\n${pathHints}

> Files inside this directory mirror live detector output. Update the module in the main repo and rerun the installer to refresh.`;
}

function renderFeatureDoc(feature, moduleLookup) {
    const moduleName = feature.moduleId ? (moduleLookup.get(feature.moduleId)?.name || feature.moduleId) : 'Unassigned';
    const criteria = Array.isArray(feature.acceptanceCriteria) && feature.acceptanceCriteria.length
        ? feature.acceptanceCriteria.map(item => `- ${item}`).join('\n')
        : '- Define acceptance criteria with stakeholders.';

    return `# Feature: ${feature.title}

- **Module**: ${moduleName}
- **Priority**: ${feature.priority || 'medium'}
- **Status**: ${feature.status || 'proposed'}
- **Created**: ${feature.created || 'unknown'}

## Description
${feature.description || 'No description captured yet.'}

## Acceptance Criteria
${criteria}
`;
}

function renderTicketDoc(ticket) {
    const tags = (ticket.tags || []).length ? ticket.tags.join(', ') : 'None';
    return `# Ticket #${ticket.id}: ${ticket.title}

- **Priority**: ${ticket.priority}
- **Status**: ${ticket.status}
- **Tags**: ${tags}
- **Created**: ${ticket.created}

## Description
${ticket.description}
`;
}

function renderTechStackMarkdown(techStack, project) {
    const deps = (project.packageJson?.dependencies) || {};
    const devDeps = (project.packageJson?.devDependencies) || {};
    const dependencyNames = Array.isArray(techStack.dependencies) ? techStack.dependencies : [];
    const devDependencyNames = Array.isArray(techStack.devDependencies) ? techStack.devDependencies : [];
    const frameworkNames = Array.isArray(techStack.frameworks) ? techStack.frameworks : [];

    const dependencies = dependencyNames.length
        ? dependencyNames.map(name => `- ${name}: ${deps[name] || 'version unknown'}`).join('\n')
        : '- None';
    const devDependencies = devDependencyNames.length
        ? devDependencyNames.map(name => `- ${name}: ${devDeps[name] || 'version unknown'}`).join('\n')
        : '- None';
    const frameworks = frameworkNames.length
        ? frameworkNames.map(name => `- ${name}`).join('\n')
        : '- None detected';

    return `# ${project.name} — Tech Stack Baseline

- **Project Type**: ${project.type}
- **Detected Frameworks**:\n${frameworks}

## Dependencies
${dependencies}

## Dev Dependencies
${devDependencies}
`;
}

function renderProjectReadme(project, techStack, questionnaire, filesCreated) {
    const questionnaireSections = Array.isArray(questionnaire) && questionnaire.length
        ? questionnaire.map(section => `- ${section.title} (${section.questions.length} prompts)`).join('\n')
        : '- Run the Spec Builder to capture discovery answers.';

    const fileList = filesCreated.length
        ? filesCreated.map(file => `- ${file}`).join('\n')
        : '- Scaffolder did not create any files (check permissions).';

    return `# .opnix Scaffold — ${project.name}

This scaffold mirrors the current Opnix audit for **${project.name}**.

- Project Type: ${project.type}
- Generated: ${new Date().toISOString()}
- Tech Stack Frameworks: ${techStack.frameworks.join(', ') || 'none detected'}

## Interview Blueprint Highlights
${questionnaireSections}

## Files Created
${fileList}

> Re-run \`npm run setup:wizard\` or \`npm run setup:install\` after updating modules/features to regenerate the scaffold without deleting previous versions.`;
}

function buildFrameworkPlan(techStack, moduleIndex, featureIndex) {
    const plan = [];
    const frameworks = new Set((techStack.frameworks || []).map(item => String(item).toLowerCase()));

    const moduleSnapshot = moduleIndex || [];
    const featureSnapshot = featureIndex || [];

    if (frameworks.has('express')) {
        plan.push({
            description: 'Express API service scaffold',
            files: [
                {
                    relativePath: path.join('project', 'api', 'server.js'),
                    content: `const express = require('express');
const cors = require('cors');

const modules = ${JSON.stringify(moduleSnapshot, null, 2)};

function bootstrap() {
    const app = express();
    app.use(cors());
    app.use(express.json());

    app.get('/health', (req, res) => {
        res.json({ status: 'ok', generatedAt: new Date().toISOString(), modules });
    });

    return app;
}

module.exports = bootstrap;

if (require.main === module) {
    const app = bootstrap();
    const port = process.env.PORT || 4000;
    app.listen(port, () => {
        console.log(
            '%s Express scaffold listening on port %d',
            process.env.npm_package_name || 'opnix-scaffold',
            port
        );
    });
}
`
                }
            ]
        });
    }

    if (frameworks.has('vue')) {
        plan.push({
            description: 'Vue SPA bootstrap',
            files: [
                {
                    relativePath: path.join('project', 'ui', 'main.js'),
                    content: `import { createApp } from 'vue';

const modules = ${JSON.stringify(moduleSnapshot, null, 2)};
const features = ${JSON.stringify(featureSnapshot, null, 2)};

const template = [
    '<main class="opnix-bootstrap">',
    '  <h1>{{ title }}</h1>',
    '  <section>',
    '    <h2>Modules</h2>',
    '    <ul>',
    '      <li v-for="module in modules" :key="module.id">',
    '        {{ module.name }} · {{ module.type }}',
    '      </li>',
    '    </ul>',
    '  </section>',
    '  <section>',
    '    <h2>Features</h2>',
    '    <ul>',
    '      <li v-for="feature in features" :key="feature.id">',
    '        {{ feature.title }} ({{ feature.status }})',
    '      </li>',
    '    </ul>',
    '  </section>',
    '</main>'
].join('\n');

createApp({
    data() {
        return { modules, features };
    },
    template,
    computed: {
        title() {
            return 'Opnix Vue Scaffold';
        }
    }
}).mount('#app');
`
                }
            ]
        });
    }

    if (frameworks.has('react')) {
        plan.push({
            description: 'React SPA bootstrap',
            files: [
                {
                    relativePath: path.join('project', 'ui', 'App.jsx'),
                    content: `import { useMemo } from 'react';

const modules = ${JSON.stringify(moduleSnapshot, null, 2)};
const features = ${JSON.stringify(featureSnapshot, null, 2)};

export default function App() {
    const featureCount = useMemo(() => features.length, []);
    return (
        <main className="opnix-bootstrap">
            <h1>Opnix React Scaffold</h1>
            <section>
                <h2>Modules ({modules.length})</h2>
                <ul>
                    {modules.map(module => (
                        <li key={module.id}>{module.name} · {module.type}</li>
                    ))}
                </ul>
            </section>
            <section>
                <h2>Features ({featureCount})</h2>
                <ul>
                    {features.map(feature => (
                        <li key={feature.id}>{feature.title} ({feature.status || 'pending'})</li>
                    ))}
                </ul>
            </section>
        </main>
    );
}
`
                }
            ]
        });
}

    return plan;
}

async function generateProjectScaffold({
    rootDir,
    project,
    techStack,
    modules,
    features,
    tickets,
    questionnaire
}) {
    const opnixRoot = path.join(rootDir, '.opnix');
    const scaffoldRoot = path.join(opnixRoot, 'scaffold');
    const modulesRoot = path.join(scaffoldRoot, 'modules');
    const featuresRoot = path.join(scaffoldRoot, 'features');
    const ticketsRoot = path.join(scaffoldRoot, 'tickets');
    const techRoot = path.join(scaffoldRoot, 'tech');

    await Promise.all([
        ensureDirectory(opnixRoot),
        ensureDirectory(scaffoldRoot),
        ensureDirectory(modulesRoot),
        ensureDirectory(featuresRoot),
        ensureDirectory(ticketsRoot),
        ensureDirectory(techRoot)
    ]);

    const createdFiles = [];
    const moduleLookup = new Map();
    const moduleIndex = (modules || []).map(module => ({
        id: module.id,
        name: module.name,
        type: module.type || 'code'
    }));
    const featureIndex = (features || []).map(feature => ({
        id: feature.id,
        title: feature.title,
        status: feature.status || 'proposed'
    }));

    (modules || []).forEach(module => {
        const slug = slugify(module.id || module.name || 'module');
        moduleLookup.set(module.id, module);
        const moduleDir = path.join(modulesRoot, slug);
        createdFiles.push({ type: 'directory', path: path.relative(rootDir, moduleDir) });
    });

    await Promise.all((modules || []).map(async module => {
        const slug = slugify(module.id || module.name || 'module');
        const moduleDir = path.join(modulesRoot, slug);
        await ensureDirectory(moduleDir);
        const readmePath = path.join(moduleDir, 'README.md');
        const result = await writeFileVersioned(readmePath, renderModuleReadme(module, project.name));
        createdFiles.push({ type: 'file', path: path.relative(rootDir, result.path), versioned: result.versioned });
    }));

    await Promise.all((features || []).map(async feature => {
        const slug = slugify(feature.title || feature.id);
        const featurePath = path.join(featuresRoot, `${slug}.md`);
        const result = await writeFileVersioned(featurePath, renderFeatureDoc(feature, moduleLookup));
        createdFiles.push({ type: 'file', path: path.relative(rootDir, result.path), versioned: result.versioned });
    }));

    await Promise.all((tickets || []).map(async ticket => {
        const ticketPath = path.join(ticketsRoot, `ticket-${ticket.id}.md`);
        const result = await writeFileVersioned(ticketPath, renderTicketDoc(ticket));
        createdFiles.push({ type: 'file', path: path.relative(rootDir, result.path), versioned: result.versioned });
    }));

    const techSummaryPath = path.join(techRoot, 'stack.md');
    const techSummary = renderTechStackMarkdown(techStack, project);
    const techResult = await writeFileVersioned(techSummaryPath, techSummary);
    createdFiles.push({ type: 'file', path: path.relative(rootDir, techResult.path), versioned: techResult.versioned });

    const frameworkPlan = buildFrameworkPlan(techStack, moduleIndex, featureIndex);
    for (const block of frameworkPlan) {
        for (const file of block.files) {
            const target = path.join(scaffoldRoot, file.relativePath);
            await ensureDirectory(path.dirname(target));
            const result = await writeFileVersioned(target, file.content);
            createdFiles.push({ type: 'file', path: path.relative(rootDir, result.path), versioned: result.versioned });
        }
    }

    const packageJsonPath = path.join(scaffoldRoot, 'project', 'package.json');
    const frameworksLower = new Set((techStack.frameworks || []).map(name => String(name).toLowerCase()));

    const pkg = {
        name: slugify(project.name) || 'opnix-scaffold',
        private: true,
        version: '0.1.0',
        type: 'module',
        scripts: {
            start: frameworksLower.has('express') ? 'node api/server.js' : 'node index.js',
            dev: frameworksLower.has('vue') ? 'vite --open' : 'node index.js'
        },
        dependencies: project.packageJson?.dependencies || {},
        devDependencies: project.packageJson?.devDependencies || {}
    };
    await ensureDirectory(path.dirname(packageJsonPath));
    const packageResult = await writeFileVersioned(packageJsonPath, `${JSON.stringify(pkg, null, 2)}\n`);
    createdFiles.push({ type: 'file', path: path.relative(rootDir, packageResult.path), versioned: packageResult.versioned });

    const fallbackIndexPath = path.join(scaffoldRoot, 'project', 'index.js');
    const fallbackContent = `/*
 * Opnix scaffold entry point
 * Mirrors the current audit state so engineers can bootstrap quickly.
 */

const summary = ${JSON.stringify({
        modules: moduleIndex,
        features: featureIndex,
        generatedAt: new Date().toISOString()
    }, null, 2)};

console.log('Opnix scaffold bootstrap loaded. Summary:', summary);
`;
    const fallbackResult = await writeFileVersioned(fallbackIndexPath, fallbackContent);
    createdFiles.push({ type: 'file', path: path.relative(rootDir, fallbackResult.path), versioned: fallbackResult.versioned });

    const manifest = {
        generatedAt: new Date().toISOString(),
        project,
        techStack: {
            frameworks: techStack.frameworks,
            dependencyCount: techStack.dependencies.length,
            devDependencyCount: techStack.devDependencies.length
        },
        modules: moduleIndex,
        features: featureIndex,
        tickets: (tickets || []).map(ticket => ({ id: ticket.id, status: ticket.status, priority: ticket.priority })),
        files: createdFiles
    };

    const manifestPath = path.join(scaffoldRoot, 'manifest.json');
    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    createdFiles.push({ type: 'file', path: path.relative(rootDir, manifestPath), versioned: false });

    const indexPath = path.join(scaffoldRoot, 'README.md');
    const indexResult = await writeFileVersioned(indexPath, renderProjectReadme(project, techStack, questionnaire, manifest.files.map(item => item.path)));
    createdFiles.push({ type: 'file', path: path.relative(rootDir, indexResult.path), versioned: indexResult.versioned });

    try {
        await runtimeBundler.syncScaffoldManifest(manifestPath);
    } catch (error) {
        console.error('Scaffold manifest bundling failed:', error);
    }

    return {
        root: opnixRoot,
        scaffoldRoot,
        createdFiles: manifest.files,
        manifestPath,
        summary: manifest
    };
}

module.exports = {
    generateProjectScaffold
};
