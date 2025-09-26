const path = require('path');
const fs = require('fs').promises;

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
      { id: 'incident-response', label: 'Incident Response' }
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

async function generateRunbook({
  projectName,
  session,
  responses,
  modulesResult,
  tickets,
  techStack,
  exportsDir
}) {
  const responseMap = toResponseMap(session?.responses, responses);

  const now = new Date();
  const title = projectName ? `${projectName} Operational Runbook` : 'Operational Runbook';
  const header = `# ${title}\n\n`;

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

  const body = [
    '## Module Summary',
    moduleSummary,
    '## High Priority Tickets',
    ticketSummary,
    '## Tech Stack Snapshot',
    techStackSummary,
    sections
  ].join('\n');

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
