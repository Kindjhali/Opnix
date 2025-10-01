import {
  fetchAgentsFlow,
  fetchTicketsFlow,
  fetchFeaturesFlow,
  fetchExportsFlow,
  fetchStatsFlow
} from '../composables/dataBootstrap.js';

function createDataBloc(_store, { agentIconMap } = {}) {
  const defaultIconMap = agentIconMap || {};

  function withRoadmapRefresh(fn, delay = 500) {
    return async function wrapped(...args) {
      await fn.call(this, ...args);
      const target = this && typeof this.queueRoadmapRefresh === 'function'
        ? this
        : _store;
      if (target && typeof target.queueRoadmapRefresh === 'function') {
        target.queueRoadmapRefresh({ delay });
      }
    };
  }

  return {
    async fetchAgents(options = {}) {
      const iconMap = options.iconMap || defaultIconMap;
      await fetchAgentsFlow.call(this, { iconMap });
    },
    fetchTickets: withRoadmapRefresh(function fetchTicketsWrapped() {
      return fetchTicketsFlow.call(this);
    }),
    fetchFeatures: withRoadmapRefresh(function fetchFeaturesWrapped() {
      return fetchFeaturesFlow.call(this);
    }),
    async fetchExports() {
      await fetchExportsFlow.call(this);
    },
    async fetchStats() {
      await fetchStatsFlow.call(this);
    }
  };
}

export { createDataBloc };
export default createDataBloc;
