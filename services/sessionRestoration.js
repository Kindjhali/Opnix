const checkpointManager = require('./checkpointManager');
const path = require('path');
const fs = require('fs').promises;

const RESTORATION_CONFIG_FILE = path.join(__dirname, '..', 'data', 'restoration-config.json');
const RECOVERY_LOG_FILE = path.join(__dirname, '..', 'data', 'recovery.log');

class SessionRestoration {
  constructor() {
    this.restorationHandlers = new Map();
    this.config = {
      autoRestore: true,
      restoreOnStartup: true,
      maxRecoveryAge: 24 * 60 * 60 * 1000, // 24 hours
      requireUserConfirmation: false,
      preferCriticalCheckpoints: true
    };
  }

  async initialize() {
    await this.loadConfig();

    // Register for application startup
    if (this.config.restoreOnStartup) {
      await this.detectAndRestoreInterruptedSessions();
    }
  }

  async loadConfig() {
    try {
      const configContent = await fs.readFile(RESTORATION_CONFIG_FILE, 'utf8');
      this.config = { ...this.config, ...JSON.parse(configContent) };
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to load restoration config: ${error.message}`);
      }
      // Use defaults if config doesn't exist
      await this.saveConfig();
    }
  }

  async saveConfig() {
    try {
      await fs.writeFile(RESTORATION_CONFIG_FILE, JSON.stringify(this.config, null, 2));
    } catch (error) {
      console.warn(`Failed to save restoration config: ${error.message}`);
    }
  }

  async updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  registerRestorationHandler(sessionType, handler) {
    this.restorationHandlers.set(sessionType, handler);
  }

  async detectAndRestoreInterruptedSessions() {
    if (!this.config.autoRestore) {
      return { restored: [], skipped: 'auto-restore disabled' };
    }

    const recoverableSessions = await checkpointManager.getAllRecoverableSessions();
    const recentSessions = this.filterRecentSessions(recoverableSessions);

    if (recentSessions.length === 0) {
      await this.logRecovery('No recent interrupted sessions found');
      return { restored: [], skipped: 'no recent sessions' };
    }

    const restoredSessions = [];
    const errors = [];

    for (const session of recentSessions) {
      try {
        if (await this.shouldRestoreSession(session)) {
          const result = await this.restoreSession(session.sessionId);
          restoredSessions.push(result);
          await this.logRecovery(`Successfully restored session: ${session.sessionId}`);
        } else {
          await this.logRecovery(`Skipped restoration for session: ${session.sessionId}`);
        }
      } catch (error) {
        errors.push({ sessionId: session.sessionId, error: error.message });
        await this.logRecovery(`Failed to restore session ${session.sessionId}: ${error.message}`);
      }
    }

    return {
      restored: restoredSessions,
      errors,
      totalFound: recentSessions.length
    };
  }

  async restoreSession(sessionId, options = {}) {
    const {
      checkpointId = null,
      forceRestore = false,
      userConfirmed = false
    } = options;

    // Check if user confirmation is required
    if (this.config.requireUserConfirmation && !userConfirmed && !forceRestore) {
      throw new Error('User confirmation required for session restoration');
    }

    // Get session checkpoints
    const checkpoints = await checkpointManager.getSessionCheckpoints(sessionId);
    if (checkpoints.length === 0) {
      throw new Error(`No checkpoints found for session ${sessionId}`);
    }

    // Select checkpoint to restore from
    let targetCheckpoint;
    if (checkpointId) {
      targetCheckpoint = checkpoints.find(cp => cp.id === checkpointId);
      if (!targetCheckpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found for session ${sessionId}`);
      }
    } else if (this.config.preferCriticalCheckpoints) {
      // Find most recent critical checkpoint
      targetCheckpoint = checkpoints.find(cp => cp.critical) || checkpoints[0];
    } else {
      // Use most recent checkpoint
      targetCheckpoint = checkpoints[0];
    }

    // Load checkpoint data
    const checkpoint = await checkpointManager.loadCheckpoint(targetCheckpoint.id);

    // Determine session type and get appropriate handler
    const sessionType = this.detectSessionType(checkpoint);
    const handler = this.restorationHandlers.get(sessionType);

    if (!handler) {
      throw new Error(`No restoration handler registered for session type: ${sessionType}`);
    }

    // Execute restoration
    const restorationResult = await handler(checkpoint, {
      sessionId,
      checkpointId: targetCheckpoint.id,
      timestamp: checkpoint.timestamp,
      sessionType
    });

    // Log successful restoration
    await this.logRecovery(
      `Session ${sessionId} restored from checkpoint ${targetCheckpoint.id} (${sessionType})`
    );

    return {
      sessionId,
      checkpointId: targetCheckpoint.id,
      sessionType,
      timestamp: checkpoint.timestamp,
      restored: true,
      result: restorationResult
    };
  }

  async shouldRestoreSession(session) {
    // Check age
    const sessionAge = Date.now() - new Date(session.latestTimestamp).getTime();
    if (sessionAge > this.config.maxRecoveryAge) {
      return false;
    }

    // Prioritize sessions with critical checkpoints
    if (this.config.preferCriticalCheckpoints && session.hasCriticalCheckpoints) {
      return true;
    }

    // Check if session has meaningful progress
    return session.checkpoints.length > 1;
  }

  filterRecentSessions(sessions) {
    const cutoffTime = Date.now() - this.config.maxRecoveryAge;

    return sessions.filter(session => {
      const sessionTime = new Date(session.latestTimestamp).getTime();
      return sessionTime > cutoffTime;
    });
  }

  detectSessionType(checkpoint) {
    // Analyze checkpoint data to determine session type
    const data = checkpoint.data;

    // Check for CLI interview session
    if (data.interviewResponses || data.currentQuestion || data.sessionType === 'cli-interview') {
      return 'cli-interview';
    }

    // Check for progressive documentation session
    if (data.generatedSpec || data.questionAnswers || data.currentPhase) {
      return 'progressive-docs';
    }

    // Check for module detection session
    if (data.detectedModules || data.moduleEdges || data.cy) {
      return 'module-detection';
    }

    // Check for roadmap session
    if (data.roadmapState || data.milestones) {
      return 'roadmap';
    }

    // Check for feature/bug workflow
    if (data.tickets || data.features || data.bugWorkflow) {
      return 'workflow';
    }

    // Default to generic session
    return 'generic';
  }

  async getRestorationCandidates() {
    const sessions = await checkpointManager.getAllRecoverableSessions();
    const recentSessions = this.filterRecentSessions(sessions);

    return recentSessions.map(session => ({
      sessionId: session.sessionId,
      latestTimestamp: session.latestTimestamp,
      checkpointCount: session.checkpoints.length,
      hasCriticalCheckpoints: session.hasCriticalCheckpoints,
      sessionType: this.detectSessionType({ data: session.checkpoints[0] || {} }),
      age: Date.now() - new Date(session.latestTimestamp).getTime(),
      recommended: this.shouldRestoreSession(session)
    }));
  }

  async createRestorationPoint(sessionId, data, description) {
    return await checkpointManager.createCriticalCheckpoint(
      sessionId,
      data,
      `Restoration point: ${description}`
    );
  }

  async logRecovery(message) {
    const logEntry = `${new Date().toISOString()} - ${message}\n`;

    try {
      await fs.appendFile(RECOVERY_LOG_FILE, logEntry);
    } catch (error) {
      console.warn(`Failed to write recovery log: ${error.message}`);
    }
  }

  async getRecoveryLog(limit = 100) {
    try {
      const content = await fs.readFile(RECOVERY_LOG_FILE, 'utf8');
      const lines = content.trim().split('\n');
      return lines.slice(-limit).reverse(); // Most recent first
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async clearRecoveryLog() {
    try {
      await fs.writeFile(RECOVERY_LOG_FILE, '');
    } catch (error) {
      console.warn(`Failed to clear recovery log: ${error.message}`);
    }
  }

  // Graceful failure handling
  async handleSessionFailure(sessionId, error, context = {}) {
    await this.logRecovery(
      `Session failure detected for ${sessionId}: ${error.message} - Context: ${JSON.stringify(context)}`
    );

    // Create failure checkpoint if we have any data
    if (context.lastKnownState) {
      try {
        await checkpointManager.createCheckpoint(sessionId, context.lastKnownState, {
          type: 'failure',
          description: `Session failed: ${error.message}`,
          critical: true,
          context: { error: error.message, ...context }
        });
      } catch (checkpointError) {
        await this.logRecovery(
          `Failed to create failure checkpoint for ${sessionId}: ${checkpointError.message}`
        );
      }
    }

    return {
      sessionId,
      failureTimestamp: new Date().toISOString(),
      error: error.message,
      checkpointCreated: !!context.lastKnownState,
      recoverable: true
    };
  }
}

module.exports = new SessionRestoration();