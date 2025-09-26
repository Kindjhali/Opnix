const { ProgressiveQuestionEngine } = require('./progressiveQuestionEngine');
const { ArtifactGenerator } = require('./artifactGenerator');
const { detectModules } = require('./moduleDetector');
const path = require('path');
const fs = require('fs').promises;

/**
 * Progressive Document System - Central Orchestrator
 *
 * This is the main integration point that connects:
 * 1. Progressive questioning engine
 * 2. Artifact generation system
 * 3. Existing module detection
 * 4. Canvas integration
 * 5. Export system
 *
 * Acts as the intelligence backbone for Opnix's automated project analysis
 */
class ProgressiveDocumentSystem {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.questionEngine = new ProgressiveQuestionEngine(rootDir);
    this.artifactGenerator = new ArtifactGenerator(rootDir);
    this.sessionId = this.generateSessionId();
    this.isInitialized = false;
  }

  /**
   * Initialize the progressive document system
   * Auto-runs on first project analysis
   */
  async initialize() {
    if (this.isInitialized) return;

    console.log('🔍 Initializing Progressive Document System...');

    // Initialize components
    await this.questionEngine.initialize();
    await this.artifactGenerator.initialize();

    // Run initial project analysis
    const analysis = await this.runInitialAnalysis();

    // Auto-generate immediate artifacts
    await this.generateInitialArtifacts(analysis);

    this.isInitialized = true;
    console.log('✅ Progressive Document System ready');

    return analysis;
  }

  /**
   * Run initial project analysis - this happens automatically
   */
  async runInitialAnalysis() {
    console.log('🔎 Running initial project analysis...');

    // Get progressive flow analysis
    const progressiveFlow = await this.questionEngine.generateProgressiveFlow();

    // Generate immediate analysis artifacts
    const analysisResults = await this.generateInitialArtifacts(progressiveFlow);

    // Update session state
    await this.saveSessionState({
      initialized: new Date().toISOString(),
      progressiveFlow,
      generatedArtifacts: analysisResults.generatedFiles,
      phase: 'initial-analysis-complete'
    });

    return {
      sessionId: this.sessionId,
      detectedPatterns: progressiveFlow.detectedPatterns,
      projectSummary: progressiveFlow.projectSummary,
      queuedArtifacts: progressiveFlow.queuedArtifacts,
      generatedFiles: analysisResults.generatedFiles,
      nextPhase: progressiveFlow.nextPhase,
      recommendedPath: progressiveFlow.recommendedPath
    };
  }

  /**
   * Generate initial artifacts immediately upon project detection
   */
  async generateInitialArtifacts(progressiveFlow) {
    console.log('📄 Auto-generating initial artifacts...');

    const generatedFiles = [];

    try {
      // Get module data
      const moduleData = await detectModules(this.rootDir);

      // Always generate project analysis first
      console.log('  📊 Generating project analysis...');
      const analysisResult = await this.artifactGenerator.generateProjectAnalysis(
        progressiveFlow.projectSummary,
        moduleData,
        new Map() // Empty responses for initial generation
      );
      generatedFiles.push({
        type: 'project-analysis',
        files: [analysisResult.filepath, analysisResult.mdFilepath]
      });

      // Generate module diagram
      console.log('  🗺️  Generating module diagram...');
      const diagramResult = await this.artifactGenerator.generateModuleDiagram(
        moduleData,
        progressiveFlow.projectSummary
      );
      generatedFiles.push({
        type: 'module-diagram',
        files: [diagramResult.filepath]
      });

      // Generate pattern-specific artifacts
      const patterns = progressiveFlow.detectedPatterns;

      if (patterns.includes('web-application') || patterns.includes('frontend-heavy')) {
        console.log('  🎨 Generating frontend checklist...');
        const checklistResult = await this.artifactGenerator.generateFrontendChecklist(
          progressiveFlow.projectSummary,
          moduleData,
          new Map()
        );
        generatedFiles.push({
          type: 'frontend-checklist',
          files: [checklistResult.mdFilepath]
        });
      }

      if (moduleData.modules.some(m => m.testFileCount > 0)) {
        console.log('  🧪 Generating testing strategy...');
        const testingResult = await this.artifactGenerator.generateTestingStrategy(
          moduleData,
          new Map()
        );
        generatedFiles.push({
          type: 'testing-strategy',
          files: [testingResult.mdFilepath]
        });
      }

      console.log(`✅ Generated ${generatedFiles.length} artifact types`);

    } catch (error) {
      console.error('❌ Error generating initial artifacts:', error);
    }

    return { generatedFiles };
  }

  /**
   * Start progressive questioning session
   * This begins the intelligent interview process
   */
  async startProgressiveQuestioning() {
    if (!this.isInitialized) {
      await this.initialize();
    }

    console.log('❓ Starting progressive questioning session...');

    const nextQuestions = await this.questionEngine.getNextQuestions();
    const sessionState = await this.questionEngine.getSessionState();

    return {
      sessionId: this.sessionId,
      questions: nextQuestions,
      sessionState,
      phase: sessionState.currentPhase,
      progress: this.calculateProgress(sessionState)
    };
  }

  /**
   * Process user response and get next questions
   */
  async processQuestionResponse(questionId, response) {
    console.log(`📝 Processing response for ${questionId}...`);

    // Process response in question engine
    await this.questionEngine.processResponse(questionId, response);

    // Check if response triggered artifact generation
    await this.handleTriggeredArtifacts(questionId, response);

    // Get next questions
    const nextQuestions = await this.questionEngine.getNextQuestions();
    const sessionState = await this.questionEngine.getSessionState();

    // Update session state
    await this.saveSessionState({
      lastResponse: { questionId, response, timestamp: new Date().toISOString() },
      sessionState
    });

    return {
      nextQuestions,
      sessionState,
      progress: this.calculateProgress(sessionState),
      phase: sessionState.currentPhase
    };
  }

  /**
   * Handle automatically triggered artifact generation
   */
  async handleTriggeredArtifacts(questionId, response) {
    const triggers = this.getArtifactTriggers(questionId, response);

    for (const trigger of triggers) {
      console.log(`🔄 Auto-generating ${trigger} artifact...`);
      await this.generateTriggeredArtifact(trigger);
    }
  }

  /**
   * Determine which artifacts should be generated based on response
   */
  getArtifactTriggers(questionId, response) {
    const triggers = [];
    const responseText = String(response || '').toLowerCase();

    // Architecture triggers
    if (questionId === 'current-architecture' || questionId === 'target-architecture-vision') {
      triggers.push('architecture-diagram');

      // Additional triggers based on response content
      if (responseText.includes('microservice') || responseText.includes('distributed')) {
        triggers.push('microservices-documentation');
      }
    }

    // API triggers
    if (questionId === 'integration-consumers' || questionId === 'integration-providers') {
      triggers.push('api-documentation');
    }

    // Technical spec triggers
    if (questionId === 'primary-language' || questionId === 'preferred-framework') {
      triggers.push('technical-specification');

      // Technology-specific documentation
      if (responseText.includes('react') || responseText.includes('vue') || responseText.includes('angular')) {
        triggers.push('frontend-checklist');
      }
      if (responseText.includes('database') || responseText.includes('sql') || responseText.includes('mongo')) {
        triggers.push('database-documentation');
      }
    }

    // Response content analysis for additional triggers
    if (responseText.includes('test') || responseText.includes('quality')) {
      triggers.push('testing-strategy');
    }

    if (responseText.includes('deploy') || responseText.includes('docker') || responseText.includes('kubernetes')) {
      triggers.push('deployment-guide');
    }

    // Security triggers
    if (questionId === 'authentication-model' || questionId === 'authorization-model') {
      triggers.push('security-analysis');
    }

    return triggers;
  }

  /**
   * Generate a specific artifact based on current state
   */
  async generateTriggeredArtifact(artifactType, precomputedData = null) {
    let moduleData, projectSummary, responses;

    if (precomputedData) {
      ({ moduleData, projectSummary, responses } = precomputedData);
    } else {
      moduleData = await detectModules(this.rootDir);
      const sessionState = await this.questionEngine.getSessionState();
      responses = new Map(Object.entries(sessionState.responses));

      projectSummary = {
        name: responses.get('project-name') || 'Untitled Project',
        type: responses.get('project-type') || 'Unknown',
        patterns: sessionState.detectedPatterns
      };
    }

    switch (artifactType) {
      case 'architecture-diagram':
        return await this.artifactGenerator.generateArchitectureDiagram(
          projectSummary, moduleData, responses
        );

      case 'technical-specification':
        return await this.artifactGenerator.generateTechnicalSpecification(
          projectSummary, moduleData, responses
        );

      case 'api-documentation':
        return await this.artifactGenerator.generateAPIDocumentation(
          moduleData, responses
        );

      default:
        console.log(`⚠️  Unknown artifact type: ${artifactType}`);
    }
  }

  /**
   * Generate complete document package
   * This creates all artifacts based on current session state
   */
  async generateCompleteDocumentPackage() {
    console.log('📦 Generating complete document package...');

    const sessionState = await this.questionEngine.getSessionState();
    const moduleData = await detectModules(this.rootDir);
    const responses = new Map(Object.entries(sessionState.responses));

    const projectSummary = {
      name: responses.get('project-name') || 'Untitled Project',
      type: responses.get('project-type') || 'Unknown',
      patterns: sessionState.detectedPatterns
    };

    const generatedPackage = {
      sessionId: this.sessionId,
      generated: new Date().toISOString(),
      artifacts: []
    };

    // Generate all core artifacts
    const artifactTypes = [
      'project-analysis',
      'module-diagram',
      'architecture-diagram',
      'technical-specification'
    ];

    // Add conditional artifacts based on patterns
    if (sessionState.detectedPatterns.includes('web-application')) {
      artifactTypes.push('frontend-checklist');
    }

    if (sessionState.detectedPatterns.includes('api-service')) {
      artifactTypes.push('api-documentation');
    }

    artifactTypes.push('testing-strategy');

    // Prepare precomputed data to avoid regenerating for each artifact
    const precomputedData = { moduleData, projectSummary, responses };

    // Generate each artifact
    for (const artifactType of artifactTypes) {
      try {
        console.log(`  📄 Generating ${artifactType}...`);
        const result = await this.generateTriggeredArtifact(artifactType, precomputedData);
        if (result) {
          generatedPackage.artifacts.push({
            type: artifactType,
            result
          });
        }
      } catch (error) {
        console.error(`❌ Error generating ${artifactType}:`, error);
      }
    }

    // Save package summary
    const packageSummaryPath = path.join(this.rootDir, 'exports', `document-package-${this.sessionId}.json`);
    await fs.writeFile(packageSummaryPath, JSON.stringify(generatedPackage, null, 2));

    console.log(`✅ Generated complete document package: ${generatedPackage.artifacts.length} artifacts`);

    return generatedPackage;
  }

  /**
   * Canvas Integration - Update canvas with progressive analysis
   */
  async updateCanvasWithAnalysis() {
    const sessionState = await this.questionEngine.getSessionState();
    const moduleData = await detectModules(this.rootDir);

    // Generate canvas-compatible data structure
    const canvasData = {
      modules: moduleData.modules.map(module => ({
        ...module,
        detectedPatterns: this.getModulePatterns(module, sessionState),
        analysisScore: this.calculateModuleAnalysisScore(module),
        recommendations: this.getModuleRecommendations(module)
      })),
      edges: moduleData.edges,
      analysis: {
        patterns: sessionState.detectedPatterns,
        phase: sessionState.currentPhase,
        completeness: this.calculateProgress(sessionState)
      }
    };

    // Save for canvas consumption
    const canvasDataPath = path.join(this.rootDir, 'data', 'canvas-analysis.json');
    await fs.writeFile(canvasDataPath, JSON.stringify(canvasData, null, 2));

    return canvasData;
  }

  // Helper methods

  calculateProgress(sessionState) {
    const totalPhases = 5; // detection, foundation, technical, specialized, generation
    const phaseOrder = ['detection', 'foundation', 'technical', 'specialized', 'generation'];
    const phaseWeights = {
      'detection': 0.2,
      'foundation': 0.4,
      'technical': 0.6,
      'specialized': 0.8,
      'generation': 1.0
    };

    const currentPhase = sessionState.currentPhase || 'detection';
    const baseProgress = phaseWeights[currentPhase] || 0;

    // Add more granular progress within phase based on responses completed
    const currentPhaseIndex = phaseOrder.indexOf(currentPhase);
    if (currentPhaseIndex >= 0 && sessionState.responses) {
      const responseCount = Object.keys(sessionState.responses).length;
      const expectedResponsesPerPhase = Math.max(3, Math.ceil(responseCount / totalPhases));
      const withinPhaseProgress = Math.min(responseCount % expectedResponsesPerPhase, expectedResponsesPerPhase) / expectedResponsesPerPhase;
      const phaseIncrement = (1 / totalPhases) * withinPhaseProgress * 0.8; // 80% of phase increment for within-phase progress

      return Math.min(baseProgress + phaseIncrement, 1.0);
    }

    return baseProgress;
  }

  getModulePatterns(module, sessionState) {
    const patterns = [];

    // Basic module type patterns
    if (module.type === 'frontend') patterns.push('ui-component');
    if (module.type === 'backend') patterns.push('api-service');
    if (module.coverage > 80) patterns.push('well-tested');
    if (module.health < 50) patterns.push('needs-attention');

    // Session-aware pattern detection
    if (sessionState && sessionState.detectedPatterns) {
      // Add architecture-specific patterns based on session analysis
      if (sessionState.detectedPatterns.includes('microservices') && module.type === 'backend') {
        patterns.push('microservice');
      }
      if (sessionState.detectedPatterns.includes('web-application') && module.type === 'frontend') {
        patterns.push('spa-component');
      }
      if (sessionState.detectedPatterns.includes('api-heavy') && module.type === 'backend') {
        patterns.push('api-gateway');
      }
    }

    // Session response-based patterns
    if (sessionState && sessionState.responses) {
      const responses = sessionState.responses;

      // Technology-specific patterns from user responses
      if (responses['preferred-framework']) {
        const framework = String(responses['preferred-framework']).toLowerCase();
        if (framework.includes('vue') && module.type === 'frontend') {
          patterns.push('vue-component');
        }
        if (framework.includes('react') && module.type === 'frontend') {
          patterns.push('react-component');
        }
        if (framework.includes('express') && module.type === 'backend') {
          patterns.push('express-service');
        }
      }

      // Architecture patterns from responses
      if (responses['current-architecture'] || responses['target-architecture-vision']) {
        const architecture = String(responses['current-architecture'] || responses['target-architecture-vision'] || '').toLowerCase();
        if (architecture.includes('distributed') && module.dependencies.length > 3) {
          patterns.push('distributed-component');
        }
        if (architecture.includes('monolith') && module.dependencies.length < 2) {
          patterns.push('monolith-component');
        }
      }

      // Integration patterns
      if (responses['integration-consumers'] || responses['integration-providers']) {
        if (module.type === 'backend') {
          patterns.push('integration-service');
        }
      }
    }

    return patterns;
  }

  calculateModuleAnalysisScore(module) {
    // Weighted scoring based on health, coverage, and dependencies
    const healthScore = module.health * 0.4;
    const coverageScore = module.coverage * 0.3;
    const dependencyScore = Math.max(0, 100 - (module.dependencies.length * 5)) * 0.3;

    return Math.round(healthScore + coverageScore + dependencyScore);
  }

  getModuleRecommendations(module) {
    const recommendations = [];

    if (module.coverage < 50) {
      recommendations.push('Increase test coverage');
    }

    if (module.todoCount > 10) {
      recommendations.push('Address technical debt');
    }

    if (module.dependencies.length > 5) {
      recommendations.push('Consider reducing dependencies');
    }

    return recommendations;
  }

  generateSessionId() {
    return `pdq-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  async saveSessionState(state) {
    const dataDir = path.join(this.rootDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });

    const sessionFile = path.join(dataDir, `session-${this.sessionId}.json`);
    const currentState = await this.loadSessionState();

    const updatedState = {
      ...currentState,
      ...state,
      lastUpdated: new Date().toISOString()
    };

    await fs.writeFile(sessionFile, JSON.stringify(updatedState, null, 2));
  }

  async loadSessionState() {
    try {
      const sessionFile = path.join(this.rootDir, 'data', `session-${this.sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return {};
    }
  }

  // Public API methods for integration

  /**
   * Get current system status and capabilities
   */
  async getSystemStatus() {
    const sessionState = await this.questionEngine.getSessionState();

    return {
      initialized: this.isInitialized,
      sessionId: this.sessionId,
      phase: sessionState.currentPhase,
      detectedPatterns: sessionState.detectedPatterns,
      progress: this.calculateProgress(sessionState),
      artifactQueue: sessionState.artifactQueue,
      capabilities: {
        progressiveQuestioning: true,
        autoArtifactGeneration: true,
        patternDetection: true,
        moduleAnalysis: true,
        canvasIntegration: true
      }
    };
  }

  /**
   * Force regenerate all artifacts with current state
   */
  async regenerateAllArtifacts() {
    console.log('🔄 Regenerating all artifacts...');
    return await this.generateCompleteDocumentPackage();
  }
}

module.exports = {
  ProgressiveDocumentSystem
};