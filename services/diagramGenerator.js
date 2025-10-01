const path = require('path');
const fs = require('fs').promises;

function sanitizeId(value) {
    return String(value)
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/_{2,}/g, '_');
}

function createModuleClasses(modules) {
    const classes = new Set();
    modules.forEach(module => {
        const type = module.type || 'code';
        classes.add(type);
    });
    const definitions = [];
    if (classes.size > 0) {
        classes.forEach(type => {
            switch (type) {
            case 'frontend':
                definitions.push('classDef frontend fill:#1fb6ff,stroke:#0f172a,stroke-width:1px,color:#0f172a;');
                break;
            case 'backend':
                definitions.push('classDef backend fill:#f97316,stroke:#7c2d12,stroke-width:1px,color:#7c2d12;');
                break;
            case 'data':
                definitions.push('classDef data fill:#0ea5e9,stroke:#0c4a6e,stroke-width:1px,color:#082f49;');
                break;
            case 'documentation':
                definitions.push('classDef documentation fill:#f472b6,stroke:#831843,stroke-width:1px,color:#500724;');
                break;
            default:
                definitions.push(`classDef ${sanitizeId(type)} fill:#22c55e,stroke:#14532d,stroke-width:1px,color:#052e16;`);
                break;
            }
        });
    }
    return definitions;
}

function buildArchitectureDiagram({ modules = [], edges = [] }) {
    const lines = ['graph TD'];
    modules.forEach(module => {
        const id = sanitizeId(module.id || module.name);
        const labelLines = [module.name || module.id || 'module'];
        if (typeof module.health === 'number') {
            labelLines.push(`health ${module.health}%`);
        }
        if (module.type) {
            labelLines.push(module.type);
        }
        lines.push(`  ${id}["${labelLines.join('\n')}"]`);
    });

    if (edges.length === 0 && modules.length > 1) {
        for (let i = 0; i < modules.length - 1; i += 1) {
            const source = sanitizeId(modules[i].id || modules[i].name);
            const target = sanitizeId(modules[i + 1].id || modules[i + 1].name);
            lines.push(`  ${source} --> ${target}`);
        }
    } else {
        edges.forEach(edge => {
            const source = sanitizeId(edge.source);
            const target = sanitizeId(edge.target);
            if (source && target) {
                lines.push(`  ${source} --> ${target}`);
            }
        });
    }

    const classDefs = createModuleClasses(modules);
    const classAssignments = modules.map(module => {
        const id = sanitizeId(module.id || module.name);
        const type = sanitizeId(module.type || 'code');
        return `  class ${id} ${type}`;
    });

    return lines
        .concat(classDefs)
        .concat(classAssignments)
        .join('\n');
}

function buildSequenceDiagram({ features = [], modules = [] }) {
    const participants = new Set(['Stakeholder']);
    const moduleById = modules.reduce((acc, module) => {
        if (module.id) {
            acc[module.id] = module;
        }
        return acc;
    }, {});

    features.forEach(feature => {
        const moduleRef = feature.moduleId && moduleById[feature.moduleId];
        if (moduleRef) {
            participants.add(moduleRef.name || moduleRef.id);
        }
    });

    if (participants.size < 3) {
        participants.add('Backend API');
        participants.add('Frontend UI');
    }
    participants.add('Quality');
    participants.add('Release');

    const lines = ['sequenceDiagram'];
    participants.forEach(name => {
        lines.push(`  participant ${sanitizeId(name)} as ${name}`);
    });

    features.slice(0, 5).forEach(feature => {
        const moduleRef = feature.moduleId && moduleById[feature.moduleId];
        const moduleName = moduleRef ? (moduleRef.name || moduleRef.id) : 'Backend API';
        const safeModule = sanitizeId(moduleName);
        const safeFrontend = sanitizeId('Frontend UI');
        lines.push(`  Stakeholder->>${safeFrontend}: Request ${feature.title}`);
        lines.push(`  ${safeFrontend}->>${safeModule}: Implement ${feature.title}`);
        lines.push(`  ${safeModule}-->>Quality: Provide validation hooks`);
        lines.push('  Quality-->>Release: Approve for deployment');
    });

    if (features.length === 0) {
        lines.push('  Stakeholder->>Frontend_UI: Capture requirements');
        lines.push('  Frontend_UI->>Backend_API: Design API contract');
        lines.push('  Backend_API-->>Quality: Provide integration tests');
        lines.push('  Quality-->>Release: Sign-off for deployment');
    }

    return lines.join('\n');
}

function buildEntityDiagram({ modules = [] }) {
    const lines = ['erDiagram'];
    modules.forEach(module => {
        const id = sanitizeId(module.id || module.name || 'Module');
        const name = module.name || module.id || 'Module';
        lines.push(`  ${id} {`);
        lines.push(`    string name "${name}"`);
        if (module.type) {
            lines.push(`    string type "${module.type}"`);
        }
        if (typeof module.health === 'number') {
            lines.push(`    number health "${module.health}"`);
        }
        lines.push('  }');
    });

    modules.forEach(module => {
        const source = sanitizeId(module.id || module.name || 'Module');
        (module.dependencies || []).forEach(dep => {
            const target = sanitizeId(dep);
            lines.push(`  ${source} ||--o{ ${target} : "depends on"`);
        });
    });

    return lines.join('\n');
}

function buildDeliveryFlowDiagram({ project, techStack, features = [], tickets = [] }) {
    const name = project?.name || 'Project';
    const lines = ['flowchart TD'];
    lines.push(`  Start(["Kickoff ${name}"])`);
    lines.push('  Discovery{{Discovery Sessions}}');
    lines.push('  SpecBuilder[[Spec Builder Intake]]');
    lines.push('  Implementation[Implementation Streams]');
    lines.push('  Verification[[Quality & Verification]]');
    lines.push('  Release([Production Release])');

    lines.push('  Start --> Discovery');
    lines.push('  Discovery --> SpecBuilder');
    lines.push('  SpecBuilder --> Implementation');
    if (features.length > 0) {
        lines.push(`  Implementation -->|${features.length} features| Verification`);
    } else {
        lines.push('  Implementation --> Verification');
    }
    if (tickets.length > 0) {
        lines.push(`  Verification -->|${tickets.length} tickets| Release`);
    } else {
        lines.push('  Verification --> Release');
    }

    const stack = techStack || {};
    const dependencies = (stack.dependencies || []).slice(0, 5);
    const frameworks = (stack.frameworks || []).slice(0, 5);
    const depList = dependencies.length ? dependencies.join(', ') : 'N/A';
    const frameworkList = frameworks.length ? frameworks.join(', ') : 'N/A';

    lines.push(`  Implementation -->|Stack| StackInfo[[Dependencies: ${depList}\nFrameworks: ${frameworkList}]]`);

    return lines.join('\n');
}

async function writeDiagram({ mermaid, type, exportsDir, sources }) {
    await fs.mkdir(exportsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-diagram-${type}-${timestamp}.mmd`;
    const filePath = path.join(exportsDir, filename);
    await fs.writeFile(filePath, mermaid, 'utf8');
    return {
        type,
        filename,
        path: filePath,
        relativePath: path.relative(path.join(exportsDir, '..'), filePath).replace(/\\/g, '/'),
        format: 'mermaid',
        mermaid,
        generatedAt: new Date().toISOString(),
        sources
    };
}

// Hook: extend the context payload before fan-out to enrich every downstream diagram.
async function generateAllDiagrams({
    modules,
    edges,
    features,
    tickets,
    project,
    techStack,
    exportsDir
}) {
    const diagrams = [];
    const context = { modules, edges, features, tickets, project, techStack };

    const architectureMermaid = buildArchitectureDiagram({ modules, edges });
    diagrams.push(await writeDiagram({
        mermaid: architectureMermaid,
        type: 'architecture',
        exportsDir,
        sources: ['modules', 'moduleEdges']
    }));

    const sequenceMermaid = buildSequenceDiagram({ features, modules });
    diagrams.push(await writeDiagram({
        mermaid: sequenceMermaid,
        type: 'sequence',
        exportsDir,
        sources: ['features', 'modules']
    }));

    const entityMermaid = buildEntityDiagram({ modules });
    diagrams.push(await writeDiagram({
        mermaid: entityMermaid,
        type: 'entity',
        exportsDir,
        sources: ['modules']
    }));

    const flowMermaid = buildDeliveryFlowDiagram(context);
    diagrams.push(await writeDiagram({
        mermaid: flowMermaid,
        type: 'delivery-flow',
        exportsDir,
        sources: ['project', 'techStack', 'features', 'tickets']
    }));

    return diagrams;
}

function generateDiagramContent(type, context) {
    switch (type) {
    case 'architecture':
        return buildArchitectureDiagram(context);
    case 'sequence':
        return buildSequenceDiagram(context);
    case 'entity':
        return buildEntityDiagram(context);
    case 'delivery-flow':
        return buildDeliveryFlowDiagram(context);
    default:
        return null;
    }
}

async function generateDiagramFile(type, context, exportsDir) {
    const mermaid = generateDiagramContent(type, context);
    if (!mermaid) return null;
    const sources = [];
    if (type === 'architecture') sources.push('modules', 'moduleEdges');
    if (type === 'sequence') sources.push('features', 'modules');
    if (type === 'entity') sources.push('modules');
    if (type === 'delivery-flow') sources.push('project', 'techStack', 'features', 'tickets');
    return writeDiagram({ mermaid, type, exportsDir, sources });
}

module.exports = {
    buildArchitectureDiagram,
    buildSequenceDiagram,
    buildEntityDiagram,
    buildDeliveryFlowDiagram,
    generateAllDiagrams,
    generateDiagramFile,
    generateDiagramContent
};
