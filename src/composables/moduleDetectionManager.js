import {
  detectModules as detectModulesApi,
  persistModuleLink as persistModuleLinkApi,
  exportCanvas as exportCanvasApi
} from '../services/apiClient.js';
import { queueRoadmapRefreshFlow } from './roadmapManager.js';

export async function detectModulesFlow() {
  this.addTask('Backend Architect', 'Scanning project structure', 'processing');
  try {
    const payload = await detectModulesApi({});
    this.modules = payload.modules || [];
    this.moduleEdges = (payload.edges || []).filter(edge => {
      return this.modules.some(module => module.id === edge.source) &&
        this.modules.some(module => module.id === edge.target);
    });
    this.moduleSummary = payload.summary || this.moduleSummary;
    this.refreshCanvas();
    queueRoadmapRefreshFlow.call(this, { delay: 600 });
  } catch (error) {
    console.error('Detect modules failed', error);
  }
}

export async function persistModuleLinkFlow(source, target, provisionalEdge) {
  try {
    const payload = await persistModuleLinkApi({ source, target });
    if (payload && payload.duplicate) {
      this.addTask('Canvas', `Link ${source} → ${target} already exists`, 'complete');
    } else if (payload && payload.source && payload.target) {
      this.addTask('Canvas', `Linked ${source} → ${target}`, 'complete');
      await detectModulesFlow.call(this);
      queueRoadmapRefreshFlow.call(this, { delay: 600 });
    } else {
      console.error('Failed to persist link', payload);
    }
  } catch (error) {
    console.error('Persist link error', error);
  } finally {
    if (provisionalEdge && !provisionalEdge.destroyed()) {
      provisionalEdge.remove();
    }
  }
}

export function analyzeCanvasFlow() {
  const summary = {
    modules: this.modules.length,
    dependencies: this.moduleEdges.length,
    externalDependencies: this.modules.reduce((sum, module) => sum + (module.externalDependencies ? module.externalDependencies.length : 0), 0)
  };
  console.table(summary);
  this.addTask('Backend Architect', 'Canvas metrics computed', 'complete');
}

export async function exportCanvasFlow() {
  if (!this.cy) return;
  try {
    const png = this.cy.png({ full: true });
    const payload = await exportCanvasApi({ format: 'png', data: png });
    if (payload.success) {
      this.addTask('Canvas Export', `Saved ${payload.filename}`, 'complete');
      if (typeof this.fetchExports === 'function') {
        await this.fetchExports();
      }
    }
  } catch (error) {
    console.error('Canvas export failed', error);
  }
}
