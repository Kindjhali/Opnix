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

import { useAppStore } from '../composables/appStore.js';

function bindFlow(flow, store) {
  return (...args) => flow.call(store, ...args);
}

export function createWorkbenchBloc(store = useAppStore()) {
  return {
    loadTerminalHistory: bindFlow(loadTerminalHistoryFlow, store),
    runTerminalCommand: bindFlow(runTerminalCommandFlow, store),
    clearTerminalHistory: bindFlow(clearTerminalHistoryFlow, store),
    refreshBranchStatus: bindFlow(refreshBranchStatusFlow, store),
    refreshContextStatus: bindFlow(refreshContextStatusFlow, store),
    executeClaudeCommand: bindFlow(executeClaudeCommandFlow, store),
    fetchCliSessions: bindFlow(fetchCliSessionsFlow, store),
    viewCliSession: bindFlow(viewCliSessionFlow, store),
    clearCliSessionDetails: bindFlow(clearCliSessionDetailsFlow, store),
    activateAgent: bindFlow(activateAgentFlow, store),
    addTask: bindFlow(addTaskFlow, store),
    clearTaskQueue: bindFlow(clearTaskQueueFlow, store)
  };
}

export default createWorkbenchBloc;
