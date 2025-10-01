const path = require('path');
const fs = require('fs').promises;

function ensureArray(value) {
  if (!value) return [];
  return Array.isArray(value) ? value : [value];
}

function formatList(items) {
  if (!items || items.length === 0) {
    return ['_None recorded._'];
  }
  return items.map(item => `- ${item}`);
}

function createCliStagedFlow({
  auditManager,
  cliInterviewManager,
  ensureArtifactsDirectory,
  readData,
  normaliseTicketStatus,
  statusConstants,
  rootDir
}) {
  if (!auditManager || typeof auditManager.runInitialAudit !== 'function') {
    throw new Error('createCliStagedFlow requires an auditManager with runInitialAudit');
  }
  if (!cliInterviewManager || !cliInterviewManager.CLI_ARTIFACTS_DIR) {
    throw new Error('createCliStagedFlow requires cliInterviewManager with CLI_ARTIFACTS_DIR');
  }
  if (typeof readData !== 'function') {
    throw new Error('createCliStagedFlow requires a readData function');
  }
  if (typeof normaliseTicketStatus !== 'function') {
    throw new Error('createCliStagedFlow requires normaliseTicketStatus');
  }

  const {
    statusReported,
    statusInProgress,
    statusFinished,
    priorityHigh,
    priorityMedium,
    priorityLow
  } = statusConstants || {};

  if (!statusReported || !statusInProgress || !statusFinished) {
    throw new Error('createCliStagedFlow requires ticket status constants');
  }

  const artifactsDir = cliInterviewManager.CLI_ARTIFACTS_DIR;

  async function ensureDir() {
    if (typeof ensureArtifactsDirectory === 'function') {
      await ensureArtifactsDirectory();
    } else {
      await fs.mkdir(artifactsDir, { recursive: true });
    }
  }

  function relativePath(filePath) {
    return path.relative(rootDir, filePath);
  }

  async function writeMarkdown(prefix, title, sections) {
    await ensureDir();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.md`;
    const filePath = path.join(artifactsDir, filename);

    const lines = [`# ${title}`, ''];

    sections.forEach(section => {
      if (!section) {
        return;
      }
      const { heading, body } = section;
      if (heading) {
        lines.push(`## ${heading}`);
      }
      const content = Array.isArray(body) ? body : ensureArray(body);
      lines.push(...content, '');
    });

    await fs.writeFile(filePath, lines.join('\n'));
    return {
      type: prefix,
      path: filePath,
      filename,
      relativePath: relativePath(filePath)
    };
  }

  function summariseModules(modules = []) {
    const unhealthy = [];
    const lowCoverage = [];

    modules.forEach(module => {
      if (typeof module.health === 'number' && module.health < 60) {
        unhealthy.push(`${module.name} (${module.health}%)`);
      }
      if (typeof module.coverage === 'number' && module.coverage < 50) {
        lowCoverage.push(`${module.name} (${module.coverage}%)`);
      }
    });

    return {
      unhealthy,
      lowCoverage
    };
  }

  function summariseTickets(tickets = []) {
    const buckets = {
      [priorityHigh || 'high']: [],
      [priorityMedium || 'medium']: [],
      [priorityLow || 'low']: [],
      other: []
    };

    tickets.forEach(ticket => {
      const normalisedStatus = normaliseTicketStatus(ticket.status, { fallback: statusReported }) || statusReported;
      if (normalisedStatus === statusFinished) {
        return;
      }
      const priority = String(ticket.priority || '').toLowerCase();
      const entry = `[#${ticket.id}] ${ticket.title}${ticket.modules && ticket.modules.length ? ` — Modules: ${ticket.modules.join(', ')}` : ''}`;
      if (priority === 'high' || priority === priorityHigh) {
        buckets[priorityHigh || 'high'].push(entry);
      } else if (priority === 'medium' || priority === priorityMedium) {
        buckets[priorityMedium || 'medium'].push(entry);
      } else if (priority === 'low' || priority === priorityLow) {
        buckets[priorityLow || 'low'].push(entry);
      } else {
        buckets.other.push(entry);
      }
    });

    return buckets;
  }

  async function generatePlanStage() {
    const audit = await auditManager.runInitialAudit();
    const followUps = audit.followUps || [];
    const followUpTickets = Array.isArray(audit.followUpTicketsCreated)
      ? audit.followUpTicketsCreated
      : [];
    const featureNeedingCriteria = audit.featuresNeedingCriteria || [];
    const moduleSummary = summariseModules(audit.modules);
    const exportsList = Array.isArray(audit.exports) ? audit.exports : [];

    const sections = [
      {
        heading: 'Project Overview',
        body: [
          `- Name: ${audit.project?.name || 'Opnix Project'}`,
          `- Type: ${audit.project?.type || 'N/A'}`,
          `- Goal: ${audit.project?.goal || 'Not specified'}`,
          `- Audit Message: ${audit.message || 'Audit completed.'}`
        ]
      },
      {
        heading: 'Follow-up Recommendations',
        body: formatList(followUps)
      },
      {
        heading: 'Modules Requiring Attention',
        body: [
          '**Unhealthy Modules**',
          ...formatList(moduleSummary.unhealthy),
          '',
          '**Low Coverage Modules**',
          ...formatList(moduleSummary.lowCoverage)
        ]
      },
      {
        heading: 'Features Requiring Acceptance Criteria',
        body: formatList(featureNeedingCriteria.map(feature => `${feature.id}: ${feature.title}`))
      },
      {
        heading: 'Generated Exports',
        body: formatList(exportsList.map(meta => meta.relativePath || meta.path || '(unknown export)'))
      }
    ];

    const artifact = await writeMarkdown('cli-plan', 'Delivery Plan', sections);
    const messages = [
      'Delivery plan compiled from latest audit.',
      `${followUps.length} follow-up recommendation${followUps.length === 1 ? '' : 's'} recorded.`,
      `Plan saved to ${artifact.relativePath}`
    ];

    const planMetadata = {
      followUpsCount: followUps.length,
      featureGaps: featureNeedingCriteria.length,
      exportsCount: exportsList.length,
      followUps,
      followUpTickets,
      featureNeedingCriteria,
      projectName: audit.project?.name || 'Opnix Project',
      unhealthyModules: audit.unhealthyModules || [],
      moduleCoverageAlerts: moduleSummary,
      exports: exportsList.map(meta => ({
        path: meta.path,
        relativePath: meta.relativePath || null,
        category: meta.category || meta.format || null
      }))
    };

    return {
      result: 'Delivery plan ready',
      messages,
      artifacts: [artifact],
      metadata: planMetadata
    };
  }

  async function generateTasksStage() {
    const [audit, data] = await Promise.all([
      auditManager.runInitialAudit(),
      readData()
    ]);

    const tickets = Array.isArray(data?.tickets) ? data.tickets : [];
    const ticketBuckets = summariseTickets(tickets);
    const followUpTickets = audit.followUpTicketsCreated || [];

    const highCount = ticketBuckets[priorityHigh || 'high'].length;
    const mediumCount = ticketBuckets[priorityMedium || 'medium'].length;
    const lowCount = ticketBuckets[priorityLow || 'low'].length;

    const sections = [
      {
        heading: 'New Follow-up Tickets',
        body: formatList(followUpTickets.map(ticket => `[#${ticket.id}] ${ticket.title}`))
      },
      {
        heading: 'High Priority Work',
        body: formatList(ticketBuckets[priorityHigh || 'high'])
      },
      {
        heading: 'Medium Priority Work',
        body: formatList(ticketBuckets[priorityMedium || 'medium'])
      },
      {
        heading: 'Low Priority Work',
        body: formatList(ticketBuckets[priorityLow || 'low'])
      },
      {
        heading: 'Other Tasks',
        body: formatList(ticketBuckets.other)
      }
    ];

    const artifact = await writeMarkdown('cli-tasks', 'Task Queue Summary', sections);
    const totalOpen = highCount + mediumCount + lowCount + ticketBuckets.other.length;

    const messages = [
      `Task queue summarised. ${totalOpen} open ticket${totalOpen === 1 ? '' : 's'} remain.`,
      `High priority: ${highCount}, Medium: ${mediumCount}, Low: ${lowCount}.`,
      `Summary saved to ${artifact.relativePath}`
    ];

    if (followUpTickets.length) {
      messages.push(`${followUpTickets.length} follow-up ticket${followUpTickets.length === 1 ? '' : 's'} created during audit.`);
    }

    return {
      result: 'Task summary ready',
      messages,
      artifacts: [artifact],
      metadata: {
        openTickets: totalOpen,
        followUpTickets: followUpTickets.length,
        highCount,
        mediumCount,
        lowCount
      }
    };
  }

  return {
    generatePlanStage,
    generateTasksStage
  };
}

module.exports = {
  createCliStagedFlow
};
