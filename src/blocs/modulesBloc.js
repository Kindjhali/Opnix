import {
  ensureCanvasFlow,
  layoutCanvasFlow
} from '../composables/canvasManager.js';

import {
  refreshCanvasFlow,
  analyzeModuleFlow,
  analyzeModuleDependenciesFlow,
  getModuleBugCountHelper,
  getModuleFeatureCountHelper,
  getModuleNameHelper,
  getHealthColorHelper,
  getFeatureStatusColorHelper
} from '../composables/moduleManager.js';

import {
  detectModulesFlow,
  persistModuleLinkFlow,
  analyzeCanvasFlow,
  exportCanvasFlow
} from '../composables/moduleDetectionManager.js';

import { fetchModulesGraph as fetchModulesGraphApi } from '../services/apiClient.js';

function createModulesBloc() {
  return {
    async fetchModulesGraph() {
      try {
        this.loading.modules = true;
        const payload = await fetchModulesGraphApi();
        this.modules = payload.modules || [];
        this.moduleEdges = (payload.edges || []).filter(edge => {
          return this.modules.some(module => module.id === edge.source) &&
            this.modules.some(module => module.id === edge.target);
        });
        this.moduleSummary = payload.summary || this.moduleSummary;
        if (typeof this.ensureCanvas === 'function') {
          this.ensureCanvas();
        }
        if (typeof this.queueRoadmapRefresh === 'function') {
          this.queueRoadmapRefresh({ delay: 600 });
        }
      } catch (error) {
        console.error('Module graph error', error);
      } finally {
        this.loading.modules = false;
      }
    },
    ensureCanvas() {
      ensureCanvasFlow.call(this);
    },
    refreshCanvas() {
      refreshCanvasFlow.call(this);
    },
    layoutCanvas(type) {
      layoutCanvasFlow.call(this, type);
    },
    async detectModules() {
      await detectModulesFlow.call(this);
    },
    async persistModuleLink(source, target, provisionalEdge) {
      await persistModuleLinkFlow.call(this, source, target, provisionalEdge);
    },
    analyzeCanvas() {
      analyzeCanvasFlow.call(this);
    },
    async exportCanvas() {
      await exportCanvasFlow.call(this);
    },
    analyzeModule(module) {
      analyzeModuleFlow.call(this, module);
    },
    analyzeModuleDependencies() {
      analyzeModuleDependenciesFlow.call(this);
    },
    getModuleBugCount(moduleId) {
      return getModuleBugCountHelper.call(this, moduleId);
    },
    getModuleFeatureCount(moduleId) {
      return getModuleFeatureCountHelper.call(this, moduleId);
    },
    getModuleName(moduleId) {
      return getModuleNameHelper.call(this, moduleId);
    },
    getHealthColor(value) {
      return getHealthColorHelper(value);
    },
    getFeatureStatusColor(status) {
      return getFeatureStatusColorHelper(status);
    }
  };
}

export { createModulesBloc };
export default createModulesBloc;
