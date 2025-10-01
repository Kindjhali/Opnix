import {
  addFeatureFlow,
  generateFeatureReportFlow,
  toggleModuleSelectionFlow
} from '../composables/featureManager.js';

import {
  openFeatureModalFlow,
  closeFeatureModalFlow,
  updateFeatureDraftFlow
} from '../composables/modalManager.js';

function createFeaturesBloc() {
  return {
    async addFeature() {
      await addFeatureFlow.call(this);
    },
    generateFeatureReport() {
      generateFeatureReportFlow.call(this);
    },
    toggleModule(moduleId) {
      toggleModuleSelectionFlow.call(this, moduleId);
    },
    updateFeatureFilter(filter) {
      this.featureFilter = { ...filter };
    },
    openFeatureModal() {
      openFeatureModalFlow.call(this);
    },
    closeFeatureModal() {
      closeFeatureModalFlow.call(this);
    },
    updateFeatureDraft(value) {
      updateFeatureDraftFlow.call(this, value);
    }
  };
}

export { createFeaturesBloc };
export default createFeaturesBloc;
