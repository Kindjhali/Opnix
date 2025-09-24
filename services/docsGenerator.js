const path = require('path');
const fs = require('fs').promises;

function listToMarkdown(items) {
    if (!items || items.length === 0) return '- None';
    return items.map(item => `- ${item}`).join('\n');
}

function buildDocsMarkdown({ projectName, stats, modules, moduleEdges, features, tickets, techStack }) {
    const totalTickets = tickets.length;
    const openTickets = tickets.filter(ticket => ticket.status === 'reported' || ticket.status === 'in_progress').length;
    const closedTickets = tickets.filter(ticket => ticket.status === 'finished').length;
    const highPriority = tickets.filter(ticket => ticket.priority === 'high').length;

    const moduleLines = modules.map(module => {
        const deps = module.dependencies && module.dependencies.length ? module.dependencies.join(', ') : 'None';
        const externals = module.externalDependencies && module.externalDependencies.length ? module.externalDependencies.join(', ') : 'None';
        return `### ${module.name}\n- Id: ${module.id}\n- Type: ${module.type}\n- Health: ${module.health || 'n/a'}%\n- Coverage: ${module.coverage || 0}%\n- Dependencies: ${deps}\n- External Packages: ${externals}\n- Path Hints: ${(module.pathHints || []).join(', ') || 'Unknown'}\n`;
    }).join('\n');

    const featureLines = features.map(feature => {
        const criteria = Array.isArray(feature.acceptanceCriteria) && feature.acceptanceCriteria.length
            ? feature.acceptanceCriteria.map(line => `    - ${line}`).join('\n')
            : '    - [Clarify acceptance criteria]';
        return `- **${feature.title}** (${feature.priority || 'medium'}) → ${feature.status || 'proposed'}\n${criteria}`;
    }).join('\n');

    const techDeps = listToMarkdown(techStack.dependencies);
    const techDevDeps = listToMarkdown(techStack.devDependencies);
    const frameworks = listToMarkdown(techStack.frameworks);

    return `# Opnix Project Audit — ${projectName}

Generated: ${new Date().toISOString()}

## Ticket Overview
- Total Tickets: ${totalTickets}
- Open Tickets: ${openTickets}
- Closed Tickets: ${closedTickets}
- High Priority: ${highPriority}
- Reported: ${stats.reported || 0}
- In Progress: ${stats.in_progress || 0}
- Finished: ${stats.finished || 0}

## Module Summary
- Modules Discovered: ${modules.length}
- Dependencies: ${moduleEdges.length}
- External Dependencies: ${stats.externalDependencies || 0}
- Total Lines: ${stats.totalLines || 0}

${moduleLines || 'No modules detected. Run module detection to populate this section.'}

## Feature Catalog
${featureLines || '- No features captured yet. Use the FEATURES tab to add proposals.'}

## Tech Stack Snapshot
### Dependencies
${techDeps}

### Dev Dependencies
${techDevDeps}

### Framework Signals
${frameworks}

## Ticket Backlog (Open)
${tickets.filter(ticket => ticket.status === 'reported' || ticket.status === 'in_progress').map(ticket => `- [${ticket.priority}] #${ticket.id} — ${ticket.title}`).join('\n') || '- None'}

---
Generated automatically by the Opnix audit pipeline.
`;
}

async function generateDocsFile({ projectName, stats, modules, moduleEdges, features, tickets, techStack, exportsDir }) {
    const content = buildDocsMarkdown({ projectName, stats, modules, moduleEdges, features, tickets, techStack });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-docs-${timestamp}.md`;
    const filePath = path.join(exportsDir, filename);
    await fs.writeFile(filePath, content);
    return { filename, path: filePath, format: 'markdown' };
}

module.exports = {
    buildDocsMarkdown,
    generateDocsFile
};
