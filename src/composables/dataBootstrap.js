import {
  fetchAgents as fetchAgentsApi,
  fetchTickets as fetchTicketsApi,
  fetchFeatures as fetchFeaturesApi,
  fetchExports as fetchExportsApi,
  fetchStats as fetchStatsApi
} from '../services/apiClient.js';

import { useAppStore } from './appStore.js';

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

export async function fetchAgentsFlow(options = {}, context) {
  const store = resolveStore(context, this);
  const { iconMap = {} } = options;
  store.loading.agents = true;
  try {
    const payload = await fetchAgentsApi();
    const decorated = (payload.agents || []).map(agent => ({
      id: agent.id,
      name: agent.name,
      category: agent.category,
      path: agent.path,
      icon: iconMap[agent.category] || iconMap.general || '🤖',
      status: 'idle',
      taskCount: 0
    }));
    store.agents = decorated;
  } catch (error) {
    console.error('Agent load error', error);
  } finally {
    store.loading.agents = false;
  }
}

export async function fetchTicketsFlow(context) {
  const store = resolveStore(context, this);
  store.loading.tickets = true;
  try {
    const tickets = await fetchTicketsApi();
    store.tickets = Array.isArray(tickets) ? tickets : [];
  } catch (error) {
    console.error('Ticket load error', error);
  } finally {
    store.loading.tickets = false;
  }
}

export async function fetchFeaturesFlow(context) {
  const store = resolveStore(context, this);
  store.loading.features = true;
  try {
    const features = await fetchFeaturesApi();
    store.features = Array.isArray(features) ? features : [];
  } catch (error) {
    console.error('Feature load error', error);
  } finally {
    store.loading.features = false;
  }
}

export async function fetchExportsFlow(context) {
  const store = resolveStore(context, this);
  store.loading.exports = true;
  try {
    const payload = await fetchExportsApi();
    store.exportsList = payload.files || [];
  } catch (error) {
    console.error('Exports load error', error);
  } finally {
    store.loading.exports = false;
  }
}

export async function fetchStatsFlow(context) {
  const store = resolveStore(context, this);
  store.loading.stats = true;
  try {
    store.stats = await fetchStatsApi();
  } catch (error) {
    console.error('Stats load error', error);
  } finally {
    store.loading.stats = false;
  }
}
