const fs = require('fs').promises;
const path = require('path');
const crypto = require('crypto');

const DEFAULT_FILE = path.join(__dirname, '..', 'data', 'pre-implementation-discussions.json');
const STATUSES = {
  PENDING: 'pending',
  COMPLETED: 'completed',
  ARCHIVED: 'archived'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normaliseArray(values) {
  if (!values) return [];
  if (Array.isArray(values)) return values.filter(Boolean);
  return [values].filter(Boolean);
}

function normaliseParticipants(participants = []) {
  return normaliseArray(participants).map(participant => {
    if (typeof participant === 'string') {
      return {
        name: participant,
        role: null
      };
    }
    if (participant && typeof participant === 'object') {
      return {
        name: participant.name || participant.id || participant.handle || null,
        role: participant.role || participant.title || null
      };
    }
    return null;
  }).filter(item => item && item.name);
}

function normaliseDecisionEntries(entries = []) {
  return normaliseArray(entries).map(entry => {
    if (typeof entry === 'string') {
      return {
        decision: entry,
        rationale: null
      };
    }
    if (entry && typeof entry === 'object') {
      return {
        decision: entry.decision || entry.summary || entry.title || '',
        rationale: entry.rationale || entry.reason || null
      };
    }
    return null;
  }).filter(item => item && item.decision);
}

function normaliseRisks(risks = []) {
  return normaliseArray(risks).map(risk => {
    if (typeof risk === 'string') {
      return {
        risk,
        mitigation: null
      };
    }
    if (risk && typeof risk === 'object') {
      return {
        risk: risk.risk || risk.summary || '',
        mitigation: risk.mitigation || risk.plan || null
      };
    }
    return null;
  }).filter(item => item && item.risk);
}

function createPreImplementationDiscussionManager({
  filePath = DEFAULT_FILE,
  logger = console,
  approvalGatesManager = null
} = {}) {
  if (!filePath) {
    throw new Error('preImplementationDiscussionManager requires a filePath');
  }

  async function ensureStore() {
    try {
      await fs.access(filePath);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initial = { version: 1, discussions: [] };
        await fs.mkdir(path.dirname(filePath), { recursive: true });
        await fs.writeFile(filePath, JSON.stringify(initial, null, 2));
      } else {
        throw error;
      }
    }
  }

  async function readStore() {
    await ensureStore();
    const raw = await fs.readFile(filePath, 'utf8');
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { version: 1, discussions: parsed };
      }
      if (parsed && Array.isArray(parsed.discussions)) {
        return parsed;
      }
      return { version: 1, discussions: [] };
    } catch (error) {
      logger.warn?.(`preImplementationDiscussionManager: failed to parse store, resetting: ${error.message}`);
      return { version: 1, discussions: [] };
    }
  }

  async function writeStore(store) {
    const payload = {
      version: store.version || 1,
      discussions: Array.isArray(store.discussions) ? store.discussions : []
    };
    await fs.writeFile(filePath, JSON.stringify(payload, null, 2));
    return payload;
  }

  function buildDiscussionEntry({
    sessionId = null,
    planArtifactRelativePath = null,
    tasks = [],
    createdTicketIds = [],
    createdBy = 'system',
    planSummary = null,
    checkpointId = null
  } = {}) {
    const now = new Date().toISOString();
    const taskSummaries = Array.isArray(tasks) ? tasks.map(task => ({
      ticketId: task.ticketId ?? null,
      title: task.title ?? null,
      priority: task.priority ?? null
    })) : [];

    return {
      id: crypto.randomUUID(),
      status: STATUSES.PENDING,
      sessionId,
      planArtifact: planArtifactRelativePath,
      createdTicketIds: Array.isArray(createdTicketIds) ? createdTicketIds : [],
      taskCount: taskSummaries.length,
      tasks: taskSummaries,
      createdBy,
      summary: planSummary,
      decisions: [],
      risks: [],
      actionItems: [],
      participants: [],
      notes: null,
      checkpointId,
      createdAt: now,
      updatedAt: now,
      completedAt: null
    };
  }

  async function ensureDiscussion({
    sessionId = null,
    planArtifactRelativePath = null,
    tasks = [],
    createdTicketIds = [],
    createdBy = 'system',
    planSummary = null,
    checkpointId = null
  } = {}) {
    const store = await readStore();
    const discussions = store.discussions || [];

    const existing = discussions.find(entry => {
      if (planArtifactRelativePath && entry.planArtifact === planArtifactRelativePath) {
        return entry.status !== STATUSES.ARCHIVED;
      }
      if (!planArtifactRelativePath && sessionId && entry.sessionId === sessionId) {
        return entry.status !== STATUSES.ARCHIVED;
      }
      return false;
    });

    if (existing) {
      return { created: false, discussion: existing };
    }

    const discussion = buildDiscussionEntry({
      sessionId,
      planArtifactRelativePath,
      tasks,
      createdTicketIds,
      createdBy,
      planSummary,
      checkpointId
    });

    discussions.push(discussion);
    store.discussions = discussions;
    await writeStore(store);

    if (approvalGatesManager && typeof approvalGatesManager.getApproval === 'function' && typeof approvalGatesManager.resetGate === 'function') {
      try {
        const gate = await approvalGatesManager.getApproval('pre-implementation-discussion');
        if (gate?.status === 'approved') {
          await approvalGatesManager.resetGate('pre-implementation-discussion', { notes: 'New implementation discussion required before coding begins.' });
        }
      } catch (error) {
        logger.warn?.(`preImplementationDiscussionManager: unable to sync approval gate state: ${error.message}`);
      }
    }

    return { created: true, discussion };
  }

  async function listDiscussions({ status = null } = {}) {
    const store = await readStore();
    const discussions = Array.isArray(store.discussions) ? [...store.discussions] : [];
    const filtered = status
      ? discussions.filter(entry => entry.status === status)
      : discussions.filter(entry => entry.status !== STATUSES.ARCHIVED);

    return filtered.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async function getDiscussion(id) {
    if (!id) return null;
    const store = await readStore();
    return (store.discussions || []).find(entry => entry.id === id) || null;
  }

  async function updateDiscussion(id, updater) {
    if (!id) {
      throw new Error('Discussion id is required');
    }
    const store = await readStore();
    const discussions = store.discussions || [];
    const index = discussions.findIndex(entry => entry.id === id);
    if (index === -1) {
      throw new Error(`Discussion ${id} not found`);
    }

    const original = discussions[index];
    const updated = updater(clone(original));
    updated.updatedAt = new Date().toISOString();
    discussions[index] = updated;
    store.discussions = discussions;
    await writeStore(store);
    return updated;
  }

  async function completeDiscussion({
    id,
    summary,
    decisions = [],
    risks = [],
    actionItems = [],
    notes = null,
    participants = [],
    recordedBy = null,
    autoApprove = false
  } = {}) {
    if (!id) {
      throw new Error('Discussion id is required to complete a discussion');
    }

    const updated = await updateDiscussion(id, entry => {
      entry.summary = summary || entry.summary || null;
      entry.decisions = normaliseDecisionEntries(decisions);
      entry.risks = normaliseRisks(risks);
      entry.actionItems = normaliseArray(actionItems).map(item => {
        if (typeof item === 'string') {
          return { action: item, owner: null, due: null };
        }
        if (item && typeof item === 'object') {
          return {
            action: item.action || item.summary || '',
            owner: item.owner || item.assignee || null,
            due: item.due || item.dueDate || null
          };
        }
        return null;
      }).filter(item => item && item.action);
      entry.notes = notes || entry.notes || null;
      entry.participants = normaliseParticipants(participants);
      entry.recordedBy = recordedBy || entry.recordedBy || null;
      entry.status = STATUSES.COMPLETED;
      entry.completedAt = new Date().toISOString();
      return entry;
    });

    if (autoApprove && approvalGatesManager && typeof approvalGatesManager.approveGate === 'function') {
      try {
        await approvalGatesManager.approveGate('pre-implementation-discussion', {
          approvedBy: recordedBy || 'unknown',
          role: 'reviewer',
          notes: notes || 'Pre-implementation discussion recorded.'
        });
      } catch (error) {
        logger.warn?.(`preImplementationDiscussionManager: auto approval skipped: ${error.message}`);
      }
    }

    return updated;
  }

  async function resetDiscussion(id, options = {}) {
    if (!id) {
      throw new Error('Discussion id is required to reset a discussion');
    }

    const updated = await updateDiscussion(id, entry => {
      entry.status = STATUSES.PENDING;
      entry.summary = options.keepSummary ? entry.summary : null;
      if (!options.keepSummary) {
        entry.decisions = [];
        entry.risks = [];
        entry.actionItems = [];
        entry.notes = null;
      }
      entry.completedAt = null;
      return entry;
    });

    if (approvalGatesManager && typeof approvalGatesManager.resetGate === 'function') {
      try {
        await approvalGatesManager.resetGate('pre-implementation-discussion', { notes: options.notes || 'Discussion reset' });
      } catch (error) {
        logger.warn?.(`preImplementationDiscussionManager: gate reset warning: ${error.message}`);
      }
    }

    return updated;
  }

  async function hasCompletedDiscussion() {
    const discussions = await listDiscussions();
    return discussions.some(entry => entry.status === STATUSES.COMPLETED);
  }

  async function archiveDiscussion(id) {
    if (!id) {
      throw new Error('Discussion id is required to archive a discussion');
    }

    return updateDiscussion(id, entry => {
      entry.status = STATUSES.ARCHIVED;
      return entry;
    });
  }

  return {
    ensureDiscussion,
    listDiscussions,
    getDiscussion,
    completeDiscussion,
    resetDiscussion,
    hasCompletedDiscussion,
    archiveDiscussion,
    STATUSES
  };
}

module.exports = {
  createPreImplementationDiscussionManager
};
