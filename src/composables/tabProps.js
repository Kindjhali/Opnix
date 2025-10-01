function bind(fn, ctx) {
  return (...args) => fn.apply(ctx, args);
}

export function getCanvasProps(ctx) {
  return {
    active: ctx.activeTab === 'canvas',
    onLayout: layout => bind(ctx.layoutCanvas, ctx)(layout),
    onDetect: () => bind(ctx.detectModules, ctx)(),
    onAnalyze: () => bind(ctx.analyzeCanvas, ctx)(),
    onExport: () => bind(ctx.exportCanvas, ctx)()
  };
}

export function getTicketsProps(ctx) {
  return {
    active: ctx.activeTab === 'bugs',
    tickets: ctx.tickets,
    ticketStatusOptions: ctx.ticketStatusOptions,
    filter: ctx.bugFilter,
    onCreate: () => bind(ctx.openBugModal, ctx)(),
    onAnalyze: () => bind(ctx.analyzeWithPythonAgent, ctx)(),
    onExport: () => bind(ctx.exportBugs, ctx)(),
    onStatusChange: (ticket, event) => bind(ctx.onTicketStatusChange, ctx)(ticket, event),
    onUpdateFilter: filter => bind(ctx.updateBugFilter, ctx)(filter)
  };
}

export function getFeaturesProps(ctx) {
  return {
    active: ctx.activeTab === 'features',
    features: ctx.filteredFeatures,
    modules: ctx.modules,
    selectedModules: ctx.selectedModules,
    filter: ctx.featureFilter,
    getModuleFeatureCount: moduleId => bind(ctx.getModuleFeatureCount, ctx)(moduleId),
    getModuleName: moduleId => bind(ctx.getModuleName, ctx)(moduleId),
    getFeatureStatusColor: status => bind(ctx.getFeatureStatusColor, ctx)(status),
    onCreate: () => bind(ctx.openFeatureModal, ctx)(),
    onReport: () => bind(ctx.generateFeatureReport, ctx)(),
    onToggleModule: moduleId => bind(ctx.toggleModule, ctx)(moduleId),
    onUpdateFilter: filter => bind(ctx.updateFeatureFilter, ctx)(filter)
  };
}

export function getModulesProps(ctx) {
  return {
    active: ctx.activeTab === 'modules',
    modules: ctx.modules,
    summary: ctx.moduleSummary,
    getModuleBugCount: moduleId => bind(ctx.getModuleBugCount, ctx)(moduleId),
    getModuleFeatureCount: moduleId => bind(ctx.getModuleFeatureCount, ctx)(moduleId),
    getHealthColor: value => bind(ctx.getHealthColor, ctx)(value),
    onCreate: () => bind(ctx.openAddModuleModal, ctx)(),
    onDetect: () => bind(ctx.detectModules, ctx)(),
    onAnalyzeDependencies: module => bind(ctx.analyzeModuleDependencies, ctx)(module),
    onAnalyze: module => bind(ctx.analyzeModule, ctx)(module)
  };
}

export function getRoadmapProps(ctx) {
  return {
    active: ctx.activeTab === 'roadmap',
    state: ctx.roadmapState,
    versions: ctx.roadmapVersions,
    loading: ctx.roadmapLoading,
    updating: ctx.roadmapUpdating,
    versionsLoading: ctx.roadmapVersionsLoading,
    error: ctx.roadmapError,
    updateMessage: ctx.roadmapUpdateMessage,
    updateTimestamp: ctx.roadmapUpdateTimestamp,
    viewMode: ctx.roadmapViewMode,
    selectedVersion: ctx.roadmapSelectedVersion,
    onRefresh: options => bind(ctx.refreshRoadmapState, ctx)(options),
    onGenerate: () => bind(ctx.generateRoadmapFromData, ctx)(),
    onExport: () => bind(ctx.exportRoadmapSnapshot, ctx)(),
    onDownload: () => bind(ctx.downloadRoadmapSnapshot, ctx)(),
    onRollback: version => bind(ctx.rollbackRoadmap, ctx)(version),
    onSelectVersion: version => bind(ctx.selectRoadmapVersion, ctx)(version),
    onViewMode: mode => bind(ctx.setRoadmapViewMode, ctx)(mode),
    onFetchVersions: options => bind(ctx.fetchRoadmapVersions, ctx)(options),
    onUpdateMilestone: payload => bind(ctx.updateRoadmapMilestone, ctx)(payload)
  };
}

export function getSpecsProps(ctx) {
  return {
    active: ctx.activeTab === 'specs',
    currentPhase: ctx.currentPhase,
    questions: ctx.currentQuestions,
    exportFormat: ctx.specExportFormat,
    generatedSpec: ctx.generatedSpec,
    latestSpecMeta: ctx.latestSpecMeta,
    cliSessions: ctx.cliSessions,
    cliSessionsLoading: ctx.cliSessionsLoading,
    cliSessionsError: ctx.cliSessionsError,
    selectedSessionId: ctx.selectedCliSession,
    sessionDetails: ctx.cliSessionDetails,
    sessionDetailsError: ctx.cliSessionDetailsError,
    cliGateLog: ctx.cliGateLog,
    findCliQuestionPrompt: id => bind(ctx.findCliQuestionPrompt, ctx)(id),
    formatCliTimestamp: value => bind(ctx.formatCliTimestamp, ctx)(value),
    formatCliSessionStatus: status => bind(ctx.formatCliSessionStatus, ctx)(status),
    formatGateTimestamp: value => bind(ctx.formatGateTimestamp, ctx)(value),
    formatGateContext: value => bind(ctx.formatGateContext, ctx)(value),
    onUpdateExportFormat: format => bind(ctx.updateSpecExportFormat, ctx)(format),
    onGenerate: () => bind(ctx.generateSpec, ctx)(),
    onRefreshSessions: () => bind(ctx.fetchCliSessions, ctx)(),
    onViewSession: id => bind(ctx.viewCliSession, ctx)(id),
    onCloseSession: () => bind(ctx.clearCliSessionDetails, ctx)(),
    onAnswer: question => bind(ctx.processAnswer, ctx)(question),
    onReloadQuestions: () => bind(ctx.reloadInterviewQuestions, ctx)()
  };
}

export function getDiagramsProps(ctx) {
  return {
    active: ctx.activeTab === 'diagrams',
    mermaidCode: ctx.mermaidCode,
    generateDiagram: type => bind(ctx.generateDiagram, ctx)(type),
    generateFromModules: () => bind(ctx.generateFromModules, ctx)(),
    renderMermaid: () => bind(ctx.renderMermaid, ctx)(),
    updateMermaidCode: code => bind(ctx.updateMermaidCode, ctx)(code),
    mermaidError: ctx.mermaidError
  };
}

export function getApiProps(ctx) {
  return {
    active: ctx.activeTab === 'api',
    apiFormat: ctx.apiFormat,
    apiSpecContent: ctx.apiSpecContent,
    apiSpecWarnings: ctx.apiSpecWarnings,
    onGenerateApiSpec: options => bind(ctx.generateAPISpec, ctx)(options),
    onExportApiSpec: options => bind(ctx.exportAPISpec, ctx)(options),
    onTestApi: payload => bind(ctx.testAPI, ctx)(payload),
    onUpdateApiFormat: format => bind(ctx.updateApiFormat, ctx)(format)
  };
}

export function getStorybookProps(ctx) {
  return {
    active: ctx.activeTab === 'storybook',
    theme: ctx.currentTheme,
    status: ctx.storybookStatus,
    frameVersion: ctx.storybookFrameVersion,
    onStart: () => bind(ctx.startStorybookInstance, ctx)(),
    onRefresh: opts => bind(ctx.refreshStorybookFrame, ctx)(opts)
  };
}

export function getDocsProps(ctx) {
  return {
    active: ctx.activeTab === 'docs',
    docType: ctx.docType,
    docTitle: ctx.docTitle,
    generatedDocs: ctx.generatedDocs,
    docGenerationError: ctx.docGenerationError,
    latestDocMeta: ctx.latestDocMeta,
    latestDocContent: ctx.latestDocContent,
    latestDocHtml: ctx.latestDocHtml,
    docGenerating: ctx.docGenerating,
    runbookGenerationError: ctx.runbookGenerationError,
    latestRunbook: ctx.latestRunbook,
    latestRunbookContent: ctx.latestRunbookContent,
    latestRunbookHtml: ctx.latestRunbookHtml,
    runbookMessages: ctx.runbookMessages,
    runbookGenerating: ctx.runbookGenerating,
    runbookInterviewLoading: ctx.runbookInterviewLoading,
    onGenerateDocs: options => bind(ctx.generateDocs, ctx)(options),
    onExportDocs: () => bind(ctx.exportDocs, ctx)(),
    onUpdateDocType: value => bind(ctx.updateDocType, ctx)(value),
    onStartRunbookInterview: () => bind(ctx.startRunbookInterview, ctx)(),
    onQuickGenerateRunbook: () => bind(ctx.quickGenerateRunbook, ctx)()
  };
}
