import {
  generateDiagramFlow,
  generateFromModulesFlow,
  renderMermaidFlow
} from '../composables/diagramManager.js';

function createDiagramsBloc() {
  return {
    updateMermaidCode(code) {
      this.mermaidCode = code;
      this.mermaidError = '';
    },
    async generateDiagram(type) {
      await generateDiagramFlow.call(this, type);
    },
    generateFromModules() {
      generateFromModulesFlow.call(this);
    },
    renderMermaid() {
      renderMermaidFlow.call(this);
    }
  };
}

export { createDiagramsBloc };
export default createDiagramsBloc;
