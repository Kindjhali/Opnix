import {
  fetchRoadmapState as fetchRoadmapStateApi,
  fetchRoadmapVersions as fetchRoadmapVersionsApi,
  generateRoadmap as generateRoadmapApi,
  exportRoadmap as exportRoadmapApi,
  rollbackRoadmap as rollbackRoadmapApi,
  updateRoadmapMilestone as updateRoadmapMilestoneApi
} from '../services/apiClient.js';

import { useAppStore } from './appStore.js';

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

const DEFAULT_SUMMARY = {
  source: 'manual',
  reason: '',
  ticketCount: 0,
  moduleCount: 0,
  featureCount: 0,
  statusBreakdown: {},
  featureStatusBreakdown: {},
  generatedAt: null
};

function normaliseSummary(raw) {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_SUMMARY };
  }
  const summary = { ...DEFAULT_SUMMARY, ...raw };
  summary.statusBreakdown = summary.statusBreakdown && typeof summary.statusBreakdown === 'object'
    ? summary.statusBreakdown
    : {};
  summary.featureStatusBreakdown = summary.featureStatusBreakdown && typeof summary.featureStatusBreakdown === 'object'
    ? summary.featureStatusBreakdown
    : {};
  return summary;
}

function normaliseMilestones(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map(item => ({
    id: item.id,
    name: item.name || 'Roadmap Milestone',
    start: item.start,
    end: item.end,
    progress: typeof item.progress === 'number' ? Math.max(0, Math.min(100, Math.round(item.progress))) : 0,
    linkedModule: item.linkedModule || null,
    linkedTickets: Array.isArray(item.linkedTickets) ? item.linkedTickets : [],
    notes: item.notes || ''
  }));
}

function normaliseHistory(raw) {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter(entry => entry && typeof entry === 'object')
    .map(entry => ({
      timestamp: entry.timestamp || entry.generatedAt || new Date().toISOString(),
      reason: entry.reason || 'sync',
      ticketCount: entry.ticketCount ?? 0,
      moduleCount: entry.moduleCount ?? 0,
      featureCount: entry.featureCount ?? 0
    }));
}

function normaliseRoadmapState(raw) {
  const state = raw && typeof raw === 'object' ? raw : {};
  const summary = normaliseSummary(state.summary);
  const milestones = normaliseMilestones(state.milestones);
  const history = normaliseHistory(state.history);
  return {
    milestones,
    summary,
    history,
    lastUpdated: state.lastUpdated || summary.generatedAt || null
  };
}

function scheduleDeferredRefresh(store, delay = 500) {
  if (store.roadmapRefreshHandle) {
    clearTimeout(store.roadmapRefreshHandle);
  }
  store.roadmapRefreshHandle = setTimeout(async () => {
    store.roadmapRefreshHandle = null;
    await fetchRoadmapStateFlow.call(store, { background: true });
    await fetchRoadmapVersionsFlow.call(store, { background: true });
  }, delay);
}

export async function fetchRoadmapStateFlow(options = {}, context) {
  const store = resolveStore(context, this);
  const { background = false } = options;
  if (!background) {
    store.roadmapLoading = true;
    store.roadmapError = '';
  }
  try {
    const response = await fetchRoadmapStateApi();
    if (!response || response.success !== true) {
      throw new Error(response?.error || 'Failed to load roadmap state');
    }
    store.roadmapState = normaliseRoadmapState(response.state);
  } catch (error) {
    console.error('Roadmap state fetch failed', error);
    store.roadmapError = error.message || 'Failed to load roadmap state';
  } finally {
    if (!background) {
      store.roadmapLoading = false;
    }
  }
}

export async function fetchRoadmapVersionsFlow(options = {}, context) {
  const store = resolveStore(context, this);
  const { background = false } = options;
  if (!background) {
    store.roadmapVersionsLoading = true;
    store.roadmapError = '';
  }
  try {
    const response = await fetchRoadmapVersionsApi();
    if (!response || response.success !== true) {
      throw new Error(response?.error || 'Failed to load roadmap versions');
    }
    store.roadmapVersions = Array.isArray(response.versions) ? response.versions : [];
  } catch (error) {
    console.error('Roadmap versions fetch failed', error);
    store.roadmapError = error.message || 'Failed to load roadmap versions';
  } finally {
    if (!background) {
      store.roadmapVersionsLoading = false;
    }
  }
}

export function setRoadmapViewModeFlow(mode = 'minimal', context) {
  const store = resolveStore(context, this);
  const allowed = new Set(['minimal', 'detailed']);
  store.roadmapViewMode = allowed.has(mode) ? mode : 'minimal';
}

function downloadJsonFile(filename, payload) {
  try {
    const safeName = filename || `opnix-roadmap-${Date.now()}.json`;
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = safeName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(link.href);
  } catch (error) {
    console.error('Roadmap download failed', error);
  }
}

export async function generateRoadmapFlow(context) {
  const store = resolveStore(context, this);
  store.roadmapLoading = true;
  store.roadmapError = '';
  try {
    const payload = await generateRoadmapApi({
      tickets: store.tickets,
      modules: store.modules,
      features: store.features
    });
    if (!payload || payload.success !== true) {
      throw new Error(payload?.error || 'Failed to generate roadmap');
    }
    store.roadmapState = normaliseRoadmapState(payload.state ?? payload);
    store.addTask?.('Roadmap', `Generated ${store.roadmapState.milestones.length} milestones`, 'complete');
    scheduleDeferredRefresh(store, 750);
  } catch (error) {
    console.error('Generate roadmap failed', error);
    store.roadmapError = error.message || 'Failed to generate roadmap';
  } finally {
    store.roadmapLoading = false;
  }
}

export async function exportRoadmapFlow(context) {
  const store = resolveStore(context, this);
  try {
    const payload = await exportRoadmapApi(store.roadmapState);
    if (!payload || payload.success !== true) {
      throw new Error(payload?.error || 'Export failed');
    }
    store.addTask?.('Roadmap', `Exported ${payload.filename}`, 'complete');
  } catch (error) {
    console.error('Roadmap export failed', error);
    store.roadmapError = error.message || 'Failed to export roadmap';
  }
}

export async function rollbackRoadmapFlow(version, context) {
  const store = resolveStore(context, this);
  if (!version) {
    store.roadmapError = 'Select a version to rollback.';
    return;
  }
  store.roadmapLoading = true;
  store.roadmapError = '';
  try {
    const payload = await rollbackRoadmapApi({ version });
    if (!payload || payload.success !== true) {
      throw new Error(payload?.error || 'Rollback failed');
    }
    store.roadmapState = normaliseRoadmapState(payload.state ?? payload);
    store.addTask?.('Roadmap', `Rolled back to ${version}`, 'complete');
    scheduleDeferredRefresh(store, 500);
  } catch (error) {
    console.error('Roadmap rollback failed', error);
    store.roadmapError = error.message || 'Failed to rollback roadmap';
  } finally {
    store.roadmapLoading = false;
  }
}

export async function updateRoadmapMilestoneFlow(payload = {}, context) {
  const store = resolveStore(context, this);
  const { id, field, value, updates, reason, actor } = payload || {};

  if (id === undefined || id === null || id === '') {
    store.roadmapError = 'Milestone id is required.';
    return;
  }

  const requestBody = {};
  if (updates && typeof updates === 'object' && Object.keys(updates).length) {
    requestBody.updates = updates;
  }
  if (field !== undefined) {
    requestBody.field = field;
    requestBody.value = value;
  }

  if (!Object.keys(requestBody).length) {
    store.roadmapError = 'Provide at least one field to update.';
    return;
  }

  if (reason) {
    requestBody.reason = reason;
  }
  if (actor) {
    requestBody.actor = actor;
  }

  store.roadmapUpdating = true;
  store.roadmapUpdateError = '';
  store.roadmapError = '';

  try {
    const response = await updateRoadmapMilestoneApi(id, requestBody);
    if (!response || response.success !== true) {
      throw new Error(response?.error || 'Failed to update roadmap milestone');
    }
    const statePayload = response.state ?? response;
    store.roadmapState = normaliseRoadmapState(statePayload);
    const changedFields = Array.isArray(response.changedFields) ? response.changedFields : [];
    const successMessage = response.message || (changedFields.length ? `Milestone updated (${changedFields.join(', ')})` : 'Milestone updated');
    const timestamp = response.timestamp || new Date().toISOString();
    if (store.roadmapUpdateMessageHandle) {
      clearTimeout(store.roadmapUpdateMessageHandle);
      store.roadmapUpdateMessageHandle = null;
    }
    store.roadmapUpdateMessage = successMessage;
    store.roadmapUpdateTimestamp = timestamp;
    store.roadmapError = '';
    store.roadmapUpdateError = '';
    store.roadmapUpdateMessageHandle = setTimeout(() => {
      store.roadmapUpdateMessage = '';
      store.roadmapUpdateMessageHandle = null;
    }, 3500);
    scheduleDeferredRefresh(store, 500);
  } catch (error) {
    console.error('Roadmap milestone update failed', error);
    if (store.roadmapUpdateMessageHandle) {
      clearTimeout(store.roadmapUpdateMessageHandle);
      store.roadmapUpdateMessageHandle = null;
    }
    store.roadmapUpdateMessage = '';
    const message = error?.message || 'Failed to update roadmap milestone';
    store.roadmapUpdateError = message;
    store.roadmapError = message;
  } finally {
    store.roadmapUpdating = false;
  }
}

export function queueRoadmapRefreshFlow(options = {}, context) {
  const store = resolveStore(context, this);
  const { delay = 1000 } = options;
  scheduleDeferredRefresh(store, delay);
}

export function downloadRoadmapSnapshotFlow(context) {
  const store = resolveStore(context, this);
  if (!store.roadmapState) return;
  const filename = `opnix-roadmap-snapshot-${Date.now()}.json`;
  downloadJsonFile(filename, store.roadmapState);
}

export async function refreshRoadmapStateFlow(options = {}, context) {
  await fetchRoadmapStateFlow.call(this, options, context);
  await fetchRoadmapVersionsFlow.call(this, options, context);
}
