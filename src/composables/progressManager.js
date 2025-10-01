import { reactive, computed, watch } from 'vue';

const progressState = reactive({
  sessions: {},
  currentSession: null,
  autoSaveEnabled: true,
  lastSaved: null,
  isDirty: false
});

// Progress data structure for a session
function createProgressSession(id, type = 'general') {
  return {
    id,
    type, // 'general', 'roadmap', 'ticket', 'feature', 'module'
    title: '',
    description: '',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    startedAt: null,
    completedAt: null,
    status: 'pending', // 'pending', 'active', 'paused', 'completed', 'cancelled'
    progress: 0,
    stages: [],
    metadata: {},
    checkpoints: [],
    statistics: {
      totalSteps: 0,
      completedSteps: 0,
      skippedSteps: 0,
      blockedSteps: 0,
      timeSpent: 0, // milliseconds
      estimatedRemaining: 0 // milliseconds
    }
  };
}

// Stage structure within a progress session
function createProgressStage(id, title, order = 0) {
  return {
    id,
    title,
    description: '',
    order,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    estimatedDuration: null,
    actualDuration: null,
    steps: [],
    dependencies: [],
    metadata: {}
  };
}

// Step structure within a stage
function createProgressStep(id, title, order = 0) {
  return {
    id,
    title,
    description: '',
    order,
    status: 'pending',
    startedAt: null,
    completedAt: null,
    isRequired: true,
    isSkippable: false,
    estimatedDuration: null,
    actualDuration: null,
    checkpoints: [],
    metadata: {}
  };
}

export function useProgressManager() {
  // API functions for persistence
  const saveProgressToServer = async (sessionId, progressData) => {
    try {
      const response = await fetch('/api/progress/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId,
          progressData,
          timestamp: new Date().toISOString()
        })
      });

      if (!response.ok) {
        throw new Error(`Failed to save progress: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Progress save failed:', error);
      throw error;
    }
  };

  const loadProgressFromServer = async (sessionId = null) => {
    try {
      const url = sessionId ? `/api/progress/load/${sessionId}` : '/api/progress/load';
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null; // No progress data found
        }
        throw new Error(`Failed to load progress: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Progress load failed:', error);
      throw error;
    }
  };

  const listProgressSessions = async () => {
    try {
      const response = await fetch('/api/progress/sessions');

      if (!response.ok) {
        throw new Error(`Failed to list sessions: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      console.error('Session list failed:', error);
      throw error;
    }
  };

  // Progress session management
  const createSession = (id, type = 'general', title = '', description = '') => {
    const session = createProgressSession(id, type);
    session.title = title;
    session.description = description;

    progressState.sessions[id] = session;
    progressState.isDirty = true;

    return session;
  };

  const setCurrentSession = (sessionId) => {
    if (progressState.sessions[sessionId]) {
      progressState.currentSession = sessionId;
      return progressState.sessions[sessionId];
    }
    return null;
  };

  const getCurrentSession = () => {
    return progressState.currentSession ? progressState.sessions[progressState.currentSession] : null;
  };

  const updateSession = (sessionId, updates) => {
    if (progressState.sessions[sessionId]) {
      Object.assign(progressState.sessions[sessionId], updates);
      progressState.sessions[sessionId].updatedAt = new Date().toISOString();
      progressState.isDirty = true;
      return progressState.sessions[sessionId];
    }
    return null;
  };

  const deleteSession = (sessionId) => {
    if (progressState.sessions[sessionId]) {
      delete progressState.sessions[sessionId];
      if (progressState.currentSession === sessionId) {
        progressState.currentSession = null;
      }
      progressState.isDirty = true;
      return true;
    }
    return false;
  };

  // Stage management
  const addStage = (sessionId, stage) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const newStage = typeof stage === 'string'
      ? createProgressStage(`stage-${Date.now()}`, stage, session.stages.length)
      : { ...createProgressStage(stage.id || `stage-${Date.now()}`, stage.title, session.stages.length), ...stage };

    session.stages.push(newStage);
    session.updatedAt = new Date().toISOString();
    progressState.isDirty = true;

    return newStage;
  };

  const updateStage = (sessionId, stageId, updates) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const stage = session.stages.find(s => s.id === stageId);
    if (!stage) return null;

    Object.assign(stage, updates);
    session.updatedAt = new Date().toISOString();
    progressState.isDirty = true;

    return stage;
  };

  const setStageStatus = (sessionId, stageId, status) => {
    const updates = { status };

    if (status === 'active' && !updates.startedAt) {
      updates.startedAt = new Date().toISOString();
    } else if ((status === 'completed' || status === 'cancelled') && !updates.completedAt) {
      updates.completedAt = new Date().toISOString();

      if (status === 'completed' && updates.startedAt) {
        updates.actualDuration = new Date() - new Date(updates.startedAt);
      }
    }

    return updateStage(sessionId, stageId, updates);
  };

  // Step management
  const addStep = (sessionId, stageId, step) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const stage = session.stages.find(s => s.id === stageId);
    if (!stage) return null;

    const newStep = typeof step === 'string'
      ? createProgressStep(`step-${Date.now()}`, step, stage.steps.length)
      : { ...createProgressStep(step.id || `step-${Date.now()}`, step.title, stage.steps.length), ...step };

    stage.steps.push(newStep);
    session.updatedAt = new Date().toISOString();
    progressState.isDirty = true;

    return newStep;
  };

  const updateStep = (sessionId, stageId, stepId, updates) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const stage = session.stages.find(s => s.id === stageId);
    if (!stage) return null;

    const step = stage.steps.find(s => s.id === stepId);
    if (!step) return null;

    Object.assign(step, updates);
    session.updatedAt = new Date().toISOString();
    progressState.isDirty = true;

    return step;
  };

  const setStepStatus = (sessionId, stageId, stepId, status) => {
    const updates = { status };

    if (status === 'active' && !updates.startedAt) {
      updates.startedAt = new Date().toISOString();
    } else if ((status === 'completed' || status === 'cancelled' || status === 'skipped') && !updates.completedAt) {
      updates.completedAt = new Date().toISOString();

      if (status === 'completed' && updates.startedAt) {
        updates.actualDuration = new Date() - new Date(updates.startedAt);
      }
    }

    const result = updateStep(sessionId, stageId, stepId, updates);

    // Update session statistics
    if (result) {
      updateSessionStatistics(sessionId);
    }

    return result;
  };

  // Checkpoint management
  const createCheckpoint = (sessionId, description = '', metadata = {}) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      description,
      timestamp: new Date().toISOString(),
      sessionSnapshot: JSON.parse(JSON.stringify(session)), // Deep copy
      metadata
    };

    session.checkpoints.push(checkpoint);
    session.updatedAt = new Date().toISOString();
    progressState.isDirty = true;

    return checkpoint;
  };

  const restoreFromCheckpoint = (sessionId, checkpointId) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    const checkpoint = session.checkpoints.find(c => c.id === checkpointId);
    if (!checkpoint) return null;

    // Restore session from checkpoint snapshot
    const restoredSession = { ...checkpoint.sessionSnapshot };
    restoredSession.id = sessionId; // Preserve original ID
    restoredSession.updatedAt = new Date().toISOString();

    progressState.sessions[sessionId] = restoredSession;
    progressState.isDirty = true;

    return restoredSession;
  };

  // Statistics calculation
  const updateSessionStatistics = (sessionId) => {
    const session = progressState.sessions[sessionId];
    if (!session) return null;

    let totalSteps = 0;
    let completedSteps = 0;
    let skippedSteps = 0;
    let blockedSteps = 0;
    let totalTimeSpent = 0;

    session.stages.forEach(stage => {
      stage.steps.forEach(step => {
        totalSteps++;

        switch (step.status) {
          case 'completed':
            completedSteps++;
            if (step.actualDuration) {
              totalTimeSpent += step.actualDuration;
            }
            break;
          case 'skipped':
            skippedSteps++;
            break;
          case 'blocked':
            blockedSteps++;
            break;
        }
      });
    });

    session.statistics = {
      totalSteps,
      completedSteps,
      skippedSteps,
      blockedSteps,
      timeSpent: totalTimeSpent,
      estimatedRemaining: 0 // Could be calculated based on average step duration
    };

    // Update overall progress percentage
    session.progress = totalSteps > 0 ? Math.round((completedSteps / totalSteps) * 100) : 0;

    // Update session status based on progress
    if (session.progress === 100) {
      session.status = 'completed';
      if (!session.completedAt) {
        session.completedAt = new Date().toISOString();
      }
    } else if (session.progress > 0 && session.status === 'pending') {
      session.status = 'active';
      if (!session.startedAt) {
        session.startedAt = new Date().toISOString();
      }
    }

    return session.statistics;
  };

  // Auto-save functionality
  const enableAutoSave = (intervalMs = 30000) => {
    progressState.autoSaveEnabled = true;

    const autoSaveInterval = setInterval(async () => {
      if (progressState.isDirty && progressState.currentSession) {
        try {
          await saveProgress(progressState.currentSession);
        } catch (error) {
          console.warn('Auto-save failed:', error);
        }
      }
    }, intervalMs);

    return () => {
      clearInterval(autoSaveInterval);
      progressState.autoSaveEnabled = false;
    };
  };

  // Manual save/load
  const saveProgress = async (sessionId = null) => {
    const targetSessionId = sessionId || progressState.currentSession;
    if (!targetSessionId || !progressState.sessions[targetSessionId]) {
      throw new Error('No valid session to save');
    }

    const session = progressState.sessions[targetSessionId];
    await saveProgressToServer(targetSessionId, session);

    progressState.lastSaved = new Date().toISOString();
    progressState.isDirty = false;

    return session;
  };

  const loadProgress = async (sessionId = null) => {
    const data = await loadProgressFromServer(sessionId);

    if (data && data.sessions) {
      // Load multiple sessions
      Object.assign(progressState.sessions, data.sessions);
      if (data.currentSession) {
        progressState.currentSession = data.currentSession;
      }
    } else if (data && sessionId) {
      // Load single session
      progressState.sessions[sessionId] = data;
      progressState.currentSession = sessionId;
    }

    progressState.isDirty = false;
    return data;
  };

  // Computed properties
  const allSessions = computed(() => Object.values(progressState.sessions));
  const activeSessions = computed(() => allSessions.value.filter(s => s.status === 'active'));
  const completedSessions = computed(() => allSessions.value.filter(s => s.status === 'completed'));

  // Watch for changes to trigger auto-save
  watch(
    () => progressState.isDirty,
    (isDirty) => {
      if (isDirty && progressState.autoSaveEnabled && progressState.currentSession) {
        // Debounce auto-save
        setTimeout(() => {
          if (progressState.isDirty) {
            saveProgress().catch(console.warn);
          }
        }, 5000);
      }
    }
  );

  return {
    // State
    progressState,

    // Session management
    createSession,
    setCurrentSession,
    getCurrentSession,
    updateSession,
    deleteSession,

    // Stage management
    addStage,
    updateStage,
    setStageStatus,

    // Step management
    addStep,
    updateStep,
    setStepStatus,

    // Checkpoint management
    createCheckpoint,
    restoreFromCheckpoint,

    // Statistics
    updateSessionStatistics,

    // Persistence
    saveProgress,
    loadProgress,
    listProgressSessions,
    enableAutoSave,

    // Computed
    allSessions,
    activeSessions,
    completedSessions,

    // Utilities
    createProgressSession,
    createProgressStage,
    createProgressStep
  };
}