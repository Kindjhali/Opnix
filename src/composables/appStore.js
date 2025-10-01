import { reactive, computed } from 'vue';
import MAIN_TABS from '../config/mainTabs.js';

const INITIAL_TICKET_STATUS_OPTIONS = [
  { value: 'reported', label: 'Reported' },
  { value: 'inProgress', label: 'In Progress' },
  { value: 'finished', label: 'Finished' }
];

function createInitialState() {
  return {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    activeTab: 'canvas',
    mainTabs: [...MAIN_TABS],
    claudeCommand: '',
    claudeLastResponse: '',
    cy: null,
    edgeHandles: null,
    moduleEdges: [],
    moduleSummary: {
      moduleCount: 0,
      dependencyCount: 0,
      externalDependencyCount: 0,
      totalLines: 0
    },
    roadmapState: {
      milestones: [],
      summary: {
        source: 'manual',
        ticketCount: 0,
        moduleCount: 0,
        featureCount: 0,
        generatedAt: null
      },
      history: []
    },
    roadmapVersions: [],
    roadmapLoading: false,
    roadmapUpdating: false,
    roadmapUpdateError: '',
    roadmapUpdateMessage: '',
    roadmapUpdateTimestamp: null,
    roadmapUpdateMessageHandle: null,
    roadmapVersionsLoading: false,
    roadmapError: '',
    roadmapViewMode: 'minimal',
    roadmapSelectedVersion: '',
    roadmapRefreshHandle: null,
    stats: null,
    agents: [],
    taskQueue: [],
    tickets: [],
    features: [],
    modules: [],
    exportsList: [],
    latestAudit: null,
    loading: {
      tickets: false,
      features: false,
      modules: false,
      agents: false,
      exports: false,
      stats: false
    },
    branchStatusLoading: false,
    branchStatusError: '',
    branchStatus: {
      name: '',
      ahead: 0,
      behind: 0,
      dirty: false,
      detached: false,
      notGitRepo: false,
      lastUpdated: null
    },
    contextStatusLoading: false,
    contextStatusError: '',
    contextStatus: {
      contextUsed: 0,
      contextLimit: 0,
      percentage: 0,
      remaining: 0,
      displayText: '',
      warning: '',
      currentTask: 'System Ready',
      filesEdited: 0,
      daicState: 'Discussion'
    },
    terminalHistory: [],
    terminalCommand: '',
    terminalWorkingDirectory: '.',
    terminalLoading: false,
    terminalRunning: false,
    terminalError: '',
    bugFilter: { priority: '', status: '' },
    featureFilter: { module: '', status: '' },
    selectedModules: [],
    ticketStatusOptions: [...INITIAL_TICKET_STATUS_OPTIONS],
    showTicketCompletionModal: false,
    ticketBeingUpdated: null,
    ticketStatusElement: null,
    ticketCompletionSummary: '',
    ticketCompletionError: '',
    showBugModal: false,
    showFeatureModal: false,
    showAddModuleModal: false,
    newBug: { title: '', description: '', priority: 'medium', modules: [], tagsText: '' },
    newFeature: { title: '', description: '', moduleId: '', priority: 'medium', criteriaText: '' },
    newModule: { name: '', id: '', path: '', depsString: '', type: 'custom' },
    interviewBlueprint: null,
    baseSectionOrder: [],
    typeSectionMap: {},
    frameworkSectionMap: {},
    languageFrameworks: {},
    currentSectionOrder: [],
    activeSectionIndex: 0,
    completedSections: [],
    currentQuestions: [],
    currentPhase: 'initial',
    questionAnswers: {},
    generatedSpec: '',
    latestSpecMeta: null,
    latestSpecPayload: null,
    specExportFormat: 'json',
    apiFormat: 'openapi',
    apiSpecContent: '',
    apiSpecPayload: null,
    apiSpecWarnings: [],
    docType: 'overview',
    docTitle: 'Project Overview',
    generatedDocs: '<p class="loading">Select documentation type and click generate...</p>',
    docGenerating: false,
    docGenerationError: '',
    latestDocMeta: null,
    latestDocContent: '',
    latestDocHtml: '',
    runbookModalOpen: false,
    runbookInterviewLoading: false,
    runbookInterviewSubmitting: false,
    runbookInterviewError: '',
    runbookSessionId: null,
    runbookCurrentQuestion: null,
    runbookDraftAnswer: '',
    runbookResponses: [],
    runbookHistory: [],
    runbookMessages: [],
    latestRunbook: null,
    latestRunbookContent: '',
    latestRunbookHtml: '',
    runbookGenerating: false,
    runbookGenerationError: '',
    mermaidCode: '',
    mermaidError: '',
    cliSessions: [],
    cliSessionsLoading: false,
    cliSessionsError: '',
    selectedCliSession: null,
    cliSessionDetails: null,
    cliSessionDetailsError: '',
    cliGateLog: [],
    cliSessionsRefreshHandle: null,
    branchStatusRefreshHandle: null,
    contextStatusRefreshHandle: null,
    storybookStatus: '',
    storybookFrameVersion: 0
  };
}

const state = reactive(createInitialState());

const ticketProgress = computed(() => {
  const reported = state.stats?.reported || 0;
  const inProgress = state.stats?.inProgress || 0;
  const finished = state.stats?.finished || 0;
  const open = state.stats?.open !== undefined ? state.stats.open : reported + inProgress;
  const closed = state.stats?.closed !== undefined ? state.stats.closed : finished;
  const total = open + closed;
  const openPct = total ? Math.round((open / total) * 100) : 0;
  const closedPct = total ? 100 - openPct : 0;
  return { reported, inProgress, finished, open, closed, total, openPct, closedPct };
});

export function useAppStore() {
  return state;
}

export function useAppStoreComputed() {
  return { ticketProgress };
}

export function resetAppStore() {
  Object.assign(state, createInitialState());
}
