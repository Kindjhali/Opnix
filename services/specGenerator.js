const path = require('path');
const fs = require('fs').promises;

function buildSpecKitMarkdown(specPayload) {
    const now = new Date();
    const projectName = specPayload?.project?.name || 'Feature';
    const goal = specPayload?.project?.goal || '[NEEDS CLARIFICATION: goal not provided]';
    const projectType = specPayload?.project?.type || 'General';
    const branchSlug = projectName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || 'feature';
    const branchName = `spec-${now.getFullYear()}-${branchSlug}`;

    const architecture = specPayload?.technical?.architecture || {};
    const dataStores = architecture.dataStores || '[NEEDS CLARIFICATION: data stores not defined]';
    const integrations = architecture.integrations || '[NEEDS CLARIFICATION: integrations not defined]';
    const testingStrategy = architecture.testingStrategy || '[NEEDS CLARIFICATION: testing strategy not defined]';
    const observability = architecture.observability || '[NEEDS CLARIFICATION: observability requirements not defined]';

    const features = Array.isArray(specPayload?.features) ? specPayload.features : [];
    const modules = Array.isArray(specPayload?.modules) ? specPayload.modules : [];
    const tickets = Array.isArray(specPayload?.tickets) ? specPayload.tickets : [];

    const projectTypeLabel = projectType || 'General';

    const scenarios = features.slice(0, 2).map(feature => `**Given** the ${projectTypeLabel.toLowerCase()} includes module ${feature.moduleId || 'core'}, **When** ${feature.title.toLowerCase()}, **Then** ${feature.description || 'the system delivers the expected outcome'}`);
    if (scenarios.length === 0) {
        scenarios.push('**Given** the specification is drafted, **When** requirements are clarified with stakeholders, **Then** [NEEDS CLARIFICATION: acceptance scenario must be defined]');
    }

    const edgeCases = tickets.slice(0, 3).map(ticket => `- ${ticket.title} (${ticket.priority || 'priority unknown'})`);
    if (edgeCases.length === 0) {
        edgeCases.push('- [NEEDS CLARIFICATION: edge cases derived from quality/test tickets]');
    }

    const functionalRequirements = [];
    features.forEach((feature, index) => {
        functionalRequirements.push(`- **FR-${String(index + 1).padStart(3, '0')}**: ${feature.title} — ${feature.description || 'description pending refinement'}`);
    });
    if (functionalRequirements.length === 0) {
        functionalRequirements.push('- **FR-001**: [NEEDS CLARIFICATION: define user-facing functionality]');
    }
    modules.forEach((module, index) => {
        functionalRequirements.push(`- **FR-${String(functionalRequirements.length + 1).padStart(3, '0')}**: Maintain ${module.name} module with minimum health ${module.health || 'n/a'}% and coverage ${module.coverage || 0}%`);
    });

    const entities = modules.slice(0, 5).map(module => {
        const paths = Array.isArray(module.pathHints) && module.pathHints.length > 0 ? module.pathHints.join(', ') : '[location unspecified]';
        return `- **${module.name}**: Located at ${paths}; depends on ${(module.dependencies || []).join(', ') || 'no internal modules'}; external packages ${(module.externalDependencies || []).join(', ') || 'none recorded'}`;
    });
    if (entities.length === 0) {
        entities.push('- [NEEDS CLARIFICATION: identify key entities/modules once discovery completes]');
    }

    const dependencyStats = specPayload?.canvas?.summary || {};
    const questionEntries = Object.entries(specPayload?.questionAnswers || {});

    return `# Feature Specification: ${projectName}

**Feature Branch**: \`${branchName}\`  
**Created**: ${now.toISOString()}  
**Status**: Draft  
**Project Type**: ${projectTypeLabel}  
**Input**: User description: "${goal}"

## User Scenarios & Testing *(mandatory)*

### Primary User Story
${goal}

### Acceptance Scenarios
${scenarios.map((scenario, idx) => `${idx + 1}. ${scenario}`).join('\n')}

### Edge Cases
${edgeCases.join('\n')}

## Requirements *(mandatory)*

### Functional Requirements
${functionalRequirements.join('\n')}

### Key Entities
${entities.join('\n')}

### Architecture Snapshot
- **Data Stores**: ${dataStores}
- **Integrations**: ${integrations}
- **Testing Strategy**: ${testingStrategy}
- **Observability**: ${observability}
- **Modules Discovered**: ${modules.length}
- **Dependencies**: ${dependencyStats.dependencyCount || 0}
- **External Dependencies**: ${dependencyStats.externalDependencyCount || 0}

## Review & Acceptance Checklist
- [ ] No [NEEDS CLARIFICATION] markers remain
- [ ] Requirements are testable and unambiguous
- [ ] Scope is clearly bounded
- [ ] Dependencies and assumptions identified
- [ ] User journeys validated with stakeholders

## Open Questions
${questionEntries.length ? questionEntries.map(([key, answer]) => `- **${key}** → ${answer || '[pending]'}`).join('\n') : '- Document follow-up questions with stakeholders.'}

---

Generated automatically by Opnix based on live repository telemetry.`;
}

function buildMarkdownSummary(spec) {
    let content = '# Opnix Specification\n\n';
    content += `Generated: ${new Date().toISOString()}\n\n`;
    content += `## Project Overview\n${JSON.stringify(spec.project, null, 2)}\n\n`;
    content += `## Technical Details\n${JSON.stringify(spec.technical, null, 2)}\n\n`;
    content += `## Modules\n${JSON.stringify(spec.modules, null, 2)}\n\n`;
    content += `## Features\n${JSON.stringify(spec.features, null, 2)}\n`;
    return content;
}

function buildSpecContent(spec, format) {
    const normalizedFormat = format || 'json';
    if (normalizedFormat === 'markdown') {
        return {
            format: 'markdown',
            extension: 'md',
            content: buildMarkdownSummary(spec)
        };
    }
    if (normalizedFormat === 'github-spec-kit') {
        return {
            format: 'github-spec-kit',
            extension: 'spec.md',
            content: buildSpecKitMarkdown(spec)
        };
    }
    return {
        format: 'json',
        extension: 'json',
        content: JSON.stringify(spec, null, 2)
    };
}

async function generateSpecFile({ spec, format, exportsDir }) {
    const { extension, content, format: resolvedFormat } = buildSpecContent(spec, format);
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `opnix-spec-${timestamp}.${extension}`;
    const filePath = path.join(exportsDir, filename);
    await fs.writeFile(filePath, content);
    return { filename, path: filePath, format: resolvedFormat };
}

module.exports = {
    buildSpecKitMarkdown,
    generateSpecFile
};
