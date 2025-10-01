<template>
  <div class="context-summary-container" :class="{ 'is-loading': loading }">
    <div class="summary-header">
      <h2>Context Overview</h2>
      <div class="summary-controls">
        <button class="refresh-btn" @click="refreshAll" :disabled="loading">
          {{ loading ? '...' : '↻' }}
        </button>
        <button class="settings-btn" @click="showSettings = !showSettings">
          ⚙
        </button>
      </div>
    </div>

    <div class="summary-filters" v-if="showSettings">
      <div class="filter-group">
        <label>
          <input
            type="checkbox"
            v-model="visibleTypes.tickets"
            @change="updateVisibility"
          >
          Tickets & Bugs
        </label>
        <label>
          <input
            type="checkbox"
            v-model="visibleTypes.features"
            @change="updateVisibility"
          >
          Features
        </label>
        <label>
          <input
            type="checkbox"
            v-model="visibleTypes.modules"
            @change="updateVisibility"
          >
          Modules
        </label>
        <label>
          <input
            type="checkbox"
            v-model="visibleTypes.specs"
            @change="updateVisibility"
          >
          Specifications
        </label>
      </div>
    </div>

    <div class="summary-content">
      <!-- Tickets Summary -->
      <ContextSummaryCard
        v-if="visibleTypes.tickets && ticketsSummary"
        type="ticket"
        :title="`${ticketsSummary.openCount} Open Tickets`"
        :subtitle="`${ticketsSummary.totalCount} total, ${ticketsSummary.closedCount} closed`"
        :status="getTicketsStatus()"
        :count="ticketsSummary.openCount"
        :data="ticketsSummary"
        :actions="ticketActions"
        :loading="ticketsLoading"
        :error="ticketsError"
        @action="handleAction"
        @retry="loadTicketsSummary"
      />

      <!-- Features Summary -->
      <ContextSummaryCard
        v-if="visibleTypes.features && featuresSummary"
        type="feature"
        :title="`${featuresSummary.activeCount} Active Features`"
        :subtitle="`${featuresSummary.totalCount} total, ${featuresSummary.completedCount} completed`"
        :status="getFeaturesStatus()"
        :count="featuresSummary.activeCount"
        :data="featuresSummary"
        :actions="featureActions"
        :loading="featuresLoading"
        :error="featuresError"
        @action="handleAction"
        @retry="loadFeaturesSummary"
      />

      <!-- Modules Summary -->
      <ContextSummaryCard
        v-if="visibleTypes.modules && modulesSummary"
        type="module"
        :title="`${modulesSummary.detectedCount} Modules Detected`"
        :subtitle="`${modulesSummary.totalFiles} files across ${modulesSummary.totalCount} modules`"
        :status="getModulesStatus()"
        :count="modulesSummary.detectedCount"
        :data="modulesSummary"
        :actions="moduleActions"
        :loading="modulesLoading"
        :error="modulesError"
        @action="handleAction"
        @retry="loadModulesSummary"
      />

      <!-- Specs Summary -->
      <ContextSummaryCard
        v-if="visibleTypes.specs && specsSummary"
        type="spec"
        :title="`${specsSummary.generatedCount} Specifications`"
        :subtitle="`${specsSummary.totalWordCount} words, last updated ${formatRelativeTime(specsSummary.lastGenerated)}`"
        :status="getSpecsStatus()"
        :count="specsSummary.generatedCount"
        :data="specsSummary"
        :actions="specActions"
        :loading="specsLoading"
        :error="specsError"
        @action="handleAction"
        @retry="loadSpecsSummary"
      />

      <!-- Recent Sessions Summary -->
      <ContextSummaryCard
        v-if="sessionsSummary"
        type="session"
        :title="`${sessionsSummary.activeCount} Active Sessions`"
        :subtitle="`${sessionsSummary.pausedCount} paused, ${sessionsSummary.recentCount} recent`"
        :status="getSessionsStatus()"
        :count="sessionsSummary.activeCount"
        :data="sessionsSummary"
        :actions="sessionActions"
        :loading="sessionsLoading"
        :error="sessionsError"
        @action="handleAction"
        @retry="loadSessionsSummary"
      />

      <!-- Loading state -->
      <div v-if="loading && !hasAnySummary" class="summary-loading">
        <div class="loading-spinner"></div>
        <span>Loading context overview...</span>
      </div>

      <!-- Empty state -->
      <div v-if="!loading && !hasAnySummary" class="summary-empty">
        <span class="empty-icon">📭</span>
        <h3>No Context Available</h3>
        <p>Start by creating tickets, features, or generating specifications to see context summaries here.</p>
        <button class="create-btn" @click="handleAction('create-ticket')">
          Create Your First Ticket
        </button>
      </div>
    </div>
  </div>
</template>

<script>
import ContextSummaryCard from './ContextSummaryCard.vue';

export default {
  name: 'ContextSummaryContainer',
  components: {
    ContextSummaryCard
  },
  props: {
    autoRefresh: {
      type: Boolean,
      default: true
    },
    refreshInterval: {
      type: Number,
      default: 30000 // 30 seconds
    }
  },
  emits: ['action'],
  data() {
    return {
      showSettings: false,
      loading: false,
      refreshTimer: null,

      // Visibility settings
      visibleTypes: {
        tickets: true,
        features: true,
        modules: true,
        specs: true
      },

      // Summary data
      ticketsSummary: null,
      featuresSummary: null,
      modulesSummary: null,
      specsSummary: null,
      sessionsSummary: null,

      // Loading states
      ticketsLoading: false,
      featuresLoading: false,
      modulesLoading: false,
      specsLoading: false,
      sessionsLoading: false,

      // Error states
      ticketsError: null,
      featuresError: null,
      modulesError: null,
      specsError: null,
      sessionsError: null,

      // Action definitions
      ticketActions: [
        { id: 'view-tickets', label: 'View All', icon: '👁', style: 'secondary' },
        { id: 'create-ticket', label: 'New Ticket', icon: '+', style: 'primary' }
      ],
      featureActions: [
        { id: 'view-features', label: 'View All', icon: '👁', style: 'secondary' },
        { id: 'create-feature', label: 'New Feature', icon: '+', style: 'primary' }
      ],
      moduleActions: [
        { id: 'view-modules', label: 'View Canvas', icon: '🗺', style: 'secondary' },
        { id: 'detect-modules', label: 'Re-detect', icon: '🔍', style: 'secondary' }
      ],
      specActions: [
        { id: 'view-specs', label: 'View All', icon: '👁', style: 'secondary' },
        { id: 'generate-spec', label: 'Generate', icon: '+', style: 'primary' }
      ],
      sessionActions: [
        { id: 'view-sessions', label: 'Manage', icon: '⚙', style: 'secondary' },
        { id: 'resume-session', label: 'Resume Recent', icon: '▶', style: 'primary' }
      ]
    };
  },
  computed: {
    hasAnySummary() {
      return this.ticketsSummary || this.featuresSummary ||
             this.modulesSummary || this.specsSummary || this.sessionsSummary;
    }
  },
  mounted() {
    this.loadAllSummaries();
    this.loadVisibilitySettings();

    if (this.autoRefresh && this.refreshInterval > 0) {
      this.startAutoRefresh();
    }
  },
  beforeUnmount() {
    this.stopAutoRefresh();
  },
  methods: {
    async loadAllSummaries() {
      this.loading = true;

      await Promise.allSettled([
        this.loadTicketsSummary(),
        this.loadFeaturesSummary(),
        this.loadModulesSummary(),
        this.loadSpecsSummary(),
        this.loadSessionsSummary()
      ]);

      this.loading = false;
    },

    async loadTicketsSummary() {
      if (!this.visibleTypes.tickets) return;

      this.ticketsLoading = true;
      this.ticketsError = null;

      try {
        const response = await fetch('/api/tickets');
        if (!response.ok) throw new Error('Failed to load tickets');

        const data = await response.json();
        const tickets = data.tickets || [];

        this.ticketsSummary = {
          totalCount: tickets.length,
          openCount: tickets.filter(t => t.status !== 'closed').length,
          closedCount: tickets.filter(t => t.status === 'closed').length,
          priorityBreakdown: this.getBreakdown(tickets, 'priority'),
          moduleBreakdown: this.getBreakdown(tickets, 'module'),
          recentTickets: tickets.slice(0, 3)
        };

      } catch (error) {
        console.error('Failed to load tickets summary:', error);
        this.ticketsError = error.message;
      } finally {
        this.ticketsLoading = false;
      }
    },

    async loadFeaturesSummary() {
      if (!this.visibleTypes.features) return;

      this.featuresLoading = true;
      this.featuresError = null;

      try {
        const response = await fetch('/api/features');
        if (!response.ok) throw new Error('Failed to load features');

        const data = await response.json();
        const features = data.features || [];

        this.featuresSummary = {
          totalCount: features.length,
          activeCount: features.filter(f => ['planned', 'in_progress'].includes(f.status)).length,
          completedCount: features.filter(f => f.status === 'completed').length,
          statusBreakdown: this.getBreakdown(features, 'status'),
          effortBreakdown: this.getBreakdown(features, 'effort'),
          recentFeatures: features.slice(0, 3)
        };

      } catch (error) {
        console.error('Failed to load features summary:', error);
        this.featuresError = error.message;
      } finally {
        this.featuresLoading = false;
      }
    },

    async loadModulesSummary() {
      if (!this.visibleTypes.modules) return;

      this.modulesLoading = true;
      this.modulesError = null;

      try {
        const response = await fetch('/api/modules/graph');
        if (!response.ok) throw new Error('Failed to load modules');

        const data = await response.json();
        const modules = data.modules || [];

        this.modulesSummary = {
          totalCount: modules.length,
          detectedCount: modules.filter(m => m.detected).length,
          totalFiles: modules.reduce((sum, m) => sum + (m.files?.length || 0), 0),
          totalSize: modules.reduce((sum, m) => sum + (m.size || 0), 0),
          dependencyCount: modules.reduce((sum, m) => sum + (m.dependencies?.length || 0), 0),
          recentModules: modules.slice(0, 3)
        };

      } catch (error) {
        console.error('Failed to load modules summary:', error);
        this.modulesError = error.message;
      } finally {
        this.modulesLoading = false;
      }
    },

    async loadSpecsSummary() {
      if (!this.visibleTypes.specs) return;

      this.specsLoading = true;
      this.specsError = null;

      try {
        // This would need to be implemented based on your specs API
        const response = await fetch('/api/specs');
        if (!response.ok) throw new Error('Failed to load specs');

        const data = await response.json();
        const specs = data.specs || [];

        this.specsSummary = {
          generatedCount: specs.length,
          totalWordCount: specs.reduce((sum, s) => sum + (s.wordCount || 0), 0),
          lastGenerated: specs.length > 0 ? specs[0].lastGenerated : null,
          typeBreakdown: this.getBreakdown(specs, 'type'),
          recentSpecs: specs.slice(0, 3)
        };

      } catch (error) {
        console.error('Failed to load specs summary:', error);
        this.specsError = error.message;
        // Set empty summary for specs since they might not exist
        this.specsSummary = {
          generatedCount: 0,
          totalWordCount: 0,
          lastGenerated: null,
          typeBreakdown: {},
          recentSpecs: []
        };
      } finally {
        this.specsLoading = false;
      }
    },

    async loadSessionsSummary() {
      this.sessionsLoading = true;
      this.sessionsError = null;

      try {
        const [statsResponse, recentResponse] = await Promise.all([
          fetch('/api/sessions/stats'),
          fetch('/api/sessions/recent?limit=5')
        ]);

        if (!statsResponse.ok || !recentResponse.ok) {
          throw new Error('Failed to load sessions');
        }

        const [statsData, recentData] = await Promise.all([
          statsResponse.json(),
          recentResponse.json()
        ]);

        const stats = statsData.stats || {};
        const recent = recentData.sessions || [];

        this.sessionsSummary = {
          activeCount: stats.byStatus?.active || 0,
          pausedCount: stats.byStatus?.paused || 0,
          totalCount: stats.total || 0,
          recentCount: recent.length,
          averageProgress: stats.averageProgress || 0,
          recentActivity: stats.recentActivity || 0,
          recentSessions: recent
        };

      } catch (error) {
        console.error('Failed to load sessions summary:', error);
        this.sessionsError = error.message;
      } finally {
        this.sessionsLoading = false;
      }
    },

    getBreakdown(items, field) {
      const breakdown = {};
      items.forEach(item => {
        const value = item[field] || 'unspecified';
        breakdown[value] = (breakdown[value] || 0) + 1;
      });
      return breakdown;
    },

    getTicketsStatus() {
      if (!this.ticketsSummary) return 'default';
      const { openCount, totalCount } = this.ticketsSummary;
      if (openCount === 0) return 'completed';
      if (openCount / totalCount > 0.7) return 'error';
      if (openCount / totalCount > 0.4) return 'in-progress';
      return 'active';
    },

    getFeaturesStatus() {
      if (!this.featuresSummary) return 'default';
      const { activeCount, totalCount } = this.featuresSummary;
      if (activeCount === 0) return 'completed';
      if (activeCount / totalCount > 0.5) return 'active';
      return 'in-progress';
    },

    getModulesStatus() {
      if (!this.modulesSummary) return 'default';
      const { detectedCount, totalCount } = this.modulesSummary;
      if (detectedCount === totalCount) return 'completed';
      if (detectedCount / totalCount > 0.8) return 'active';
      return 'in-progress';
    },

    getSpecsStatus() {
      if (!this.specsSummary) return 'default';
      return this.specsSummary.generatedCount > 0 ? 'active' : 'default';
    },

    getSessionsStatus() {
      if (!this.sessionsSummary) return 'default';
      const { activeCount, pausedCount } = this.sessionsSummary;
      if (pausedCount > activeCount) return 'paused';
      return activeCount > 0 ? 'active' : 'default';
    },

    async refreshAll() {
      await this.loadAllSummaries();
    },

    updateVisibility() {
      // Save visibility settings to preferences
      if (this.$preferences) {
        this.$preferences.setPreference('contextSummary.visibleTypes', this.visibleTypes);
      }

      // Reload summaries for newly visible types
      this.loadAllSummaries();
    },

    loadVisibilitySettings() {
      // Load visibility settings from preferences
      if (this.$preferences) {
        const saved = this.$preferences.getPreference('contextSummary.visibleTypes');
        if (saved) {
          this.visibleTypes = { ...this.visibleTypes, ...saved };
        }
      }
    },

    handleAction(actionId, data) {
      this.$emit('action', actionId, data);
    },

    formatRelativeTime(timestamp) {
      if (!timestamp) return 'never';

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
    },

    startAutoRefresh() {
      this.refreshTimer = setInterval(() => {
        this.loadAllSummaries();
      }, this.refreshInterval);
    },

    stopAutoRefresh() {
      if (this.refreshTimer) {
        clearInterval(this.refreshTimer);
        this.refreshTimer = null;
      }
    }
  }
};
</script>