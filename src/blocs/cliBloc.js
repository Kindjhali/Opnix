import {
  loadTerminalHistoryFlow,
  runTerminalCommandFlow,
  clearTerminalHistoryFlow,
  refreshBranchStatusFlow,
  refreshContextStatusFlow
} from '../composables/terminalManager.js';

import {
  executeClaudeCommandFlow,
  fetchCliSessionsFlow,
  viewCliSessionFlow,
  clearCliSessionDetailsFlow,
  activateAgentFlow,
  addTaskFlow,
  clearTaskQueueFlow
} from '../composables/commandCenterManager.js';

function createCliBloc(store) {
  const context = store || this;
  return {
    loadTerminalHistory() {
      return loadTerminalHistoryFlow.call(context);
    },
    runTerminalCommand() {
      return runTerminalCommandFlow.call(context);
    },
    clearTerminalHistory() {
      return clearTerminalHistoryFlow.call(context);
    },
    refreshBranchStatus() {
      return refreshBranchStatusFlow.call(context);
    },
    refreshContextStatus() {
      return refreshContextStatusFlow.call(context);
    },
    async executeClaudeCommand() {
      await executeClaudeCommandFlow.call(context);
    },
    async fetchCliSessions() {
      await fetchCliSessionsFlow.call(context);
    },
    async viewCliSession(sessionId) {
      await viewCliSessionFlow.call(context, sessionId);
    },
    clearCliSessionDetails() {
      clearCliSessionDetailsFlow.call(context);
    },
    activateAgent(agent) {
      activateAgentFlow.call(context, agent);
    },
    addTask(agentName, description, status = 'pending') {
      addTaskFlow.call(context, agentName, description, status);
    },
    clearTaskQueue() {
      clearTaskQueueFlow.call(context);
    }
  };
}

export { createCliBloc };
export default createCliBloc;
