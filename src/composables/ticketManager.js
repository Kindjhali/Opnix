import {
  activateAgent as activateAgentApi,
  createTicket as createTicketApi,
  updateTicket as updateTicketApi,
  exportMarkdown as exportMarkdownApi
} from '../services/apiClient.js';

import { downloadMarkdownFile } from './markdownUtils.js';
import { queueRoadmapRefreshFlow } from './roadmapManager.js';

function normalizeTagInput(raw) {
  if (!raw) return [];
  return raw
    .split(/[\n,]/)
    .map(token => token.trim())
    .filter(Boolean)
    .map(token => token.replace(/\s+/g, '_').toUpperCase());
}

export async function analyzeWithPythonAgentFlow() {
  const highPriorityBugs = (this.tickets || []).filter(ticket => ticket && ticket.priority === 'high' && ticket.status !== 'finished');
  const pythonModules = (this.modules || []).filter(module => {
    const identifier = `${module?.name || ''} ${module?.id || ''}`;
    const nameMatches = /python/i.test(identifier);
    const deps = (module?.externalDependencies || []).some(dep => /python|py\b/i.test(dep));
    return nameMatches || deps;
  });
  const pythonModuleIds = new Set(pythonModules.map(module => module.id));
  const pythonRelatedBugs = (this.tickets || []).filter(ticket => Array.isArray(ticket?.modules) && ticket.modules.some(moduleId => pythonModuleIds.has(moduleId)));

  this.addTask('Python Agent', 'Activating Python diagnostic agent', 'processing');
  try {
    const payload = await activateAgentApi('python-pro');
    if (!payload?.success) {
      throw new Error(payload?.error || 'Agent activation failed');
    }
    this.addTask('Python Agent', payload.message || 'Python agent activated', 'complete');
    await this.fetchAgents();
  } catch (error) {
    console.error('Python agent analysis failed', error);
    this.addTask('Python Agent', error.message || 'Python agent activation failed', 'complete');
    return;
  }

  const summaries = [];
  if (highPriorityBugs.length) {
    summaries.push(`${highPriorityBugs.length} high-priority bug${highPriorityBugs.length === 1 ? '' : 's'} still open`);
  } else {
    summaries.push('No high-priority bugs open');
  }
  if (pythonModules.length) {
    summaries.push(`${pythonModules.length} module${pythonModules.length === 1 ? '' : 's'} with Python signals`);
  }
  if (pythonRelatedBugs.length) {
    const bugList = pythonRelatedBugs
      .slice(0, 3)
      .map(ticket => `#${ticket.id} ${ticket.title}`)
      .join(', ');
    summaries.push(`Python-linked bugs: ${pythonRelatedBugs.length}${bugList ? ` (${bugList}${pythonRelatedBugs.length > 3 ? ', ...' : ''})` : ''}`);
  }
  this.addTask('Python Agent', summaries.join(' | '), 'complete');
}

export async function addBugFlow() {
  if (!this.newBug.title.trim()) return;
  try {
    const tags = normalizeTagInput(this.newBug.tagsText);
    const payload = await createTicketApi({
      title: this.newBug.title,
      description: this.newBug.description,
      priority: this.newBug.priority,
      status: 'reported',
      modules: this.newBug.modules,
      tags
    });
    this.tickets.push(payload);
    this.showBugModal = false;
    this.newBug = { title: '', description: '', priority: 'medium', modules: [], tagsText: '' };
    this.addTask('Bug Tracker', `Ticket #${payload.id} recorded`, 'complete');
    queueRoadmapRefreshFlow.call(this, { delay: 500 });
  } catch (error) {
    console.error('Create bug failed', error);
  }
}

export async function onTicketStatusChangeFlow(ticket, event) {
  const nextStatus = event.target.value;
  if (!nextStatus || nextStatus === ticket.status) {
    event.target.value = ticket.status;
    return;
  }

  if (nextStatus === 'finished') {
    this.ticketBeingUpdated = ticket;
    this.ticketStatusElement = event.target;
    this.ticketCompletionSummary = ticket.completionSummary || '';
    this.ticketCompletionError = '';
    this.showTicketCompletionModal = true;
    return;
  }

  try {
    await persistTicketUpdateFlow.call(this, ticket, { status: nextStatus }, event.target);
  } catch {
    // handled in persistTicketUpdateFlow
  }
}

export async function persistTicketUpdateFlow(ticket, payload, selectEl) {
  try {
    const updated = await updateTicketApi(ticket.id, payload);
    const index = this.tickets.findIndex(item => item.id === updated.id);
    if (index !== -1) {
      this.tickets.splice(index, 1, updated);
    }
    await this.fetchStats();
    this.addTask('Bug Tracker', `Ticket #${updated.id} updated`, 'complete');
    queueRoadmapRefreshFlow.call(this, { delay: 400 });
    return updated;
  } catch (error) {
    console.error('Persist ticket update failed', error);
    if (selectEl) {
      selectEl.value = ticket.status;
    }
    throw error;
  }
}

export function cancelTicketCompletionFlow() {
  if (this.ticketStatusElement && this.ticketBeingUpdated) {
    this.ticketStatusElement.value = this.ticketBeingUpdated.status;
  }
  this.showTicketCompletionModal = false;
  this.ticketBeingUpdated = null;
  this.ticketStatusElement = null;
  this.ticketCompletionSummary = '';
  this.ticketCompletionError = '';
}

export async function confirmTicketCompletionFlow() {
  if (!this.ticketBeingUpdated) {
    this.showTicketCompletionModal = false;
    return;
  }

  if (!this.ticketCompletionSummary || !this.ticketCompletionSummary.trim()) {
    this.ticketCompletionError = 'Completion summary is required.';
    return;
  }

  try {
    await persistTicketUpdateFlow.call(this, this.ticketBeingUpdated, {
      status: 'finished',
      completionSummary: this.ticketCompletionSummary.trim()
    }, this.ticketStatusElement);
    this.showTicketCompletionModal = false;
    this.ticketCompletionSummary = '';
    this.ticketCompletionError = '';
    this.ticketBeingUpdated = null;
    this.ticketStatusElement = null;
  } catch (error) {
    console.error('Ticket update failed', error);
    this.ticketCompletionError = 'Unable to update ticket. Check console for details.';
  }
}

export async function exportBugsFlow() {
  try {
    const content = await exportMarkdownApi();
    downloadMarkdownFile('opnix-tickets.md', content);
  } catch (error) {
    console.error('Export bugs failed', error);
  }
}

const STATUS_MAP = {
  reported: 'Reported',
  inProgress: 'In Progress',
  finished: 'Finished'
};

export function normaliseTicketStatusValue(status, { fallback } = {}) {
  if (status === null || status === undefined) return fallback ?? null;
  const trimmed = String(status).trim();
  if (!trimmed) return fallback ?? null;
  const condensed = trimmed.replace(/[\s_-]/g, '').toLowerCase();
  if (condensed === 'reported' || condensed === 'open') return 'reported';
  if (condensed === 'inprogress') return 'inProgress';
  if (condensed === 'finished' || condensed === 'resolved' || condensed === 'complete') return 'finished';
  return fallback ?? trimmed;
}

export function getTicketStatusLabel(status) {
  const normalised = normaliseTicketStatusValue(status, { fallback: 'reported' });
  return STATUS_MAP[normalised] || STATUS_MAP.reported;
}

export function formatTicketDate(value) {
  try {
    const date = value instanceof Date ? value : new Date(value);
    if (Number.isNaN(date.getTime())) {
      return 'Unknown date';
    }
    return date.toLocaleDateString();
  } catch (error) {
    console.error('Ticket date format error', error);
    return 'Unknown date';
  }
}
