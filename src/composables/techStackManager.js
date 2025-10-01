import {
  fetchTechStackSummary as fetchTechStackSummaryApi,
  exportTechStackSummary as exportTechStackSummaryApi
} from '../services/apiClient.js';

import { useAppStore } from './appStore.js';

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

function normaliseSummary(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }
  const summary = { ...payload };
  summary.package = summary.package && typeof summary.package === 'object'
    ? summary.package
    : { name: 'unregistered-project', version: '0.0.0', packageManager: 'npm' };
  summary.dependencies = summary.dependencies && typeof summary.dependencies === 'object'
    ? summary.dependencies
    : { total: 0, items: [] };
  summary.devDependencies = summary.devDependencies && typeof summary.devDependencies === 'object'
    ? summary.devDependencies
    : { total: 0, items: [] };
  summary.frameworks = Array.isArray(summary.frameworks) ? summary.frameworks : [];
  summary.moduleSummary = summary.moduleSummary && typeof summary.moduleSummary === 'object'
    ? summary.moduleSummary
    : { total: 0, detectedCount: 0, manualCount: 0, byType: {}, externalDependencyCount: 0, details: [] };
  summary.moduleSummary.details = Array.isArray(summary.moduleSummary.details)
    ? summary.moduleSummary.details
    : [];
  summary.cliInsights = summary.cliInsights && typeof summary.cliInsights === 'object'
    ? summary.cliInsights
    : { project: [], module: [], sessionsAnalyzed: 0 };
  summary.cliInsights.project = Array.isArray(summary.cliInsights.project) ? summary.cliInsights.project : [];
  summary.cliInsights.module = Array.isArray(summary.cliInsights.module) ? summary.cliInsights.module : [];
  summary.cliInsights.sessionsAnalyzed = summary.cliInsights.sessionsAnalyzed || 0;
  summary.generatedAt = summary.generatedAt || new Date().toISOString();
  return summary;
}

export async function fetchTechStackSummaryFlow(options = {}, context) {
  const store = resolveStore(context, this);
  const {
    background = false,
    force = false
  } = options;

  if (!background) {
    store.techStackLoading = true;
    store.techStackError = '';
  }

  try {
    if (!force && store.techStackSummary && !background) {
      return store.techStackSummary;
    }

    const response = await fetchTechStackSummaryApi();
    if (!response || response.success !== true) {
      throw new Error(response?.error || 'Unable to load tech stack summary');
    }

    const summary = normaliseSummary(response.summary);
    store.techStackSummary = summary;
    if (!background && typeof store.addTask === 'function') {
      store.addTask('Tech Stack', 'Tech stack summary refreshed', 'complete');
    }
    return summary;
  } catch (error) {
    console.error('Tech stack summary fetch failed', error);
    store.techStackError = error.message || 'Failed to load tech stack summary';
    throw error;
  } finally {
    if (!background) {
      store.techStackLoading = false;
    }
  }
}

export async function exportTechStackFlow(context) {
  const store = resolveStore(context, this);
  store.techStackExporting = true;
  store.techStackExportError = '';
  try {
    const response = await exportTechStackSummaryApi();
    if (!response || response.success !== true) {
      throw new Error(response?.error || 'Tech stack export failed');
    }

    store.techStackExportResult = response.export || null;
    if (typeof store.addTask === 'function') {
      const location = response.export?.relativePath || response.export?.path;
      const message = location ? `Tech stack saved to ${location}` : 'Tech stack export complete';
      store.addTask('Tech Stack', message, 'complete');
    }

    if (typeof store.fetchExports === 'function') {
      await store.fetchExports();
    }

    await fetchTechStackSummaryFlow({ background: true, force: true }, store);
    return response;
  } catch (error) {
    console.error('Tech stack export error', error);
    store.techStackExportError = error.message || 'Failed to export tech stack summary';
    throw error;
  } finally {
    store.techStackExporting = false;
  }
}

export default {
  fetchTechStackSummaryFlow,
  exportTechStackFlow
};
