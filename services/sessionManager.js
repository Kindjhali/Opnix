const fs = require('fs').promises;
const path = require('path');

class SessionManager {
  constructor() {
    this.sessionDataDir = path.join(__dirname, '../data/sessions');
    this.sessionStateDir = path.join(__dirname, '../data/session-state');
    this.userPreferencesFile = path.join(__dirname, '../data/user-preferences.json');
    this.activeSessionsFile = path.join(__dirname, '../data/active-sessions.json');
    this.sessionHistoryFile = path.join(__dirname, '../data/session-history.json');
    this.contextHistoryFile = path.join(__dirname, '../data/context-history.json');
    this.maxHistoryEntries = 50;
    this.maxActiveSessions = 10;
    this.contextHistoryLimit = 100;

    this.initializeDirectories();
  }

  async initializeDirectories() {
    try {
      await fs.mkdir(this.sessionDataDir, { recursive: true });
      await fs.mkdir(this.sessionStateDir, { recursive: true });
      await fs.mkdir(path.dirname(this.contextHistoryFile), { recursive: true });
    } catch (error) {
      console.warn('Failed to create session directory:', error.message);
    }
  }

  getSessionStatePath(sessionId) {
    return path.join(this.sessionStateDir, `${sessionId}.json`);
  }

  async readSessionState(sessionId) {
    const statePath = this.getSessionStatePath(sessionId);
    try {
      const raw = await fs.readFile(statePath, 'utf8');
      const parsed = JSON.parse(raw);
      return {
        sessionId,
        updatedAt: parsed.updatedAt || parsed.savedAt || null,
        forms: parsed.forms || {},
        context: {
          selectedItems: parsed.context?.selectedItems || [],
          filters: parsed.context?.filters || {},
          viewState: parsed.context?.viewState || {}
        }
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return {
          sessionId,
          updatedAt: null,
          forms: {},
          context: {
            selectedItems: [],
            filters: {},
            viewState: {}
          }
        };
      }
      throw error;
    }
  }

  async writeSessionState(sessionId, state) {
    const statePath = this.getSessionStatePath(sessionId);
    const payload = {
      sessionId,
      updatedAt: state.updatedAt || new Date().toISOString(),
      forms: state.forms || {},
      context: state.context || {
        selectedItems: [],
        filters: {},
        viewState: {}
      }
    };
    await fs.writeFile(statePath, JSON.stringify(payload, null, 2));
    return payload;
  }

  async mergeSessionState(sessionId, updates = {}) {
    const state = await this.readSessionState(sessionId);
    const merged = {
      sessionId,
      updatedAt: new Date().toISOString(),
      forms: { ...state.forms },
      context: { ...state.context }
    };

    if (updates.formData && typeof updates.formData === 'object') {
      Object.entries(updates.formData).forEach(([formId, formState]) => {
        const existing = merged.forms[formId] || {};
        merged.forms[formId] = {
          ...existing,
          ...formState,
          formId,
          timestamp: formState?.timestamp || new Date().toISOString()
        };
      });
    }

    const contextKeys = ['selectedItems', 'filters', 'viewState'];
    contextKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(updates, key)) {
        merged.context[key] = updates[key];
      }
    });

    await this.writeSessionState(sessionId, merged);
    return merged;
  }

  async deleteSessionState(sessionId) {
    const statePath = this.getSessionStatePath(sessionId);
    try {
      await fs.rm(statePath, { force: true });
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn(`Failed to remove session state for ${sessionId}:`, error.message);
      }
    }
  }

  async readContextHistory() {
    try {
      const raw = await fs.readFile(this.contextHistoryFile, 'utf8');
      const parsed = JSON.parse(raw);
      const history = Array.isArray(parsed.history) ? parsed.history : [];
      return {
        updatedAt: parsed.updatedAt || null,
        history
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { updatedAt: null, history: [] };
      }
      throw error;
    }
  }

  async writeContextHistory(entries) {
    const payload = {
      updatedAt: new Date().toISOString(),
      history: entries.slice(0, this.contextHistoryLimit)
    };
    await fs.writeFile(this.contextHistoryFile, JSON.stringify(payload, null, 2));
    return payload;
  }

  async appendContextHistory(session, autoSaveState, delta = {}) {
    if (!session || !session.id) {
      return null;
    }

    const snapshot = {
      sessionId: session.id,
      sessionType: session.type || 'unknown',
      timestamp: new Date().toISOString(),
      forms: Object.keys(autoSaveState?.forms || {}),
      selectedItems: autoSaveState?.context?.selectedItems || [],
      filters: autoSaveState?.context?.filters || {},
      viewState: autoSaveState?.context?.viewState || {},
      lastUpdated: autoSaveState?.updatedAt || null,
      deltaKeys: Object.keys(delta || {})
    };

    const existing = await this.readContextHistory();
    const filtered = existing.history.filter(entry => entry.sessionId !== session.id);
    const updated = [snapshot, ...filtered];
    await this.writeContextHistory(updated);
    return snapshot;
  }

  // Generate unique session ID
  generateSessionId() {
    return `session-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  // Create new session
  async createSession(type, data, metadata = {}) {
    const sessionId = this.generateSessionId();
    const session = {
      id: sessionId,
      type, // 'spec', 'feature', 'bug', 'interview', 'custom'
      data,
      metadata: {
        ...metadata,
        createdAt: new Date().toISOString(),
        lastAccessedAt: new Date().toISOString(),
        accessCount: 1
      },
      status: 'active', // 'active', 'paused', 'completed', 'abandoned'
      progress: {
        currentStep: 0,
        totalSteps: metadata.totalSteps || 1,
        completedSteps: [],
        percentage: 0
      },
      context: {
        formData: {},
        selectedItems: [],
        filters: {},
        viewState: {}
      }
    };

    try {
      // Save session to file
      const sessionFile = path.join(this.sessionDataDir, `${sessionId}.json`);
      await fs.writeFile(sessionFile, JSON.stringify(session, null, 2));

      await this.writeSessionState(sessionId, {
        sessionId,
        updatedAt: new Date().toISOString(),
        forms: {},
        context: {
          selectedItems: [],
          filters: {},
          viewState: {}
        }
      });

      // Add to active sessions
      await this.addToActiveSessions(session);

      // Add to history
      await this.addToHistory(session);

      console.log(`✓ Created session ${sessionId} (${type})`);
      return session;
    } catch (error) {
      console.error('Failed to create session:', error);
      throw error;
    }
  }

  // Load session by ID
  async loadSession(sessionId) {
    try {
      const sessionFile = path.join(this.sessionDataDir, `${sessionId}.json`);
      const data = await fs.readFile(sessionFile, 'utf8');
      const session = JSON.parse(data);

      // Update last access time
      session.metadata.lastAccessedAt = new Date().toISOString();
      session.metadata.accessCount = (session.metadata.accessCount || 0) + 1;

      session.autoSave = await this.readSessionState(sessionId);

      return await this.saveSession(session);
    } catch (error) {
      console.warn(`Failed to load session ${sessionId}:`, error.message);
      return null;
    }
  }

  // Save session updates
  async saveSession(session) {
    try {
      const sessionFile = path.join(this.sessionDataDir, `${session.id}.json`);
      const autoSaveState = session.autoSave;
      const persistable = {
        ...session,
        metadata: {
          ...session.metadata,
          updatedAt: new Date().toISOString()
        }
      };
      delete persistable.autoSave;

      await fs.writeFile(sessionFile, JSON.stringify(persistable, null, 2));

      // Update in active sessions
      await this.updateActiveSession(persistable);

      return autoSaveState ? { ...persistable, autoSave: autoSaveState } : persistable;
    } catch (error) {
      console.error('Failed to save session:', error);
      throw error;
    }
  }

  // Update session progress
  async updateSessionProgress(sessionId, progress) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.progress = {
      ...session.progress,
      ...progress,
      percentage: Math.round((progress.completedSteps?.length || 0) / (progress.totalSteps || 1) * 100)
    };

    return await this.saveSession(session);
  }

  // Update session context (form data, selections, etc.)
  async updateSessionContext(sessionId, context) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.context = {
      ...session.context
    };

    if (context.formData) {
      session.context.formData = {
        ...(session.context.formData || {}),
        ...context.formData
      };
    }

    const contextKeys = ['selectedItems', 'filters', 'viewState'];
    contextKeys.forEach(key => {
      if (Object.prototype.hasOwnProperty.call(context, key)) {
        session.context[key] = context[key];
      }
    });

    const autoSaveState = await this.mergeSessionState(sessionId, context);
    session.autoSave = autoSaveState;
    session.context.formData = autoSaveState.forms;
    session.context.selectedItems = autoSaveState.context.selectedItems;
    session.context.filters = autoSaveState.context.filters;
    session.context.viewState = autoSaveState.context.viewState;

    await this.appendContextHistory(session, autoSaveState, context);

    return await this.saveSession(session);
  }

  // Pause session
  async pauseSession(sessionId, reason = 'User paused') {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'paused';
    session.metadata.pausedAt = new Date().toISOString();
    session.metadata.pauseReason = reason;

    return await this.saveSession(session);
  }

  // Resume session
  async resumeSession(sessionId) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'active';
    session.metadata.resumedAt = new Date().toISOString();
    delete session.metadata.pauseReason;

    return await this.saveSession(session);
  }

  // Complete session
  async completeSession(sessionId, result = {}) {
    const session = await this.loadSession(sessionId);
    if (!session) {
      throw new Error('Session not found');
    }

    session.status = 'completed';
    session.metadata.completedAt = new Date().toISOString();
    session.result = result;
    session.progress.percentage = 100;

    await this.saveSession(session);
    await this.removeFromActiveSessions(sessionId);

    return session;
  }

  // Get active sessions
  async getActiveSessions() {
    try {
      const data = await fs.readFile(this.activeSessionsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return [];
    }
  }

  // Get recent sessions
  async getRecentSessions(limit = 10) {
    try {
      const data = await fs.readFile(this.sessionHistoryFile, 'utf8');
      const history = JSON.parse(data);
      return history.slice(-limit).reverse();
    } catch {
      return [];
    }
  }

  // Get paused sessions
  async getPausedSessions() {
    const activeSessions = await this.getActiveSessions();
    return activeSessions.filter(session => session.status === 'paused');
  }

  // Get sessions by type
  async getSessionsByType(type, limit = 20) {
    try {
      const files = await fs.readdir(this.sessionDataDir);
      const sessions = [];

      for (const file of files.slice(-limit)) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.sessionDataDir, file), 'utf8');
            const session = JSON.parse(data);
            if (session.type === type) {
              sessions.push(session);
            }
          } catch (error) {
            console.warn(`Failed to read session file ${file}:`, error.message);
          }
        }
      }

      return sessions.sort((a, b) => new Date(b.metadata.lastAccessedAt) - new Date(a.metadata.lastAccessedAt));
    } catch (error) {
      console.error('Failed to get sessions by type:', error);
      return [];
    }
  }

  // Search sessions
  async searchSessions(query, options = {}) {
    try {
      const files = await fs.readdir(this.sessionDataDir);
      const sessions = [];
      const lowerQuery = query.toLowerCase();

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.sessionDataDir, file), 'utf8');
            const session = JSON.parse(data);

            // Search in title, type, metadata
            const searchableText = [
              session.metadata.title || '',
              session.type || '',
              session.metadata.description || '',
              JSON.stringify(session.data)
            ].join(' ').toLowerCase();

            if (searchableText.includes(lowerQuery)) {
              sessions.push(session);
            }
          } catch (error) {
            console.warn(`Failed to search session file ${file}:`, error.message);
          }
        }
      }

      return sessions
        .filter(session => {
          if (options.type && session.type !== options.type) return false;
          if (options.status && session.status !== options.status) return false;
          return true;
        })
        .sort((a, b) => new Date(b.metadata.lastAccessedAt) - new Date(a.metadata.lastAccessedAt))
        .slice(0, options.limit || 50);
    } catch (error) {
      console.error('Failed to search sessions:', error);
      return [];
    }
  }

  // Add to active sessions
  async addToActiveSessions(session) {
    try {
      const activeSessions = await this.getActiveSessions();

      // Remove existing session if it exists
      const filtered = activeSessions.filter(s => s.id !== session.id);

      // Add new session
      filtered.push({
        id: session.id,
        type: session.type,
        status: session.status,
        metadata: session.metadata,
        progress: session.progress
      });

      // Keep only the most recent sessions
      const trimmed = filtered.slice(-this.maxActiveSessions);

      await fs.writeFile(this.activeSessionsFile, JSON.stringify(trimmed, null, 2));
    } catch (error) {
      console.warn('Failed to update active sessions:', error);
    }
  }

  // Update active session
  async updateActiveSession(session) {
    try {
      const activeSessions = await this.getActiveSessions();
      const index = activeSessions.findIndex(s => s.id === session.id);

      if (index !== -1) {
        activeSessions[index] = {
          id: session.id,
          type: session.type,
          status: session.status,
          metadata: session.metadata,
          progress: session.progress
        };

        await fs.writeFile(this.activeSessionsFile, JSON.stringify(activeSessions, null, 2));
      }
    } catch (error) {
      console.warn('Failed to update active session:', error);
    }
  }

  // Remove from active sessions
  async removeFromActiveSessions(sessionId) {
    try {
      const activeSessions = await this.getActiveSessions();
      const filtered = activeSessions.filter(s => s.id !== sessionId);
      await fs.writeFile(this.activeSessionsFile, JSON.stringify(filtered, null, 2));
    } catch (error) {
      console.warn('Failed to remove from active sessions:', error);
    }
  }

  // Add to history
  async addToHistory(session) {
    try {
      const history = await this.getRecentSessions(this.maxHistoryEntries - 1);

      history.unshift({
        id: session.id,
        type: session.type,
        status: session.status,
        metadata: session.metadata,
        progress: session.progress
      });

      await fs.writeFile(this.sessionHistoryFile, JSON.stringify(history, null, 2));
    } catch (error) {
      console.warn('Failed to update session history:', error);
    }
  }

  // Clean up old sessions
  async cleanupOldSessions(maxAge = 30 * 24 * 60 * 60 * 1000) { // 30 days
    try {
      const files = await fs.readdir(this.sessionDataDir);
      const now = Date.now();
      let cleanedCount = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const filePath = path.join(this.sessionDataDir, file);
            const stats = await fs.stat(filePath);
            const age = now - stats.mtime.getTime();

            if (age > maxAge) {
              await fs.unlink(filePath);
              cleanedCount++;
            }
          } catch (error) {
            console.warn(`Failed to process session file ${file}:`, error.message);
          }
        }
      }

      if (cleanedCount > 0) {
        console.log(`✓ Cleaned up ${cleanedCount} old session files`);
      }

      return cleanedCount;
    } catch (error) {
      console.error('Failed to cleanup old sessions:', error);
      return 0;
    }
  }

  // Get session statistics
  async getSessionStatistics() {
    try {
      const files = await fs.readdir(this.sessionDataDir);
      const stats = {
        total: 0,
        byType: {},
        byStatus: {},
        averageProgress: 0,
        recentActivity: 0
      };

      const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
      let totalProgress = 0;

      for (const file of files) {
        if (file.endsWith('.json')) {
          try {
            const data = await fs.readFile(path.join(this.sessionDataDir, file), 'utf8');
            const session = JSON.parse(data);

            stats.total++;
            stats.byType[session.type] = (stats.byType[session.type] || 0) + 1;
            stats.byStatus[session.status] = (stats.byStatus[session.status] || 0) + 1;
            totalProgress += session.progress?.percentage || 0;

            const lastAccessed = new Date(session.metadata.lastAccessedAt).getTime();
            if (lastAccessed > oneDayAgo) {
              stats.recentActivity++;
            }
          } catch (error) {
            console.warn(`Failed to process session file ${file}:`, error.message);
          }
        }
      }

      stats.averageProgress = stats.total > 0 ? Math.round(totalProgress / stats.total) : 0;

      return stats;
    } catch (error) {
      console.error('Failed to get session statistics:', error);
      return {
        total: 0,
        byType: {},
        byStatus: {},
        averageProgress: 0,
        recentActivity: 0
      };
    }
  }

  // Delete session
  async deleteSession(sessionId) {
    try {
      const sessionFile = path.join(this.sessionDataDir, `${sessionId}.json`);
      await fs.unlink(sessionFile);
      await this.deleteSessionState(sessionId);
      await this.removeFromActiveSessions(sessionId);
      await this.appendContextHistory(
        { id: sessionId, type: 'deleted' },
        {
          updatedAt: new Date().toISOString(),
          forms: {},
          context: {
            selectedItems: [],
            filters: {},
            viewState: {}
          }
        },
        { status: 'deleted' }
      );

      console.log(`✓ Deleted session ${sessionId}`);
      return true;
    } catch (error) {
      console.error('Failed to delete session:', error);
      return false;
    }
  }
}

module.exports = SessionManager;
