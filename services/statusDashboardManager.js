const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');

const WORKSPACE_STALE_THRESHOLD_MS = 1000 * 60 * 60 * 72; // 72 hours

class StatusDashboardManager {
  constructor() {
    this.sessionFiles = new Set();
    this.startTime = Date.now();
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      quota: 100000, // Default quota
      quotaReset: Date.now() + (24 * 60 * 60 * 1000) // 24 hours
    };
    this.fileMonitor = {
      touched: new Set(),
      created: new Set(),
      modified: new Set(),
      deleted: new Set()
    };
    this.alerts = [];
    this.blockers = [];
    this.workspaceManifestPath = path.join(process.cwd(), '.opnix', 'workspaces', 'manifest.json');
    this.workspaceRecentLimit = 5;
  }

  // 1. BRANCH STATUS INDICATOR
  async getBranchStatus() {
    try {
      const [branch, ahead, behind, uncommitted, untracked] = await Promise.all([
        this.executeGitCommand(['rev-parse', '--abbrev-ref', 'HEAD']),
        this.executeGitCommand(['rev-list', '--count', 'HEAD', '^origin/HEAD']).catch(() => '0'),
        this.executeGitCommand(['rev-list', '--count', 'origin/HEAD', '^HEAD']).catch(() => '0'),
        this.executeGitCommand(['diff', '--name-only', 'HEAD']),
        this.executeGitCommand(['ls-files', '--others', '--exclude-standard'])
      ]);

      const status = {
        currentBranch: branch.trim() || 'unknown',
        aheadBy: parseInt(ahead.trim()) || 0,
        behindBy: parseInt(behind.trim()) || 0,
        uncommittedFiles: uncommitted.trim() ? uncommitted.trim().split('\n').length : 0,
        untrackedFiles: untracked.trim() ? untracked.trim().split('\n').length : 0,
        isDirty: uncommitted.trim() !== '' || untracked.trim() !== '',
        lastCommit: await this.getLastCommitInfo()
      };

      // Add divergence summary
      if (status.aheadBy > 0 && status.behindBy > 0) {
        status.divergence = 'diverged';
        status.divergenceText = `↑${status.aheadBy} ↓${status.behindBy}`;
      } else if (status.aheadBy > 0) {
        status.divergence = 'ahead';
        status.divergenceText = `↑${status.aheadBy}`;
      } else if (status.behindBy > 0) {
        status.divergence = 'behind';
        status.divergenceText = `↓${status.behindBy}`;
      } else {
        status.divergence = 'up-to-date';
        status.divergenceText = '✓';
      }

      return status;
    } catch (error) {
      return {
        currentBranch: 'error',
        error: error.message,
        divergence: 'unknown',
        divergenceText: '?'
      };
    }
  }

  async readWorkspaceManifest() {
    try {
      const raw = await fs.readFile(this.workspaceManifestPath, 'utf8');
      const parsed = JSON.parse(raw);
      const workspaces = Array.isArray(parsed.workspaces) ? parsed.workspaces : [];
      return {
        generatedAt: parsed.generatedAt || null,
        workspaces
      };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { generatedAt: null, workspaces: [] };
      }
      console.warn('Failed to read workspace manifest:', error.message);
      return { generatedAt: null, workspaces: [] };
    }
  }

  normalizeWorkspaceEntry(entry) {
    if (!entry || typeof entry !== 'object') {
      return null;
    }
    const status = entry.branchStatus || 'pending';
    const createdAt = entry.branchCreatedAt || entry.createdAt || null;
    const lastCheckoutAt = entry.lastCheckoutAt || null;
    return {
      branchName: entry.branchName || 'unknown-branch',
      ticketId: entry.ticketId ?? null,
      title: entry.title || null,
      status,
      relativePath: entry.relativePath || entry.workspacePath || null,
      branchScript: entry.branchScript || null,
      planTasks: entry.planTasks || null,
      planArtifact: entry.planArtifact || null,
      createdAt,
      lastCheckoutAt,
      sessionId: entry.sessionId || null,
      rollbackPlan: entry.rollbackPlan || null
    };
  }

  async getWorkspaceSummary(limit = this.workspaceRecentLimit) {
    const manifest = await this.readWorkspaceManifest();
    const normalised = manifest.workspaces
      .map(entry => this.normalizeWorkspaceEntry(entry))
      .filter(Boolean);

    const statusCounts = normalised.reduce((acc, workspace) => {
      const status = workspace.status || 'pending';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});

    const recentSorted = [...normalised].sort((a, b) => {
      const left = new Date(b.lastCheckoutAt || b.createdAt || 0).getTime();
      const right = new Date(a.lastCheckoutAt || a.createdAt || 0).getTime();
      return left - right;
    });

    const staleWorkspaces = normalised.filter(workspace => {
      const reference = new Date(workspace.lastCheckoutAt || workspace.createdAt || 0).getTime();
      if (!reference) {
        return false;
      }
      const isPending = workspace.status === 'pending' || workspace.status === 'created';
      return isPending && Date.now() - reference > WORKSPACE_STALE_THRESHOLD_MS;
    });

    return {
      generatedAt: manifest.generatedAt,
      total: normalised.length,
      statusCounts,
      pendingCount: statusCounts.pending || 0,
      activeCount: (statusCounts.active || 0) + (statusCounts.created || 0),
      staleCount: staleWorkspaces.length,
      recent: recentSorted.slice(0, limit),
      staleWorkspaces: staleWorkspaces.slice(0, limit)
    };
  }

  async getLastCommitInfo() {
    try {
      const commitHash = await this.executeGitCommand(['rev-parse', '--short', 'HEAD']);
      const commitMessage = await this.executeGitCommand(['log', '-1', '--pretty=format:%s']);
      const commitAuthor = await this.executeGitCommand(['log', '-1', '--pretty=format:%an']);
      const commitDate = await this.executeGitCommand(['log', '-1', '--pretty=format:%cr']);

      return {
        hash: commitHash.trim(),
        message: commitMessage.trim(),
        author: commitAuthor.trim(),
        date: commitDate.trim()
      };
    } catch {
      return null;
    }
  }

  executeGitCommand(args) {
    return new Promise((resolve, reject) => {
      const git = spawn('git', args, { cwd: process.cwd() });
      let output = '';
      let error = '';

      git.stdout.on('data', (data) => {
        output += data.toString();
      });

      git.stderr.on('data', (data) => {
        error += data.toString();
      });

      git.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(error || `Git command failed with code ${code}`));
        }
      });
    });
  }

  normaliseTicketStatus(status) {
    if (status === null || status === undefined) {
      return 'reported';
    }
    const condensed = String(status).trim().replace(/[\s_-]/g, '').toLowerCase();
    if (!condensed) return 'reported';
    if (condensed === 'finished' || condensed === 'resolved' || condensed === 'complete' || condensed === 'closed') {
      return 'finished';
    }
    if (condensed === 'inprogress' || condensed === 'active' || condensed === 'working') {
      return 'inProgress';
    }
    if (condensed === 'blocked' || condensed === 'stuck') {
      return 'blocked';
    }
    return 'reported';
  }

  normaliseChecklistStatus(status, { fallback = 'pending' } = {}) {
    if (status === null || status === undefined) {
      return fallback;
    }
    const condensed = String(status).trim().replace(/[\s_-]/g, '').toLowerCase();
    if (!condensed) return fallback;
    if (condensed === 'complete' || condensed === 'completed' || condensed === 'done') {
      return 'complete';
    }
    if (condensed === 'inprogress' || condensed === 'active') {
      return 'inProgress';
    }
    if (condensed === 'blocked' || condensed === 'stuck') {
      return 'blocked';
    }
    return 'pending';
  }

  normaliseRoadmapStatus(status) {
    if (status === null || status === undefined) {
      return 'pending';
    }
    const condensed = String(status).trim().replace(/[\s_-]/g, '').toLowerCase();
    if (!condensed) return 'pending';
    if (condensed === 'completed' || condensed === 'complete' || condensed === 'done') {
      return 'completed';
    }
    if (condensed === 'active' || condensed === 'inprogress') {
      return 'active';
    }
    if (condensed === 'paused') {
      return 'paused';
    }
    if (condensed === 'blocked') {
      return 'blocked';
    }
    return 'pending';
  }

  // 2. TASK PROGRESS INDICATOR
  async getTaskProgress() {
    try {
      const [ticketsData, checklistData, roadmapData] = await Promise.all([
        this.loadTicketsData(),
        this.loadChecklistData(),
        this.loadRoadmapData()
      ]);

      const ticketStats = this.calculateTicketStats(ticketsData);
      const checklistStats = this.calculateChecklistStats(checklistData);
      const roadmapStats = this.calculateRoadmapStats(roadmapData);

      return {
        tickets: ticketStats,
        checklists: checklistStats,
        roadmap: roadmapStats,
        overall: {
          completionRate: Math.round((ticketStats.completionRate + checklistStats.completionRate + roadmapStats.completionRate) / 3),
          activeTasksCount: ticketStats.inProgress + checklistStats.inProgress + roadmapStats.active,
          blockedTasksCount: ticketStats.blocked + checklistStats.blocked + roadmapStats.blocked
        }
      };
    } catch (error) {
      return {
        error: error.message,
        overall: { completionRate: 0, activeTasksCount: 0, blockedTasksCount: 0 }
      };
    }
  }

  async loadTicketsData() {
    try {
      const ticketsPath = path.join(process.cwd(), 'data', 'tickets.json');
      const data = await fs.readFile(ticketsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return { tickets: [] };
    }
  }

  async loadChecklistData() {
    try {
      const checklistPath = path.join(process.cwd(), 'data', 'checklists.json');
      const data = await fs.readFile(checklistPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return { checklists: [] };
    }
  }

  async loadRoadmapData() {
    try {
      const roadmapPath = path.join(process.cwd(), 'data', 'roadmap-state.json');
      const data = await fs.readFile(roadmapPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return { milestones: {} };
    }
  }

  calculateTicketStats(ticketsData) {
    const tickets = ticketsData.tickets || [];
    const total = tickets.length;
    let reported = 0;
    let inProgress = 0;
    let completed = 0;
    let blocked = 0;

    tickets.forEach(ticket => {
      const status = this.normaliseTicketStatus(ticket?.status);
      switch (status) {
        case 'finished':
          completed += 1;
          break;
        case 'inProgress':
          inProgress += 1;
          break;
        case 'blocked':
          blocked += 1;
          break;
        default:
          reported += 1;
          break;
      }
    });

    return {
      total,
      completed,
      inProgress,
      blocked,
      reported,
      open: total - completed,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  calculateChecklistStats(checklistData) {
    const checklists = checklistData.checklists || [];
    let totalItems = 0;
    let completedItems = 0;
    let inProgressItems = 0;
    let blockedItems = 0;

    checklists.forEach(checklist => {
      const items = Array.isArray(checklist.items) ? checklist.items : [];
      totalItems += items.length;

      items.forEach(item => {
        const status = this.normaliseChecklistStatus(item?.status, {
          fallback: this.normaliseChecklistStatus(checklist?.status)
        });
        const isCompleted = item?.completed === true || status === 'complete';
        if (isCompleted) {
          completedItems += 1;
          return;
        }
        if (status === 'inProgress') {
          inProgressItems += 1;
          return;
        }
        if (status === 'blocked') {
          blockedItems += 1;
        }
      });
    });

    return {
      total: totalItems,
      completed: completedItems,
      inProgress: inProgressItems,
      blocked: blockedItems,
      completionRate: totalItems > 0 ? Math.round((completedItems / totalItems) * 100) : 0
    };
  }

  calculateRoadmapStats(roadmapData) {
    const milestones = Object.values(roadmapData.milestones || {});
    const total = milestones.length;
    let completed = 0;
    let active = 0;
    let blocked = 0;
    let paused = 0;
    let pending = 0;

    milestones.forEach(milestone => {
      const status = this.normaliseRoadmapStatus(milestone?.status);
      switch (status) {
        case 'completed':
          completed += 1;
          break;
        case 'active':
          active += 1;
          break;
        case 'blocked':
          blocked += 1;
          break;
        case 'paused':
          paused += 1;
          break;
        default:
          pending += 1;
          break;
      }
    });

    return {
      total,
      completed,
      active,
      blocked,
      paused,
      pending,
      completionRate: total > 0 ? Math.round((completed / total) * 100) : 0
    };
  }

  // 3. TOKEN USAGE TRACKING
  trackTokenUsage(inputTokens, outputTokens) {
    this.tokenUsage.inputTokens += inputTokens;
    this.tokenUsage.outputTokens += outputTokens;
    this.tokenUsage.totalTokens = this.tokenUsage.inputTokens + this.tokenUsage.outputTokens;

    // Calculate usage percentage
    const usagePercentage = (this.tokenUsage.totalTokens / this.tokenUsage.quota) * 100;

    // Add alerts if approaching limits
    if (usagePercentage >= 90 && !this.alerts.find(a => a.type === 'token-critical')) {
      this.addAlert({
        type: 'token-critical',
        level: 'critical',
        message: 'Token quota critically low (>90%)',
        details: `${this.tokenUsage.totalTokens}/${this.tokenUsage.quota} tokens used`,
        timestamp: new Date().toISOString()
      });
    } else if (usagePercentage >= 75 && !this.alerts.find(a => a.type === 'token-warning')) {
      this.addAlert({
        type: 'token-warning',
        level: 'warning',
        message: 'Token quota approaching limit (>75%)',
        details: `${this.tokenUsage.totalTokens}/${this.tokenUsage.quota} tokens used`,
        timestamp: new Date().toISOString()
      });
    }

    return this.getTokenUsageStats();
  }

  getTokenUsageStats() {
    const usagePercentage = (this.tokenUsage.totalTokens / this.tokenUsage.quota) * 100;
    const timeToReset = this.tokenUsage.quotaReset - Date.now();

    return {
      ...this.tokenUsage,
      usagePercentage: Math.round(usagePercentage * 10) / 10,
      timeToReset: Math.max(0, timeToReset),
      timeToResetHuman: this.formatDuration(timeToReset),
      status: usagePercentage >= 90 ? 'critical' : usagePercentage >= 75 ? 'warning' : 'normal'
    };
  }

  // 4. FILE COUNT MONITORING
  trackFileChange(filePath, operation = 'modified') {
    const relativePath = path.relative(process.cwd(), filePath);

    this.fileMonitor.touched.add(relativePath);

    switch (operation) {
      case 'created':
        this.fileMonitor.created.add(relativePath);
        break;
      case 'modified':
        this.fileMonitor.modified.add(relativePath);
        break;
      case 'deleted':
        this.fileMonitor.deleted.add(relativePath);
        break;
    }

    return this.getFileMonitorStats();
  }

  getFileMonitorStats() {
    const sessionDuration = Date.now() - this.startTime;
    const filesPerHour = this.fileMonitor.touched.size / (sessionDuration / (1000 * 60 * 60));

    return {
      touched: this.fileMonitor.touched.size,
      created: this.fileMonitor.created.size,
      modified: this.fileMonitor.modified.size,
      deleted: this.fileMonitor.deleted.size,
      sessionDuration: this.formatDuration(sessionDuration),
      filesPerHour: Math.round(filesPerHour * 10) / 10,
      recentFiles: Array.from(this.fileMonitor.touched).slice(-5),
      types: this.analyzeFileTypes()
    };
  }

  analyzeFileTypes() {
    const types = {};
    Array.from(this.fileMonitor.touched).forEach(file => {
      const ext = path.extname(file) || 'no-extension';
      types[ext] = (types[ext] || 0) + 1;
    });
    return types;
  }

  // 5. PROJECT HEALTH DASHBOARD
  async getProjectHealth(overrides = {}) {
    const [branchStatus, taskProgress, workspaceSummary] = await Promise.all([
      overrides.branchStatus ? Promise.resolve(overrides.branchStatus) : this.getBranchStatus(),
      overrides.taskProgress ? Promise.resolve(overrides.taskProgress) : this.getTaskProgress(),
      overrides.workspaceSummary ? Promise.resolve(overrides.workspaceSummary) : this.getWorkspaceSummary()
    ]);

    const tokenStats = overrides.tokenStats || this.getTokenUsageStats();
    const fileStats = overrides.fileStats || this.getFileMonitorStats();

    // Calculate overall health score
    let healthScore = 100;
    const healthFactors = [];

    // Branch health
    if (branchStatus.isDirty) {
      healthScore -= 10;
      healthFactors.push({ factor: 'Uncommitted changes', impact: -10 });
    }
    if (branchStatus.divergence === 'behind') {
      healthScore -= 15;
      healthFactors.push({ factor: 'Branch behind remote', impact: -15 });
    }
    if (branchStatus.divergence === 'diverged') {
      healthScore -= 20;
      healthFactors.push({ factor: 'Branch diverged', impact: -20 });
    }

    // Task progress health
    if (taskProgress.overall.blockedTasksCount > 0) {
      const impact = Math.min(taskProgress.overall.blockedTasksCount * 5, 25);
      healthScore -= impact;
      healthFactors.push({ factor: `${taskProgress.overall.blockedTasksCount} blocked tasks`, impact: -impact });
    }

    if (workspaceSummary.pendingCount > 0) {
      const impact = Math.min(workspaceSummary.pendingCount * 3, 15);
      healthScore -= impact;
      healthFactors.push({ factor: `${workspaceSummary.pendingCount} pending workspaces`, impact: -impact });
    }

    if (workspaceSummary.staleCount > 0) {
      const impact = Math.min(workspaceSummary.staleCount * 5, 20);
      healthScore -= impact;
      healthFactors.push({ factor: `${workspaceSummary.staleCount} stale workspaces`, impact: -impact });
    }

    // Token usage health
    if (tokenStats.usagePercentage >= 90) {
      healthScore -= 30;
      healthFactors.push({ factor: 'Critical token usage', impact: -30 });
    } else if (tokenStats.usagePercentage >= 75) {
      healthScore -= 15;
      healthFactors.push({ factor: 'High token usage', impact: -15 });
    }

    // File activity health
    if (fileStats.filesPerHour > 20) {
      healthScore -= 10;
      healthFactors.push({ factor: 'High file activity', impact: -10 });
    }

    healthScore = Math.max(0, Math.min(100, healthScore));

    return {
      score: healthScore,
      status: this.getHealthStatus(healthScore),
      factors: healthFactors,
      alerts: this.alerts.slice(-5), // Recent alerts
      blockers: this.blockers,
      components: {
        branch: branchStatus,
        tasks: taskProgress,
        tokens: tokenStats,
        files: fileStats,
        workspaces: workspaceSummary
      },
      summary: this.generateHealthSummary(healthScore, healthFactors),
      workspaces: workspaceSummary
    };
  }

  getHealthStatus(score) {
    if (score >= 90) return 'excellent';
    if (score >= 75) return 'good';
    if (score >= 60) return 'fair';
    if (score >= 40) return 'poor';
    return 'critical';
  }

  generateHealthSummary(score, factors) {
    if (score >= 90) {
      return 'Project is in excellent health with no significant issues.';
    }

    const topIssues = factors
      .sort((a, b) => a.impact - b.impact)
      .slice(0, 2)
      .map(f => f.factor);

    if (topIssues.length === 0) {
      return 'Project health is good with minor room for improvement.';
    }

    return `Primary concerns: ${topIssues.join(', ')}.`;
  }

  // 6. COLOR PALETTE CUSTOMIZATION
  getThemeColors(themeName = 'canyon') {
    const themes = {
      canyon: {
        primary: '#FF6B35',
        secondary: '#004E89',
        success: '#2ECC71',
        warning: '#F39C12',
        danger: '#E74C3C',
        info: '#3498DB',
        light: '#ECF0F1',
        dark: '#2C3E50',
        muted: '#95A5A6'
      },
      mole: {
        primary: '#8B4513',
        secondary: '#2F4F4F',
        success: '#228B22',
        warning: '#DAA520',
        danger: '#B22222',
        info: '#4682B4',
        light: '#F5F5DC',
        dark: '#1C1C1C',
        muted: '#708090'
      }
    };

    return themes[themeName] || themes.canyon;
  }

  getStatusColors(status, theme = 'canyon') {
    const colors = this.getThemeColors(theme);

    const statusColorMap = {
      excellent: colors.success,
      good: colors.info,
      fair: colors.warning,
      poor: colors.warning,
      critical: colors.danger,
      normal: colors.success,
      warning: colors.warning,
      error: colors.danger,
      'up-to-date': colors.success,
      ahead: colors.info,
      behind: colors.warning,
      diverged: colors.danger
    };

    return statusColorMap[status] || colors.muted;
  }

  // Utility methods
  addAlert(alert) {
    this.alerts.push({
      id: Date.now().toString(),
      ...alert
    });

    // Keep only last 50 alerts
    if (this.alerts.length > 50) {
      this.alerts = this.alerts.slice(-50);
    }
  }

  addBlocker(blocker) {
    this.blockers.push({
      id: Date.now().toString(),
      ...blocker,
      timestamp: new Date().toISOString()
    });
  }

  clearBlocker(blockerId) {
    this.blockers = this.blockers.filter(b => b.id !== blockerId);
  }

  formatDuration(ms) {
    const seconds = Math.floor(ms / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
    return `${seconds}s`;
  }

  // Reset methods for new sessions
  resetSession() {
    this.sessionFiles.clear();
    this.startTime = Date.now();
    this.fileMonitor = {
      touched: new Set(),
      created: new Set(),
      modified: new Set(),
      deleted: new Set()
    };
    this.alerts = [];
    this.blockers = [];
  }

  resetTokenUsage() {
    this.tokenUsage = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
      quota: this.tokenUsage.quota, // Keep quota setting
      quotaReset: Date.now() + (24 * 60 * 60 * 1000)
    };
  }
}

module.exports = new StatusDashboardManager();
