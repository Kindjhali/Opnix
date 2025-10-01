import {
  fetchTechStackSummaryFlow,
  exportTechStackFlow
} from '../composables/techStackManager.js';

function createTechStackBloc() {
  return {
    async fetchTechStackSummary(options = {}) {
      await fetchTechStackSummaryFlow.call(this, options);
    },
    async refreshTechStackSummary() {
      await fetchTechStackSummaryFlow.call(this, { force: true });
    },
    async exportTechStackSummary() {
      await exportTechStackFlow.call(this);
    }
  };
}

export { createTechStackBloc };
export default createTechStackBloc;
