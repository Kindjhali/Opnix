import {
  formatCliSessionStatus,
  findCliQuestionPrompt,
  formatGateTimestamp,
  formatGateContext,
  formatCliTimestamp
} from '../composables/cliSessions.js';

function createFormattingBloc() {
  return {
    formatCliSessionStatus,
    findCliQuestionPrompt,
    formatGateTimestamp,
    formatGateContext,
    formatCliTimestamp
  };
}

export { createFormattingBloc };
export default createFormattingBloc;
