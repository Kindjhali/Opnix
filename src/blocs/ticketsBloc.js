import {
  analyzeWithPythonAgentFlow,
  addBugFlow,
  onTicketStatusChangeFlow,
  persistTicketUpdateFlow,
  cancelTicketCompletionFlow,
  confirmTicketCompletionFlow,
  exportBugsFlow
} from '../composables/ticketManager.js';

import {
  openBugModalFlow,
  closeBugModalFlow,
  updateBugDraftFlow,
  updateTicketCompletionSummaryFlow
} from '../composables/modalManager.js';

function createTicketsBloc() {
  return {
    updateBugFilter(filter) {
      this.bugFilter = { ...filter };
    },
    async analyzeWithPythonAgent() {
      await analyzeWithPythonAgentFlow.call(this);
    },
    async addBug() {
      await addBugFlow.call(this);
    },
    async exportBugs() {
      await exportBugsFlow.call(this);
    },
    async onTicketStatusChange(ticket, event) {
      await onTicketStatusChangeFlow.call(this, ticket, event);
    },
    async persistTicketUpdate(ticket, payload, selectEl) {
      return persistTicketUpdateFlow.call(this, ticket, payload, selectEl);
    },
    cancelTicketCompletion() {
      cancelTicketCompletionFlow.call(this);
    },
    async confirmTicketCompletion() {
      await confirmTicketCompletionFlow.call(this);
    },
    updateTicketCompletionSummary(value) {
      updateTicketCompletionSummaryFlow.call(this, value);
    },
    openBugModal() {
      openBugModalFlow.call(this);
    },
    closeBugModal() {
      closeBugModalFlow.call(this);
    },
    updateBugDraft(value) {
      updateBugDraftFlow.call(this, value);
    }
  };
}

export { createTicketsBloc };
export default createTicketsBloc;
