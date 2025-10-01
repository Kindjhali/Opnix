<template>
  <div class="recent-sessions">
    <div class="recent-sessions-header">
      <h3>Recent Sessions</h3>
      <button
        class="sessions-toggle"
        @click="toggleExpanded"
        :aria-expanded="expanded"
        aria-label="Toggle recent sessions"
      >
        {{ expanded ? '−' : '+' }}
      </button>
    </div>

    <div v-if="expanded" class="recent-sessions-content">
      <div v-if="loading" class="sessions-loading">
        Loading sessions...
      </div>

      <div v-else-if="error" class="sessions-error">
        Failed to load sessions: {{ error }}
      </div>

      <div v-else-if="!sessions.length" class="sessions-empty">
        No recent sessions found
      </div>

      <ul v-else class="sessions-list">
        <li
          v-for="session in sessions"
          :key="session.id"
          class="session-item"
        >
          <div class="session-info">
            <div class="session-type-and-status">
              <span class="session-type">{{ formatSessionType(session.type) }}</span>
              <span :class="['session-status', session.status]">{{ session.status }}</span>
            </div>
            <div class="session-title">
              {{ session.metadata.title || session.metadata.description || `Session ${session.id.split('-').pop()}` }}
            </div>
            <div class="session-meta">
              <span class="session-time">{{ formatRelativeTime(session.metadata.lastAccessedAt) }}</span>
              <span class="session-progress">{{ session.progress.percentage }}%</span>
            </div>
          </div>

          <div class="session-actions">
            <button
              v-if="session.status === 'paused'"
              class="session-action session-resume"
              @click="resumeSession(session.id)"
              :disabled="resumingSession === session.id"
              title="Resume session"
            >
              {{ resumingSession === session.id ? '...' : '▶' }}
            </button>
            <button
              v-else-if="session.status === 'active'"
              class="session-action session-view"
              @click="viewSession(session.id)"
              title="View session"
            >
              👁
            </button>
            <button
              class="session-action session-delete"
              @click="deleteSession(session.id)"
              :disabled="deletingSession === session.id"
              title="Delete session"
            >
              {{ deletingSession === session.id ? '...' : '🗑' }}
            </button>
          </div>
        </li>
      </ul>

      <div class="sessions-footer">
        <button class="sessions-view-all" @click="viewAllSessions">
          View All Sessions
        </button>
        <button class="sessions-refresh" @click="refreshSessions" :disabled="loading">
          {{ loading ? '...' : '↻' }}
        </button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RecentSessions',
  data() {
    return {
      expanded: false,
      sessions: [],
      loading: false,
      error: null,
      resumingSession: null,
      deletingSession: null,
      refreshInterval: null
    };
  },
  mounted() {
    this.loadSessions();
    // Auto-refresh every 30 seconds
    this.refreshInterval = setInterval(() => {
      if (this.expanded && !this.loading) {
        this.loadSessions(true);
      }
    }, 30000);
  },
  beforeUnmount() {
    if (this.refreshInterval) {
      clearInterval(this.refreshInterval);
    }
  },
  methods: {
    toggleExpanded() {
      this.expanded = !this.expanded;
      if (this.expanded && !this.sessions.length) {
        this.loadSessions();
      }
    },

    async loadSessions(silent = false) {
      if (!silent) {
        this.loading = true;
      }
      this.error = null;

      try {
        const response = await fetch('/api/sessions/recent?limit=5');
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const data = await response.json();
        this.sessions = data.sessions || [];
      } catch (error) {
        console.error('Failed to load recent sessions:', error);
        this.error = error.message;
      } finally {
        this.loading = false;
      }
    },

    async resumeSession(sessionId) {
      this.resumingSession = sessionId;
      try {
        const response = await fetch(`/api/sessions/${sessionId}/resume`, {
          method: 'POST'
        });

        if (!response.ok) {
          throw new Error(`Failed to resume session: ${response.statusText}`);
        }

        // Refresh sessions list and emit resume event
        await this.loadSessions(true);
        this.$emit('session-resumed', sessionId);

        // Show success notification if available
        if (this.$parent && this.$parent.showNotification) {
          this.$parent.showNotification('Session resumed successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to resume session:', error);
        this.error = error.message;
      } finally {
        this.resumingSession = null;
      }
    },

    async deleteSession(sessionId) {
      if (!confirm('Are you sure you want to delete this session?')) {
        return;
      }

      this.deletingSession = sessionId;
      try {
        const response = await fetch(`/api/sessions/${sessionId}`, {
          method: 'DELETE'
        });

        if (!response.ok) {
          throw new Error(`Failed to delete session: ${response.statusText}`);
        }

        // Remove from local list and emit delete event
        this.sessions = this.sessions.filter(s => s.id !== sessionId);
        this.$emit('session-deleted', sessionId);

        // Show success notification if available
        if (this.$parent && this.$parent.showNotification) {
          this.$parent.showNotification('Session deleted successfully', 'success');
        }
      } catch (error) {
        console.error('Failed to delete session:', error);
        this.error = error.message;
      } finally {
        this.deletingSession = null;
      }
    },

    viewSession(sessionId) {
      this.$emit('session-view', sessionId);
      // Could also navigate to a session detail page if available
    },

    viewAllSessions() {
      this.$emit('view-all-sessions');
      // Could navigate to a sessions management page
    },

    refreshSessions() {
      this.loadSessions();
    },

    formatSessionType(type) {
      const typeMap = {
        'spec': 'Spec',
        'feature': 'Feature',
        'bug': 'Bug',
        'interview': 'Interview',
        'custom': 'Custom'
      };
      return typeMap[type] || type;
    },

    formatRelativeTime(timestamp) {
      const now = new Date();
      const time = new Date(timestamp);
      const diffMs = now - time;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return time.toLocaleDateString();
    }
  }
};
</script>