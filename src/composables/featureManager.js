import { createFeature as createFeatureApi } from '../services/apiClient.js';
import { queueRoadmapRefreshFlow } from './roadmapManager.js';

function parseAcceptanceCriteria(text) {
  return text
    .split('\n')
    .map(line => line.trim().replace(/^[-*]\s*/, ''))
    .filter(Boolean);
}

export async function addFeatureFlow() {
  if (!this.newFeature.title.trim()) return;
  try {
    const criteria = parseAcceptanceCriteria(this.newFeature.criteriaText || '');
    const payload = await createFeatureApi({
      title: this.newFeature.title,
      description: this.newFeature.description,
      moduleId: this.newFeature.moduleId,
      priority: this.newFeature.priority,
      acceptanceCriteria: criteria
    });
    this.features.push(payload);
    this.showFeatureModal = false;
    this.newFeature = { title: '', description: '', moduleId: '', priority: 'medium', criteriaText: '' };
    this.addTask('Feature Manager', `Feature ${payload.title} created`, 'complete');
    queueRoadmapRefreshFlow.call(this, { delay: 500 });
  } catch (error) {
    console.error('Create feature failed', error);
  }
}

export function generateFeatureReportFlow() {
  if (!Array.isArray(this.features) || this.features.length === 0) {
    this.addTask('Feature Manager', 'No features available for reporting', 'complete');
    return;
  }

  const timestamp = new Date().toISOString();
  const lines = [
    '# Opnix Feature Report',
    `Generated: ${timestamp}`,
    ''
  ];

  const statusTotals = this.features.reduce((totals, feature) => {
    const status = feature.status || 'unknown';
    totals[status] = (totals[status] || 0) + 1;
    return totals;
  }, {});

  lines.push('## Status Totals');
  Object.entries(statusTotals)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([status, count]) => {
      lines.push(`- ${status}: ${count}`);
    });

  lines.push('', '## Modules');
  const featuresByModule = this.features.reduce((map, feature) => {
    const moduleId = feature.moduleId || 'unassigned';
    if (!map[moduleId]) {
      map[moduleId] = [];
    }
    map[moduleId].push(feature);
    return map;
  }, {});

  Object.entries(featuresByModule)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([moduleId, moduleFeatures]) => {
      const moduleName = this.getModuleName(moduleId);
      lines.push(`\n### ${moduleName} (${moduleId})`);
      moduleFeatures.forEach(feature => {
        const criteria = Array.isArray(feature.acceptanceCriteria) && feature.acceptanceCriteria.length
          ? feature.acceptanceCriteria.map(item => `    - ${item}`).join('\n')
          : '    - Pending acceptance criteria';
        lines.push(`
- ${feature.title} [${feature.status || 'unknown'}]\n  - Priority: ${feature.priority || 'unknown'}\n  - Votes: ${feature.votes || 0}\n  - Summary: ${feature.description || 'No description provided'}\n${criteria}`);
      });
    });

  const blob = new Blob([lines.join('\n')], { type: 'text/markdown' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `opnix-feature-report-${Date.now()}.md`;
  link.click();
  URL.revokeObjectURL(link.href);
  this.addTask('Feature Manager', 'Feature report exported', 'complete');
}

export function toggleModuleSelectionFlow(moduleId) {
  const index = this.selectedModules.indexOf(moduleId);
  if (index > -1) {
    this.selectedModules.splice(index, 1);
  } else {
    this.selectedModules.push(moduleId);
  }
}
