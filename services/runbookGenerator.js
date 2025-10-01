const path = require('path');
const fs = require('fs').promises;
const { ArtifactGenerator } = require('./artifactGenerator');
const { buildSpecKitMarkdown } = require('./specGenerator');
const runbookTemplates = require('./runbookTemplates');

const artifactGenerator = new ArtifactGenerator(process.cwd());

const RUNBOOK_SECTION_DEFINITIONS = [
  {
    title: 'Runtime Decisions',
    entries: [
      { id: 'primary-language', label: 'Primary Language' },
      { id: 'preferred-framework', label: 'Preferred Framework' },
      { id: 'supporting-libraries', label: 'Supporting Libraries' }
    ]
  },
  {
    title: 'Security & Compliance',
    entries: [
      { id: 'compliance-standards', label: 'Compliance Standards' },
      { id: 'authentication-model', label: 'Authentication Model' },
      { id: 'authorization-model', label: 'Authorization Model' },
      { id: 'security-monitoring', label: 'Security Monitoring' }
    ]
  },
  {
    title: 'Operations & Reliability',
    entries: [
      { id: 'availability-targets', label: 'Availability Targets' },
      { id: 'scaling-strategy', label: 'Scaling Strategy' },
      { id: 'observability-tooling', label: 'Observability Tooling' },
      { id: 'monitoring-procedures', label: 'Monitoring Procedures' },
      { id: 'incident-response', label: 'Incident Response' },
      { id: 'troubleshooting-playbook', label: 'Troubleshooting Playbook' }
    ]
  },
  {
    title: 'Deployment & Release',
    entries: [
      { id: 'environment-promotion', label: 'Environment Promotion' },
      { id: 'release-cadence', label: 'Release Cadence' },
      { id: 'rollback-plan', label: 'Rollback Plan' }
    ]
  },
  {
    title: 'AI Safeguards',
    entries: [
      { id: 'ai-regression-history', label: 'Regression History' },
      { id: 'ai-guardrails', label: 'Guardrails' },
      { id: 'manual-validation-points', label: 'Manual Validation Points' }
    ]
  },
  {
    title: 'Audit Readiness',
    entries: [
      { id: 'audit-evidence-plan', label: 'Evidence Plan' },
      { id: 'audit-blockers', label: 'Known Blockers' }
    ]
  },
  {
    title: 'Desktop Distribution',
    entries: [
      { id: 'distribution-channels', label: 'Distribution Channels' },
      { id: 'auto-update-strategy', label: 'Auto Update Strategy' }
    ]
  },
  {
    title: 'Hardware Dependencies',
    entries: [
      { id: 'peripheral-support', label: 'Peripheral Support' }
    ]
  },
  {
    title: 'Desktop Support',
    entries: [
      { id: 'it-policies', label: 'IT Policies & Constraints' }
    ]
  }
];

function deriveProjectType(modules, techStack) {
  const types = new Set((modules || []).map(module => String(module.type || '').toLowerCase()));
  const frameworks = new Set((techStack?.frameworks || []).map(fw => fw.toLowerCase()));

  if (types.has('mobile') || frameworks.has('react-native') || frameworks.has('expo')) return 'Mobile App';
  if (types.has('desktop') || frameworks.has('electron')) return 'Desktop Software';
  if (types.has('frontend') || frameworks.has('react') || frameworks.has('vue') || frameworks.has('angular')) return 'Web Application';
  if (types.has('api') || frameworks.has('express') || frameworks.has('fastify') || frameworks.has('koa') || frameworks.has('nest')) return 'API Service';
  if (types.has('data-pipeline')) return 'Data Platform';
  return 'Operational Toolkit';
}

function deriveProjectPatterns(modules, techStack) {
  const patterns = new Set();
  const types = new Set((modules || []).map(module => String(module.type || '').toLowerCase()));
  const dependencies = (techStack?.dependencies || []).map(dep => dep.toLowerCase());
  const devDependencies = (techStack?.devDependencies || []).map(dep => dep.toLowerCase());
  const frameworks = (techStack?.frameworks || []).map(dep => dep.toLowerCase());
  const combined = new Set([...dependencies, ...devDependencies, ...frameworks]);

  if (types.has('frontend')) patterns.add('frontend-heavy');
  if (types.has('api')) patterns.add('api-service');
  if (combined.has('docker') || combined.has('kubernetes') || combined.has('helm')) patterns.add('containerized');
  if (combined.has('lambda') || combined.has('serverless')) patterns.add('serverless');
  if (combined.has('electron')) patterns.add('desktop-app');
  return Array.from(patterns);
}

function buildSpecSnapshotPayload({ projectName, projectType, responseMap, modulesResult, tickets, techStack }) {
  const frameworks = techStack?.frameworks || [];
  const primaryFramework = responseMap.get('preferred-framework') || frameworks[0] || null;
  const projectGoal = responseMap.get('project-purpose') || 'Operational readiness planning';
  return {
    project: {
      name: projectName || 'Opnix Project',
      type: projectType,
      goal: projectGoal
    },
    technical: {
      language: responseMap.get('primary-language') || null,
      framework: primaryFramework,
      stack: frameworks,
      architecture: {
        dataStores: responseMap.get('data-sources') || null,
        integrations: responseMap.get('integration-consumers') || null,
        testingStrategy: responseMap.get('testing-strategy') || null,
        observability: responseMap.get('observability-tooling') || null
      }
    },
    modules: modulesResult?.modules || [],
    canvas: {
      edges: modulesResult?.edges || [],
      summary: modulesResult?.summary || {}
    },
    features: [],
    tickets: tickets || []
  };
}

function formatRecommendationsMarkdown(recommendations) {
  const lines = ['## Recommendations'];
  if (Array.isArray(recommendations) && recommendations.length) {
    lines.push(...recommendations.map(rec => `- ${rec}`));
  } else {
    lines.push('- Populate additional runbook responses to unlock tailored recommendations.');
  }
  lines.push('');
  return lines.join('\n');
}

function formatTestingQuickWins(quickWins) {
  const lines = ['## Testing Quick Wins'];
  if (Array.isArray(quickWins) && quickWins.length) {
    lines.push(...quickWins.map(item => `- ${item}`));
  } else {
    lines.push('- No immediate testing quick wins detected.');
  }
  lines.push('');
  return lines.join('\n');
}


function toResponseMap(sessionResponses, responsesObject) {
  const map = new Map();
  if (Array.isArray(sessionResponses)) {
    sessionResponses.forEach(entry => {
      if (entry && entry.questionId) {
        map.set(entry.questionId, entry.answer || '');
      }
    });
  }
  if (responsesObject && typeof responsesObject === 'object') {
    Object.entries(responsesObject).forEach(([key, value]) => {
      if (!map.has(key)) {
        map.set(key, value);
      }
    });
  }
  return map;
}

function buildSectionMarkdown(responseMap, section) {
  const lines = [`## ${section.title}`];
  let hasContent = false;

  section.entries.forEach(entry => {
    if (responseMap.has(entry.id)) {
      const value = String(responseMap.get(entry.id) || '').trim();
      if (value) {
        lines.push(`- **${entry.label}:** ${value}`);
        hasContent = true;
      }
    }
  });

  if (!hasContent) {
    lines.push('- [Pending input]');
  }

  lines.push('');
  return lines.join('\n');
}

function buildModuleSummary(modulesResult) {
  const modules = modulesResult?.modules || [];
  if (!modules.length) {
    return '- No modules detected. Run module detection to populate this section.\n\n';
  }

  const items = modules.slice(0, 10).map(module => {
    const dependencies = (module.dependencies || []).join(', ') || 'None';
    const externals = (module.externalDependencies || []).join(', ') || 'None';
    const pathHints = (module.pathHints || []).join(', ') || 'Unknown';
    return `- **${module.name}** (Health ${module.health ?? 'n/a'}%, Coverage ${module.coverage ?? 0}%)\n  - Path: ${pathHints}\n  - Internal Dependencies: ${dependencies}\n  - External: ${externals}`;
  });

  return `${items.join('\n')}\n\n`;
}

function buildTicketSummary(tickets) {
  if (!Array.isArray(tickets) || tickets.length === 0) {
    return '- No open tickets were found.\n\n';
  }
  const openHighPriority = tickets
    .filter(ticket => (ticket.status === 'reported' || ticket.status === 'inProgress') && ticket.priority === 'high')
    .slice(0, 10)
    .map(ticket => `- [${ticket.priority.toUpperCase()}] #${ticket.id} — ${ticket.title}`);

  if (!openHighPriority.length) {
    return '- No high-priority tickets are currently open.\n\n';
  }
  return `${openHighPriority.join('\n')}\n\n`;
}

function buildTechStackSummary(techStack) {
  if (!techStack) return '- No dependency data available.\n\n';
  const dependencies = (techStack.dependencies || []).slice(0, 12);
  const devDependencies = (techStack.devDependencies || []).slice(0, 12);
  const frameworks = techStack.frameworks || [];

  const lines = [];
  lines.push('### Dependencies');
  lines.push(dependencies.length ? dependencies.map(dep => `- ${dep}`).join('\n') : '- None captured');
  lines.push('');
  lines.push('### Dev Dependencies');
  lines.push(devDependencies.length ? devDependencies.map(dep => `- ${dep}`).join('\n') : '- None captured');
  lines.push('');
  lines.push('### Framework Signals');
  lines.push(frameworks.length ? frameworks.map(fw => `- ${fw}`).join('\n') : '- None detected');
  lines.push('');
  return lines.join('\n');
}

function buildContextHistorySection(sessionId, contextHistory = []) {
  if (!Array.isArray(contextHistory) || !contextHistory.length) {
    return '## Session Context History\n\n- No context snapshots recorded.\n\n';
  }

  const relevant = sessionId
    ? contextHistory.filter(entry => entry.sessionId === sessionId)
    : contextHistory;

  if (!relevant.length) {
    return '## Session Context History\n\n- No matching context snapshots found for this session.\n\n';
  }

  const lines = ['## Session Context History', ''];
  relevant.slice(0, 5).forEach(snapshot => {
    const timestamp = snapshot.timestamp || snapshot.lastUpdated || 'unknown';
    const forms = Array.isArray(snapshot.forms) && snapshot.forms.length
      ? snapshot.forms.join(', ')
      : 'none';
    const selected = Array.isArray(snapshot.selectedItems) && snapshot.selectedItems.length
      ? snapshot.selectedItems.join(', ')
      : 'none';
    const filterKeys = snapshot.filters && typeof snapshot.filters === 'object'
      ? Object.keys(snapshot.filters)
      : [];
    const filters = filterKeys.length ? filterKeys.join(', ') : 'none';

    lines.push(`- **${timestamp}:** forms → ${forms}; selected → ${selected}; filters → ${filters}`);
  });

  if (relevant.length > 5) {
    lines.push('- _Additional snapshots available in `data/context-history.json`_.');
  }

  lines.push('');
  return lines.join('\n');
}

async function resolveTemplates(templateIds = []) {
  const ids = Array.isArray(templateIds) && templateIds.length
    ? templateIds
    : runbookTemplates.defaultTemplates();
  return runbookTemplates.loadTemplatesById(ids);
}

async function generateRunbook({
  projectName,
  session,
  responses,
  modulesResult,
  tickets,
  techStack,
  exportsDir,
  templates = [],
  contextHistory = []
}) {
  const responseMap = toResponseMap(session?.responses, responses);

  const projectType = deriveProjectType(modulesResult?.modules, techStack);
  const projectPatterns = deriveProjectPatterns(modulesResult?.modules, techStack);
  const projectData = {
    name: projectName || 'Opnix Project',
    type: projectType,
    patterns: projectPatterns
  };
  const moduleDataForArtifacts = {
    modules: modulesResult?.modules || [],
    summary: modulesResult?.summary || {},
    edges: modulesResult?.edges || []
  };

  let recommendations = [];
  let quickWins = [];
  try {
    recommendations = artifactGenerator.generateProjectRecommendations(projectData, moduleDataForArtifacts, responseMap);
  } catch (error) {
    console.error('Runbook recommendation generation failed:', error);
  }
  try {
    quickWins = artifactGenerator.identifyTestingQuickWins(moduleDataForArtifacts);
  } catch (error) {
    console.error('Runbook testing quick wins generation failed:', error);
  }

  const specSnapshotPayload = buildSpecSnapshotPayload({
    projectName,
    projectType,
    responseMap,
    modulesResult,
    tickets,
    techStack
  });

  let specMarkdown = '';
  try {
    specMarkdown = buildSpecKitMarkdown(specSnapshotPayload).trim();
  } catch (error) {
    console.error('Runbook spec snapshot generation failed:', error);
    specMarkdown = 'Specification snapshot unavailable. Ensure spec generator configuration is valid.';
  }

  const now = new Date();
  const title = projectName ? `${projectName} Operational Runbook` : 'Operational Runbook';
  const header = `# ${title}

`;

  const metadata = [
    `- Generated: ${now.toISOString()}`,
    `- Session: ${session?.sessionId || 'manual-runbook'}`,
    `- Command: ${session?.command || 'UI generate runbook'}`,
    `- Category: ${session?.category || 'runbook'}`,
    ''
  ].join('\n');

  const sections = RUNBOOK_SECTION_DEFINITIONS
    .map(section => buildSectionMarkdown(responseMap, section))
    .join('');

  const moduleSummary = buildModuleSummary(modulesResult);
  const ticketSummary = buildTicketSummary(tickets);
  const techStackSummary = buildTechStackSummary(techStack);
  const memoisedTemplates = await resolveTemplates(templates);
  const templateSegments = memoisedTemplates.map(template => {
    const heading = `## ${template.name}`;
    const descriptionLine = template.description ? `> ${template.description}\n\n` : '';
    const content = template.content ? `${template.content}\n\n` : '';
    return `${heading}\n\n${descriptionLine}${content}`;
  });

  const contextSection = buildContextHistorySection(session?.sessionId, contextHistory);

  const bodySegments = [
    '## Module Summary',
    moduleSummary,
    '## High Priority Tickets',
    ticketSummary,
    '## Tech Stack Snapshot',
    techStackSummary,
    formatRecommendationsMarkdown(recommendations),
    formatTestingQuickWins(quickWins),
    '## Specification Snapshot',
    specMarkdown ? `${specMarkdown}` + '\n' : '- Specification snapshot currently unavailable.\n',
    contextSection,
    sections,
    ...templateSegments
  ];

  const body = bodySegments.join('\n');

  const content = `${header}${metadata}${body}`;

  await fs.mkdir(exportsDir, { recursive: true });
  const filename = `runbook-${now.toISOString().replace(/[:.]/g, '-')}.md`;
  const filePath = path.join(exportsDir, filename);
  await fs.writeFile(filePath, content, 'utf8');

  return {
    type: 'runbook',
    filename,
    path: filePath,
    relativePath: filename,
    format: 'markdown'
  };
}

module.exports = {
  generateRunbook
};
