const fs = require('fs').promises;
const path = require('path');
const taskLogger = require('./taskLogger');

class CompactionAlerter {
  constructor(rootDir = null) {
    // Don't initialize rootDir in constructor - it will be set in initialize()
    this.rootDir = rootDir;
    this.compactionConfigFile = null;
    this.alertLogFile = null;
    this.config = {
      logSizeThreshold: 50000, // 50KB
      fileCountThreshold: 1000,
      narrativeSizeThreshold: 100000, // 100KB
      checkIntervalMs: 3600000, // 1 hour
      alertCooldownMs: 86400000, // 24 hours
      autoArchiveDays: 30
    };
    this.lastChecks = new Map();
    this.checkTimer = null;
    this.initialCheckTimer = null;
    this.initialized = false;
  }

  async initialize(rootDir = null) {
    if (this.initialized) return;

    // Set rootDir from parameter, or environment, or process.cwd()
    this.rootDir = rootDir || process.env.PROJECT_PATH || process.cwd();
    this.compactionConfigFile = path.join(this.rootDir, 'data', 'compaction-config.json');
    this.alertLogFile = path.join(this.rootDir, 'data', 'compaction-alerts.log');

    await this.loadConfig();
    await this.startPeriodicChecks();
    this.initialized = true;
  }

  async loadConfig() {
    try {
      const data = await fs.readFile(this.compactionConfigFile, 'utf8');
      this.config = { ...this.config, ...JSON.parse(data) };
    } catch (error) {
      if (error.code === 'ENOENT') {
        await this.saveConfig();
      } else {
        console.warn('Failed to load compaction config:', error.message);
      }
    }
  }

  async saveConfig() {
    // Ensure data directory exists
    const dataDir = path.dirname(this.compactionConfigFile);
    await fs.mkdir(dataDir, { recursive: true });
    await fs.writeFile(this.compactionConfigFile, JSON.stringify(this.config, null, 2));
  }

  async updateConfig(updates) {
    this.config = { ...this.config, ...updates };
    await this.saveConfig();
  }

  async startPeriodicChecks() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
    }

    this.checkTimer = setInterval(async () => {
      try {
        await this.runCompactionCheck();
      } catch (error) {
        console.error('Compaction check failed:', error.message);
      }
    }, this.config.checkIntervalMs);

    if (typeof this.checkTimer.unref === 'function') {
      this.checkTimer.unref();
    }

    // Run initial check
    this.initialCheckTimer = setTimeout(() => this.runCompactionCheck(), 5000);
    if (typeof this.initialCheckTimer.unref === 'function') {
      this.initialCheckTimer.unref();
    }
  }

  async runCompactionCheck() {
    const checks = await Promise.allSettled([
      this.checkTaskLogsSize(),
      this.checkTaskLogCount(),
      this.checkNarrativeSize(),
      this.checkOldLogs()
    ]);

    const alerts = checks
      .filter(result => result.status === 'fulfilled' && result.value)
      .map(result => result.value)
      .filter(Boolean);

    for (const alert of alerts) {
      await this.processAlert(alert);
    }

    return alerts;
  }

  async checkTaskLogsSize() {
    const taskLogsDir = path.join(this.rootDir, 'data', 'task-logs');

    try {
      const files = await fs.readdir(taskLogsDir);
      let totalSize = 0;
      const oversizedFiles = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(taskLogsDir, file);
        const stats = await fs.stat(filePath);
        totalSize += stats.size;

        if (stats.size > this.config.logSizeThreshold) {
          oversizedFiles.push({
            file,
            size: stats.size,
            taskId: file.replace('.json', '')
          });
        }
      }

      if (oversizedFiles.length > 0) {
        return {
          id: `log-size-${Date.now()}`,
          type: 'oversized-logs',
          severity: 'warning',
          message: `${oversizedFiles.length} task logs exceed size threshold`,
          details: {
            threshold: this.config.logSizeThreshold,
            totalSize,
            oversizedFiles: oversizedFiles.slice(0, 5),
            totalOversized: oversizedFiles.length
          },
          recommendations: [
            'Archive old detailed logs',
            'Summarize verbose task entries',
            'Consider increasing log rotation frequency'
          ],
          createdAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Failed to check task logs size:', error.message);
    }

    return null;
  }

  async checkTaskLogCount() {
    const taskLogsDir = path.join(this.rootDir, 'data', 'task-logs');

    try {
      const files = await fs.readdir(taskLogsDir);
      const logFiles = files.filter(f => f.endsWith('.json'));

      if (logFiles.length > this.config.fileCountThreshold) {
        return {
          id: `log-count-${Date.now()}`,
          type: 'excessive-log-count',
          severity: 'warning',
          message: `Task log directory contains ${logFiles.length} files`,
          details: {
            threshold: this.config.fileCountThreshold,
            currentCount: logFiles.length,
            excess: logFiles.length - this.config.fileCountThreshold
          },
          recommendations: [
            `Archive logs older than ${this.config.autoArchiveDays} days`,
            'Implement automatic log rotation',
            'Consider compressing old logs'
          ],
          createdAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Failed to check task log count:', error.message);
    }

    return null;
  }

  async checkNarrativeSize() {
    const narrativeFile = path.join(this.rootDir, 'docs', 'narrative.md');

    try {
      const stats = await fs.stat(narrativeFile);

      if (stats.size > this.config.narrativeSizeThreshold) {
        return {
          id: `narrative-size-${Date.now()}`,
          type: 'large-narrative',
          severity: 'info',
          message: `Project narrative has grown to ${Math.round(stats.size / 1024)}KB`,
          details: {
            threshold: this.config.narrativeSizeThreshold,
            currentSize: stats.size,
            lastModified: stats.mtime
          },
          recommendations: [
            'Archive older narrative sections',
            'Create quarterly narrative summaries',
            'Move detailed entries to separate documentation'
          ],
          createdAt: new Date().toISOString()
        };
      }
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Failed to check narrative size:', error.message);
      }
    }

    return null;
  }

  async checkOldLogs() {
    const taskLogsDir = path.join(this.rootDir, 'data', 'task-logs');
    const cutoffDate = new Date(Date.now() - (this.config.autoArchiveDays * 24 * 60 * 60 * 1000));

    try {
      const files = await fs.readdir(taskLogsDir);
      const oldFiles = [];

      for (const file of files) {
        if (!file.endsWith('.json')) continue;

        const filePath = path.join(taskLogsDir, file);
        const stats = await fs.stat(filePath);

        if (stats.mtime < cutoffDate) {
          oldFiles.push({
            file,
            age: Math.floor((Date.now() - stats.mtime.getTime()) / (24 * 60 * 60 * 1000)),
            size: stats.size
          });
        }
      }

      if (oldFiles.length > 0) {
        return {
          id: `old-logs-${Date.now()}`,
          type: 'old-logs-available',
          severity: 'info',
          message: `${oldFiles.length} task logs are eligible for archival`,
          details: {
            archiveThreshold: this.config.autoArchiveDays,
            oldLogCount: oldFiles.length,
            totalSize: oldFiles.reduce((sum, file) => sum + file.size, 0),
            oldestAge: Math.max(...oldFiles.map(f => f.age))
          },
          recommendations: [
            'Run automatic archival process',
            'Review and summarize old completed tasks',
            'Consider permanent deletion of very old logs'
          ],
          createdAt: new Date().toISOString()
        };
      }
    } catch (error) {
      console.warn('Failed to check old logs:', error.message);
    }

    return null;
  }

  async processAlert(alert) {
    const lastCheck = this.lastChecks.get(alert.type);
    const now = Date.now();

    // Check cooldown period
    if (lastCheck && (now - lastCheck) < this.config.alertCooldownMs) {
      return;
    }

    // Log the alert
    await this.logAlert(alert);

    // Update last check time
    this.lastChecks.set(alert.type, now);

    // Trigger automatic actions for certain alert types
    if (alert.type === 'old-logs-available' && this.config.autoArchiveDays) {
      try {
        const archived = await taskLogger.archiveOldLogs(this.config.autoArchiveDays);
        if (archived.length > 0) {
          await this.logAlert({
            ...alert,
            id: `auto-archive-${Date.now()}`,
            type: 'auto-archive-completed',
            message: `Automatically archived ${archived.length} old task logs`,
            details: { archivedFiles: archived }
          });
        }
      } catch (error) {
        console.error('Auto-archive failed:', error.message);
      }
    }

    return alert;
  }

  async logAlert(alert) {
    const logEntry = `[${alert.createdAt}] ${alert.severity.toUpperCase()}: ${alert.message}\n`;

    try {
      await fs.appendFile(this.alertLogFile, logEntry);
    } catch (error) {
      console.error('Failed to log compaction alert:', error.message);
    }
  }

  async getRecentAlerts(limit = 10) {
    try {
      const logContent = await fs.readFile(this.alertLogFile, 'utf8');
      const lines = logContent.trim().split('\n');

      return lines
        .slice(-limit)
        .reverse()
        .map(line => {
          const match = line.match(/^\[([^\]]+)\] (\w+): (.+)$/);
          if (match) {
            return {
              timestamp: match[1],
              severity: match[2].toLowerCase(),
              message: match[3]
            };
          }
          return { raw: line };
        });
    } catch (error) {
      if (error.code === 'ENOENT') {
        return [];
      }
      throw error;
    }
  }

  async getCompactionStatus() {
    const taskLogsDir = path.join(this.rootDir, 'data', 'task-logs');
    const narrativeFile = path.join(this.rootDir, 'docs', 'narrative.md');

    try {
      const [logFiles, narrativeStats, recentAlerts] = await Promise.allSettled([
        fs.readdir(taskLogsDir).then(files => files.filter(f => f.endsWith('.json'))),
        fs.stat(narrativeFile),
        this.getRecentAlerts(5)
      ]);

      return {
        config: this.config,
        status: {
          taskLogCount: logFiles.status === 'fulfilled' ? logFiles.value.length : 0,
          narrativeSize: narrativeStats.status === 'fulfilled' ? narrativeStats.value.size : 0,
          lastCheck: Math.max(...Array.from(this.lastChecks.values()), 0),
          alertsToday: recentAlerts.status === 'fulfilled' ?
            recentAlerts.value.filter(a =>
              new Date(a.timestamp).toDateString() === new Date().toDateString()
            ).length : 0
        },
        recentAlerts: recentAlerts.status === 'fulfilled' ? recentAlerts.value : [],
        thresholds: {
          logSize: `${Math.round(this.config.logSizeThreshold / 1024)}KB`,
          fileCount: this.config.fileCountThreshold,
          narrativeSize: `${Math.round(this.config.narrativeSizeThreshold / 1024)}KB`,
          archiveAge: `${this.config.autoArchiveDays} days`
        }
      };
    } catch (error) {
      console.error('Failed to get compaction status:', error.message);
      return { error: error.message };
    }
  }

  async stopPeriodicChecks() {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
    if (this.initialCheckTimer) {
      clearTimeout(this.initialCheckTimer);
      this.initialCheckTimer = null;
    }
  }
}

module.exports = new CompactionAlerter();
