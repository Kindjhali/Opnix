const { loadInterviewBlueprint } = require('./interviewLoader');
const { detectModules } = require('./moduleDetector');
const path = require('path');
const fs = require('fs').promises;

/**
 * Progressive Document Questions System - Core Intelligence Engine
 *
 * This system drives Opnix's automated project analysis by:
 * 1. Adapting question flow based on previous answers
 * 2. Auto-detecting project patterns and triggering appropriate questions
 * 3. Triggering automatic artifact generation based on response patterns
 * 4. Maintaining context across progressive questioning sessions
 */
class ProgressiveQuestionEngine {
  constructor(rootDir = process.cwd()) {
    this.rootDir = rootDir;
    this.sessionState = {
      responses: new Map(),
      triggeredSections: new Set(),
      detectedPatterns: new Set(),
      artifactQueue: new Set(),
      currentPhase: 'detection'
    };
    this.blueprint = null;
    this.moduleData = null;
  }

  async initialize() {
    this.blueprint = await loadInterviewBlueprint();
    this.moduleData = await detectModules(this.rootDir);
    await this.detectInitialPatterns();
  }

  /**
   * Auto-detect project patterns on initialization
   * This drives the initial question branching strategy
   */
  async detectInitialPatterns() {
    const patterns = new Set();

    // Module-based pattern detection
    for (const module of this.moduleData.modules) {
      // Frontend patterns
      if (module.type === 'frontend' || module.frameworks.some(fw =>
        ['react', 'vue', 'angular', 'svelte', 'next'].includes(fw))) {
        patterns.add('web-application');
        patterns.add('frontend-heavy');

        if (module.frameworks.includes('react')) patterns.add('react-project');
        if (module.frameworks.includes('next')) patterns.add('nextjs-project');
        if (module.frameworks.includes('vue')) patterns.add('vue-project');
      }

      // Backend patterns
      if (module.type === 'backend' || module.frameworks.some(fw =>
        ['express', 'fastify', 'nest', 'koa'].includes(fw))) {
        patterns.add('api-service');
        patterns.add('backend-heavy');
      }

      // Mobile patterns
      if (module.frameworks.some(fw =>
        ['react-native', 'expo', 'ionic'].includes(fw))) {
        patterns.add('mobile-app');
      }

      // Package/Library patterns
      if (module.type === 'lib' || module.pathHints.some(hint =>
        hint.includes('lib') || hint.includes('package'))) {
        patterns.add('library-package');
      }
    }

    // File structure patterns
    const hasPackageJson = await this.fileExists('package.json');
    const hasDockerfile = await this.fileExists('Dockerfile');
    const hasKubernetes = await this.directoryExists('k8s') || await this.directoryExists('kubernetes');

    if (hasPackageJson) patterns.add('npm-project');
    if (hasDockerfile) patterns.add('containerized');
    if (hasKubernetes) patterns.add('kubernetes-deployment');

    // Testing patterns
    const totalTestFiles = this.moduleData.modules.reduce((sum, mod) => sum + mod.testFileCount, 0);
    if (totalTestFiles > 0) patterns.add('test-coverage-exists');
    if (totalTestFiles >= this.moduleData.modules.length) patterns.add('well-tested');

    // Documentation patterns
    const hasReadme = await this.fileExists('README.md');
    const hasDocs = this.moduleData.modules.some(mod => mod.type === 'documentation');
    if (hasReadme) patterns.add('documented-project');
    if (hasDocs) patterns.add('comprehensive-docs');

    this.sessionState.detectedPatterns = patterns;

    // Auto-queue initial artifact generation based on patterns
    this.queueInitialArtifacts(patterns);
  }

  /**
   * Queue artifacts for auto-generation based on detected patterns
   */
  queueInitialArtifacts(patterns) {
    // Always generate these on project detection
    this.sessionState.artifactQueue.add('project-analysis');
    this.sessionState.artifactQueue.add('module-diagram');

    if (patterns.has('web-application')) {
      this.sessionState.artifactQueue.add('frontend-checklist');
      this.sessionState.artifactQueue.add('ui-component-map');
    }

    if (patterns.has('api-service')) {
      this.sessionState.artifactQueue.add('api-documentation');
      this.sessionState.artifactQueue.add('endpoint-catalog');
    }

    if (patterns.has('containerized')) {
      this.sessionState.artifactQueue.add('deployment-guide');
    }

    if (patterns.has('test-coverage-exists')) {
      this.sessionState.artifactQueue.add('testing-strategy');
    }

    // High-value artifacts for any detected project
    if (patterns.size > 0) {
      this.sessionState.artifactQueue.add('technical-specification');
      this.sessionState.artifactQueue.add('architecture-diagram');
    }
  }

  /**
   * Get the next question(s) based on current session state
   * This is the core progressive logic that adapts the interview flow
   */
  async getNextQuestions() {
    const currentPhase = this.sessionState.currentPhase;

    switch (currentPhase) {
      case 'detection':
        return this.getDetectionPhaseQuestions();
      case 'foundation':
        return this.getFoundationQuestions();
      case 'technical':
        return this.getTechnicalQuestions();
      case 'specialized':
        return this.getSpecializedQuestions();
      case 'generation':
        return this.getGenerationPhaseQuestions();
      default:
        return this.getDefaultQuestions();
    }
  }

  /**
   * Detection phase - quick project type and pattern identification
   */
  getDetectionPhaseQuestions() {
    const questions = [];

    // If we haven't established basic project info
    if (!this.sessionState.responses.has('project-name')) {
      questions.push({
        id: 'project-name',
        prompt: `Based on analysis, this appears to be a ${this.getPrimaryProjectType()} project. What should we call this project?`,
        type: 'text',
        phase: 'detection',
        autoSuggestion: this.generateProjectNameSuggestion(),
        required: true
      });
    }

    // Confirm detected patterns
    if (!this.sessionState.responses.has('pattern-confirmation')) {
      const detectedPatterns = Array.from(this.sessionState.detectedPatterns);
      questions.push({
        id: 'pattern-confirmation',
        prompt: 'I detected these patterns in your codebase. Which are most important for this analysis?',
        type: 'multiselect',
        options: this.formatPatternsForUser(detectedPatterns),
        phase: 'detection',
        autoSelected: detectedPatterns.slice(0, 3), // Auto-select top 3
        required: true
      });
    }

    return questions;
  }

  /**
   * Foundation questions - adapted based on detected patterns
   */
  getFoundationQuestions() {
    const section = this.blueprint.sections.foundation;
    const adaptedQuestions = section.questions.map(q => ({
      ...q,
      prompt: this.adaptPromptToPatterns(q.prompt, q.id),
      placeholder: this.adaptPlaceholderToPatterns(q.placeholder, q.id)
    }));

    return adaptedQuestions;
  }

  /**
   * Technical questions - filtered based on detected frameworks and patterns
   */
  getTechnicalQuestions() {
    const questions = [];
    const patterns = this.sessionState.detectedPatterns;

    // Runtime decisions adapted to detected tech stack
    const runtimeSection = this.blueprint.sections['runtime-decisions'];
    const adaptedRuntime = runtimeSection.questions.map(q => {
      if (q.id === 'preferred-framework') {
        // Pre-populate based on detected frameworks
        const detectedFrameworks = this.getDetectedFrameworks();
        return {
          ...q,
          autoSelected: detectedFrameworks[0], // Auto-select primary framework
          options: detectedFrameworks.length > 0 ? detectedFrameworks : q.options
        };
      }
      return q;
    });

    questions.push(...adaptedRuntime);

    // Add conditional sections based on patterns
    if (patterns.has('web-application')) {
      questions.push(...this.blueprint.sections['web-experience'].questions);
    }

    if (patterns.has('api-service')) {
      questions.push(...this.blueprint.sections['api-contracts'].questions);
    }

    return questions;
  }

  /**
   * Specialized questions - only shown if patterns warrant them
   */
  getSpecializedQuestions() {
    const questions = [];
    const patterns = this.sessionState.detectedPatterns;
    const responses = this.sessionState.responses;

    // Advanced sections based on project maturity and patterns
    if (patterns.has('well-tested')) {
      questions.push(...this.blueprint.sections['quality-strategy'].questions);
    }

    if (patterns.has('containerized') || responses.get('deployment-strategy') === 'containerized') {
      questions.push(...this.blueprint.sections['deployment-release'].questions);
    }

    if (this.moduleData.summary.moduleCount > 5) { // Complex projects
      questions.push(...this.blueprint.sections['architecture-baseline'].questions);
    }

    return questions;
  }

  /**
   * Generation phase - prepare for artifact creation
   */
  getGenerationPhaseQuestions() {
    const questions = [];
    const queuedArtifacts = Array.from(this.sessionState.artifactQueue);

    questions.push({
      id: 'artifact-selection',
      prompt: 'Based on your responses, I can generate these artifacts automatically. Which would be most valuable?',
      type: 'multiselect',
      options: queuedArtifacts.map(artifact => ({
        value: artifact,
        label: this.getArtifactDescription(artifact)
      })),
      phase: 'generation',
      autoSelected: this.getHighPriorityArtifacts(queuedArtifacts),
      required: false
    });

    return questions;
  }

  /**
   * Process a user response and update session state
   * This triggers the progressive logic and phase transitions
   */
  async processResponse(questionId, response) {
    this.sessionState.responses.set(questionId, response);

    // Trigger phase transitions and additional questions based on responses
    await this.evaluatePhaseTransition(questionId, response);

    // Pattern-based response processing
    await this.processPatternTriggers(questionId, response);

    // Auto-trigger artifact generation if criteria met
    await this.evaluateArtifactTriggers(questionId, response);
  }

  /**
   * Evaluate if we should transition to next phase
   */
  async evaluatePhaseTransition(questionId, response) {
    const currentPhase = this.sessionState.currentPhase;

    switch (currentPhase) {
      case 'detection':
        if (questionId === 'pattern-confirmation') {
          this.sessionState.currentPhase = 'foundation';
          // Update patterns based on user confirmation
          this.sessionState.detectedPatterns = new Set(response);
        }
        break;

      case 'foundation':
        if (this.hasCompletedFoundationQuestions()) {
          this.sessionState.currentPhase = 'technical';
        }
        break;

      case 'technical':
        if (this.hasCompletedTechnicalQuestions()) {
          this.sessionState.currentPhase = 'specialized';
        }
        break;

      case 'specialized':
        if (this.shouldSkipToGeneration() || this.hasCompletedSpecializedQuestions()) {
          this.sessionState.currentPhase = 'generation';
        }
        break;
    }
  }

  /**
   * Process pattern-specific response triggers
   */
  async processPatternTriggers(questionId, response) {
    // Framework-specific triggers
    if (questionId === 'preferred-framework') {
      const framework = response.toLowerCase();
      const frameworkSections = this.blueprint.frameworkSectionMap[framework] || [];
      frameworkSections.forEach(section => this.sessionState.triggeredSections.add(section));
    }

    // Project type triggers
    if (questionId === 'project-type') {
      const projectSections = this.blueprint.typeOrder[response] || [];
      projectSections.forEach(section => this.sessionState.triggeredSections.add(section));
    }

    // Auto-detect more patterns from responses
    if (questionId === 'project-purpose' && response.toLowerCase().includes('api')) {
      this.sessionState.detectedPatterns.add('api-heavy');
      this.sessionState.artifactQueue.add('api-specification');
    }
  }

  /**
   * Evaluate if we should auto-trigger artifact generation
   */
  async evaluateArtifactTriggers(questionId, response) {
    const responseText = String(response || '').toLowerCase();

    // Immediate triggers - generate as soon as we have enough info
    if (questionId === 'project-name' && this.sessionState.responses.has('project-type')) {
      await this.triggerArtifactGeneration('project-overview');
    }

    // Architecture triggers with response analysis
    if (questionId === 'current-architecture') {
      await this.triggerArtifactGeneration('architecture-analysis');

      // Response-specific triggers
      if (responseText.includes('microservice') || responseText.includes('distributed')) {
        await this.triggerArtifactGeneration('microservices-documentation');
      }
      if (responseText.includes('monolith') || responseText.includes('single')) {
        await this.triggerArtifactGeneration('monolith-refactoring-guide');
      }
    }

    // Framework/Technology triggers
    if (questionId === 'preferred-framework' || questionId === 'primary-language') {
      if (responseText.includes('react') || responseText.includes('vue') || responseText.includes('angular')) {
        await this.triggerArtifactGeneration('frontend-checklist');
      }
      if (responseText.includes('node') || responseText.includes('express')) {
        await this.triggerArtifactGeneration('backend-api-guide');
      }
      if (responseText.includes('database') || responseText.includes('sql') || responseText.includes('mongo')) {
        await this.triggerArtifactGeneration('database-schema-analysis');
      }
    }

    // API triggers with response analysis
    if (questionId === 'api-consumers' || questionId === 'integration-providers') {
      await this.triggerArtifactGeneration('integration-map');

      // Complex integration patterns
      if (responseText.includes('graphql') || responseText.includes('rest') || responseText.includes('grpc')) {
        await this.triggerArtifactGeneration('api-documentation');
      }
    }

    // Security/Auth triggers
    if (questionId === 'authentication-model' || questionId === 'authorization-model') {
      if (responseText.includes('oauth') || responseText.includes('jwt') || responseText.includes('saml')) {
        await this.triggerArtifactGeneration('security-implementation-guide');
      }
    }
  }

  /**
   * Auto-trigger artifact generation
   */
  async triggerArtifactGeneration(artifactType) {
    const artifactData = {
      type: artifactType,
      projectData: this.getProjectSummary(),
      moduleData: this.moduleData,
      responses: Object.fromEntries(this.sessionState.responses),
      timestamp: new Date().toISOString()
    };

    // Save artifact generation request
    await this.saveArtifactRequest(artifactType, artifactData);

    return artifactData;
  }

  // Helper methods

  getPrimaryProjectType() {
    const patterns = this.sessionState.detectedPatterns;
    if (patterns.has('web-application')) return 'web application';
    if (patterns.has('api-service')) return 'API service';
    if (patterns.has('mobile-app')) return 'mobile app';
    if (patterns.has('library-package')) return 'library/package';
    return 'software';
  }

  generateProjectNameSuggestion() {
    // Generate intelligent project name based on directory and patterns
    const dirName = path.basename(this.rootDir);
    const patterns = Array.from(this.sessionState.detectedPatterns);

    if (patterns.includes('web-application')) {
      return `${dirName}-web-app`;
    }
    if (patterns.includes('api-service')) {
      return `${dirName}-api`;
    }
    return dirName;
  }

  formatPatternsForUser(patterns) {
    const patternLabels = {
      'web-application': 'Web Application',
      'api-service': 'API Service',
      'frontend-heavy': 'Frontend-Heavy Project',
      'backend-heavy': 'Backend-Heavy Project',
      'react-project': 'React Application',
      'vue-project': 'Vue Application',
      'mobile-app': 'Mobile Application',
      'library-package': 'Library/Package',
      'containerized': 'Containerized Application',
      'well-tested': 'Well-Tested Codebase',
      'documented-project': 'Well-Documented Project'
    };

    return patterns.map(pattern => ({
      value: pattern,
      label: patternLabels[pattern] || pattern.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
    }));
  }

  adaptPromptToPatterns(prompt, questionId) {
    const patterns = this.sessionState.detectedPatterns;

    // Adapt prompts based on detected patterns
    if (questionId === 'project-purpose' && patterns.has('web-application')) {
      return 'What user experience problem does this web application solve?';
    }

    if (questionId === 'project-purpose' && patterns.has('api-service')) {
      return 'What data or functionality does this API service provide to consumers?';
    }

    return prompt;
  }

  adaptPlaceholderToPatterns(placeholder, questionId) {
    const patterns = this.sessionState.detectedPatterns;

    if (questionId === 'value-proposition' && patterns.has('frontend-heavy')) {
      return 'e.g., Reduce user onboarding time by 40%, improve conversion rate, enhance user engagement';
    }

    return placeholder;
  }

  getDetectedFrameworks() {
    const frameworks = new Set();

    for (const module of this.moduleData.modules) {
      module.frameworks.forEach(fw => frameworks.add(fw));
    }

    return Array.from(frameworks);
  }

  getArtifactDescription(artifact) {
    const descriptions = {
      'project-analysis': 'Comprehensive Project Analysis Report',
      'module-diagram': 'Interactive Module Dependency Diagram',
      'architecture-diagram': 'System Architecture Visualization',
      'technical-specification': 'Technical Specification Document',
      'api-documentation': 'Auto-Generated API Documentation',
      'frontend-checklist': 'Frontend Development Checklist',
      'deployment-guide': 'Deployment & Operations Guide',
      'testing-strategy': 'Testing Strategy & Coverage Report'
    };

    return descriptions[artifact] || artifact.replace(/-/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
  }

  getHighPriorityArtifacts(artifacts) {
    const highPriority = ['project-analysis', 'technical-specification', 'architecture-diagram'];
    return artifacts.filter(artifact => highPriority.includes(artifact));
  }

  hasCompletedFoundationQuestions() {
    const foundationQuestions = ['project-name', 'project-type', 'project-purpose'];
    return foundationQuestions.every(q => this.sessionState.responses.has(q));
  }

  hasCompletedTechnicalQuestions() {
    const technicalQuestions = ['primary-language', 'preferred-framework'];
    return technicalQuestions.every(q => this.sessionState.responses.has(q));
  }

  hasCompletedSpecializedQuestions() {
    // Based on triggered sections
    return this.sessionState.triggeredSections.size === 0 ||
           Array.from(this.sessionState.triggeredSections).every(section =>
             this.hasCompletedSection(section));
  }

  hasCompletedSection(sectionId) {
    const section = this.blueprint.sections[sectionId];
    if (!section) return true;

    return section.questions.every(q =>
      !q.required || this.sessionState.responses.has(q.id));
  }

  shouldSkipToGeneration() {
    // Skip specialized questions if user confirmed they want artifacts immediately
    return this.sessionState.responses.get('skip-to-generation') === true;
  }

  getProjectSummary() {
    return {
      name: this.sessionState.responses.get('project-name') || 'Untitled Project',
      type: this.sessionState.responses.get('project-type') || 'Unknown',
      patterns: Array.from(this.sessionState.detectedPatterns),
      moduleCount: this.moduleData.modules.length,
      totalLines: this.moduleData.summary.totalLines,
      frameworks: this.getDetectedFrameworks()
    };
  }

  async fileExists(filename) {
    try {
      await fs.access(path.join(this.rootDir, filename));
      return true;
    } catch {
      return false;
    }
  }

  async directoryExists(dirname) {
    try {
      const stats = await fs.stat(path.join(this.rootDir, dirname));
      return stats.isDirectory();
    } catch {
      return false;
    }
  }

  async saveArtifactRequest(type, data) {
    const dataDir = path.join(this.rootDir, 'data');
    await fs.mkdir(dataDir, { recursive: true });

    const filename = `artifact-${type}-${Date.now()}.json`;
    const filepath = path.join(dataDir, filename);

    await fs.writeFile(filepath, JSON.stringify(data, null, 2));

    return filepath;
  }

  // Public API methods

  async getSessionState() {
    return {
      ...this.sessionState,
      responses: Object.fromEntries(this.sessionState.responses),
      detectedPatterns: Array.from(this.sessionState.detectedPatterns),
      triggeredSections: Array.from(this.sessionState.triggeredSections),
      artifactQueue: Array.from(this.sessionState.artifactQueue)
    };
  }

  async generateProgressiveFlow() {
    await this.initialize();

    const flow = {
      detectedPatterns: Array.from(this.sessionState.detectedPatterns),
      queuedArtifacts: Array.from(this.sessionState.artifactQueue),
      projectSummary: this.getProjectSummary(),
      nextPhase: this.sessionState.currentPhase,
      recommendedPath: this.getRecommendedQuestionPath()
    };

    return flow;
  }

  getRecommendedQuestionPath() {
    const patterns = this.sessionState.detectedPatterns;
    const path = ['detection', 'foundation'];

    if (patterns.has('web-application') || patterns.has('api-service')) {
      path.push('technical');
    }

    if (patterns.has('well-tested') || patterns.has('containerized')) {
      path.push('specialized');
    }

    path.push('generation');

    return path;
  }
}

module.exports = {
  ProgressiveQuestionEngine
};