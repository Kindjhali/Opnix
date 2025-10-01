const path = require('path');
const fs = require('fs').promises;

const TASK_LOGS_DIR = path.join(__dirname, '..', 'data', 'task-logs');
const NARRATIVE_FILE = path.join(__dirname, '..', 'docs', 'narrative.md');
const MAX_LOG_ENTRIES_PER_FILE = 1000;
const LOG_COMPACTION_THRESHOLD = 50000; // characters

class TaskLogger {
  constructor() {
    this.activeTasks = new Map();
    this.logBuffer = new Map();
    this.compactionAlerts = [];
  }

  async initialize() {
    await this.ensureTaskLogsDirectory();
    await this.ensureNarrativeFile();
  }

  async ensureTaskLogsDirectory() {
    try {
      await fs.access(TASK_LOGS_DIR);
    } catch (error) {
      if (error.code === 'ENOENT') {
        await fs.mkdir(TASK_LOGS_DIR, { recursive: true });
      } else {
        throw error;
      }
    }
  }

  async ensureNarrativeFile() {
    try {
      await fs.access(NARRATIVE_FILE);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initialNarrative = `# Project Narrative

## Overview
This document maintains an ongoing narrative of the project's development journey, automatically updated through task logging.

## Development Timeline

*Narrative entries will be added automatically as tasks are completed.*

---
*Last Updated: ${new Date().toISOString()}*
`;
        await fs.writeFile(NARRATIVE_FILE, initialNarrative);
      }
    }
  }

  generateTaskId(taskName, author = 'system') {
    const timestamp = Date.now();
    const sanitized = taskName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    return `${sanitized}-${timestamp}-${author}`;
  }

  async startTask(taskName, description, author = 'claude', context = {}) {
    const taskId = this.generateTaskId(taskName, author);
    const startTime = new Date().toISOString();

    const task = {
      id: taskId,
      name: taskName,
      description,
      author,
      startTime,
      status: 'active',
      context,
      logs: [],
      metrics: {
        duration: null,
        linesChanged: 0,
        filesModified: [],
        complexity: 'unknown'
      }
    };

    this.activeTasks.set(taskId, task);

    await this.logEntry(taskId, {
      type: 'task-start',
      message: `Started task: ${taskName}`,
      description,
      author,
      context
    });

    return taskId;
  }

  async logEntry(taskId, entry) {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      taskId,
      ...entry
    };

    // Add to buffer
    if (!this.logBuffer.has(taskId)) {
      this.logBuffer.set(taskId, []);
    }
    this.logBuffer.get(taskId).push(logEntry);

    // Add to active task if exists
    if (this.activeTasks.has(taskId)) {
      this.activeTasks.get(taskId).logs.push(logEntry);
    }

    // Persist to disk immediately for critical events
    if (entry.type === 'task-start' || entry.type === 'task-complete' || entry.critical) {
      await this.persistTaskLog(taskId);
    }
  }

  async addTaskNote(taskId, message, type = 'note', context = {}) {
    if (!this.activeTasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found or not active`);
    }

    await this.logEntry(taskId, {
      type,
      message,
      context
    });
  }

  async updateTaskMetrics(taskId, metrics) {
    if (!this.activeTasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found or not active`);
    }

    const task = this.activeTasks.get(taskId);
    task.metrics = { ...task.metrics, ...metrics };

    await this.logEntry(taskId, {
      type: 'metrics-update',
      message: 'Task metrics updated',
      metrics: task.metrics
    });
  }

  async completeTask(taskId, summary, outcome = 'success') {
    if (!this.activeTasks.has(taskId)) {
      throw new Error(`Task ${taskId} not found or not active`);
    }

    const task = this.activeTasks.get(taskId);
    const endTime = new Date().toISOString();
    const duration = new Date(endTime) - new Date(task.startTime);

    task.status = 'completed';
    task.endTime = endTime;
    task.metrics.duration = duration;
    task.summary = summary;
    task.outcome = outcome;

    await this.logEntry(taskId, {
      type: 'task-complete',
      message: `Completed task: ${task.name}`,
      summary,
      outcome,
      duration,
      critical: true
    });

    // Generate and persist recap
    const recap = await this.generateTaskRecap(taskId);
    await this.persistTaskLog(taskId);

    // Update narrative
    await this.updateNarrative(task, recap);

    // Check for compaction needs
    await this.checkCompactionNeeds(taskId);

    // Move to completed
    this.activeTasks.delete(taskId);

    return {
      taskId,
      duration,
      recap,
      outcome
    };
  }

  async generateTaskRecap(taskId) {
    const task = this.activeTasks.get(taskId) || await this.loadTaskLog(taskId);
    if (!task) {
      throw new Error(`Task ${taskId} not found`);
    }

    const logs = task.logs || [];
    const startTime = new Date(task.startTime);
    const endTime = new Date(task.endTime || new Date());
    const duration = Math.round((endTime - startTime) / 1000);

    const recap = {
      taskId,
      name: task.name,
      author: task.author,
      duration: `${Math.floor(duration / 60)}m ${duration % 60}s`,
      status: task.status,
      outcome: task.outcome || 'in-progress',
      summary: task.summary || 'Task in progress',
      metrics: task.metrics,
      keyEvents: logs.filter(log =>
        log.type === 'task-start' ||
        log.type === 'task-complete' ||
        log.type === 'milestone' ||
        log.critical
      ).map(log => ({
        timestamp: log.timestamp,
        type: log.type,
        message: log.message
      })),
      filesModified: task.metrics.filesModified || [],
      complexity: task.metrics.complexity || 'unknown',
      generatedAt: new Date().toISOString()
    };

    return recap;
  }

  async persistTaskLog(taskId) {
    const task = this.activeTasks.get(taskId);
    if (!task) {
      return;
    }

    const filename = `${taskId}.json`;
    const filepath = path.join(TASK_LOGS_DIR, filename);

    const bufferedLogs = this.logBuffer.get(taskId) || task.logs || [];
    const normalisedLogs = Array.isArray(bufferedLogs) ? bufferedLogs : [];
    const trimmedLogs = normalisedLogs.slice(-MAX_LOG_ENTRIES_PER_FILE);

    if (trimmedLogs.length !== normalisedLogs.length) {
      this.logBuffer.set(taskId, trimmedLogs);
      if (this.activeTasks.has(taskId)) {
        this.activeTasks.get(taskId).logs = trimmedLogs;
      }
    }

    const logData = {
      ...task,
      logs: trimmedLogs,
      persistedAt: new Date().toISOString()
    };

    await fs.writeFile(filepath, JSON.stringify(logData, null, 2));
  }

  async loadTaskLog(taskId) {
    // First check active tasks
    if (this.activeTasks.has(taskId)) {
      const task = this.activeTasks.get(taskId);
      const bufferedLogs = this.logBuffer.get(taskId) || [];
      return {
        ...task,
        logs: bufferedLogs
      };
    }

    // Then check file system
    const filename = `${taskId}.json`;
    const filepath = path.join(TASK_LOGS_DIR, filename);

    try {
      const data = await fs.readFile(filepath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
  }

  async updateNarrative(task, recap) {
    try {
      let narrative = await fs.readFile(NARRATIVE_FILE, 'utf8');

      const entry = `
### ${task.name} - ${new Date(task.startTime).toLocaleDateString()}

**Duration:** ${recap.duration} | **Author:** ${task.author} | **Outcome:** ${task.outcome}

${task.summary || task.description}

**Key Activities:**
${recap.keyEvents.map(event => `- ${event.message} (${new Date(event.timestamp).toLocaleTimeString()})`).join('\n')}

${recap.filesModified.length > 0 ? `**Files Modified:** ${recap.filesModified.length} files` : ''}

---
`;

      // Insert before the last updated line
      const lastUpdatedIndex = narrative.lastIndexOf('*Last Updated:');
      if (lastUpdatedIndex !== -1) {
        narrative = narrative.substring(0, lastUpdatedIndex) + entry + '\n' +
                   `*Last Updated: ${new Date().toISOString()}*\n`;
      } else {
        narrative += entry;
      }

      await fs.writeFile(NARRATIVE_FILE, narrative);

    } catch (error) {
      console.warn('Failed to update narrative:', error.message);
    }
  }

  async checkCompactionNeeds(taskId) {
    const task = await this.loadTaskLog(taskId);
    if (!task) return;

    const logSize = JSON.stringify(task).length;

    if (logSize > LOG_COMPACTION_THRESHOLD) {
      const alert = {
        id: `compaction-${Date.now()}`,
        taskId,
        type: 'log-size-warning',
        message: `Task log ${taskId} has grown to ${Math.round(logSize / 1024)}KB`,
        recommendation: 'Consider archiving or summarizing detailed logs',
        threshold: LOG_COMPACTION_THRESHOLD,
        currentSize: logSize,
        createdAt: new Date().toISOString()
      };

      this.compactionAlerts.push(alert);

      // Also log the alert
      await this.logEntry(taskId, {
        type: 'compaction-alert',
        message: alert.message,
        recommendation: alert.recommendation,
        critical: true
      });
    }
  }

  async getTaskRecaps(limit = 10, author = null) {
    const files = await fs.readdir(TASK_LOGS_DIR);
    const recaps = [];

    for (const file of files.slice(-limit)) {
      if (!file.endsWith('.json')) continue;

      try {
        const taskData = await this.loadTaskLog(file.replace('.json', ''));
        if (!taskData) continue;

        if (author && taskData.author !== author) continue;

        const recap = await this.generateTaskRecap(taskData.id);
        recaps.push(recap);
      } catch (error) {
        console.warn(`Failed to load task recap from ${file}:`, error.message);
      }
    }

    return recaps.sort((a, b) => new Date(b.generatedAt) - new Date(a.generatedAt));
  }

  async getActiveTasks() {
    return Array.from(this.activeTasks.values()).map(task => ({
      id: task.id,
      name: task.name,
      author: task.author,
      startTime: task.startTime,
      status: task.status,
      metrics: task.metrics
    }));
  }

  async getCompactionAlerts() {
    return this.compactionAlerts.filter(alert => {
      // Keep alerts for 7 days
      const alertAge = Date.now() - new Date(alert.createdAt).getTime();
      return alertAge < (7 * 24 * 60 * 60 * 1000);
    });
  }

  async archiveOldLogs(daysOld = 30) {
    const files = await fs.readdir(TASK_LOGS_DIR);
    const cutoffTime = Date.now() - (daysOld * 24 * 60 * 60 * 1000);
    const archived = [];

    for (const file of files) {
      if (!file.endsWith('.json')) continue;

      const filepath = path.join(TASK_LOGS_DIR, file);
      const stats = await fs.stat(filepath);

      if (stats.mtime.getTime() < cutoffTime) {
        const archiveDir = path.join(TASK_LOGS_DIR, 'archive');
        await fs.mkdir(archiveDir, { recursive: true });

        const archivePath = path.join(archiveDir, file);
        await fs.rename(filepath, archivePath);
        archived.push(file);
      }
    }

    return archived;
  }

  async getNarrativeSummary() {
    try {
      const narrative = await fs.readFile(NARRATIVE_FILE, 'utf8');
      return {
        content: narrative,
        lastUpdated: (await fs.stat(NARRATIVE_FILE)).mtime,
        size: narrative.length
      };
    } catch (error) {
      console.warn('Failed to load narrative summary:', error.message);
      return null;
    }
  }
}

module.exports = new TaskLogger();