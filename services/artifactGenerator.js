const path = require('path');
const fs = require('fs').promises;
const { detectModules } = require('./moduleDetector');

/**
 * Artifact Generation Hooks - Auto-generate comprehensive project artifacts
 *
 * This system automatically generates various project artifacts based on:
 * 1. Progressive questioning responses
 * 2. Detected project patterns
 * 3. Module analysis results
 * 4. Codebase structure analysis
 */
class ArtifactGenerator {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.outputDir = path.join(rootDir, 'exports');
  }

  async initialize() {
    await fs.mkdir(this.outputDir, { recursive: true });
  }

  getResponseValue(responses, key, defaultValue = '') {
    if (!responses || typeof responses.get !== 'function') return defaultValue;
    const value = responses.get(key);
    if (value === undefined || value === null) return defaultValue;
    if (Array.isArray(value)) {
      return value.join(', ');
    }
    return typeof value === 'string' ? value : defaultValue;
  }

  getResponseList(responses, key) {
    const raw = this.getResponseValue(responses, key, '');
    if (!raw) return [];
    return raw
      .split(/\r?\n|,/)
      .map(entry => entry.trim())
      .filter(Boolean);
  }

  extractResponseEntries(responses, keysFilter = null) {
    if (!responses || typeof responses.forEach !== 'function') return [];
    const filterSet = keysFilter ? new Set(keysFilter) : null;
    const entries = [];
    responses.forEach((value, key) => {
      if (filterSet && !filterSet.has(key)) return;
      if (typeof value === 'string') {
        const trimmed = value.trim();
        if (trimmed) {
          entries.push({ key, text: trimmed.toLowerCase(), raw: trimmed });
        }
      } else if (Array.isArray(value) && value.length) {
        const joined = value.join(' ').trim();
        if (joined) {
          entries.push({ key, text: joined.toLowerCase(), raw: joined });
        }
      }
    });
    return entries;
  }

  responsesContainKeywords(responses, keywords, options = {}) {
    const entries = this.extractResponseEntries(responses, options.keys || null);
    if (!entries.length) return false;
    const normalizedKeywords = keywords.map(keyword => keyword.toLowerCase());
    return entries.some(entry => normalizedKeywords.some(keyword => entry.text.includes(keyword)));
  }

  logFileReadError(context, targetPath, error) {
    if (!error || error.code === 'ENOENT') {
      return;
    }
    const location = targetPath ? ` (${targetPath})` : '';
    console.warn(`[ArtifactGenerator][${context}] ${error.message}${location}`, error);
  }

  async ensureModuleData(moduleData) {
    if (moduleData && Array.isArray(moduleData.modules) && Array.isArray(moduleData.edges)) {
      return moduleData;
    }
    try {
      return await detectModules(this.rootDir);
    } catch (error) {
      this.logFileReadError('module-detection-fallback', null, error);
      return { modules: [], edges: [], summary: { totalLines: 0 } };
    }
  }

  /**
   * Generate Project Analysis Report - Comprehensive project overview
   */
  async generateProjectAnalysis(projectData, moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);
    const analysis = {
      project: {
        name: projectData.name,
        type: projectData.type,
        detectedPatterns: projectData.patterns,
        analysisDate: timestamp
      },
      codebase: {
        totalModules: moduleData.modules.length,
        totalFiles: moduleData.modules.reduce((sum, mod) => sum + mod.fileCount, 0),
        totalLines: moduleData.summary.totalLines,
        testCoverage: this.calculateOverallTestCoverage(moduleData.modules),
        healthScore: this.calculateProjectHealth(moduleData.modules)
      },
      modules: moduleData.modules.map(module => ({
        id: module.id,
        name: module.name,
        type: module.type,
        size: module.lineCount,
        health: module.health,
        dependencies: module.dependencies.length,
        testCoverage: module.coverage,
        frameworks: module.frameworks,
        risksAndIssues: this.identifyModuleRisks(module)
      })),
      architecture: {
        dependencies: moduleData.edges,
        complexity: this.calculateArchitecturalComplexity(moduleData),
        hotspots: this.identifyArchitecturalHotspots(moduleData),
        recommendations: this.generateArchitecturalRecommendations(moduleData, projectData)
      },
      recommendations: this.generateProjectRecommendations(projectData, moduleData, responses),
      nextSteps: this.generateNextSteps(projectData, responses)
    };

    const filename = `project-analysis-${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(analysis, null, 2));

    // Also generate markdown version for readability
    const markdownReport = this.generateAnalysisMarkdown(analysis);
    const mdFilename = filename.replace('.json', '.md');
    await fs.writeFile(path.join(this.outputDir, mdFilename), markdownReport);

    return { filepath, mdFilepath: path.join(this.outputDir, mdFilename) };
  }

  /**
   * Generate Interactive Module Diagram Data
   */
  async generateModuleDiagram(moduleData, projectData) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    // Create Mermaid diagram
    const mermaidDiagram = this.generateMermaidDiagram(moduleData);

    // Create D3.js force-directed graph data
    const d3GraphData = {
      nodes: moduleData.modules.map(module => ({
        id: module.id,
        name: module.name,
        type: module.type,
        size: Math.log(module.lineCount + 1) * 10, // Proportional sizing
        health: module.health,
        color: this.getModuleColor(module.type),
        frameworks: module.frameworks
      })),
      links: moduleData.edges.map(edge => ({
        source: edge.source,
        target: edge.target,
        type: edge.type
      }))
    };

    const diagramData = {
      project: projectData,
      mermaid: mermaidDiagram,
      d3: d3GraphData,
      metadata: {
        generated: timestamp,
        totalNodes: moduleData.modules.length,
        totalEdges: moduleData.edges.length
      }
    };

    const filename = `module-diagram-${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(diagramData, null, 2));

    return { filepath };
  }

  /**
   * Generate Architecture Diagram (High-level system view)
   */
  async generateArchitectureDiagram(projectData, moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    // Group modules into architectural layers
    const layers = this.groupModulesIntoLayers(moduleData.modules);

    // Create system context diagram
    const systemDiagram = {
      title: `${projectData.name} - System Architecture`,
      layers,
      dataFlow: this.generateDataFlow(moduleData),
      externalSystems: this.identifyExternalSystems(moduleData),
      deploymentView: this.generateDeploymentView(responses),
      securityBoundaries: this.identifySecurityBoundaries(responses)
    };

    // Generate PlantUML diagram
    const plantUmlDiagram = this.generatePlantUMLArchitecture(systemDiagram);

    // Generate Mermaid C4 diagram
    const c4Diagram = this.generateMermaidC4(systemDiagram);

    const architectureData = {
      project: projectData,
      systemDiagram,
      plantUml: plantUmlDiagram,
      mermaidC4: c4Diagram,
      metadata: {
        generated: timestamp,
        layers: Object.keys(layers).length
      }
    };

    const filename = `architecture-diagram-${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(architectureData, null, 2));

    return { filepath };
  }

  /**
   * Generate Technical Specification Document
   */
  async generateTechnicalSpecification(projectData, moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    const spec = {
      document: {
        title: `${projectData.name} - Technical Specification`,
        version: '1.0',
        generated: timestamp,
        lastModified: timestamp
      },
      overview: this.generateSpecOverview(projectData, responses),
      architecture: this.generateSpecArchitecture(moduleData, responses),
      dataModel: this.generateDataModel(moduleData, responses),
      apiSpecification: this.generateAPISpec(moduleData, responses),
      userInterface: this.generateUISpec(moduleData, responses),
      infrastructure: this.generateInfrastructureSpec(responses),
      security: this.generateSecuritySpec(responses),
      testing: this.generateTestingSpec(moduleData, responses),
      deployment: this.generateDeploymentSpec(responses),
      maintenance: this.generateMaintenanceSpec(moduleData, responses),
      appendices: {
        glossary: this.generateGlossary(responses),
        references: this.generateReferences(responses),
        changeLog: []
      }
    };

    // Generate both JSON and formatted markdown
    const specMarkdown = this.generateSpecMarkdown(spec);

    const jsonFilename = `technical-spec-${timestamp.replace(/[:.]/g, '-')}.json`;
    const mdFilename = `technical-spec-${timestamp.replace(/[:.]/g, '-')}.md`;

    const jsonFilepath = path.join(this.outputDir, jsonFilename);
    const mdFilepath = path.join(this.outputDir, mdFilename);

    await fs.writeFile(jsonFilepath, JSON.stringify(spec, null, 2));
    await fs.writeFile(mdFilepath, specMarkdown);

    return { jsonFilepath, mdFilepath };
  }

  /**
   * Generate API Documentation (Auto-detected endpoints)
   */
  async generateAPIDocumentation(moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    // Extract API endpoints from backend modules
    const apiEndpoints = await this.extractAPIEndpoints(moduleData);

    const apiDocs = {
      info: {
        title: `${responses.get('project-name') || 'Project'} API`,
        version: '1.0.0',
        description: responses.get('project-purpose') || 'Auto-generated API documentation',
        generated: timestamp
      },
      servers: this.generateServerInfo(responses),
      paths: apiEndpoints,
      components: {
        schemas: await this.extractDataSchemas(moduleData),
        securitySchemes: this.generateSecuritySchemes(responses)
      },
      security: this.generateSecurityRequirements(responses)
    };

    // Generate OpenAPI 3.0 spec
    const openApiSpec = this.generateOpenAPISpec(apiDocs);

    const filename = `api-documentation-${timestamp.replace(/[:.]/g, '-')}.json`;
    const filepath = path.join(this.outputDir, filename);
    await fs.writeFile(filepath, JSON.stringify(openApiSpec, null, 2));

    return { filepath };
  }

  /**
   * Generate Frontend Development Checklist
   */
  async generateFrontendChecklist(projectData, moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    const checklist = {
      project: projectData.name,
      generated: timestamp,
      categories: [
        {
          name: 'Setup & Configuration',
          items: this.getFrontendSetupChecklist(moduleData, responses)
        },
        {
          name: 'Component Architecture',
          items: this.getComponentArchitectureChecklist(moduleData)
        },
        {
          name: 'State Management',
          items: this.getStateManagementChecklist(moduleData)
        },
        {
          name: 'Performance',
          items: this.getPerformanceChecklist(responses)
        },
        {
          name: 'Accessibility',
          items: this.getAccessibilityChecklist(responses)
        },
        {
          name: 'Testing',
          items: this.getFrontendTestingChecklist(moduleData)
        },
        {
          name: 'Deployment',
          items: this.getFrontendDeploymentChecklist(responses)
        }
      ]
    };

    const checklistMarkdown = this.generateChecklistMarkdown(checklist);

    const mdFilename = `frontend-checklist-${timestamp.replace(/[:.]/g, '-')}.md`;
    const mdFilepath = path.join(this.outputDir, mdFilename);
    await fs.writeFile(mdFilepath, checklistMarkdown);

    return { mdFilepath };
  }

  /**
   * Generate Testing Strategy & Coverage Report
   */
  async generateTestingStrategy(moduleData, responses) {
    const timestamp = new Date().toISOString();
    moduleData = await this.ensureModuleData(moduleData);

    const strategy = {
      project: responses.get('project-name') || 'Project',
      generated: timestamp,
      currentState: {
        totalModules: moduleData.modules.length,
        testedModules: moduleData.modules.filter(m => m.testFileCount > 0).length,
        overallCoverage: this.calculateOverallTestCoverage(moduleData.modules),
        coverageByModule: moduleData.modules.map(m => ({
          module: m.name,
          coverage: m.coverage,
          testFiles: m.testFileCount,
          codeFiles: m.fileCount
        }))
      },
      recommendations: this.generateTestingRecommendations(moduleData, responses),
      testingPyramid: this.generateTestingPyramid(moduleData, responses),
      toolsAndFrameworks: this.recommendTestingTools(moduleData, responses),
      implementation: {
        quickWins: this.identifyTestingQuickWins(moduleData),
        priorities: this.prioritizeTestingEfforts(moduleData),
        roadmap: this.generateTestingRoadmap(moduleData)
      }
    };

    const strategyMarkdown = this.generateTestingStrategyMarkdown(strategy);

    const mdFilename = `testing-strategy-${timestamp.replace(/[:.]/g, '-')}.md`;
    const mdFilepath = path.join(this.outputDir, mdFilename);
    await fs.writeFile(mdFilepath, strategyMarkdown);

    return { mdFilepath };
  }

  // Helper methods for calculations and analysis

  calculateOverallTestCoverage(modules) {
    const totalFiles = modules.reduce((sum, mod) => sum + mod.fileCount, 0);
    const totalTestFiles = modules.reduce((sum, mod) => sum + mod.testFileCount, 0);

    return totalFiles === 0 ? 0 : Math.round((totalTestFiles / totalFiles) * 100);
  }

  calculateProjectHealth(modules) {
    const avgHealth = modules.reduce((sum, mod) => sum + mod.health, 0) / modules.length;
    return Math.round(avgHealth);
  }

  identifyModuleRisks(module) {
    const risks = [];

    if (module.health < 50) risks.push('Low health score');
    if (module.coverage < 30) risks.push('Low test coverage');
    if (module.todoCount > 10) risks.push('High technical debt');
    if (module.dependencies.length > 5) risks.push('High coupling');
    if (module.externalDependencies.length > 20) risks.push('Many external dependencies');

    return risks;
  }

  calculateArchitecturalComplexity(moduleData) {
    const moduleCount = moduleData.modules.length;
    const dependencyCount = moduleData.edges.length;
    const avgDependencies = dependencyCount / moduleCount;

    let complexity = 'Low';
    if (moduleCount > 10 && avgDependencies > 3) complexity = 'Medium';
    if (moduleCount > 20 && avgDependencies > 5) complexity = 'High';
    if (moduleCount > 50 && avgDependencies > 8) complexity = 'Very High';

    return {
      level: complexity,
      score: Math.min(100, (moduleCount * avgDependencies) / 2),
      factors: {
        moduleCount,
        dependencyCount,
        avgDependencies: Math.round(avgDependencies * 10) / 10
      }
    };
  }

  identifyArchitecturalHotspots(moduleData) {
    const hotspots = [];

    // Identify modules with many dependencies (high coupling)
    const highCouplingModules = moduleData.modules
      .filter(m => m.dependencies.length > 5)
      .sort((a, b) => b.dependencies.length - a.dependencies.length);

    if (highCouplingModules.length > 0) {
      hotspots.push({
        type: 'High Coupling',
        description: 'Modules with many dependencies that may be hard to maintain',
        modules: highCouplingModules.slice(0, 3).map(m => m.name)
      });
    }

    // Identify modules that many others depend on (central nodes)
    const dependencyCounts = new Map();
    moduleData.edges.forEach(edge => {
      dependencyCounts.set(edge.target, (dependencyCounts.get(edge.target) || 0) + 1);
    });

    const centralModules = Array.from(dependencyCounts.entries())
      .filter(([, count]) => count > 3)
      .sort((a, b) => b[1] - a[1])
      .map(([moduleId]) => moduleData.modules.find(m => m.id === moduleId))
      .filter(Boolean);

    if (centralModules.length > 0) {
      hotspots.push({
        type: 'Central Dependencies',
        description: 'Modules that many others depend on - changes here have wide impact',
        modules: centralModules.slice(0, 3).map(m => m.name)
      });
    }

    return hotspots;
  }

  generateArchitecturalRecommendations(moduleData, projectData) {
    const recommendations = [];

    // Test coverage recommendations
    const lowCoverageModules = moduleData.modules.filter(m => m.coverage < 50);
    if (lowCoverageModules.length > 0) {
      recommendations.push({
        type: 'Testing',
        priority: 'High',
        title: 'Improve Test Coverage',
        description: `${lowCoverageModules.length} modules have low test coverage (<50%). Consider prioritizing testing efforts.`,
        modules: lowCoverageModules.slice(0, 3).map(m => m.name)
      });
    }

    // Technical debt recommendations
    const highDebtModules = moduleData.modules
      .filter(m => m.todoCount > 5)
      .sort((a, b) => b.todoCount - a.todoCount);

    if (highDebtModules.length > 0) {
      recommendations.push({
        type: 'Technical Debt',
        priority: 'Medium',
        title: 'Address Technical Debt',
        description: 'Several modules have high TODO/FIXME counts indicating technical debt.',
        modules: highDebtModules.slice(0, 3).map(m => `${m.name} (${m.todoCount} TODOs)`)
      });
    }

    // Architecture recommendations based on patterns
    if (projectData.patterns.includes('frontend-heavy')) {
      recommendations.push({
        type: 'Architecture',
        priority: 'Medium',
        title: 'Consider Component Libraries',
        description: 'Frontend-heavy projects benefit from shared component libraries and design systems.'
      });
    }

    if (projectData.patterns.includes('api-service')) {
      recommendations.push({
        type: 'Documentation',
        priority: 'High',
        title: 'API Documentation',
        description: 'API services need comprehensive documentation for consumers. Consider OpenAPI/Swagger.'
      });
    }

    return recommendations;
  }

  generateProjectRecommendations(projectData, moduleData, responses) {
    const recommendations = [];
    const add = rec => {
      if (rec && !recommendations.includes(rec)) {
        recommendations.push(rec);
      }
    };

    const summary = moduleData.summary || {};
    const lowHealthModules = moduleData.modules
      .filter(module => typeof module.health === 'number' && module.health < 60)
      .slice(0, 3);
    if (lowHealthModules.length > 0) {
      add(`Stabilise low-health modules (${lowHealthModules.map(m => m.name).join(', ')}) before expanding scope.`);
    }

    if (moduleData.modules.length > 20 || (summary.totalLines || 0) > 20000) {
      add('Introduce domain-driven ownership boundaries and modular builds to keep large codebases maintainable.');
    }

    const externalHeavy = moduleData.modules.filter(m => Array.isArray(m.externalDependencies) && m.externalDependencies.length > 5);
    if (externalHeavy.length > 0) {
      add('Establish a dependency review cadence and lockfile policy for modules that lean heavily on third-party libraries.');
    }

    if (projectData.patterns.includes('web-application')) {
      add('Implement Progressive Web App capabilities and critical rendering path budgets for the web surface.');
    }

    if (projectData.patterns.includes('containerized')) {
      add('Harden the container workflow with image scanning, base-image patching, and runtime policies.');
    }

    if (this.responsesContainKeywords(responses, ['accessibility', 'wcag', 'screen reader', 'a11y'])) {
      add('Schedule recurring accessibility audits and bake automated axe/pa11y checks into the CI pipeline.');
    }

    if (this.responsesContainKeywords(responses, ['compliance', 'gdpr', 'hipaa', 'pci', 'soc 2', 'iso 27001'])) {
      add('Align engineering backlog with compliance evidence requirements (audit logging, retention, data residency).');
    }

    const performanceBudget = this.getResponseValue(responses, 'performance-budget', '');
    if (performanceBudget) {
      add(`Wire the declared performance budgets (${performanceBudget}) into automated Lighthouse/Calibre gates.`);
    }

    if (this.responsesContainKeywords(responses, ['observability', 'telemetry', 'slo', 'sla', 'uptime'])) {
      add('Expand observability coverage with SLIs/SLOs, alert runbooks, and error budget tracking.');
    }

    const releaseCadence = this.getResponseValue(responses, 'release-cadence', '').toLowerCase();
    if (releaseCadence.includes('continuous') || releaseCadence.includes('daily')) {
      add('Invest in automated rollback, progressive delivery, and feature flag governance to support the planned release cadence.');
    }

    const integrationRisks = this.getResponseList(responses, 'integration-failure-modes');
    if (integrationRisks.length > 0) {
      add(`Create resilience tests and fallbacks for critical integrations (${integrationRisks.slice(0, 2).join('; ')}).`);
    }

    const preferredFramework = this.getResponseValue(responses, 'preferred-framework', '').toLowerCase();
    if (preferredFramework.includes('vue')) {
      add('Codify the Vue component library (Storybook, design tokens, visual regression checks) to support reuse.');
    } else if (preferredFramework.includes('react')) {
      add('Adopt React-specific linting rules, bundle analysis, and suspense/data-fetching patterns aligned with the interview outcomes.');
    } else if (preferredFramework.includes('angular')) {
      add('Document Nx/Angular workspace conventions and guard schematics to enforce module boundaries.');
    }

    return recommendations;
  }

  generateNextSteps(projectData, responses) {
    const steps = [
      'Review the generated analysis and recommendations',
      'Prioritize technical debt reduction in low-health modules',
      'Implement missing tests in uncovered modules'
    ];

    const add = step => {
      if (step && !steps.includes(step)) {
        steps.push(step);
      }
    };

    if (projectData.patterns.includes('api-service')) {
      add('Generate OpenAPI/AsyncAPI specifications and publish them to the Docs hub.');
      add('Set up API monitoring, synthetic checks, and contract tests.');
    }

    if (projectData.patterns.includes('frontend-heavy')) {
      add('Implement automated accessibility tests and performance monitoring for the UI.');
    }

    const stateStrategy = this.getResponseValue(responses, 'state-management-strategy', '');
    if (stateStrategy) {
      add(`Document the agreed state management approach (${stateStrategy}) and share it with feature squads.`);
    }

    if (this.responsesContainKeywords(responses, ['design system', 'component library', 'storytelling'])) {
      add('Kick off a design system backlog (tokens, theming, reusable components) aligned with interview expectations.');
    }

    if (this.responsesContainKeywords(responses, ['edge', 'cdn', 'caching', 'revalidation'])) {
      add('Prototype edge caching/revalidation workflows in staging before launch.');
    }

    const documentationOwner = this.getResponseValue(responses, 'docs-update-responsibility', '');
    if (documentationOwner) {
      add(`Set up documentation ownership workflow with ${documentationOwner} and publish the cadence.`);
    }

    const complianceStandards = this.getResponseList(responses, 'compliance-standards');
    if (complianceStandards.length > 0) {
      add(`Map engineering checkpoints to compliance standards (${complianceStandards.join(', ')}).`);
    }

    if (this.responsesContainKeywords(responses, ['training', 'enablement', 'onboarding'])) {
      add('Schedule enablement sessions to socialise new delivery guardrails across teams.');
    }

    return steps;
  }

  // Diagram generation methods

  generateMermaidDiagram(moduleData) {
    const lines = ['graph TD'];

    // Add nodes
    moduleData.modules.forEach(module => {
      const nodeId = module.id.replace(/[^a-zA-Z0-9]/g, '_');
      const shape = this.getMermaidNodeShape(module.type);
      lines.push(`    ${nodeId}${shape}["${module.name}"]`);
    });

    // Add edges
    moduleData.edges.forEach(edge => {
      const sourceId = edge.source.replace(/[^a-zA-Z0-9]/g, '_');
      const targetId = edge.target.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`    ${sourceId} --> ${targetId}`);
    });

    // Add styling
    lines.push('    classDef frontend fill:#e1f5fe');
    lines.push('    classDef backend fill:#f3e5f5');
    lines.push('    classDef database fill:#e8f5e8');

    moduleData.modules.forEach(module => {
      const nodeId = module.id.replace(/[^a-zA-Z0-9]/g, '_');
      lines.push(`    class ${nodeId} ${module.type}`);
    });

    return lines.join('\n');
  }

  getMermaidNodeShape(type) {
    const shapes = {
      frontend: '(',
      backend: '[',
      database: '[(',
      documentation: '{',
      automation: '[[',
      default: '['
    };
    return shapes[type] || shapes.default;
  }

  getModuleColor(type) {
    const colors = {
      frontend: '#42a5f5',
      backend: '#ab47bc',
      database: '#66bb6a',
      documentation: '#ffa726',
      automation: '#ef5350',
      default: '#78909c'
    };
    return colors[type] || colors.default;
  }

  // Markdown generation methods

  generateAnalysisMarkdown(analysis) {
    return `# ${analysis.project.name} - Project Analysis

Generated on: ${new Date(analysis.project.analysisDate).toLocaleDateString()}

## Project Overview

- **Type**: ${analysis.project.type}
- **Detected Patterns**: ${analysis.project.detectedPatterns.join(', ')}
- **Total Modules**: ${analysis.codebase.totalModules}
- **Total Lines**: ${analysis.codebase.totalLines.toLocaleString()}
- **Test Coverage**: ${analysis.codebase.testCoverage}%
- **Health Score**: ${analysis.codebase.healthScore}/100

## Architecture Analysis

**Complexity**: ${analysis.architecture.complexity.level}

### Architectural Hotspots

${analysis.architecture.hotspots.map(hotspot =>
  `**${hotspot.type}**: ${hotspot.description}\n- ${hotspot.modules.join('\n- ')}`
).join('\n\n')}

## Modules

| Module | Type | Size (LOC) | Health | Test Coverage | Dependencies |
|--------|------|------------|---------|---------------|--------------|
${analysis.modules.map(m =>
  `| ${m.name} | ${m.type} | ${m.size} | ${m.health} | ${m.testCoverage}% | ${m.dependencies} |`
).join('\n')}

## Recommendations

${analysis.recommendations.map(rec => `- ${rec}`).join('\n')}

## Next Steps

${analysis.nextSteps.map(step => `1. ${step}`).join('\n')}
`;
  }

  generateChecklistMarkdown(checklist) {
    return `# ${checklist.project} - Frontend Development Checklist

Generated on: ${new Date(checklist.generated).toLocaleDateString()}

${checklist.categories.map(category => `
## ${category.name}

${category.items.map(item => `- [ ] ${item}`).join('\n')}
`).join('\n')}
`;
  }

  async extractAPIEndpoints(moduleData) {
    const endpoints = {};

    for (const module of moduleData.modules) {
      if (module.type === 'backend' && module.frameworks.some(fw =>
        ['express', 'fastify', 'koa', 'nest'].includes(fw))) {

        // Analyze backend module files for API routes
        for (const pathHint of module.pathHints) {
          try {
            const content = await fs.readFile(pathHint, 'utf8');
            const routes = this.parseRoutes(content, module.frameworks);

            Object.keys(routes).forEach(method => {
              if (!endpoints[method]) endpoints[method] = {};
              Object.assign(endpoints[method], routes[method]);
            });
          } catch (error) {
            this.logFileReadError('api-endpoint-scan', pathHint, error);
            continue;
          }
        }
      }
    }

    return endpoints;
  }

  parseRoutes(content, frameworks) {
    const routes = { get: {}, post: {}, put: {}, delete: {}, patch: {} };

    // Express route patterns
    if (frameworks.includes('express')) {
      const expressPatterns = [
        /app\.get\(['"`]([^'"`]+)['"`]/g,
        /app\.post\(['"`]([^'"`]+)['"`]/g,
        /app\.put\(['"`]([^'"`]+)['"`]/g,
        /app\.delete\(['"`]([^'"`]+)['"`]/g,
        /app\.patch\(['"`]([^'"`]+)['"`]/g
      ];

      const methods = ['get', 'post', 'put', 'delete', 'patch'];

      expressPatterns.forEach((pattern, index) => {
        const method = methods[index];
        let match;
        while ((match = pattern.exec(content)) !== null) {
          const path = match[1];
          routes[method][path] = {
            summary: `${method.toUpperCase()} ${path}`,
            parameters: this.extractPathParameters(path),
            responses: {
              '200': { description: 'Success' },
              '400': { description: 'Bad Request' },
              '500': { description: 'Internal Server Error' }
            }
          };
        }
      });
    }

    return routes;
  }

  extractPathParameters(path) {
    const params = [];
    const paramPattern = /:([a-zA-Z_][a-zA-Z0-9_]*)/g;
    let match;

    while ((match = paramPattern.exec(path)) !== null) {
      params.push({
        name: match[1],
        in: 'path',
        required: true,
        schema: { type: 'string' }
      });
    }

    return params;
  }

  async extractDataSchemas(moduleData) {
    const schemas = {};

    for (const module of moduleData.modules) {
      if (module.type === 'backend' || module.type === 'database') {
        for (const pathHint of module.pathHints) {
          try {
            const content = await fs.readFile(pathHint, 'utf8');
            const moduleSchemas = this.parseDataSchemas(content);
            Object.assign(schemas, moduleSchemas);
          } catch (error) {
            this.logFileReadError('schema-extraction', pathHint, error);
            continue;
          }
        }
      }
    }

    return schemas;
  }

  parseDataSchemas(content) {
    const schemas = {};

    // Parse JavaScript/TypeScript interfaces and types
    const interfacePattern = /interface\s+(\w+)\s*{([^}]+)}/g;
    const typePattern = /type\s+(\w+)\s*=\s*{([^}]+)}/g;

    let match;

    // Extract interfaces
    while ((match = interfacePattern.exec(content)) !== null) {
      const name = match[1];
      const properties = this.parseTypeProperties(match[2]);
      schemas[name] = {
        type: 'object',
        properties,
        required: Object.keys(properties).filter(key =>
          !match[2].includes(`${key}?:`))
      };
    }

    // Extract type definitions
    while ((match = typePattern.exec(content)) !== null) {
      const name = match[1];
      const properties = this.parseTypeProperties(match[2]);
      schemas[name] = {
        type: 'object',
        properties,
        required: Object.keys(properties)
      };
    }

    return schemas;
  }

  parseTypeProperties(propertiesString) {
    const properties = {};
    const lines = propertiesString.split('\n');

    lines.forEach(line => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('//')) return;

      const match = trimmed.match(/(\w+)\??\s*:\s*([^;,]+)/);
      if (match) {
        const [, name, type] = match;
        properties[name] = this.mapTypeToJsonSchema(type.trim());
      }
    });

    return properties;
  }

  mapTypeToJsonSchema(tsType) {
    const typeMap = {
      'string': { type: 'string' },
      'number': { type: 'number' },
      'boolean': { type: 'boolean' },
      'Date': { type: 'string', format: 'date-time' },
      'object': { type: 'object' }
    };

    // Handle arrays
    if (tsType.endsWith('[]')) {
      const itemType = tsType.slice(0, -2);
      return {
        type: 'array',
        items: this.mapTypeToJsonSchema(itemType)
      };
    }

    return typeMap[tsType] || { type: 'string', description: `Custom type: ${tsType}` };
  }

  groupModulesIntoLayers(modules) {
    const layers = {
      presentation: modules.filter(m => m.type === 'frontend'),
      business: modules.filter(m => m.type === 'backend'),
      data: modules.filter(m => m.type === 'database' || m.type === 'storage'),
      infrastructure: modules.filter(m => m.type === 'automation'),
      shared: modules.filter(m => m.type === 'code' && m.name.toLowerCase().includes('shared')),
      services: modules.filter(m => m.type === 'workspace' || m.name.toLowerCase().includes('service'))
    };

    return layers;
  }

  generateDataFlow(moduleData) {
    const dataFlow = [];

    // Analyze dependencies to create data flow
    moduleData.edges.forEach(edge => {
      const sourceModule = moduleData.modules.find(m => m.id === edge.source);
      const targetModule = moduleData.modules.find(m => m.id === edge.target);

      if (sourceModule && targetModule) {
        dataFlow.push({
          from: sourceModule.name,
          to: targetModule.name,
          type: this.determineDataFlowType(sourceModule, targetModule),
          description: this.generateFlowDescription(sourceModule, targetModule)
        });
      }
    });

    return dataFlow;
  }

  determineDataFlowType(source, target) {
    if (source.type === 'frontend' && target.type === 'backend') return 'API Request';
    if (source.type === 'backend' && target.type === 'database') return 'Database Query';
    if (source.type === 'backend' && target.type === 'frontend') return 'API Response';
    if (source.type === 'automation' && target.type === 'backend') return 'Process Trigger';
    return 'Data Exchange';
  }

  generateFlowDescription(source, target) {
    const flowType = this.determineDataFlowType(source, target);
    return `${source.name} sends ${flowType.toLowerCase()} to ${target.name}`;
  }

  identifyExternalSystems(moduleData) {
    const externalSystems = new Set();

    moduleData.modules.forEach(module => {
      module.externalDependencies.forEach(dep => {
        if (this.isExternalService(dep)) {
          externalSystems.add({
            name: dep,
            type: this.categorizeExternalSystem(dep),
            description: this.getSystemDescription(dep)
          });
        }
      });
    });

    return Array.from(externalSystems);
  }

  isExternalService(dependency) {
    const externalServices = [
      'aws-sdk', 'stripe', 'sendgrid', 'twilio', 'firebase',
      'mongodb', 'postgres', 'redis', 'elasticsearch'
    ];
    return externalServices.some(service => dependency.includes(service));
  }

  categorizeExternalSystem(dependency) {
    if (dependency.includes('aws') || dependency.includes('azure') || dependency.includes('gcp')) {
      return 'Cloud Service';
    }
    if (dependency.includes('stripe') || dependency.includes('paypal')) {
      return 'Payment Service';
    }
    if (dependency.includes('sendgrid') || dependency.includes('twilio')) {
      return 'Communication Service';
    }
    if (dependency.includes('mongodb') || dependency.includes('postgres') || dependency.includes('mysql')) {
      return 'Database Service';
    }
    return 'External API';
  }

  getSystemDescription(dependency) {
    const descriptions = {
      'aws-sdk': 'Amazon Web Services SDK for cloud services',
      'stripe': 'Payment processing platform',
      'sendgrid': 'Email delivery service',
      'twilio': 'Communication platform (SMS, Voice, Video)',
      'mongodb': 'NoSQL document database',
      'postgres': 'PostgreSQL relational database',
      'redis': 'In-memory data structure store'
    };
    return descriptions[dependency] || `External dependency: ${dependency}`;
  }

  generateDeploymentView(responses) {
    const environments = [];

    // Extract deployment info from responses
    const deploymentStrategy = responses.get('deployment-strategy') || 'containerized';
    const environmentsRaw = responses.get('environment-promotion') || 'dev, staging, production';

    environmentsRaw.split(',').forEach(env => {
      environments.push({
        name: env.trim(),
        type: env.includes('prod') ? 'production' : 'non-production',
        deploymentStrategy
      });
    });

    return {
      strategy: deploymentStrategy,
      environments,
      cicd: this.inferCICDPipeline(responses)
    };
  }

  inferCICDPipeline(responses) {
    const releaseStrategy = responses.get('release-cadence') || '';

    if (releaseStrategy.includes('continuous')) {
      return {
        type: 'Continuous Deployment',
        triggers: ['push to main', 'pull request merge'],
        stages: ['test', 'build', 'deploy']
      };
    }

    return {
      type: 'Scheduled Release',
      triggers: ['manual trigger', 'scheduled deployment'],
      stages: ['test', 'build', 'stage', 'deploy']
    };
  }

  generateSecurityBoundaries(responses) {
    const boundaries = [];

    const authModel = responses.get('authentication-model') || '';
    const authzModel = responses.get('authorization-model') || '';

    if (authModel.includes('SSO')) {
      boundaries.push({
        name: 'SSO Authentication Boundary',
        description: 'Single Sign-On authentication layer',
        controls: ['Multi-factor authentication', 'Session management']
      });
    }

    if (authzModel.includes('RBAC')) {
      boundaries.push({
        name: 'Role-Based Access Control',
        description: 'Authorization boundary based on user roles',
        controls: ['Role assignment', 'Permission validation']
      });
    }

    return boundaries;
  }

  generatePlantUMLArchitecture(systemDiagram) {
    const lines = ['@startuml', 'title System Architecture'];

    // Add external systems
    systemDiagram.externalSystems.forEach(system => {
      lines.push(`cloud "${system.name}" as ${system.name.replace(/\s+/g, '_')}`);
    });

    // Add internal layers
    Object.keys(systemDiagram.layers).forEach(layerName => {
      const layer = systemDiagram.layers[layerName];
      if (layer.length > 0) {
        lines.push(`package "${layerName.toUpperCase()}" {`);
        layer.forEach(module => {
          lines.push(`  [${module.name}] as ${module.id}`);
        });
        lines.push('}');
      }
    });

    // Add data flows
    systemDiagram.dataFlow.forEach(flow => {
      const fromId = flow.from.replace(/\s+/g, '_');
      const toId = flow.to.replace(/\s+/g, '_');
      lines.push(`${fromId} --> ${toId} : ${flow.type}`);
    });

    lines.push('@enduml');
    return lines.join('\n');
  }

  generateMermaidC4(systemDiagram) {
    const lines = ['graph TB'];

    // Add system context
    lines.push('  subgraph "System Context"');

    systemDiagram.externalSystems.forEach(system => {
      const nodeId = system.name.replace(/\s+/g, '_');
      lines.push(`    ${nodeId}["${system.name}<br/>${system.type}"]:::external`);
    });

    Object.keys(systemDiagram.layers).forEach(layerName => {
      const layer = systemDiagram.layers[layerName];
      if (layer.length > 0) {
        lines.push(`  subgraph "${layerName.toUpperCase()}"`);
        layer.forEach(module => {
          lines.push(`    ${module.id}["${module.name}"]:::${module.type}`);
        });
        lines.push('  end');
      }
    });

    lines.push('  end');

    // Add styling
    lines.push('  classDef frontend fill:#e3f2fd');
    lines.push('  classDef backend fill:#f3e5f5');
    lines.push('  classDef database fill:#e8f5e8');
    lines.push('  classDef external fill:#fff3e0');

    return lines.join('\n');
  }

  generateSpecOverview(projectData, responses) {
    return {
      projectName: projectData.name,
      projectType: projectData.type,
      purpose: responses.get('project-purpose') || 'Project purpose not specified',
      valueProposition: responses.get('value-proposition') || 'Value proposition not specified',
      stakeholders: {
        sponsor: responses.get('executive-sponsor') || 'Not specified',
        productOwner: responses.get('product-owner') || 'Not specified',
        technicalLead: responses.get('technical-lead') || 'Not specified'
      },
      scope: {
        inclusions: this.parseListResponse(responses.get('scope-inclusions')),
        exclusions: this.parseListResponse(responses.get('scope-exclusions')),
        definition: responses.get('done-definition') || 'Not specified'
      }
    };
  }

  parseListResponse(response) {
    if (!response) return [];
    return response.split('\n')
      .filter(line => line.trim())
      .map(line => line.trim().replace(/^[-*]\s*/, ''));
  }

  generateSpecArchitecture(moduleData, responses) {
    return {
      current: responses.get('current-architecture') || 'Current architecture not documented',
      target: responses.get('target-architecture-vision') || 'Target architecture not specified',
      technicalDebt: this.parseListResponse(responses.get('tech-debt-hotspots')),
      moduleOverview: moduleData.modules.map(module => ({
        name: module.name,
        type: module.type,
        health: module.health,
        dependencies: module.dependencies.length,
        concerns: this.identifyModuleRisks(module)
      }))
    };
  }

  generateDataModel(moduleData, responses) {
    return {
      coreEntities: this.parseListResponse(responses.get('core-entities')),
      dataSources: this.parseListResponse(responses.get('data-sources')),
      volumeCharacteristics: responses.get('data-volume-velocity') || 'Not specified',
      governanceRequirements: responses.get('data-governance') || 'Not specified',
      entityRelationships: this.inferEntityRelationships(moduleData)
    };
  }

  inferEntityRelationships(moduleData) {
    // Basic relationship inference based on module dependencies
    const relationships = [];

    moduleData.edges.forEach(edge => {
      const source = moduleData.modules.find(m => m.id === edge.source);
      const target = moduleData.modules.find(m => m.id === edge.target);

      if (source && target) {
        relationships.push({
          from: source.name,
          to: target.name,
          relationship: this.determineRelationshipType(source, target)
        });
      }
    });

    return relationships;
  }

  determineRelationshipType(source, target) {
    if (source.type === 'frontend' && target.type === 'backend') return 'consumes';
    if (source.type === 'backend' && target.type === 'database') return 'persists to';
    if (source.type === 'backend' && target.type === 'storage') return 'stores in';
    return 'depends on';
  }

  generateAPISpec(moduleData, responses) {
    const apiModules = moduleData.modules.filter(m =>
      m.type === 'backend' && m.frameworks.some(fw =>
        ['express', 'fastify', 'nest'].includes(fw)));

    return {
      overview: 'API specification based on detected backend modules',
      modules: apiModules.map(module => ({
        name: module.name,
        frameworks: module.frameworks,
        endpoints: `Estimated ${module.lineCount / 50} endpoints based on code size`
      })),
      authentication: responses.get('authentication-model') || 'Not specified',
      authorization: responses.get('authorization-model') || 'Not specified',
      rateLimit: 'Rate limiting configuration not specified'
    };
  }

  generateUISpec(moduleData, responses) {
    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend');

    if (frontendModules.length === 0) {
      return { message: 'No frontend modules detected' };
    }

    return {
      overview: 'User interface specification based on detected frontend modules',
      modules: frontendModules.map(module => ({
        name: module.name,
        frameworks: module.frameworks,
        componentCount: `Estimated ${module.fileCount * 2} components`,
        testCoverage: `${module.coverage}%`
      })),
      designSystem: responses.get('design-system') || 'Not specified',
      responsiveBreakpoints: responses.get('responsive-breakpoints') || 'Standard breakpoints assumed',
      accessibilityStandards: responses.get('accessibility-standards') || 'WCAG AA compliance target'
    };
  }

  generateInfrastructureSpec(responses) {
    return {
      deployment: {
        strategy: responses.get('deployment-strategy') || 'Not specified',
        environments: this.parseListResponse(responses.get('environment-promotion')),
        automation: responses.get('release-cadence') || 'Not specified'
      },
      monitoring: {
        observability: responses.get('observability-tooling') || 'Not specified',
        availability: responses.get('availability-targets') || 'Not specified',
        scaling: responses.get('scaling-strategy') || 'Not specified'
      },
      security: {
        compliance: this.parseListResponse(responses.get('compliance-standards')),
        monitoring: responses.get('security-monitoring') || 'Not specified'
      }
    };
  }

  generateSecuritySpec(responses) {
    return {
      authentication: {
        model: responses.get('authentication-model') || 'Not specified',
        implementation: 'Based on specified authentication model'
      },
      authorization: {
        model: responses.get('authorization-model') || 'Not specified',
        implementation: 'Role-based access control assumed'
      },
      compliance: {
        standards: this.parseListResponse(responses.get('compliance-standards')),
        monitoring: responses.get('security-monitoring') || 'Security monitoring not specified'
      },
      dataProtection: {
        encryption: 'Encryption at rest and in transit required',
        privacy: 'Privacy by design principles to be followed'
      }
    };
  }

  generateTestingSpec(moduleData, responses) {
    const testingStrategy = responses.get('testing-strategy') || 'Testing strategy not specified';

    return {
      strategy: testingStrategy,
      currentCoverage: this.calculateOverallTestCoverage(moduleData.modules),
      pyramid: {
        unit: 'Component and function level tests',
        integration: 'Module integration tests',
        e2e: 'End-to-end user journey tests'
      },
      tools: this.recommendTestingTools(moduleData, responses),
      qualityGates: {
        minimumCoverage: '70%',
        qualityThreshold: 'All tests must pass before deployment'
      }
    };
  }

  generateDeploymentSpec(responses) {
    return {
      strategy: responses.get('deployment-strategy') || 'Containerized deployment assumed',
      environments: this.parseListResponse(responses.get('environment-promotion')),
      pipeline: {
        stages: ['build', 'test', 'security-scan', 'deploy'],
        automation: responses.get('release-cadence') || 'Automated CI/CD pipeline'
      },
      rollback: {
        strategy: responses.get('rollback-plan') || 'Automated rollback on failure',
        testing: 'Rollback testing in staging environment required'
      }
    };
  }

  generateMaintenanceSpec(moduleData, responses) {
    const highDebtModules = moduleData.modules
      .filter(m => m.todoCount > 5)
      .sort((a, b) => b.todoCount - a.todoCount);

    return {
      technicalDebt: {
        current: `${highDebtModules.length} modules with high technical debt`,
        priorities: highDebtModules.slice(0, 3).map(m =>
          `${m.name}: ${m.todoCount} items`),
        strategy: 'Regular technical debt reduction sprints'
      },
      monitoring: {
        health: 'Module health monitoring dashboard',
        alerts: 'Automated alerts for health degradation'
      },
      documentation: {
        maintenance: responses.get('docs-update-responsibility') || 'Documentation ownership not specified',
        cadence: 'Monthly documentation review cycles'
      }
    };
  }

  generateGlossary(responses) {
    const terms = new Map();

    this.extractResponseEntries(responses).forEach(entry => {
      const technicalTerms = this.extractTechnicalTerms(entry.raw || '');
      technicalTerms.forEach(term => {
        if (!terms.has(term)) {
          terms.set(term, {
            definition: this.defineBusinessTerm(term),
            sources: new Set([entry.key])
          });
        } else {
          terms.get(term).sources.add(entry.key);
        }
      });
    });

    return Object.fromEntries(Array.from(terms.entries()).map(([term, meta]) => [term, {
      definition: meta.definition,
      sources: Array.from(meta.sources)
    }]));
  }

  extractTechnicalTerms(text) {
    const commonTerms = [
      'API', 'SLA', 'SSO', 'RBAC', 'GDPR', 'CI/CD', 'MVP', 'POC',
      'microservice', 'monolith', 'container', 'kubernetes'
    ];

    return commonTerms.filter(term =>
      text.toLowerCase().includes(term.toLowerCase()));
  }

  defineBusinessTerm(term) {
    const definitions = {
      'API': 'Application Programming Interface - interface for software communication',
      'SLA': 'Service Level Agreement - performance and availability commitments',
      'SSO': 'Single Sign-On - authentication method using one set of credentials',
      'RBAC': 'Role-Based Access Control - access permissions based on user roles',
      'CI/CD': 'Continuous Integration/Continuous Deployment - automated development pipeline'
    };

    return definitions[term] || `Business term: ${term}`;
  }

  generateReferences(responses) {
    const references = [];

    // Add standard references
    references.push('Clean Architecture - Robert C. Martin');
    references.push('Building Microservices - Sam Newman');

    // Add technology-specific references based on responses
    const frameworks = responses.get('preferred-framework');
    if (frameworks && frameworks.includes('React')) {
      references.push('React Documentation - https://reactjs.org/docs/');
    }

    if (responses.get('deployment-strategy') &&
        responses.get('deployment-strategy').includes('container')) {
      references.push('Docker Documentation - https://docs.docker.com/');
      references.push('Kubernetes Documentation - https://kubernetes.io/docs/');
    }

    return references;
  }

  generateSpecMarkdown(spec) {
    return `# ${spec.document.title}

**Version:** ${spec.document.version}
**Generated:** ${new Date(spec.document.generated).toLocaleDateString()}

## Overview

**Project:** ${spec.overview.projectName}
**Type:** ${spec.overview.projectType}

**Purpose:** ${spec.overview.purpose}

**Value Proposition:** ${spec.overview.valueProposition}

### Stakeholders

- **Executive Sponsor:** ${spec.overview.stakeholders.sponsor}
- **Product Owner:** ${spec.overview.stakeholders.productOwner}
- **Technical Lead:** ${spec.overview.stakeholders.technicalLead}

## Architecture

### Current State
${spec.architecture.current}

### Target State
${spec.architecture.target}

### Technical Debt
${spec.architecture.technicalDebt.map(item => `- ${item}`).join('\n')}

## Data Model

### Core Entities
${spec.dataModel.coreEntities.map(entity => `- ${entity}`).join('\n')}

### Data Sources
${spec.dataModel.dataSources.map(source => `- ${source}`).join('\n')}

## API Specification

${spec.apiSpecification.overview}

### Authentication
${spec.apiSpecification.authentication}

### Authorization
${spec.apiSpecification.authorization}

## Infrastructure

### Deployment Strategy
${spec.infrastructure.deployment.strategy}

### Monitoring
- **Observability:** ${spec.infrastructure.monitoring.observability}
- **Availability:** ${spec.infrastructure.monitoring.availability}

## Security

### Authentication Model
${spec.security.authentication.model}

### Compliance Standards
${spec.security.compliance.standards.map(standard => `- ${standard}`).join('\n')}

## Testing Strategy

${spec.testing.strategy}

**Current Coverage:** ${spec.testing.currentCoverage}%

### Testing Pyramid
- **Unit Tests:** ${spec.testing.pyramid.unit}
- **Integration Tests:** ${spec.testing.pyramid.integration}
- **E2E Tests:** ${spec.testing.pyramid.e2e}

## Deployment

### Strategy
${spec.deployment.strategy}

### Pipeline Stages
${spec.deployment.pipeline.stages.map(stage => `- ${stage}`).join('\n')}

## Maintenance

### Technical Debt Management
${spec.maintenance.technicalDebt.strategy}

**Current Priority Items:**
${spec.maintenance.technicalDebt.priorities.map(item => `- ${item}`).join('\n')}

---

*This specification was generated automatically by the Progressive Document System.*
`;
  }

  generateServerInfo(responses) {
    const servers = [];

    // Default server configurations
    servers.push({
      url: 'http://localhost:3000',
      description: 'Development server'
    });

    const deploymentStrategy = responses.get('deployment-strategy') || '';
    if (deploymentStrategy.includes('container')) {
      servers.push({
        url: 'https://staging-api.example.com',
        description: 'Staging environment'
      });
      servers.push({
        url: 'https://api.example.com',
        description: 'Production environment'
      });
    }

    return servers;
  }

  generateSecuritySchemes(responses) {
    const schemes = {};

    const authModel = responses.get('authentication-model') || '';

    if (authModel.includes('JWT') || authModel.includes('token')) {
      schemes.bearerAuth = {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT'
      };
    }

    if (authModel.includes('API key') || authModel.includes('apikey')) {
      schemes.apiKeyAuth = {
        type: 'apiKey',
        in: 'header',
        name: 'X-API-Key'
      };
    }

    if (authModel.includes('OAuth')) {
      schemes.oAuth2 = {
        type: 'oauth2',
        flows: {
          authorizationCode: {
            authorizationUrl: 'https://example.com/oauth/authorize',
            tokenUrl: 'https://example.com/oauth/token',
            scopes: {
              read: 'Read access',
              write: 'Write access'
            }
          }
        }
      };
    }

    return schemes;
  }

  generateSecurityRequirements(responses) {
    const requirements = [];

    const authModel = responses.get('authentication-model') || '';

    if (authModel.includes('JWT') || authModel.includes('token')) {
      requirements.push({ bearerAuth: [] });
    }

    if (authModel.includes('API key')) {
      requirements.push({ apiKeyAuth: [] });
    }

    if (authModel.includes('OAuth')) {
      requirements.push({ oAuth2: ['read', 'write'] });
    }

    return requirements.length > 0 ? requirements : [{}];
  }

  generateOpenAPISpec(apiDocs) {
    return {
      openapi: '3.0.0',
      info: apiDocs.info,
      servers: apiDocs.servers,
      paths: this.formatPathsForOpenAPI(apiDocs.paths),
      components: apiDocs.components,
      security: apiDocs.security
    };
  }

  formatPathsForOpenAPI(paths) {
    const formatted = {};

    Object.keys(paths).forEach(method => {
      Object.keys(paths[method]).forEach(path => {
        if (!formatted[path]) {
          formatted[path] = {};
        }
        formatted[path][method] = paths[method][path];
      });
    });

    return formatted;
  }

  generateTestingStrategyMarkdown(strategy) {
    return `# ${strategy.project} - Testing Strategy

Generated on: ${new Date(strategy.generated).toLocaleDateString()}

## Current State

- **Total Modules:** ${strategy.currentState.totalModules}
- **Tested Modules:** ${strategy.currentState.testedModules}
- **Overall Coverage:** ${strategy.currentState.overallCoverage}%

### Coverage by Module

| Module | Coverage | Test Files | Code Files |
|--------|----------|------------|------------|
${strategy.currentState.coverageByModule.map(m =>
  `| ${m.module} | ${m.coverage}% | ${m.testFiles} | ${m.codeFiles} |`
).join('\n')}

## Recommendations

${strategy.recommendations.map(rec => `- ${rec}`).join('\n')}

  ## Testing Pyramid Strategy

${Object.entries(strategy.pyramid).map(([level, detail]) => {
  const focusLine = detail.focus ? `\n- Focus: ${detail.focus}` : '';
  const notesLine = detail.notes ? `\n- Notes: ${detail.notes}` : '';
  return `### ${level.toUpperCase()}\n- Target: ${detail.target}\n- Current: ${detail.current}\n- Recommendation: ${detail.recommendation}${focusLine}${notesLine}`;
}).join('\n\n')}

## Tools and Frameworks

${strategy.toolsAndFrameworks.map(tool => `- ${tool}`).join('\n')}

## Implementation Roadmap

### Quick Wins
${strategy.implementation.quickWins.map(item => `- [ ] ${item}`).join('\n')}

### Priority Areas
${strategy.implementation.priorities.map(item => `- [ ] ${item}`).join('\n')}

### Testing Roadmap
${strategy.implementation.roadmap.map(item => `- [ ] ${item}`).join('\n')}

---

*Generated by Progressive Document System*
`;
  }

  recommendTestingTools(moduleData, responses) {
    const tools = [];
    const testingStrategy = this.getResponseValue(responses, 'testing-strategy', '').toLowerCase();
    const nonFunctional = this.getResponseValue(responses, 'non-functional-tests', '').toLowerCase();

    // Frontend testing tools
    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend');
    if (frontendModules.length > 0) {
      const frameworks = frontendModules.flatMap(m => m.frameworks);

      if (frameworks.includes('react')) {
        tools.push('Jest + React Testing Library for component testing');
        tools.push('Cypress for E2E testing');
      } else if (frameworks.includes('vue')) {
        tools.push('Vue Test Utils + Jest for component testing');
        tools.push('Cypress for E2E testing');
      } else {
        tools.push('Jest for JavaScript unit testing');
        tools.push('Playwright for E2E testing');
      }
    }

    // Backend testing tools
    const backendModules = moduleData.modules.filter(m => m.type === 'backend');
    if (backendModules.length > 0) {
      const frameworks = backendModules.flatMap(m => m.frameworks);

      if (frameworks.includes('express')) {
        tools.push('Supertest for API testing');
        tools.push('Jest for Node.js unit testing');
      } else {
        tools.push('Node.js native test runner');
        tools.push('Postman/Newman for API testing');
      }
    }

    // General tools
    tools.push('Istanbul/nyc for coverage reporting');
    tools.push('Husky for pre-commit testing hooks');

    if (testingStrategy.includes('contract')) {
      tools.push('Pact for consumer-driven contract testing');
    }
    if (testingStrategy.includes('visual')) {
      tools.push('Percy or Chromatic for visual regression testing');
    }
    if (nonFunctional.includes('accessibility')) {
      tools.push('axe-core/Pa11y for automated accessibility checks');
    }
    if (nonFunctional.includes('load') || nonFunctional.includes('performance')) {
      tools.push('k6 or Artillery for load/performance testing');
    }
    if (nonFunctional.includes('chaos')) {
      tools.push('Gremlin or LitmusChaos for chaos engineering drills');
    }

    return tools;
  }

  prioritizeTestingEfforts(moduleData) {
    const priorities = [];

    // High-impact, low-coverage modules
    const highImpactModules = moduleData.modules
      .filter(m => m.dependencies.length > 2 && m.coverage < 50)
      .sort((a, b) => (b.dependencies.length * (100 - b.coverage)) - (a.dependencies.length * (100 - a.coverage)));

    if (highImpactModules.length > 0) {
      priorities.push(`Focus on high-impact modules: ${highImpactModules.slice(0, 3).map(m => m.name).join(', ')}`);
    }

    // Backend modules (critical for API reliability)
    const untestedBackend = moduleData.modules
      .filter(m => m.type === 'backend' && m.coverage < 70);

    if (untestedBackend.length > 0) {
      priorities.push(`Prioritize backend testing: ${untestedBackend.map(m => m.name).join(', ')}`);
    }

    // Large modules with no tests
    const largeUntested = moduleData.modules
      .filter(m => m.lineCount > 500 && m.coverage === 0)
      .sort((a, b) => b.lineCount - a.lineCount);

    if (largeUntested.length > 0) {
      priorities.push(`Address large untested modules: ${largeUntested.slice(0, 2).map(m => m.name).join(', ')}`);
    }

    return priorities;
  }

  generateTestingRoadmap(moduleData) {
    const roadmap = [];

    // Phase 1: Foundation
    roadmap.push('Phase 1 (Weeks 1-2): Set up testing infrastructure and CI/CD integration');
    roadmap.push('Phase 1: Write tests for critical backend endpoints');

    // Phase 2: Coverage
    const lowCoverageModules = moduleData.modules.filter(m => m.coverage < 50).length;
    if (lowCoverageModules > 0) {
      roadmap.push(`Phase 2 (Weeks 3-6): Increase coverage for ${lowCoverageModules} modules to 70%`);
    }

    // Phase 3: Quality
    roadmap.push('Phase 3 (Weeks 7-8): Implement E2E testing for critical user journeys');
    roadmap.push('Phase 3: Set up automated performance testing');

    // Phase 4: Maturity
    roadmap.push('Phase 4 (Weeks 9-12): Implement mutation testing and advanced quality gates');

    return roadmap;
  }

  generateTestingPyramid(moduleData, responses) {
    const totalModules = moduleData.modules.length || 1;
    const backendModules = moduleData.modules.filter(m => m.type === 'backend').length;
    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend').length;
    const modulesWithUnitTests = moduleData.modules.filter(m => m.coverage > 0).length;

    const testingStrategy = this.getResponseValue(responses, 'testing-strategy', '').toLowerCase();
    const nonFunctional = this.getResponseValue(responses, 'non-functional-tests', '').toLowerCase();

    const contractFocus = testingStrategy.includes('contract');
    const accessibilityFocus = nonFunctional.includes('accessibility');
    const chaosFocus = nonFunctional.includes('chaos');
    const performanceFocus = nonFunctional.includes('performance') || !!this.getResponseValue(responses, 'performance-budget', '');

    return {
      unit: {
        target: contractFocus ? '65% of testing effort' : '70% of testing effort',
        current: `${Math.round((modulesWithUnitTests / totalModules) * 100)}% modules have unit test coverage`,
        recommendation: contractFocus
          ? 'Keep unit suites fast and deterministic to support contract tests upstream.'
          : 'Focus on pure functions, domain logic, and component units.',
        focus: contractFocus ? 'Shift-left unit coverage enabling contract confidence' : undefined
      },
      integration: {
        target: contractFocus ? '25% of testing effort' : '20% of testing effort',
        current: `${backendModules} backend modules require integration${contractFocus ? ' and contract' : ''} tests`,
        recommendation: contractFocus
          ? 'Cover contract and integration flows so schema drift is caught early.'
          : 'Exercise API endpoints, data access, and service orchestration paths.',
        focus: contractFocus ? 'Consumer-driven contracts' : undefined,
        notes: chaosFocus ? 'Plan chaos experiments once integration suites are stable.' : undefined
      },
      e2e: {
        target: accessibilityFocus || performanceFocus ? '15% of testing effort' : '10% of testing effort',
        current: `${frontendModules} frontend modules require end-to-end coverage`,
        recommendation: accessibilityFocus
          ? 'Automate key journeys with accessibility and visual regression checks.'
          : 'Validate critical user workflows end-to-end, including happy and failure paths.',
        focus: accessibilityFocus
          ? 'Accessibility & UX completeness'
          : (performanceFocus ? 'Performance smoke tests in CI' : undefined)
      }
    };
  }

  getFrontendSetupChecklist(moduleData, responses) {
    const checklist = [
      'Package.json is properly configured',
      'Build system is set up (webpack/vite/etc)',
      'Development server is configured',
      'Environment variables are documented',
      'Code formatting tools are installed (prettier/eslint)'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const preferredFramework = this.getResponseValue(responses, 'preferred-framework', '').toLowerCase();
    if (preferredFramework.includes('vue') || moduleData.modules.some(m => m.frameworks.includes('vue'))) {
      add('Align Vite + ESLint + Storybook configs with Vue 3 SFC conventions.');
    }
    if (preferredFramework.includes('react') || moduleData.modules.some(m => m.frameworks.includes('react'))) {
      add('Enable React Refresh, TypeScript aliases, and lint rules for hooks/components.');
    }
    if (preferredFramework.includes('angular') || moduleData.modules.some(m => m.frameworks.includes('angular'))) {
      add('Configure Angular builders (Nx/CLI), strict template checking, and shared module boundaries.');
    }

    const stateStrategy = this.getResponseValue(responses, 'state-management-strategy', '');
    if (stateStrategy) {
      add(`Document state management baseline (${stateStrategy}) and publish usage guidelines.`);
    }

    const routingStandards = this.getResponseValue(responses, 'routing-standards', '');
    if (routingStandards) {
      add('Capture routing, code-splitting, and data-fetch patterns in engineering docs.');
    }

    const designSystem = this.getResponseValue(responses, 'design-system', '');
    if (designSystem) {
      add(`Integrate the declared design system assets (${designSystem}) into the build pipeline.`);
    }

    return checklist;
  }

  getComponentArchitectureChecklist(moduleData) {
    const checklist = [
      'Component structure follows established patterns',
      'Shared components are in a common directory',
      'Component props are properly typed',
      'Components are properly exported/imported'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend');
    const sharedPaths = new Set();
    frontendModules.forEach(module => {
      (module.pathHints || []).forEach(hint => {
        if (/components|shared|ui/i.test(hint)) {
          sharedPaths.add(hint);
        }
      });
    });

    if (sharedPaths.size > 0) {
      add(`Define ownership and review process for shared component directories (${Array.from(sharedPaths).slice(0, 3).join(', ')}).`);
    }

    const highlyCoupled = frontendModules
      .filter(m => m.dependencies.length > 5)
      .map(m => m.name);
    if (highlyCoupled.length > 0) {
      add(`Refine boundaries for highly coupled UI modules (${highlyCoupled.slice(0, 3).join(', ')}).`);
    }

    return checklist;
  }

  getStateManagementChecklist(moduleData) {
    const checklist = [
      'State management library is properly configured',
      'Global state structure is well-defined',
      'Actions and reducers follow consistent patterns',
      'State updates are immutable',
      'Side effects are handled appropriately'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend');
    const externalDeps = new Set(frontendModules.flatMap(m => m.externalDependencies || []));

    if (externalDeps.has('redux') || externalDeps.has('@reduxjs/toolkit')) {
      add('Adopt Redux Toolkit patterns, RTK Query, and strict typing for selectors.');
    }
    if (externalDeps.has('zustand')) {
      add('Document store slice boundaries and persistence rules for Zustand.');
    }
    if (externalDeps.has('vuex') || externalDeps.has('pinia')) {
      add('Enforce moduleised Vuex/Pinia stores with typed getters and actions.');
    }

    const modulesWithAsyncEffects = frontendModules.filter(m => (m.dependencies || []).some(dep => dep.includes('api')));
    if (modulesWithAsyncEffects.length > 0) {
      add(`Define effect isolation and cancellation strategy for async-heavy modules (${modulesWithAsyncEffects.slice(0, 2).map(m => m.name).join(', ')}).`);
    }

    return checklist;
  }

  getPerformanceChecklist(responses) {
    const checklist = [
      'Performance budgets are defined and monitored',
      'Code splitting is implemented for large bundles',
      'Images are optimized and lazy-loaded',
      'Critical rendering path is optimized',
      'Bundle analysis is regularly performed'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const budgets = this.getResponseValue(responses, 'performance-budget', '');
    if (budgets) {
      add(`Track performance metrics (${budgets}) in CI with Lighthouse/Calibre thresholds.`);
    }

    if (this.responsesContainKeywords(responses, ['edge', 'cdn', 'caching', 'revalidation'])) {
      add('Validate CDN/edge caching rules and rehearse cache invalidation workflows.');
    }

    if (this.responsesContainKeywords(responses, ['media', 'video', 'image pipeline'])) {
      add('Implement media optimisation pipeline (responsive images, streaming, compression) per interview notes.');
    }

    return checklist;
  }

  getAccessibilityChecklist(responses) {
    const checklist = [
      'Semantic HTML elements are used appropriately',
      'ARIA labels are provided where needed',
      'Color contrast meets WCAG guidelines',
      'Keyboard navigation is fully functional',
      'Screen reader compatibility is tested'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const standards = this.getResponseValue(responses, 'accessibility-standards', '');
    if (standards) {
      add(`Audit against declared accessibility standards (${standards}).`);
    }

    if (this.responsesContainKeywords(responses, ['assistive', 'screen reader', 'keyboard-only', 'voiceover'])) {
      add('Schedule manual QA sessions with the assistive technologies called out during interviews.');
    }

    return checklist;
  }

  getFrontendTestingChecklist(moduleData) {
    const checklist = [
      'Unit tests cover component logic',
      'Integration tests cover user flows',
      'Visual regression tests are implemented',
      'Accessibility tests are automated',
      'Performance tests are included in CI'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const frontendModules = moduleData.modules.filter(m => m.type === 'frontend');
    const lowCoverage = frontendModules.filter(m => m.coverage < 50);
    if (lowCoverage.length > 0) {
      add(`Raise coverage for UI modules with gaps (${lowCoverage.slice(0, 3).map(m => `${m.name} (${m.coverage}%)`).join(', ')}).`);
    }

    const modulesWithoutTests = frontendModules.filter(m => m.testFileCount === 0);
    if (modulesWithoutTests.length > 0) {
      add(`Backfill test suites for untested front-end modules (${modulesWithoutTests.slice(0, 3).map(m => m.name).join(', ')}).`);
    }

    const sharedComponents = frontendModules.filter(m => (m.dependencies || []).some(dep => dep.includes('shared')));
    if (sharedComponents.length > 0) {
      add('Ensure shared component libraries have snapshot or visual regression coverage.');
    }

    return checklist;
  }

  getFrontendDeploymentChecklist(responses) {
    const checklist = [
      'Build process is automated and reliable',
      'Environment-specific configurations are managed',
      'Assets are properly versioned and cached',
      'Deployment rollback strategy is defined',
      'Monitoring and alerting are configured'
    ];

    const add = item => {
      if (item && !checklist.includes(item)) {
        checklist.push(item);
      }
    };

    const deploymentStrategy = this.getResponseValue(responses, 'deployment-strategy', '');
    if (deploymentStrategy) {
      add(`Validate front-end deployment flow matches the declared strategy (${deploymentStrategy}).`);
    }

    const environments = this.getResponseList(responses, 'environment-promotion');
    if (environments.length) {
      add(`Ensure promotion workflow covers ${environments.join(' → ')} with smoke tests.`);
    }

    const edgeCaching = this.getResponseValue(responses, 'edge-caching', '');
    if (edgeCaching) {
      add('Codify edge caching/revalidation rules and include purge automation.');
    }

    const rollbackPlan = this.getResponseValue(responses, 'rollback-plan', '');
    if (rollbackPlan) {
      add(`Document rollback SOP (${rollbackPlan}) and rehearse before launch.`);
    }

    return checklist;
  }

  generateTestingRecommendations(moduleData, responses) {
    const recommendations = [];
    const avgCoverage = this.calculateOverallTestCoverage(moduleData.modules);

    if (avgCoverage < 70) {
      recommendations.push('Increase overall test coverage to at least 70%');
    }

    if (this.responsesContainKeywords(responses, ['contract'])) {
      recommendations.push('Introduce consumer-driven contract testing to protect external/internal APIs.');
    }

    if (this.responsesContainKeywords(responses, ['accessibility'])) {
      recommendations.push('Embed automated accessibility checks into regression pipelines.');
    }

    if (this.responsesContainKeywords(responses, ['chaos'])) {
      recommendations.push('Plan controlled chaos experiments once integration suites are stable.');
    }

    const availabilityTargets = this.getResponseValue(responses, 'availability-targets', '');
    if (availabilityTargets) {
      recommendations.push(`Map reliability tests and synthetic monitoring to the stated availability targets (${availabilityTargets}).`);
    }

    const releaseCadence = this.getResponseValue(responses, 'release-cadence', '').toLowerCase();
    if (releaseCadence.includes('continuous') || releaseCadence.includes('daily')) {
      recommendations.push('Automate deployment gating (smoke tests, rollback checks) to support the rapid release cadence.');
    }

    return recommendations;
  }

  identifyTestingQuickWins(moduleData) {
    return moduleData.modules
      .filter(m => m.fileCount < 5 && m.testFileCount === 0)
      .map(m => `Add tests to ${m.name} (${m.fileCount} files, easy to test)`)
      .slice(0, 5);
  }

}

module.exports = {
  ArtifactGenerator
};
