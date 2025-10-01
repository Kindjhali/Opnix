import { stripHtmlToText, downloadMarkdownFile } from './markdownUtils.js';
import { marked } from 'marked';
import { queueRoadmapRefreshFlow } from './roadmapManager.js';

import { generateDocs as generateDocsApi } from '../services/apiClient.js';

marked.setOptions({ mangle: false, headerIds: false });

export function generateDocsContent() {
  const moduleSummaryMarkup = (this.modules || []).map(module => {
    const deps = module.dependencies && module.dependencies.length ? module.dependencies.join(', ') : 'None';
    const externals = module.externalDependencies && module.externalDependencies.length ? module.externalDependencies.join(', ') : 'None';
    return `
      <h4>${module.name}</h4>
      <p>Health: ${module.health || 'n/a'}%</p>
      <p>Coverage: ${module.coverage || 0}%</p>
      <p>Dependencies: ${deps}</p>
      <p>External: ${externals}</p>
    `;
  }).join('');

  const templates = {
    overview: `<h3>Opnix Statistics</h3>
      <ul>
        <li>Total Tickets: ${(this.tickets || []).length}</li>
        <li>Total Features: ${(this.features || []).length}</li>
        <li>Modules Discovered: ${(this.modules || []).length}</li>
        <li>Dependencies: ${(this.moduleEdges || []).length}</li>
      </ul>`,
    modules: `<h3>Module Documentation</h3>${moduleSummaryMarkup}`,
    api: `<h3>API Documentation</h3>
      <pre>${this.apiSpecContent || 'Generate API spec first'}</pre>`,
    features: `<h3>Feature Specifications</h3>
      ${(this.features || []).map(feature => `
        <h4>${feature.title}</h4>
        <p>${feature.description}</p>
        <p><strong>Status:</strong> ${feature.status || 'proposed'}</p>
        <p><strong>Module:</strong> ${this.getModuleName(feature.moduleId)}</p>
      `).join('')}`
  };

  this.generatedDocs = templates[this.docType] || '';
  this.docTitle = `${this.docType.charAt(0).toUpperCase()}${this.docType.slice(1)} Documentation`;
}

export function exportDocsContent() {
  const text = stripHtmlToText(this.generatedDocs || '');
  downloadMarkdownFile('opnix-docs.md', text);
}


export async function generateDocsFlow(options = {}) {
  this.docGenerating = true;
  this.docGenerationError = '';
  try {
    generateDocsContent.call(this);
    const response = await generateDocsApi({ docType: this.docType, ...options });
    if (!response || response.success === false) {
      throw new Error(response && response.error ? response.error : 'Failed to generate documentation');
    }
    const doc = response.doc || null;
    this.latestDocMeta = doc;
    this.latestDocContent = doc && typeof doc.content === 'string' ? doc.content : '';
    this.latestDocHtml = this.latestDocContent ? marked.parse(this.latestDocContent) : '';
    if (typeof this.addTask === 'function') {
      const location = doc && (doc.relativePath || doc.path);
      const message = location ? `Documentation saved to ${location}` : 'Documentation generated';
      this.addTask('Documentation Expert', message, 'complete');
    }
    if (typeof this.fetchExports === 'function') {
      await this.fetchExports();
    }
    queueRoadmapRefreshFlow.call(this, { delay: 600 });
  } catch (error) {
    console.error('Docs generation error', error);
    this.docGenerationError = error && error.message ? error.message : 'Failed to generate documentation';
  } finally {
    this.docGenerating = false;
  }
}

