import {
  openAddModuleModalFlow,
  closeAddModuleModalFlow,
  updateModuleDraftFlow,
  updateRunbookDraftFlow
} from '../composables/modalManager.js';

function createModalsBloc() {
  return {
    openAddModuleModal() {
      openAddModuleModalFlow.call(this);
    },
    closeAddModuleModal() {
      closeAddModuleModalFlow.call(this);
    },
    updateModuleDraft(value) {
      updateModuleDraftFlow.call(this, value);
    },
    updateRunbookDraft(value) {
      updateRunbookDraftFlow.call(this, value);
    }
  };
}

export { createModalsBloc };
export default createModalsBloc;
