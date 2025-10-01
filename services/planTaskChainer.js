const path = require('path');
const fs = require('fs').promises;

function createPlanTaskChainer({
  readData,
  writeData,
  scaffoldRoot,
  rootDir,
  statusConstants = {},
  logger = console
}) {
  if (typeof readData !== 'function') {
    throw new Error('planTaskChainer requires a readData function');
  }
  if (typeof writeData !== 'function') {
    throw new Error('planTaskChainer requires a writeData function');
  }
  if (!scaffoldRoot) {
    throw new Error('planTaskChainer requires a scaffoldRoot directory');
  }
  if (!rootDir) {
    throw new Error('planTaskChainer requires rootDir for relative paths');
  }

  const {
    statusReported = 'reported',
    priorityMedium = 'medium'
  } = statusConstants;

  const tasksRoot = path.join(scaffoldRoot, 'tasks');

  async function ensureTasksDirectory() {
    await fs.mkdir(tasksRoot, { recursive: true });
  }

  function serialiseTicketForTask(ticket) {
    return {
      ticketId: ticket.id,
      title: ticket.title,
      description: ticket.description || '',
      priority: ticket.priority || priorityMedium,
      status: ticket.status || statusReported,
      tags: ticket.tags || [],
      modules: ticket.modules || [],
      source: ticket.source || 'plan-chain'
    };
  }

  function deriveNextId(tickets = []) {
    const ids = tickets
      .map(ticket => Number.parseInt(ticket.id, 10))
      .filter(Number.isFinite);
    if (!ids.length) {
      return 1;
    }
    return Math.max(...ids) + 1;
  }

  function normaliseFollowUps(followUps) {
    if (!Array.isArray(followUps)) {
      return [];
    }
    return followUps
      .map(note => (typeof note === 'string' ? note.trim() : ''))
      .filter(Boolean);
  }

  async function chainPlanToTasks({
    planResult,
    sessionId = null,
    planArtifactRelativePath = null
  } = {}) {
    if (!planResult || typeof planResult !== 'object') {
      return { tasks: [], createdTickets: [], scaffold: null };
    }
    const metadata = planResult.metadata || {};
    const followUps = normaliseFollowUps(metadata.followUps);
    const followUpTicketSummaries = Array.isArray(metadata.followUpTickets)
      ? metadata.followUpTickets
      : [];

    if (!followUps.length && !followUpTicketSummaries.length) {
      return { tasks: [], createdTickets: [], scaffold: null };
    }

    const data = await readData();
    const tickets = Array.isArray(data?.tickets) ? [...data.tickets] : [];
    let nextId = Number.isFinite(data?.nextId) ? data.nextId : deriveNextId(tickets);
    const ticketByTitle = new Map();
    tickets.forEach(ticket => {
      if (ticket.title) {
        ticketByTitle.set(ticket.title, ticket);
      }
    });

    const createdTickets = [];
    const tasks = [];
    const now = new Date().toISOString();

    for (const note of followUps) {
      let ticket = ticketByTitle.get(note);
      if (!ticket) {
        ticket = {
          id: nextId++,
          title: note,
          description: 'Generated from delivery plan. Review plan artefacts for context.',
          priority: priorityMedium,
          status: statusReported,
          tags: ['PLAN_CHAIN', 'FOLLOW_UP'],
          source: 'plan-chain',
          created: now,
          modules: []
        };
        tickets.push(ticket);
        ticketByTitle.set(note, ticket);
        createdTickets.push(ticket);
      }
      tasks.push(serialiseTicketForTask(ticket));
    }

    followUpTicketSummaries.forEach(summary => {
      if (!summary || summary.id == null) {
        return;
      }
      const existing = tasks.find(task => String(task.ticketId) === String(summary.id));
      if (existing) {
        return;
      }
      const ticket = tickets.find(item => String(item.id) === String(summary.id));
      if (ticket) {
        tasks.push(serialiseTicketForTask(ticket));
      } else {
        tasks.push({
          ticketId: summary.id,
          title: summary.title || `Follow-up ${summary.id}`,
          description: 'Ticket referenced in audit follow-ups but not yet present in ticket store.',
          priority: priorityMedium,
          status: statusReported,
          tags: ['PLAN_CHAIN', 'FOLLOW_UP'],
          source: 'plan-chain'
        });
      }
    });

    if (createdTickets.length) {
      const payload = {
        ...data,
        tickets,
        nextId
      };
      try {
        await writeData(payload);
      } catch (error) {
        logger.error?.('planTaskChainer: failed to persist new tickets', error);
        throw error;
      }
    }

    if (!tasks.length) {
      return { tasks: [], createdTickets, scaffold: null };
    }

    await ensureTasksDirectory();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filePath = path.join(tasksRoot, `plan-tasks-${timestamp}.json`);
    const payload = {
      generatedAt: new Date().toISOString(),
      sessionId,
      planArtifact: planArtifactRelativePath,
      projectName: metadata.projectName || null,
      totalTasks: tasks.length,
      createdTicketIds: createdTickets.map(ticket => ticket.id),
      tasks
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));

    return {
      tasks,
      createdTickets,
      scaffold: {
        path: filePath,
        relativePath: path.relative(rootDir, filePath)
      }
    };
  }

  return {
    chainPlanToTasks
  };
}

module.exports = {
  createPlanTaskChainer
};
