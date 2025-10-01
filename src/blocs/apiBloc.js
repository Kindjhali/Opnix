import {
  buildApiSpecDraftFlow,
  generateApiSpecFlow,
  exportApiSpecFlow,
  testApiSpecFlow
} from '../composables/apiSpecManager.js';

function createApiBloc() {
  return {
    buildApiSpecDraft() {
      return buildApiSpecDraftFlow.call(this);
    },
    updateApiFormat(format) {
      this.apiFormat = format;
      this.apiSpecWarnings = [];
    },
    async generateAPISpec(options) {
      await generateApiSpecFlow.call(this, options);
    },
    async exportAPISpec(options = {}) {
      await exportApiSpecFlow.call(this, options);
    },
    async testAPI(options = {}) {
      await testApiSpecFlow.call(this, options);
    }
  };
}

export { createApiBloc };
export default createApiBloc;
