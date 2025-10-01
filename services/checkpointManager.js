const path = require('path');
const fs = require('fs').promises;

const CHECKPOINTS_DIR = path.join(__dirname, '..', 'data', 'checkpoints');
const RECOVERY_STATE_FILE = path.join(__dirname, '..', 'data', 'recovery-state.json');
const MAX_CHECKPOINTS_PER_SESSION = 10;
const CHECKPOINT_INTERVAL_MS = 30000; // 30 seconds

class CheckpointManager {
  constructor() {
    this.activeCheckpoints = new Map();
    this.recoveryCallbacks = new Map();
    this.checkpointTimers = new Map();
    this.isInitialized = false;
  }

  async initialize() {
    if (this.isInitialized) {
      return;
    }

    await this.ensureCheckpointsDirectory();
    this.isInitialized = true;
  }

  async ensureCheckpointsDirectory() {
    try {
      await fs.access(CHECKPOINTS_DIR);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(CHECKPOINTS_DIR, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  generateCheckpointId(sessionId, type = 'auto') {
    const timestamp = Date.now();
    const random = Math.random().toString(36).slice(2, 8);
    return `${sessionId}-${type}-${timestamp}-${random}`;
  }

  async createCheckpoint(sessionId, data, options = {}) {
    const {
      type = 'auto',
      description = 'Automatic checkpoint',
      critical = false,
      context = {}
    } = options;

    await this.ensureCheckpointsDirectory();

    const checkpointId = this.generateCheckpointId(sessionId, type);
    const checkpoint = {
      id: checkpointId,
      sessionId,
      type,
      description,
      critical,
      timestamp: new Date().toISOString(),
      context,
      data: this.sanitizeData(data),
      version: '1.0.0'
    };

    const checkpointPath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`);
    await fs.writeFile(checkpointPath, JSON.stringify(checkpoint, null, 2));

    // Update active checkpoints tracking
    if (!this.activeCheckpoints.has(sessionId)) {
      this.activeCheckpoints.set(sessionId, []);
    }

    const sessionCheckpoints = this.activeCheckpoints.get(sessionId);
    sessionCheckpoints.push({
      id: checkpointId,
      timestamp: checkpoint.timestamp,
      type,
      critical,
      description,
      path: checkpointPath
    });

    // Keep only the most recent checkpoints
    if (sessionCheckpoints.length > MAX_CHECKPOINTS_PER_SESSION) {
      const oldCheckpoint = sessionCheckpoints.shift();
      try {
        await fs.unlink(oldCheckpoint.path);
      } catch (error) {
        console.warn(`Failed to cleanup old checkpoint: ${error.message}`);
      }
    }

    // Update recovery state
    await this.updateRecoveryState();

    return checkpointId;
  }

  async loadCheckpoint(checkpointId) {
    const checkpointPath = path.join(CHECKPOINTS_DIR, `${checkpointId}.json`);

    try {
      const content = await fs.readFile(checkpointPath, 'utf8');
      return JSON.parse(content);
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }
      throw error;
    }
  }

  async getSessionCheckpoints(sessionId) {
    const sessionCheckpoints = this.activeCheckpoints.get(sessionId) || [];
    return sessionCheckpoints.sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  }

  async getAllRecoverableSessions() {
    await this.ensureCheckpointsDirectory();

    const files = await fs.readdir(CHECKPOINTS_DIR);
    const sessions = new Map();

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      try {
        const checkpointPath = path.join(CHECKPOINTS_DIR, file);
        const content = await fs.readFile(checkpointPath, 'utf8');
        const checkpoint = JSON.parse(content);

        if (!sessions.has(checkpoint.sessionId)) {
          sessions.set(checkpoint.sessionId, {
            sessionId: checkpoint.sessionId,
            checkpoints: [],
            latestTimestamp: null,
            hasCriticalCheckpoints: false
          });
        }

        const session = sessions.get(checkpoint.sessionId);
        session.checkpoints.push({
          id: checkpoint.id,
          type: checkpoint.type,
          timestamp: checkpoint.timestamp,
          description: checkpoint.description,
          critical: checkpoint.critical
        });

        if (checkpoint.critical) {
          session.hasCriticalCheckpoints = true;
        }

        if (!session.latestTimestamp || checkpoint.timestamp > session.latestTimestamp) {
          session.latestTimestamp = checkpoint.timestamp;
        }
      } catch (error) {
        console.warn(`Failed to read checkpoint file ${file}: ${error.message}`);
      }
    }

    return Array.from(sessions.values())
      .sort((a, b) => new Date(b.latestTimestamp) - new Date(a.latestTimestamp));
  }

  async startAutoCheckpointing(sessionId, dataProvider, options = {}) {
    const { interval = CHECKPOINT_INTERVAL_MS, description = 'Auto-checkpoint' } = options;

    // Clear any existing timer for this session
    this.stopAutoCheckpointing(sessionId);

    const timer = setInterval(async () => {
      try {
        const data = await dataProvider();
        if (data && this.hasSignificantChanges(sessionId, data)) {
          await this.createCheckpoint(sessionId, data, {
            type: 'auto',
            description,
            context: { autoCheckpoint: true, interval }
          });
        }
      } catch (error) {
        console.error(`Auto-checkpoint failed for session ${sessionId}:`, error);
      }
    }, interval);

    this.checkpointTimers.set(sessionId, timer);

    // Create initial checkpoint
    try {
      const initialData = await dataProvider();
      if (initialData) {
        await this.createCheckpoint(sessionId, initialData, {
          type: 'session-start',
          description: 'Session initialization checkpoint',
          critical: true
        });
      }
    } catch (error) {
      console.error(`Initial checkpoint failed for session ${sessionId}:`, error);
    }
  }

  stopAutoCheckpointing(sessionId) {
    const timer = this.checkpointTimers.get(sessionId);
    if (timer) {
      clearInterval(timer);
      this.checkpointTimers.delete(sessionId);
    }
  }

  async createCriticalCheckpoint(sessionId, data, description) {
    return await this.createCheckpoint(sessionId, data, {
      type: 'critical',
      description,
      critical: true,
      context: { userTriggered: true }
    });
  }

  async registerRecoveryCallback(sessionId, callback) {
    this.recoveryCallbacks.set(sessionId, callback);
  }

  async attemptRecovery(sessionId, checkpointId = null) {
    const checkpoints = await this.getSessionCheckpoints(sessionId);

    if (checkpoints.length === 0) {
      throw new Error(`No checkpoints found for session ${sessionId}`);
    }

    // Use specific checkpoint or most recent critical/manual checkpoint
    let targetCheckpoint;
    if (checkpointId) {
      targetCheckpoint = checkpoints.find(cp => cp.id === checkpointId);
      if (!targetCheckpoint) {
        throw new Error(`Checkpoint ${checkpointId} not found`);
      }
    } else {
      // Find the most recent critical checkpoint, fallback to most recent
      targetCheckpoint = checkpoints.find(cp => cp.critical) || checkpoints[0];
    }

    const checkpoint = await this.loadCheckpoint(targetCheckpoint.id);

    // Execute recovery callback if registered
    const recoveryCallback = this.recoveryCallbacks.get(sessionId);
    if (recoveryCallback) {
      try {
        await recoveryCallback(checkpoint.data, checkpoint);
      } catch (error) {
        console.error(`Recovery callback failed for session ${sessionId}:`, error);
        throw new Error(`Recovery failed: ${error.message}`);
      }
    }

    return {
      sessionId,
      checkpointId: targetCheckpoint.id,
      timestamp: checkpoint.timestamp,
      description: checkpoint.description,
      recovered: true
    };
  }

  async updateRecoveryState() {
    const recoveryState = {
      lastUpdated: new Date().toISOString(),
      activeSessions: Array.from(this.activeCheckpoints.keys()),
      totalCheckpoints: Array.from(this.activeCheckpoints.values())
        .reduce((sum, checkpoints) => sum + checkpoints.length, 0),
      autoCheckpointingSessions: Array.from(this.checkpointTimers.keys())
    };

    try {
      await fs.writeFile(RECOVERY_STATE_FILE, JSON.stringify(recoveryState, null, 2));
    } catch (error) {
      console.warn(`Failed to update recovery state: ${error.message}`);
    }
  }

  async cleanup(sessionId, keepCritical = true) {
    const sessionCheckpoints = this.activeCheckpoints.get(sessionId) || [];

    for (const checkpoint of sessionCheckpoints) {
      if (keepCritical && checkpoint.critical) {
        continue; // Keep critical checkpoints
      }

      try {
        await fs.unlink(checkpoint.path);
      } catch (error) {
        console.warn(`Failed to cleanup checkpoint ${checkpoint.id}: ${error.message}`);
      }
    }

    // Remove from active tracking
    this.activeCheckpoints.delete(sessionId);
    this.stopAutoCheckpointing(sessionId);
    this.recoveryCallbacks.delete(sessionId);

    await this.updateRecoveryState();
  }

  sanitizeData(data) {
    // Remove sensitive data and large objects that shouldn't be checkpointed
    const sanitized = JSON.parse(JSON.stringify(data));

    // Remove potential sensitive fields
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth'];

    function removeSensitive(obj) {
      if (typeof obj !== 'object' || obj === null) return;

      for (const key in obj) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          obj[key] = '[REDACTED]';
        } else if (typeof obj[key] === 'object') {
          removeSensitive(obj[key]);
        }
      }
    }

    removeSensitive(sanitized);
    return sanitized;
  }

  hasSignificantChanges(sessionId, newData) {
    // Simple change detection - in production this could be more sophisticated
    const checkpoints = this.activeCheckpoints.get(sessionId) || [];
    if (checkpoints.length === 0) return true;

    const lastCheckpoint = checkpoints[checkpoints.length - 1];
    const lastData = lastCheckpoint?.data ?? null;
    const hasStructuralChange = JSON.stringify(lastData) !== JSON.stringify(newData);

    if (hasStructuralChange) {
      return true;
    }

    // Check if enough time has passed (basic implementation)
    const timeSinceLastCheckpoint = Date.now() - new Date(lastCheckpoint.timestamp).getTime();

    return timeSinceLastCheckpoint > CHECKPOINT_INTERVAL_MS;
  }

  startPeriodicCleanup() {
    // Clean up old checkpoints every hour
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
    }

    this.cleanupTimer = setInterval(async () => {
      try {
        await this.cleanupExpiredCheckpoints();
      } catch (error) {
        console.warn('Checkpoint cleanup failed:', error.message);
      }
    }, 60 * 60 * 1000); // 1 hour
  }

  async cleanupExpiredCheckpoints() {
    const cutoffTime = Date.now() - (24 * 60 * 60 * 1000); // 24 hours ago

    try {
      const files = await fs.readdir(CHECKPOINTS_DIR);

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(CHECKPOINTS_DIR, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime.getTime() < cutoffTime) {
          await fs.unlink(filePath);
        }
      }
    } catch (error) {
      console.warn('Checkpoint cleanup skipped:', error.message);
    }
  }
}

module.exports = new CheckpointManager();