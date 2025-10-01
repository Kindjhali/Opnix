<template>
  <div class="status-dashboard" v-if="statusData">
    <!-- Branch Status Indicator -->
    <div class="status-section branch-status">
      <div class="status-header">
        <h4 class="status-title">
          <i class="git-icon">🌿</i>
          Branch Status
        </h4>
        <div
          class="status-badge"
          :class="getBranchStatusClass(statusData.branch)"
        >
          {{ statusData.branch.divergenceText }}
        </div>
      </div>
      <div class="branch-info">
        <div class="branch-name">{{ statusData.branch.currentBranch }}</div>
        <div class="branch-details" v-if="statusData.branch.lastCommit">
          <span class="commit-hash">{{ statusData.branch.lastCommit.hash }}</span>
          <span class="commit-message">{{ statusData.branch.lastCommit.message }}</span>
          <span class="commit-time">{{ statusData.branch.lastCommit.date }}</span>
        </div>
        <div class="branch-changes" v-if="statusData.branch.isDirty">
          <span class="uncommitted" v-if="statusData.branch.uncommittedFiles > 0">
            📝 {{ statusData.branch.uncommittedFiles }} uncommitted
          </span>
          <span class="untracked" v-if="statusData.branch.untrackedFiles > 0">
            ➕ {{ statusData.branch.untrackedFiles }} untracked
          </span>
        </div>
        <div class="workspace-summary" v-if="statusData.workspaces">
          <div class="workspace-counts">
            <div class="workspace-count">
              <span class="workspace-value">{{ statusData.workspaces.total }}</span>
              <span class="workspace-label">Tracked Workspaces</span>
            </div>
            <div class="workspace-count" v-if="statusData.workspaces.pendingCount > 0">
              <span class="workspace-value status-warning">{{ statusData.workspaces.pendingCount }}</span>
              <span class="workspace-label">Pending</span>
            </div>
            <div class="workspace-count" v-if="statusData.workspaces.activeCount > 0">
              <span class="workspace-value status-success">{{ statusData.workspaces.activeCount }}</span>
              <span class="workspace-label">Active</span>
            </div>
            <div class="workspace-count" v-if="statusData.workspaces.staleCount > 0">
              <span class="workspace-value status-danger">{{ statusData.workspaces.staleCount }}</span>
              <span class="workspace-label">Stale</span>
            </div>
          </div>
          <div class="workspace-status-chips" v-if="statusData.workspaces.statusCounts">
            <span
              v-for="(count, status) in statusData.workspaces.statusCounts"
              :key="status"
              class="workspace-chip"
            >
              {{ formatWorkspaceStatus(status) }}: {{ count }}
            </span>
          </div>
          <div class="workspace-list" v-if="statusData.workspaces.recent && statusData.workspaces.recent.length">
            <div class="workspace-list-title">Recent Checkouts</div>
            <div
              v-for="workspace in statusData.workspaces.recent.slice(0, 3)"
              :key="workspace.branchName"
              class="workspace-item"
            >
              <div class="workspace-item-header">
                <span class="workspace-branch">{{ workspace.branchName }}</span>
                <span class="workspace-status">{{ formatWorkspaceStatus(workspace.status) }}</span>
              </div>
              <div class="workspace-meta">
                <span v-if="workspace.ticketId" class="workspace-ticket">Ticket {{ workspace.ticketId }}</span>
                <span class="workspace-time" v-if="workspace.lastCheckoutAt">
                  ⏱ {{ formatRelativeTime(workspace.lastCheckoutAt) }}
                </span>
                <span class="workspace-time" v-else-if="workspace.createdAt">
                  📦 {{ formatRelativeTime(workspace.createdAt) }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Task Progress Indicator -->
    <div class="status-section task-progress">
      <div class="status-header">
        <h4 class="status-title">
          <i class="task-icon">📊</i>
          Task Progress
        </h4>
        <div class="progress-percentage">
          {{ statusData.tasks.overall.completionRate }}%
        </div>
      </div>
      <div class="progress-details">
        <div class="progress-bar">
          <div
            class="progress-fill"
            :style="{ width: statusData.tasks.overall.completionRate + '%' }"
          ></div>
        </div>
        <div class="task-stats">
          <div class="stat-item">
            <span class="stat-value">{{ statusData.tasks.overall.activeTasksCount }}</span>
            <span class="stat-label">Active</span>
          </div>
          <div class="stat-item" v-if="statusData.tasks.overall.blockedTasksCount > 0">
            <span class="stat-value blocked">{{ statusData.tasks.overall.blockedTasksCount }}</span>
            <span class="stat-label">Blocked</span>
          </div>
        </div>
        <div class="task-breakdown">
          <div class="breakdown-item">
            <span class="breakdown-label">Tickets:</span>
            <span class="breakdown-value">{{ statusData.tasks.tickets.completed }}/{{ statusData.tasks.tickets.total }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Checklists:</span>
            <span class="breakdown-value">{{ statusData.tasks.checklists.completed }}/{{ statusData.tasks.checklists.total }}</span>
          </div>
          <div class="breakdown-item">
            <span class="breakdown-label">Milestones:</span>
            <span class="breakdown-value">{{ statusData.tasks.roadmap.completed }}/{{ statusData.tasks.roadmap.total }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- Token Usage Tracking -->
    <div class="status-section token-usage">
      <div class="status-header">
        <h4 class="status-title">
          <i class="token-icon">🪙</i>
          Token Usage
        </h4>
        <div
          class="usage-badge"
          :class="getTokenStatusClass(statusData.tokens)"
        >
          {{ statusData.tokens.usagePercentage.toFixed(1) }}%
        </div>
      </div>
      <div class="token-details">
        <div class="token-bar">
          <div
            class="token-fill"
            :class="getTokenStatusClass(statusData.tokens)"
            :style="{ width: Math.min(statusData.tokens.usagePercentage, 100) + '%' }"
          >
          </div>
        </div>
        <div class="token-stats">
          <div class="token-stat">
            <span class="token-value">{{ formatTokens(statusData.tokens.totalTokens) }}</span>
            <span class="token-label">Used</span>
          </div>
          <div class="token-stat">
            <span class="token-value">{{ formatTokens(statusData.tokens.quota) }}</span>
            <span class="token-label">Quota</span>
          </div>
          <div class="token-stat" v-if="statusData.tokens.timeToReset > 0">
            <span class="token-value">{{ statusData.tokens.timeToResetHuman }}</span>
            <span class="token-label">Reset</span>
          </div>
        </div>
      </div>
    </div>

    <!-- File Count Monitoring -->
    <div class="status-section file-monitoring">
      <div class="status-header">
        <h4 class="status-title">
          <i class="file-icon">📁</i>
          File Activity
        </h4>
        <div class="file-count">
          {{ statusData.files.touched }}
        </div>
      </div>
      <div class="file-details">
        <div class="file-stats">
          <div class="file-stat">
            <span class="file-value">{{ statusData.files.created }}</span>
            <span class="file-label">Created</span>
          </div>
          <div class="file-stat">
            <span class="file-value">{{ statusData.files.modified }}</span>
            <span class="file-label">Modified</span>
          </div>
          <div class="file-stat" v-if="statusData.files.deleted > 0">
            <span class="file-value">{{ statusData.files.deleted }}</span>
            <span class="file-label">Deleted</span>
          </div>
        </div>
        <div class="file-rate">
          <span class="rate-value">{{ statusData.files.filesPerHour.toFixed(1) }}</span>
          <span class="rate-label">files/hour</span>
        </div>
        <div class="recent-files" v-if="statusData.files.recentFiles.length > 0">
          <div class="recent-title">Recent:</div>
          <div class="recent-list">
            <span
              v-for="file in statusData.files.recentFiles.slice(0, 3)"
              :key="file"
              class="recent-file"
            >
              {{ file.split('/').pop() }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Project Health Dashboard -->
    <div class="status-section project-health">
      <div class="status-header">
        <h4 class="status-title">
          <i class="health-icon">❤️</i>
          Project Health
        </h4>
        <div
          class="health-score"
          :class="getHealthStatusClass(statusData.health)"
        >
          {{ statusData.health.score }}
        </div>
      </div>
      <div class="health-details">
        <div class="health-status">
          <span class="health-label">Status:</span>
          <span
            class="health-value"
            :class="getHealthStatusClass(statusData.health)"
          >
            {{ statusData.health.status }}
          </span>
        </div>
        <div class="health-summary">{{ statusData.health.summary }}</div>
        <div class="health-factors" v-if="statusData.health.factors.length > 0">
          <div class="factors-title">Impact Factors:</div>
          <div
            v-for="factor in statusData.health.factors.slice(0, 3)"
            :key="factor.factor"
            class="factor-item"
          >
            <span class="factor-name">{{ factor.factor }}</span>
            <span class="factor-impact" :class="factor.impact < 0 ? 'negative' : 'positive'">
              {{ factor.impact }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Alerts Section -->
    <div class="status-section alerts-section" v-if="statusData.alerts.length > 0">
      <div class="status-header">
        <h4 class="status-title">
          <i class="alert-icon">⚠️</i>
          Alerts
        </h4>
        <div class="alert-count">{{ statusData.alerts.length }}</div>
      </div>
      <div class="alerts-list">
        <div
          v-for="alert in statusData.alerts.slice(0, 3)"
          :key="alert.id"
          class="alert-item"
          :class="'alert-' + alert.level"
        >
          <div class="alert-message">{{ alert.message }}</div>
          <div class="alert-details" v-if="alert.details">{{ alert.details }}</div>
        </div>
      </div>
    </div>

    <!-- Blockers Section -->
    <div class="status-section blockers-section" v-if="statusData.blockers.length > 0">
      <div class="status-header">
        <h4 class="status-title">
          <i class="blocker-icon">🚫</i>
          Blockers
        </h4>
        <div class="blocker-count">{{ statusData.blockers.length }}</div>
      </div>
      <div class="blockers-list">
        <div
          v-for="blocker in statusData.blockers"
          :key="blocker.id"
          class="blocker-item"
        >
          <div class="blocker-title">{{ blocker.title }}</div>
          <div class="blocker-description" v-if="blocker.description">{{ blocker.description }}</div>
        </div>
      </div>
    </div>

    <!-- Last Updated -->
    <div class="status-footer">
      <span class="last-updated">
        Last updated: {{ formatTime(statusData.timestamp) }}
      </span>
      <button @click="refreshStatus" class="refresh-btn" :disabled="loading">
        <span v-if="loading">⟳</span>
        <span v-else>🔄</span>
      </button>
    </div>
  </div>

  <div v-else class="status-loading">
    <div class="loading-spinner">⟳</div>
    <div class="loading-text">Loading status dashboard...</div>
  </div>
</template>

<script>
export default {
  name: 'StatusDashboard',
  data() {
    return {
      statusData: null,
      loading: false,
      error: null,
      refreshInterval: null
    };
  },
  mounted() {
    this.loadStatusData();
    // Auto-refresh every 30 seconds
    const setIntervalFn = typeof globalThis.setInterval === 'function' ? globalThis.setInterval : null;
    if (setIntervalFn) {
      this.refreshInterval = setIntervalFn(() => {
        this.loadStatusData();
      }, 30000);
    }
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      const clearIntervalFn = typeof globalThis.clearInterval === 'function' ? globalThis.clearInterval : null;
      if (clearIntervalFn) {
        clearIntervalFn(this.refreshInterval);
      }
    }
  },
  methods: {
    async loadStatusData() {
      try {
        this.loading = true;
        const fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
        if (!fetchImpl) {
          throw new Error('Fetch API is unavailable in this environment');
        }

        const response = await fetchImpl('/api/status/complete');
        if (!response.ok) {
          throw new Error(`Status request failed with ${response.status}`);
        }

        const result = await response.json();

        if (result.success) {
          this.statusData = result.data;
          this.error = null;
        } else {
          this.error = result.error || 'Failed to load status data';
        }
      } catch (error) {
        this.error = error.message;
        console.error('Failed to load status data:', error);
      } finally {
        this.loading = false;
      }
    },

    async refreshStatus() {
      await this.loadStatusData();
    },

    getBranchStatusClass(branch) {
      if (branch.error) return 'status-error';
      if (branch.isDirty) return 'status-warning';

      switch (branch.divergence) {
        case 'up-to-date': return 'status-success';
        case 'ahead': return 'status-info';
        case 'behind': return 'status-warning';
        case 'diverged': return 'status-danger';
        default: return 'status-muted';
      }
    },

    getTokenStatusClass(tokens) {
      if (tokens.usagePercentage >= 90) return 'status-critical';
      if (tokens.usagePercentage >= 75) return 'status-warning';
      if (tokens.usagePercentage >= 50) return 'status-info';
      return 'status-success';
    },

    getHealthStatusClass(health) {
      switch (health.status) {
        case 'excellent': return 'status-excellent';
        case 'good': return 'status-good';
        case 'fair': return 'status-fair';
        case 'poor': return 'status-poor';
        case 'critical': return 'status-critical';
        default: return 'status-muted';
      }
    },

    formatTokens(tokens) {
      if (tokens >= 1000000) {
        return (tokens / 1000000).toFixed(1) + 'M';
      } else if (tokens >= 1000) {
        return (tokens / 1000).toFixed(1) + 'K';
      }
      return tokens.toString();
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleTimeString();
    },

    formatWorkspaceStatus(status) {
      if (!status) {
        return 'Pending';
      }
      const lookup = {
        pending: 'Pending',
        created: 'Created',
        active: 'Active',
        resolved: 'Resolved',
        archived: 'Archived'
      };
      const key = String(status).toLowerCase();
      return lookup[key] || key.charAt(0).toUpperCase() + key.slice(1);
    },

    formatRelativeTime(timestamp) {
      if (!timestamp) {
        return 'not yet started';
      }
      const parsed = new Date(timestamp);
      if (Number.isNaN(parsed.getTime())) {
        return 'unknown';
      }

      const diff = Date.now() - parsed.getTime();
      if (diff < 0) {
        return 'just now';
      }
      const minute = 60 * 1000;
      const hour = 60 * minute;
      const day = 24 * hour;

      if (diff < minute) {
        return 'just now';
      }
      if (diff < hour) {
        const minutes = Math.floor(diff / minute);
        return `${minutes}m ago`;
      }
      if (diff < day) {
        const hours = Math.floor(diff / hour);
        return `${hours}h ago`;
      }

      return parsed.toLocaleDateString(undefined, {
        month: 'short',
        day: 'numeric'
      });
    }
  }
};
</script>
