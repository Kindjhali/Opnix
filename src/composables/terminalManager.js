import {
  fetchTerminalHistory as fetchTerminalHistoryApi,
  executeTerminalCommand as executeTerminalCommandApi,
  clearTerminalHistory as clearTerminalHistoryApi,
  fetchTerminalStatus as fetchTerminalStatusApi,
  fetchContextStatus as fetchContextStatusApi
} from '../services/apiClient.js';

import { useAppStore } from './appStore.js';
import { addTaskFlow } from './commandCenterManager.js';

const TERMINAL_MAX_ENTRIES = 100;

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

function pushTask(store, agent, description, status = 'pending') {
  if (typeof store.addTask === 'function') {
    store.addTask(agent, description, status);
  } else {
    addTaskFlow.call(store, agent, description, status);
  }
}

export async function loadTerminalHistoryFlow(context) {
  const store = resolveStore(context, this);
  store.terminalLoading = true;
  store.terminalError = '';
  try {
    const history = await fetchTerminalHistoryApi();
    store.terminalHistory = Array.isArray(history) ? history : [];
  } catch (error) {
    console.error('Terminal history load error', error);
    store.terminalError = error.message || 'Failed to load terminal history';
  } finally {
    store.terminalLoading = false;
  }
}

export async function runTerminalCommandFlow(context) {
  const store = resolveStore(context, this);
  const raw = (store.terminalCommand || '').trim();
  if (!raw) {
    return;
  }

  const workingDirectory = (store.terminalWorkingDirectory || '').trim() || '.';

  store.terminalRunning = true;
  store.terminalError = '';
  try {
    const entry = await executeTerminalCommandApi({ command: raw, cwd: workingDirectory });
    const normalisedEntry = {
      ...entry,
      command: entry.command || raw,
      cwd: entry.cwd || workingDirectory,
      ranAt: entry.ranAt || new Date().toISOString()
    };
    store.terminalHistory = [...store.terminalHistory, normalisedEntry].slice(-TERMINAL_MAX_ENTRIES);
    store.terminalCommand = '';
    pushTask(store, 'Terminal', `Executed: ${raw}`, 'complete');
  } catch (error) {
    console.error('Terminal command failed', error);
    store.terminalError = error.message || 'Command failed';
    pushTask(store, 'Terminal', 'Command failed', 'complete');
  } finally {
    store.terminalRunning = false;
  }

  await refreshBranchStatusFlow.call(store);
  await refreshContextStatusFlow.call(store);
}

export async function clearTerminalHistoryFlow(context) {
  const store = resolveStore(context, this);
  store.terminalError = '';
  try {
    await clearTerminalHistoryApi();
    store.terminalHistory = [];
    pushTask(store, 'Terminal', 'History cleared', 'complete');
  } catch (error) {
    console.error('Terminal history clear error', error);
    store.terminalError = error.message || 'Failed to clear terminal history';
  }
}

export async function refreshBranchStatusFlow(context) {
  const store = resolveStore(context, this);
  store.branchStatusLoading = true;
  store.branchStatusError = '';
  try {
    const status = await fetchTerminalStatusApi();
    store.branchStatus = {
      name: status.branch || status.name || 'unknown',
      ahead: Number.parseInt(status.ahead, 10) || 0,
      behind: Number.parseInt(status.behind, 10) || 0,
      dirty: Boolean(status.dirty),
      detached: Boolean(status.detached),
      notGitRepo: Boolean(status.notGitRepo),
      lastUpdated: status.timestamp || new Date().toISOString()
    };
  } catch (error) {
    console.error('Branch status load error', error);
    store.branchStatusError = error.message || 'Failed to load branch status';
  } finally {
    store.branchStatusLoading = false;
  }
}

export async function refreshContextStatusFlow(context) {
  const store = resolveStore(context, this);
  store.contextStatusLoading = true;
  store.contextStatusError = '';
  try {
    const status = await fetchContextStatusApi();
    store.contextStatus = {
      contextUsed: Number.parseInt(status.contextUsed, 10) || 0,
      contextLimit: Number.parseInt(status.contextLimit, 10) || 0,
      percentage: typeof status.percentage === 'number' ? status.percentage : 0,
      remaining: Number.parseInt(status.remaining, 10) || 0,
      displayText: status.displayText || '',
      warning: status.warning || '',
      currentTask: status.currentTask || 'System Ready',
      filesEdited: Number.parseInt(status.filesEdited, 10) || 0,
      daicState: status.daicState || 'Discussion'
    };
  } catch (error) {
    console.error('Context status load error', error);
    store.contextStatusError = error.message || 'Failed to load context status';
  } finally {
    store.contextStatusLoading = false;
  }
}
