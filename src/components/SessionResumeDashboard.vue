<template>
  <div class="session-resume-dashboard">
    <div class="dashboard-header">
      <h2 class="dashboard-title">
        <span class="icon">🔄</span>
        Session Resume
      </h2>
      <div class="dashboard-actions">
        <button class="btn-icon" @click="refreshSessions" :disabled="isLoading" title="Refresh">
          <span class="icon" :class="{ spinning: isLoading }">🔄</span>
        </button>
        <button class="btn-icon" @click="showSessionManager = true" title="Manage Sessions">
          <span class="icon">⚙️</span>
        </button>
      </div>
    </div>

    <!-- Quick Stats -->
    <div class="session-stats" v-if="sessionStats">
      <div class="stat-card">
        <div class="stat-number">{{ sessionStats.active || 0 }}</div>
        <div class="stat-label">Active</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ sessionStats.paused || 0 }}</div>
        <div class="stat-label">Paused</div>
      </div>
      <div class="stat-card">
        <div class="stat-number">{{ sessionStats.recent || 0 }}</div>
        <div class="stat-label">Recent</div>
      </div>
    </div>

    <!-- Paused Sessions -->
    <div class="session-section" v-if="pausedSessions.length > 0">
      <h3 class="section-title">
        <span class="icon">⏸️</span>
        Paused Sessions
      </h3>
      <div class="session-grid">
        <div
          v-for="session in pausedSessions"
          :key="session.id"
          class="session-card paused"
          @click="resumeSession(session)"
        >
          <div class="session-header">
            <div class="session-type">{{ getSessionTypeIcon(session.type) }} {{ session.type }}</div>
            <div class="session-time">{{ formatRelativeTime(session.metadata.lastAccessedAt) }}</div>
          </div>

          <div class="session-title">{{ session.metadata.title || 'Untitled Session' }}</div>

          <div class="session-progress">
            <div class="progress-bar">
              <div
                class="progress-fill"
                :style="{ width: `${session.progress?.percentage || 0}%` }"
              ></div>
            </div>
            <span class="progress-text">{{ session.progress?.percentage || 0 }}%</span>
          </div>

          <div class="session-actions">
            <button
              class="btn primary small"
              @click.stop="resumeSession(session)"
              :disabled="isLoading"
            >
              Resume
            </button>
            <button
              class="btn secondary small"
              @click.stop="deleteSession(session.id)"
              :disabled="isLoading"
            >
              Delete
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Recent Sessions -->
    <div class="session-section" v-if="recentSessions.length > 0">
      <h3 class="section-title">
        <span class="icon">📋</span>
        Recent Sessions
      </h3>
      <div class="session-list">
        <div
          v-for="session in recentSessions"
          :key="session.id"
          class="session-item"
          :class="session.status"
          @click="handleSessionClick(session)"
        >
          <div class="session-info">
            <div class="session-type-small">
              {{ getSessionTypeIcon(session.type) }}
              <span>{{ session.type }}</span>
            </div>
            <div class="session-title-small">{{ session.metadata.title || 'Untitled Session' }}</div>
            <div class="session-meta">
              <span class="session-status">{{ session.status }}</span>
              <span class="session-time-small">{{ formatRelativeTime(session.metadata.lastAccessedAt) }}</span>
            </div>
          </div>

          <div class="session-progress-small">
            <div class="progress-bar small">
              <div
                class="progress-fill"
                :style="{ width: `${session.progress?.percentage || 0}%` }"
              ></div>
            </div>
          </div>

          <div class="session-actions-small">
            <button
              class="btn-icon small"
              @click.stop="handleSessionAction(session)"
              :disabled="isLoading"
              :title="getActionTitle(session)"
            >
              <span class="icon">{{ getActionIcon(session) }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div class="empty-state" v-if="!isLoading && pausedSessions.length === 0 && recentSessions.length === 0">
      <div class="empty-icon">💤</div>
      <div class="empty-title">No Sessions Found</div>
      <div class="empty-description">
        Start working on something to see your sessions here.
      </div>
      <button class="btn primary" @click="createNewSession">
        <span class="icon">✨</span>
        Start New Session
      </button>
    </div>

    <!-- Loading State -->
    <div class="loading-state" v-if="isLoading">
      <div class="spinner"></div>
      <div class="loading-text">Loading sessions...</div>
    </div>

    <!-- Session Manager Modal -->
    <div class="modal-overlay" v-if="showSessionManager" @click="showSessionManager = false">
      <div class="modal session-manager-modal" @click.stop>
        <div class="modal-header">
          <h3>Session Manager</h3>
          <button class="btn-icon" @click="showSessionManager = false">
            <span class="icon">✕</span>
          </button>
        </div>

        <div class="modal-body">
          <div class="session-filters">
            <select v-model="sessionFilter.type">
              <option value="">All Types</option>
              <option value="spec">Specs</option>
              <option value="feature">Features</option>
              <option value="bug">Bugs</option>
              <option value="interview">Interviews</option>
            </select>

            <select v-model="sessionFilter.status">
              <option value="">All Status</option>
              <option value="active">Active</option>
              <option value="paused">Paused</option>
              <option value="completed">Completed</option>
            </select>

            <input
              type="text"
              v-model="sessionFilter.search"
              placeholder="Search sessions..."
              class="search-input"
            />
          </div>

          <div class="session-manager-list">
            <div
              v-for="session in filteredSessions"
              :key="session.id"
              class="session-manager-item"
            >
              <div class="session-info-detailed">
                <div class="session-title">{{ session.metadata.title || 'Untitled Session' }}</div>
                <div class="session-details">
                  <span class="session-type">{{ session.type }}</span>
                  <span class="session-status" :class="session.status">{{ session.status }}</span>
                  <span class="session-progress">{{ session.progress?.percentage || 0 }}%</span>
                </div>
                <div class="session-timestamps">
                  <div>Created: {{ formatDateTime(session.metadata.createdAt) }}</div>
                  <div>Last Access: {{ formatDateTime(session.metadata.lastAccessedAt) }}</div>
                </div>
              </div>

              <div class="session-manager-actions">
                <button
                  class="btn small primary"
                  @click="handleSessionAction(session)"
                  :disabled="isLoading"
                >
                  {{ getActionLabel(session) }}
                </button>
                <button
                  class="btn small danger"
                  @click="deleteSession(session.id)"
                  :disabled="isLoading"
                >
                  Delete
                </button>
              </div>
            </div>
          </div>
        </div>

        <div class="modal-footer">
          <button class="btn secondary" @click="cleanupOldSessions">
            Cleanup Old Sessions
          </button>
          <button class="btn primary" @click="showSessionManager = false">
            Close
          </button>
        </div>
      </div>
    </div>

    <!-- Error Toast -->
    <div class="toast error" v-if="error">
      {{ error }}
      <button class="toast-close" @click="error = null">×</button>
    </div>

    <!-- Success Toast -->
    <div class="toast success" v-if="successMessage">
      {{ successMessage }}
      <button class="toast-close" @click="successMessage = null">×</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SessionResumeDashboard',
  emits: ['session-resumed', 'session-created', 'session-deleted'],
  data() {
    return {
      isLoading: false,
      error: null,
      successMessage: null,
      pausedSessions: [],
      recentSessions: [],
      sessionStats: null,
      showSessionManager: false,
      sessionFilter: {
        type: '',
        status: '',
        search: ''
      },
      allSessions: []
    };
  },
  computed: {
    filteredSessions() {
      return this.allSessions.filter(session => {
        if (this.sessionFilter.type && session.type !== this.sessionFilter.type) return false;
        if (this.sessionFilter.status && session.status !== this.sessionFilter.status) return false;
        if (this.sessionFilter.search) {
          const search = this.sessionFilter.search.toLowerCase();
          const searchableText = [
            session.metadata.title || '',
            session.type,
            session.metadata.description || ''
          ].join(' ').toLowerCase();
          if (!searchableText.includes(search)) return false;
        }
        return true;
      });
    }
  },
  methods: {
    async refreshSessions() {
      this.isLoading = true;
      this.error = null;

      try {
        // Fetch paused sessions
        const pausedResponse = await fetch('/api/sessions/paused');
        if (pausedResponse.ok) {
          this.pausedSessions = await pausedResponse.json();
        }

        // Fetch recent sessions
        const recentResponse = await fetch('/api/sessions/recent');
        if (recentResponse.ok) {
          this.recentSessions = await recentResponse.json();
        }

        // Fetch session statistics
        const statsResponse = await fetch('/api/sessions/stats');
        if (statsResponse.ok) {
          const stats = await statsResponse.json();
          this.sessionStats = {
            active: stats.byStatus?.active || 0,
            paused: stats.byStatus?.paused || 0,
            recent: stats.recentActivity || 0
          };
        }

        // Fetch all sessions for manager
        const allResponse = await fetch('/api/sessions');
        if (allResponse.ok) {
          this.allSessions = await allResponse.json();
        }

      } catch (error) {
        this.error = 'Failed to load sessions';
        console.error('Session loading error:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async resumeSession(session) {
      this.isLoading = true;
      try {
        const response = await fetch(`/api/sessions/${session.id}/resume`, {
          method: 'POST'
        });

        if (response.ok) {
          const resumedSession = await response.json();
          this.successMessage = `Resumed session: ${resumedSession.metadata.title || 'Untitled'}`;
          this.$emit('session-resumed', resumedSession);
          await this.refreshSessions();
        } else {
          throw new Error('Failed to resume session');
        }
      } catch (error) {
        this.error = 'Failed to resume session';
        console.error('Resume error:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async deleteSession(sessionId) {
      if (!confirm('Are you sure you want to delete this session? This action cannot be undone.')) {
        return;
      }

      this.isLoading = true;
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE'
        });

        if (response.ok) {
          this.successMessage = 'Session deleted successfully';
          this.$emit('session-deleted', sessionId);
          await this.refreshSessions();
        } else {
          throw new Error('Failed to delete session');
        }
      } catch (error) {
        this.error = 'Failed to delete session';
        console.error('Delete error:', error);
      } finally {
        this.isLoading = false;
      }
    },

    async cleanupOldSessions() {
      if (!confirm('This will remove sessions older than 30 days. Continue?')) {
        return;
      }

      this.isLoading = true;
      try {
        const response = await fetch('/api/sessions/cleanup', {
          method: 'POST'
        });

        if (response.ok) {
          const result = await response.json();
          this.successMessage = `Cleaned up ${result.count} old sessions`;
          await this.refreshSessions();
        } else {
          throw new Error('Failed to cleanup sessions');
        }
      } catch (error) {
        this.error = 'Failed to cleanup sessions';
        console.error('Cleanup error:', error);
      } finally {
        this.isLoading = false;
      }
    },

    handleSessionClick(session) {
      if (session.status === 'paused') {
        this.resumeSession(session);
      } else {
        // Show session details or navigate to session
        this.$emit('session-selected', session);
      }
    },

    handleSessionAction(session) {
      switch (session.status) {
        case 'paused':
          this.resumeSession(session);
          break;
        case 'active':
          // Navigate to active session
          this.$emit('session-selected', session);
          break;
        case 'completed':
          // View completed session
          this.$emit('session-viewed', session);
          break;
        default:
          this.$emit('session-selected', session);
      }
    },

    createNewSession() {
      this.$emit('session-created');
    },

    getSessionTypeIcon(type) {
      const icons = {
        spec: '📋',
        feature: '✨',
        bug: '🐛',
        interview: '❓',
        custom: '⚙️'
      };
      return icons[type] || '📄';
    },

    getActionIcon(session) {
      switch (session.status) {
        case 'paused': return '▶️';
        case 'active': return '👁️';
        case 'completed': return '📖';
        default: return '👁️';
      }
    },

    getActionTitle(session) {
      switch (session.status) {
        case 'paused': return 'Resume session';
        case 'active': return 'View active session';
        case 'completed': return 'View completed session';
        default: return 'View session';
      }
    },

    getActionLabel(session) {
      switch (session.status) {
        case 'paused': return 'Resume';
        case 'active': return 'View';
        case 'completed': return 'Review';
        default: return 'Open';
      }
    },

    formatRelativeTime(timestamp) {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / 60000);
      const diffHours = Math.floor(diffMs / 3600000);
      const diffDays = Math.floor(diffMs / 86400000);

      if (diffMins < 1) return 'Just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;
      return time.toLocaleDateString();
    },

    formatDateTime(timestamp) {
      return new Date(timestamp).toLocaleString();
    }
  },

  mounted() {
    this.refreshSessions();

    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      this.refreshSessions();
    }, 30000);
  },

  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  }
};
</script>
