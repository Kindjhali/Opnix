const checkpointManager = require('./checkpointManager');
const sessionRestoration = require('./sessionRestoration');
const path = require('path');
const fs = require('fs').promises;

const FAILURE_LOG_FILE = path.join(__dirname, '..', 'data', 'failure.log');
const RECOVERY_PROMPTS_DIR = path.join(__dirname, '..', 'data', 'recovery-prompts');

class GracefulFailureHandler {
  constructor() {
    this.activeRecoveryPrompts = new Map();
    this.failureThresholds = {
      maxRetries: 3,
      retryDelay: 1000, // ms
      criticalErrorTypes: ['ENOSPC', 'ENOMEM', 'ECONNREFUSED'],
      recoverableErrorTypes: ['ENOENT', 'ETIMEDOUT', 'ENOTFOUND']
    };
    this.failureCounters = new Map();
  }

  async initialize() {
    await this.ensureRecoveryPromptsDirectory();

    // Register global error handlers
    this.setupGlobalErrorHandlers();
  }

  async ensureRecoveryPromptsDirectory() {
    try {
      await fs.access(RECOVERY_PROMPTS_DIR);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(RECOVERY_PROMPTS_DIR, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  setupGlobalErrorHandlers() {
    // Handle uncaught exceptions
    process.on('uncaughtException', async (error) => {
      await this.handleCriticalFailure('uncaught-exception', error, {
        type: 'process',
        severity: 'critical'
      });
    });

    // Handle unhandled promise rejections
    process.on('unhandledRejection', async (reason, promise) => {
      await this.handleCriticalFailure('unhandled-rejection', reason, {
        type: 'promise',
        severity: 'critical',
        promise: promise.toString()
      });
    });
  }

  async handleSessionFailure(sessionId, error, context = {}) {
    const failureId = this.generateFailureId(sessionId);

    await this.logFailure(failureId, {
      sessionId,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      type: 'session-failure'
    });

    // Create failure checkpoint if we have state
    let checkpointId = null;
    if (context.sessionState) {
      try {
        checkpointId = await checkpointManager.createCheckpoint(sessionId, context.sessionState, {
          type: 'failure',
          description: `Session failure: ${error.message}`,
          critical: true,
          context: { error: error.message, failureId, ...context }
        });
      } catch (checkpointError) {
        await this.logFailure(failureId, {
          type: 'checkpoint-creation-failed',
          originalError: error.message,
          checkpointError: checkpointError.message,
          sessionId
        });
      }
    }

    // Determine recovery strategy
    const recoveryStrategy = this.determineRecoveryStrategy(error, context);

    // Create recovery prompt
    const recoveryPrompt = await this.createRecoveryPrompt(sessionId, {
      failureId,
      error,
      context,
      checkpointId,
      recoveryStrategy,
      options: this.generateRecoveryOptions(error, context)
    });

    return {
      sessionId,
      failureId,
      checkpointId,
      recoveryStrategy,
      recoveryPromptId: recoveryPrompt.id,
      dataLoss: !checkpointId,
      recoverable: this.isRecoverable(error),
      autoRecoveryAttempted: false
    };
  }

  async handleBackendError(operation, error, context = {}) {
    const failureId = this.generateFailureId(`backend-${operation}`);

    await this.logFailure(failureId, {
      operation,
      error: error.message,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      type: 'backend-error'
    });

    // Check if this is a recurring error
    const errorKey = `${operation}-${error.code || error.message}`;
    const failureCount = (this.failureCounters.get(errorKey) || 0) + 1;
    this.failureCounters.set(errorKey, failureCount);

    // If we've seen this error multiple times, escalate
    if (failureCount >= this.failureThresholds.maxRetries) {
      return await this.escalateRecurringFailure(operation, error, failureCount, context);
    }

    // Try automatic recovery for known recoverable errors
    if (this.isAutoRecoverable(error)) {
      return await this.attemptAutoRecovery(operation, error, context);
    }

    // Create user recovery prompt
    const recoveryPrompt = await this.createRecoveryPrompt(`backend-${operation}`, {
      failureId,
      error,
      context,
      operation,
      failureCount,
      recoveryStrategy: this.determineRecoveryStrategy(error, { operation, ...context }),
      options: this.generateBackendRecoveryOptions(operation, error)
    });

    return {
      operation,
      failureId,
      recoverable: this.isRecoverable(error),
      autoRecoveryAttempted: false,
      recoveryPromptId: recoveryPrompt.id,
      requiresUserAction: true
    };
  }

  async handleCriticalFailure(type, error, context = {}) {
    const failureId = this.generateFailureId(`critical-${type}`);

    await this.logFailure(failureId, {
      type: 'critical-failure',
      subtype: type,
      error: error.message || error,
      stack: error.stack,
      context,
      timestamp: new Date().toISOString(),
      severity: 'critical'
    });

    // For critical failures, immediately create checkpoints for all active sessions
    try {
      await this.createEmergencyCheckpoints();
    } catch (checkpointError) {
      console.error('Failed to create emergency checkpoints:', checkpointError);
    }

    // Don't attempt recovery for critical failures - just log and notify
    return {
      failureId,
      type,
      severity: 'critical',
      recoverable: false,
      emergencyCheckpointsCreated: true
    };
  }

  async attemptAutoRecovery(operation, error, context) {
    const recoveryAttempts = [];

    try {
      // Retry with exponential backoff
      if (this.isRetryable(error)) {
        const delay = this.failureThresholds.retryDelay * Math.pow(2, context.retryCount || 0);

        await new Promise(resolve => setTimeout(resolve, delay));

        recoveryAttempts.push({
          type: 'retry',
          delay,
          timestamp: new Date().toISOString()
        });
      }

      // Clear cache if cache-related error
      if (this.isCacheError(error)) {
        await this.clearRelevantCaches(operation);
        recoveryAttempts.push({
          type: 'cache-clear',
          timestamp: new Date().toISOString()
        });
      }

      // Reset connection for network errors
      if (this.isNetworkError(error)) {
        await this.resetConnections(operation);
        recoveryAttempts.push({
          type: 'connection-reset',
          timestamp: new Date().toISOString()
        });
      }

      return {
        operation,
        autoRecoveryAttempted: true,
        recoveryAttempts,
        success: true
      };

    } catch (recoveryError) {
      await this.logFailure(this.generateFailureId(`recovery-${operation}`), {
        type: 'auto-recovery-failed',
        originalError: error.message,
        recoveryError: recoveryError.message,
        operation,
        recoveryAttempts
      });

      return {
        operation,
        autoRecoveryAttempted: true,
        recoveryAttempts,
        success: false,
        recoveryError: recoveryError.message
      };
    }
  }

  async createRecoveryPrompt(sessionId, failureData) {
    const promptId = this.generateFailureId(`prompt-${sessionId}`);
    const promptPath = path.join(RECOVERY_PROMPTS_DIR, `${promptId}.json`);

    const prompt = {
      id: promptId,
      sessionId,
      createdAt: new Date().toISOString(),
      failureData,
      status: 'pending',
      userResponse: null,
      resolvedAt: null
    };

    await fs.writeFile(promptPath, JSON.stringify(prompt, null, 2));
    this.activeRecoveryPrompts.set(promptId, prompt);

    return prompt;
  }

  async respondToRecoveryPrompt(promptId, userResponse) {
    const prompt = this.activeRecoveryPrompts.get(promptId);
    if (!prompt) {
      throw new Error(`Recovery prompt ${promptId} not found`);
    }

    prompt.userResponse = userResponse;
    prompt.status = 'resolved';
    prompt.resolvedAt = new Date().toISOString();

    // Update prompt file
    const promptPath = path.join(RECOVERY_PROMPTS_DIR, `${promptId}.json`);
    await fs.writeFile(promptPath, JSON.stringify(prompt, null, 2));

    // Execute recovery action based on user response
    const recoveryResult = await this.executeRecoveryAction(prompt, userResponse);

    // Clean up prompt
    this.activeRecoveryPrompts.delete(promptId);

    return {
      promptId,
      userResponse,
      recoveryResult,
      resolved: true
    };
  }

  async executeRecoveryAction(prompt, userResponse) {
    const { failureData } = prompt;

    switch (userResponse.action) {
      case 'restore-checkpoint':
        if (failureData.checkpointId) {
          return await sessionRestoration.restoreSession(
            failureData.sessionId,
            { checkpointId: failureData.checkpointId, userConfirmed: true }
          );
        }
        throw new Error('No checkpoint available for restoration');

      case 'restart-session':
        return await this.restartSession(failureData.sessionId, userResponse.options);

      case 'ignore-and-continue':
        return { action: 'ignored', sessionId: failureData.sessionId };

      case 'retry-operation':
        return await this.retryFailedOperation(failureData, userResponse.options);

      case 'create-checkpoint-and-exit':
        if (failureData.context.sessionState) {
          const checkpointId = await checkpointManager.createCriticalCheckpoint(
            failureData.sessionId,
            failureData.context.sessionState,
            'User-requested checkpoint before exit'
          );
          return { action: 'checkpoint-created', checkpointId };
        }
        throw new Error('No session state available for checkpoint');

      default:
        throw new Error(`Unknown recovery action: ${userResponse.action}`);
    }
  }

  determineRecoveryStrategy(error, context) {
    // Critical errors require immediate attention
    if (this.failureThresholds.criticalErrorTypes.includes(error.code)) {
      return 'critical-intervention';
    }

    // Recoverable errors can be handled automatically or with user input
    if (this.failureThresholds.recoverableErrorTypes.includes(error.code)) {
      return 'auto-recovery';
    }

    // Session errors usually need restoration
    if (context.sessionState) {
      return 'session-restoration';
    }

    // Network/temporary errors can be retried
    if (this.isNetworkError(error) || this.isTemporaryError(error)) {
      return 'retry-with-backoff';
    }

    return 'manual-intervention';
  }

  generateRecoveryOptions(error, context) {
    const options = [];

    if (context.sessionState) {
      options.push({
        action: 'restore-checkpoint',
        label: 'Restore from last checkpoint',
        description: 'Restore the session from the most recent checkpoint',
        recommended: true
      });
    }

    if (this.isRetryable(error)) {
      options.push({
        action: 'retry-operation',
        label: 'Retry operation',
        description: 'Attempt the failed operation again',
        recommended: !context.hasRetried
      });
    }

    options.push(
      {
        action: 'restart-session',
        label: 'Start new session',
        description: 'Begin a fresh session (may lose current progress)',
        recommended: false
      },
      {
        action: 'create-checkpoint-and-exit',
        label: 'Save and exit',
        description: 'Create a checkpoint with current state and exit safely',
        recommended: false
      },
      {
        action: 'ignore-and-continue',
        label: 'Continue anyway',
        description: 'Ignore the error and continue (may cause issues)',
        recommended: false
      }
    );

    return options;
  }

  generateBackendRecoveryOptions(operation, error) {
    const options = [
      {
        action: 'retry-operation',
        label: 'Retry operation',
        description: `Retry the ${operation} operation`,
        recommended: this.isRetryable(error)
      }
    ];

    if (this.isCacheError(error)) {
      options.push({
        action: 'clear-cache-and-retry',
        label: 'Clear cache and retry',
        description: 'Clear relevant caches and retry the operation',
        recommended: true
      });
    }

    if (this.isNetworkError(error)) {
      options.push({
        action: 'reset-connection-and-retry',
        label: 'Reset connection and retry',
        description: 'Reset network connections and retry',
        recommended: true
      });
    }

    return options;
  }

  async createEmergencyCheckpoints() {
    const activeSessions = await this.getActiveSessions();
    const checkpoints = [];

    for (const session of activeSessions) {
      try {
        const checkpointId = await checkpointManager.createCheckpoint(
          session.id,
          session.state,
          {
            type: 'emergency',
            description: 'Emergency checkpoint due to critical failure',
            critical: true,
            context: { emergency: true }
          }
        );
        checkpoints.push({ sessionId: session.id, checkpointId });
      } catch (error) {
        console.error(`Failed to create emergency checkpoint for session ${session.id}:`, error);
      }
    }

    return checkpoints;
  }

  async getActiveSessions() {
    const sessionManagerPath = path.join(__dirname, 'sessionManager.js');
    try {
      const SessionManager = require(sessionManagerPath);
      const sessionManager = new SessionManager();
      return await sessionManager.getActiveSessions();
    } catch (error) {
      console.warn('Failed to load active sessions from sessionManager:', error.message);
      return [];
    }
  }

  async getPendingRecoveryPrompts() {
    const prompts = Array.from(this.activeRecoveryPrompts.values());
    return prompts.filter(prompt => prompt.status === 'pending');
  }

  generateFailureId(prefix) {
    const timestamp = Date.now().toString(36);
    const random = Math.random().toString(36).slice(2, 8);
    return `${prefix}-${timestamp}-${random}`;
  }

  isRecoverable(error) {
    return !this.failureThresholds.criticalErrorTypes.includes(error.code);
  }

  isAutoRecoverable(error) {
    return this.failureThresholds.recoverableErrorTypes.includes(error.code) ||
           this.isNetworkError(error) ||
           this.isCacheError(error);
  }

  isRetryable(error) {
    return !['ENOSPC', 'ENOMEM', 'EPERM'].includes(error.code);
  }

  isNetworkError(error) {
    return ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'ENETUNREACH'].includes(error.code);
  }

  isCacheError(error) {
    return error.message && error.message.toLowerCase().includes('cache');
  }

  isTemporaryError(error) {
    return ['EAGAIN', 'EBUSY', 'ETIMEDOUT'].includes(error.code);
  }

  async logFailure(failureId, data) {
    const logEntry = `${new Date().toISOString()} [${failureId}] ${JSON.stringify(data)}\n`;

    try {
      await fs.appendFile(FAILURE_LOG_FILE, logEntry);
    } catch (error) {
      console.error('Failed to write failure log:', error);
    }
  }

  async escalateRecurringFailure(operation, error, count, context) {
    const escalationId = this.generateFailureId(`escalation-${operation}`);

    await this.logFailure(escalationId, {
      type: 'recurring-failure-escalation',
      operation,
      error: error.message,
      failureCount: count,
      context,
      severity: 'high'
    });

    return {
      escalationId,
      operation,
      failureCount: count,
      escalated: true,
      requiresAdminIntervention: true
    };
  }

  async clearRelevantCaches(operation) {
    // Implementation would depend on the specific caching system
    console.log(`Clearing caches for operation: ${operation}`);
  }

  async resetConnections(operation) {
    // Implementation would depend on the specific connection pools
    console.log(`Resetting connections for operation: ${operation}`);
  }

  async restartSession(sessionId, options = {}) {
    // Implementation would depend on session management system
    return { action: 'session-restarted', sessionId, options };
  }

  async retryFailedOperation(failureData, options = {}) {
    // Implementation would depend on the specific operation
    return { action: 'operation-retried', failureData, options };
  }
}

module.exports = new GracefulFailureHandler();