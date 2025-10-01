<template>
  <div class="collapsible-section" :class="[`level-${level}`, { 'is-expanded': isExpanded, 'is-loading': loading }]">
    <div class="section-header" @click="toggle" :class="{ 'is-clickable': collapsible }">
      <div class="header-content">
        <div class="section-title-area">
          <button
            v-if="collapsible"
            class="expand-toggle"
            :aria-expanded="isExpanded"
            :aria-label="isExpanded ? 'Collapse section' : 'Expand section'"
            @click.stop="toggle"
          >
            <span class="toggle-icon">{{ isExpanded ? '▼' : '▶' }}</span>
          </button>

          <div class="title-content">
            <h3 v-if="level === 1" class="section-title">{{ title }}</h3>
            <h4 v-else-if="level === 2" class="section-title">{{ title }}</h4>
            <h5 v-else class="section-title">{{ title }}</h5>

            <p v-if="subtitle" class="section-subtitle">{{ subtitle }}</p>
          </div>
        </div>

        <div class="header-actions" v-if="$slots.actions || badge || count !== null">
          <span v-if="badge" class="section-badge" :class="badgeType">{{ badge }}</span>
          <span v-if="count !== null" class="section-count">{{ count }}</span>
          <div class="action-buttons" v-if="$slots.actions">
            <slot name="actions"></slot>
          </div>
        </div>
      </div>

      <div v-if="description && !isExpanded" class="section-preview">
        {{ truncateText(description, 100) }}
      </div>
    </div>

    <div
      v-if="!collapsible || isExpanded"
      class="section-content"
      :class="{ 'is-loading': loading }"
      ref="content"
    >
      <div v-if="loading" class="content-loading">
        <div class="loading-spinner"></div>
        <span>{{ loadingText || 'Loading...' }}</span>
      </div>

      <div v-else-if="error" class="content-error">
        <span class="error-icon">⚠</span>
        <span>{{ error }}</span>
        <button v-if="$listeners.retry" class="retry-btn" @click="$emit('retry')">
          Retry
        </button>
      </div>

      <div v-else-if="isEmpty" class="content-empty">
        <slot name="empty">
          <span class="empty-icon">📭</span>
          <p>{{ emptyText || 'No content available' }}</p>
        </slot>
      </div>

      <div v-else class="content-body">
        <div v-if="description && isExpanded" class="section-description">
          {{ description }}
        </div>

        <slot></slot>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'CollapsibleSection',
  props: {
    title: {
      type: String,
      required: true
    },
    subtitle: {
      type: String,
      default: null
    },
    description: {
      type: String,
      default: null
    },
    level: {
      type: Number,
      default: 1,
      validator: value => value >= 1 && value <= 6
    },
    collapsible: {
      type: Boolean,
      default: true
    },
    defaultExpanded: {
      type: Boolean,
      default: false
    },
    badge: {
      type: String,
      default: null
    },
    badgeType: {
      type: String,
      default: 'default',
      validator: value => ['default', 'success', 'warning', 'error', 'info'].includes(value)
    },
    count: {
      type: Number,
      default: null
    },
    loading: {
      type: Boolean,
      default: false
    },
    loadingText: {
      type: String,
      default: null
    },
    error: {
      type: String,
      default: null
    },
    isEmpty: {
      type: Boolean,
      default: false
    },
    emptyText: {
      type: String,
      default: null
    },
    persistState: {
      type: Boolean,
      default: false
    },
    stateKey: {
      type: String,
      default: null
    }
  },
  emits: ['expand', 'collapse', 'retry'],
  data() {
    return {
      isExpanded: this.defaultExpanded
    };
  },
  mounted() {
    if (this.persistState && this.stateKey) {
      this.loadExpandedState();
    }
  },
  methods: {
    toggle() {
      if (!this.collapsible) return;

      this.isExpanded = !this.isExpanded;

      if (this.persistState && this.stateKey) {
        this.saveExpandedState();
      }

      this.$emit(this.isExpanded ? 'expand' : 'collapse');
    },

    expand() {
      if (!this.collapsible || this.isExpanded) return;
      this.toggle();
    },

    collapse() {
      if (!this.collapsible || !this.isExpanded) return;
      this.toggle();
    },

    truncateText(text, maxLength) {
      if (!text || text.length <= maxLength) return text;
      return text.substring(0, maxLength) + '...';
    },

    async loadExpandedState() {
      try {
        const response = await fetch(`/api/preferences/ui.collapsedSections.${this.stateKey}`);
        if (response.ok) {
          const data = await response.json();
          // If preference exists, use it; otherwise keep default
          if (data.value !== undefined) {
            this.isExpanded = !data.value; // Preference stores collapsed state
          }
        }
      } catch (error) {
        // Ignore errors, use default state
        console.warn('Failed to load section state:', error);
      }
    },

    async saveExpandedState() {
      try {
        await fetch(`/api/preferences/ui.collapsedSections.${this.stateKey}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: !this.isExpanded // Store collapsed state
          })
        });
      } catch (error) {
        console.warn('Failed to save section state:', error);
      }
    }
  }
};
</script>