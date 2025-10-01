import { generateDocsFlow, exportDocsContent } from '../composables/docsManager.js';
import {
  resetRunbookState,
  startRunbookInterviewFlow,
  submitRunbookAnswerFlow,
  skipRunbookInterviewFlow,
  closeRunbookModalFlow,
  generateRunbookFlow,
  quickGenerateRunbookFlow
} from '../composables/runbookManager.js';

function createDocsBloc() {
  return {
    updateDocType(type) {
      this.docType = type;
    },
    async generateDocs() {
      await generateDocsFlow.call(this);
    },
    exportDocs() {
      exportDocsContent.call(this);
    },
    resetRunbookInterviewState() {
      resetRunbookState.call(this);
    },
    async startRunbookInterview() {
      await startRunbookInterviewFlow.call(this);
    },
    async submitRunbookAnswer() {
      await submitRunbookAnswerFlow.call(this);
    },
    async skipRunbookInterview() {
      await skipRunbookInterviewFlow.call(this);
    },
    closeRunbookModal() {
      closeRunbookModalFlow.call(this);
    },
    async generateRunbook(options = {}) {
      await generateRunbookFlow.call(this, options);
    },
    async quickGenerateRunbook() {
      await quickGenerateRunbookFlow.call(this);
    }
  };
}

export { createDocsBloc };
export default createDocsBloc;
