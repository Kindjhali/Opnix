<template>
  <div class="context-summary-card" :class="[`type-${type}`, { 'is-expanded': expanded, 'is-loading': loading }]">
    <div class="card-header" @click="toggleExpanded">
      <div class="card-header-main">
        <div class="card-icon">
          {{ getTypeIcon(type) }}
        </div>
        <div class="card-title-section">
          <h3 class="card-title">{{ title }}</h3>
          <p class="card-subtitle" v-if="subtitle">{{ subtitle }}</p>
        </div>
      </div>

      <div class="card-header-actions">
        <div class="card-metadata">
          <span class="card-status" :class="status">{{ formatStatus(status) }}</span>
          <span class="card-count" v-if="count !== null">{{ count }}</span>
        </div>
        <button
          class="expand-toggle"
          :aria-expanded="expanded"
          :aria-label="expanded ? 'Collapse card' : 'Expand card'"
        >
          {{ expanded ? '−' : '+' }}
        </button>
      </div>
    </div>

    <div class="card-content" v-if="expanded" :class="{ 'is-loading': loading }">
      <div v-if="loading" class="card-loading">
        <div class="loading-spinner"></div>
        <span>Loading {{ type }} details...</span>
      </div>

      <div v-else-if="error" class="card-error">
        <span class="error-icon">⚠</span>
        <span>{{ error }}</span>
        <button class="retry-btn" @click="$emit('retry')" v-if="$listeners.retry">
          Retry
        </button>
      </div>

      <div v-else class="card-details">
        <!-- Ticket/Bug Summary -->
        <div v-if="type === 'ticket' || type === 'bug'" class="ticket-details">
          <div class="detail-row">
            <span class="detail-label">Priority:</span>
            <span class="detail-value priority" :class="data.priority">{{ data.priority || 'Normal' }}</span>
          </div>
          <div class="detail-row" v-if="data.module">
            <span class="detail-label">Module:</span>
            <span class="detail-value">{{ data.module }}</span>
          </div>
          <div class="detail-row" v-if="data.assignee">
            <span class="detail-label">Assignee:</span>
            <span class="detail-value">{{ data.assignee }}</span>
          </div>
          <div class="detail-row" v-if="data.created">
            <span class="detail-label">Created:</span>
            <span class="detail-value">{{ formatDate(data.created) }}</span>
          </div>
          <div class="description" v-if="data.description">
            <span class="detail-label">Description:</span>
            <p class="detail-description">{{ truncateText(data.description, 150) }}</p>
          </div>
        </div>

        <!-- Feature Summary -->
        <div v-else-if="type === 'feature'" class="feature-details">
          <div class="detail-row" v-if="data.acceptanceCriteria">
            <span class="detail-label">Criteria:</span>
            <span class="detail-value">{{ data.acceptanceCriteria.length }} items</span>
          </div>
          <div class="detail-row" v-if="data.module">
            <span class="detail-label">Module:</span>
            <span class="detail-value">{{ data.module }}</span>
          </div>
          <div class="detail-row" v-if="data.effort">
            <span class="detail-label">Effort:</span>
            <span class="detail-value effort" :class="data.effort">{{ data.effort }}</span>
          </div>
          <div class="description" v-if="data.description">
            <span class="detail-label">Description:</span>
            <p class="detail-description">{{ truncateText(data.description, 150) }}</p>
          </div>
        </div>

        <!-- Module Summary -->
        <div v-else-if="type === 'module'" class="module-details">
          <div class="detail-row" v-if="data.dependencies">
            <span class="detail-label">Dependencies:</span>
            <span class="detail-value">{{ data.dependencies.length || 0 }}</span>
          </div>
          <div class="detail-row" v-if="data.files">
            <span class="detail-label">Files:</span>
            <span class="detail-value">{{ data.files.length || 0 }}</span>
          </div>
          <div class="detail-row" v-if="data.size">
            <span class="detail-label">Size:</span>
            <span class="detail-value">{{ formatBytes(data.size) }}</span>
          </div>
          <div class="description" v-if="data.description">
            <span class="detail-label">Purpose:</span>
            <p class="detail-description">{{ truncateText(data.description, 150) }}</p>
          </div>
        </div>

        <!-- Spec Summary -->
        <div v-else-if="type === 'spec'" class="spec-details">
          <div class="detail-row" v-if="data.sections">
            <span class="detail-label">Sections:</span>
            <span class="detail-value">{{ data.sections.length || 0 }}</span>
          </div>
          <div class="detail-row" v-if="data.lastGenerated">
            <span class="detail-label">Generated:</span>
            <span class="detail-value">{{ formatDate(data.lastGenerated) }}</span>
          </div>
          <div class="detail-row" v-if="data.wordCount">
            <span class="detail-label">Length:</span>
            <span class="detail-value">{{ data.wordCount.toLocaleString() }} words</span>
          </div>
        </div>

        <!-- Generic details for other types -->
        <div v-else class="generic-details">
          <div v-for="(value, key) in getDisplayableProperties(data)" :key="key" class="detail-row">
            <span class="detail-label">{{ formatKey(key) }}:</span>
            <span class="detail-value">{{ formatValue(value) }}</span>
          </div>
        </div>

        <!-- Quick Actions -->
        <div class="card-actions" v-if="actions && actions.length">
          <button
            v-for="action in actions"
            :key="action.id"
            class="action-btn"
            :class="action.style || 'secondary'"
            @click="$emit('action', action.id, data)"
            :disabled="action.disabled"
          >
            <span v-if="action.icon" class="action-icon">{{ action.icon }}</span>
            {{ action.label }}
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'ContextSummaryCard',
  props: {
    type: {
      type: String,
      required: true,
      validator: value => ['ticket', 'bug', 'feature', 'module', 'spec', 'session', 'custom'].includes(value)
    },
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: null
    },
    status: {
      type: String,
      default: 'default'
    },
    count: {
      type: Number,
      default: null
    },
    data: {
      type: Object,
      default: () => ({})
    },
    actions: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: null
    },
    defaultExpanded: {
      type: Boolean,
      default: false
    }
  },
  emits: ['action', 'retry', 'expand', 'collapse'],
  data() {
    return {
      expanded: this.defaultExpanded
    };
  },
  methods: {
    toggleExpanded() {
      this.expanded = !this.expanded;
      this.$emit(this.expanded ? 'expand' : 'collapse');
    },

    getTypeIcon(type) {
      const icons = {
        ticket: '🎫',
        bug: '🐛',
        feature: '✨',
        module: '📦',
        spec: '📋',
        session: '⚡',
        custom: '📄'
      };
      return icons[type] || '📄';
    },

    formatStatus(status) {
      return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ');
    },

    formatDate(dateString) {
      if (!dateString) return '';

      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffMins = Math.floor(diffMs / (1000 * 60));
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

      if (diffMins < 1) return 'just now';
      if (diffMins < 60) return `${diffMins}m ago`;
      if (diffHours < 24) return `${diffHours}h ago`;
      if (diffDays < 7) return `${diffDays}d ago`;

      return date.toLocaleDateString();
    },

    formatBytes(bytes) {
      if (!bytes) return '0 B';

      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(1024));
      return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
    },

    truncateText(text, maxLength) {
      if (!text || text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    },

    formatKey(key) {
      return key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1');
    },

    formatValue(value) {
      if (value === null || value === undefined) return '';
      if (typeof value === 'boolean') return value ? 'Yes' : 'No';
      if (Array.isArray(value)) return `${value.length} items`;
      if (typeof value === 'object') return 'Object';
      return String(value);
    },

    getDisplayableProperties(data) {
      if (!data || typeof data !== 'object') return {};

      // Filter out complex objects and focus on displayable properties
      const displayable = {};
      for (const [key, value] of Object.entries(data)) {
        if (typeof value !== 'object' || value === null) {
          displayable[key] = value;
        }
      }

      return displayable;
    }
  }
};
</script>