import mermaid from 'mermaid';

import { fetchDiagram as fetchDiagramApi } from '../services/apiClient.js';

export function configureMermaidTheme(theme) {
  const variables = theme === 'canyon' ? {
    primaryColor: '#FF8C3B',
    primaryTextColor: '#FFDEAD',
    primaryBorderColor: '#DAA520',
    lineColor: '#CD5C5C',
    secondaryColor: '#5F9EA0',
    tertiaryColor: '#8A2BE2'
  } : {
    primaryColor: '#1FB6FF',
    primaryTextColor: '#FAEBD7',
    primaryBorderColor: '#06B6D4',
    lineColor: '#06B6D4',
    secondaryColor: '#E94560',
    tertiaryColor: '#8B5CF6'
  };
  mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: variables
  });
}

export async function generateDiagramFlow(type) {
  this.mermaidError = '';
  try {
    const payload = await fetchDiagramApi(type, { refresh: true });
    if (payload && payload.mermaid) {
      this.mermaidCode = payload.mermaid;
      this.$nextTick(() => renderMermaidFlow.call(this));
      this.addTask('Diagram Generator', `Generated ${type} diagram`, 'complete');
    } else if (!payload || !payload.mermaid) {
      this.mermaidError = 'No diagram content returned';
    }
  } catch (error) {
    console.error('Generate diagram failed', error);
    this.mermaidError = error?.message || 'Diagram generation failed';
    this.addTask('Diagram Generator', 'Diagram generation failed', 'complete');
  }
}

export function generateFromModulesFlow() {
  let diagram = 'graph TD\n';
  this.modules.forEach(module => {
    diagram += `    ${module.id.replace(/[^a-zA-Z0-9_]/g, '_')}[${module.name}]\n`;
  });
  diagram += '\n';
  this.moduleEdges.forEach(edge => {
    diagram += `    ${edge.source.replace(/[^a-zA-Z0-9_]/g, '_')} --> ${edge.target.replace(/[^a-zA-Z0-9_]/g, '_')}\n`;
  });
  this.mermaidCode = diagram;
  renderMermaidFlow.call(this);
}

export function renderMermaidFlow() {
  const element = document.getElementById('mermaid-output');
  if (!element) return;
  const code = (this.mermaidCode || '').trim();
  this.mermaidError = '';
  element.innerHTML = '';
  element.removeAttribute('data-processed');

  if (!code) {
    return;
  }

  mermaid.render(`mermaid-${Date.now()}`, code)
    .then(result => {
      element.innerHTML = result.svg;
      this.mermaidError = '';
    })
    .catch(error => {
      this.mermaidError = error?.message || 'Failed to render diagram';
    });
}
