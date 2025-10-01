export function refreshCanvasFlow() {
  if (!this.cy) return;
  const elements = [];

  this.modules.forEach(module => {
    elements.push({
      data: {
        id: module.id,
        label: module.name,
        coverage: module.coverage,
        health: module.health || 60,
        dependencies: module.dependencies || []
      }
    });
  });

  this.moduleEdges.forEach(edge => {
    const edgeId = edge.id || `${edge.source}->${edge.target}`;
    elements.push({
      data: {
        id: edgeId,
        source: edge.source,
        target: edge.target
      }
    });
  });

  this.cy.elements().remove();
  this.cy.add(elements);
  this.cy.layout({
    name: 'cose',
    animate: true,
    animationDuration: 700,
    nodeRepulsion: 4500,
    idealEdgeLength: 140
  }).run();
}

export function analyzeModuleFlow(module) {
  const relatedFeatures = this.features.filter(feature => feature.moduleId === module.id);
  const relatedTickets = this.tickets.filter(ticket => (ticket.modules || []).includes(module.id));
  console.table({
    module: module.name,
    features: relatedFeatures.length,
    tickets: relatedTickets.length,
    coverage: module.coverage
  });
  this.addTask('AI Engineer', `Analyzed ${module.name}`, 'complete');
}

export function analyzeModuleDependenciesFlow() {
  const dependencyMap = this.moduleEdges.reduce((acc, edge) => {
    acc[edge.source] = acc[edge.source] || [];
    acc[edge.source].push(edge.target);
    return acc;
  }, {});
  console.table(dependencyMap);
  this.addTask('Backend Architect', 'Dependency map calculated', 'complete');
}

export function getModuleBugCountHelper(moduleId) {
  return this.tickets.filter(ticket => (ticket.modules || []).includes(moduleId)).length;
}

export function getModuleFeatureCountHelper(moduleId) {
  return this.features.filter(feature => feature.moduleId === moduleId).length;
}

export function getModuleNameHelper(moduleId) {
  const module = this.moduleLookup[moduleId];
  return module ? module.name : 'Unknown';
}

export function getHealthColorHelper(health) {
  if (health >= 80) return '#10B981';
  if (health >= 60) return '#F59E0B';
  return '#EF4444';
}

export function getFeatureStatusColorHelper(status) {
  const colors = {
    proposed: '#8B5CF6',
    approved: '#06B6D4',
    'in-development': '#F59E0B',
    testing: '#EC4899',
    deployed: '#10B981'
  };
  return colors[status] || '#7B8AA8';
}
