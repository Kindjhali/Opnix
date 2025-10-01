import {
  fetchClaudeCommand as fetchClaudeCommandApi,
  fetchCliSessions as fetchCliSessionsApi,
  fetchCliSessionDetails as fetchCliSessionDetailsApi,
  activateAgent as activateAgentApi
} from '../services/apiClient.js';

import { useAppStore } from './appStore.js';

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

export async function executeClaudeCommandFlow(context) {
  const store = resolveStore(context, this);
  const raw = (store.claudeCommand || '').trim();
  if (!raw) return;
  const command = /--ultrathink/i.test(raw) ? raw : `${raw} --ultrathink`;
  addTaskFlow.call(store, 'Claude CLI', command, 'processing');
  try {
    const payload = await fetchClaudeCommandApi({ command });
    store.claudeLastResponse = payload.result || 'Command executed';
    addTaskFlow.call(store, 'Claude CLI', store.claudeLastResponse, 'complete');
    if (payload.audit) {
      store.latestAudit = payload.audit;
      console.group('Opnix Audit');
      console.table(payload.audit.project || {});
      console.table(payload.audit.ticketStats || {});
      console.groupEnd();
      addTaskFlow.call(store, 'Audit', 'Initial audit artefacts generated', 'complete');
      const refreshOperations = [];
      if (typeof store.fetchModulesGraph === 'function') refreshOperations.push(store.fetchModulesGraph());
      if (typeof store.fetchExports === 'function') refreshOperations.push(store.fetchExports());
      if (typeof store.fetchStats === 'function') refreshOperations.push(store.fetchStats());
      if (refreshOperations.length) {
        await Promise.all(refreshOperations);
      }
    }
  } catch (error) {
    console.error('Claude command failed', error);
    addTaskFlow.call(store, 'Claude CLI', 'Execution failed', 'complete');
  }
  store.claudeCommand = '';
}

export async function fetchCliSessionsFlow(context) {
  const store = resolveStore(context, this);
  if (store.cliSessionsLoading) {
    return;
  }
  store.cliSessionsLoading = true;
  store.cliSessionsError = '';
  try {
    const payload = await fetchCliSessionsApi();
    store.cliSessions = Array.isArray(payload.sessions) ? payload.sessions : [];
    store.cliGateLog = Array.isArray(payload.gates) ? payload.gates : [];
    if (store.selectedCliSession) {
      const sessionStillExists = store.cliSessions.some(session => session.sessionId === store.selectedCliSession);
      if (!sessionStillExists) {
        clearCliSessionDetailsFlow.call(store);
      }
    }
  } catch (error) {
    console.error('CLI sessions load error', error);
    store.cliSessionsError = error.message || 'Failed to load CLI sessions';
  } finally {
    store.cliSessionsLoading = false;
  }
}

export async function viewCliSessionFlow(sessionId, context) {
  const store = resolveStore(context, this);
  store.selectedCliSession = sessionId;
  store.cliSessionDetailsError = '';
  store.cliSessionDetails = null;
  try {
    store.cliSessionDetails = await fetchCliSessionDetailsApi(sessionId);
  } catch (error) {
    console.error('CLI session detail error', error);
    store.cliSessionDetailsError = error.message || 'Failed to load session details';
  }
}

export function clearCliSessionDetailsFlow(context) {
  const store = resolveStore(context, this);
  store.selectedCliSession = null;
  store.cliSessionDetails = null;
  store.cliSessionDetailsError = '';
}

export async function activateAgentFlow(agent, context) {
  const store = resolveStore(context, this);
  store.agents = store.agents.map(existing => ({
    ...existing,
    status: existing.id === agent.id ? 'active' : 'idle',
    taskCount: existing.id === agent.id ? existing.taskCount + 1 : existing.taskCount
  }));
  try {
    await activateAgentApi(agent.id);
    addTaskFlow.call(store, agent.name, 'Agent activated', 'complete');
  } catch (error) {
    console.error('Agent activation error', error);
    addTaskFlow.call(store, agent.name, 'Activation failed', 'complete');
  }
}

export function addTaskFlow(agentName, description, status = 'pending', context) {
  const store = resolveStore(context, this);
  const task = {
    id: Date.now() + Math.random(),
    agent: agentName,
    description,
    status
  };
  store.taskQueue = [task, ...store.taskQueue].slice(0, 5);
  if (status !== 'complete') {
    setTimeout(() => {
      task.status = 'complete';
    }, 2000);
  }
}

export function clearTaskQueueFlow(context) {
  const store = resolveStore(context, this);
  store.taskQueue = [];
}
