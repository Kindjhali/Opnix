<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn feature" type="button" @click="$emit('create')">+ New Feature</button>
      <select v-model="localFilter.module">
        <option value="">All Modules</option>
        <option v-for="module in modules" :key="module.id" :value="module.id">
          {{ module.name }}
        </option>
      </select>
      <select v-model="localFilter.status">
        <option value="">All Status</option>
        <option value="proposed">Proposed</option>
        <option value="approved">Approved</option>
        <option value="in-development">In Development</option>
        <option value="testing">Testing</option>
        <option value="deployed">Deployed</option>
      </select>
      <button class="btn secondary" type="button" @click="$emit('report')">Generate Report</button>

      <!-- Bulk Operations Toggle -->
      <button
        class="btn bulk-toggle"
        :class="{ active: isInSelectionMode }"
        type="button"
        @click="toggleSelectionMode"
        title="Toggle bulk selection mode"
      >
        {{ isInSelectionMode ? '☑️ Exit Selection' : '☐ Bulk Select' }}
      </button>
    </div>

    <div class="tag-cloud">
      <div
        v-for="module in modules"
        :key="module.id"
        class="tag"
        :class="{ selected: selectedModules.includes(module.id) }"
        @click="$emit('toggle-module', module.id)"
      >
        {{ module.name }} ({{ getModuleFeatureCount(module.id) }})
      </div>
    </div>

    <div class="grid">
      <div
        v-for="feature in features"
        :key="feature.id"
        :class="[
          'card',
          {
            'selection-mode': isInSelectionMode,
            'selected': isFeatureSelected(feature.id)
          }
        ]"
        @click="handleFeatureClick(feature, $event)"
        @keydown="handleKeyDown(feature.id, $event)"
        tabindex="0"
      >
        <div class="feature-card-header">
          <!-- Selection Checkbox -->
          <div class="selection-checkbox" v-if="isInSelectionMode">
            <input
              type="checkbox"
              :checked="isFeatureSelected(feature.id)"
              @change="toggleFeatureSelection(feature.id)"
              @click.stop
            />
          </div>

          <span class="badge feature">FEATURE</span>
          <span class="feature-card-id">#F-{{ feature.id }}</span>
        </div>
        <h3 class="feature-card-title">{{ feature.title }}</h3>
        <p class="feature-card-description">{{ feature.description }}</p>
        <div class="feature-card-section">
          <strong class="feature-card-label">Module:</strong>
          {{ getModuleName(feature.moduleId) }}
        </div>
        <div class="feature-card-section" v-if="feature.acceptanceCriteria">
          <strong class="feature-card-label">Acceptance Criteria:</strong>
          <ul class="feature-card-acceptance-list">
            <li v-for="(criteria, index) in feature.acceptanceCriteria" :key="index">
              {{ criteria }}
            </li>
          </ul>
        </div>
        <div class="feature-card-footer">
          <span :class="['badge', 'feature-status', featureStatusClass(feature.status)]">
            {{ feature.status }}
          </span>
          <div class="feature-card-meta">
            <div class="feature-card-meta-row">
              Priority: {{ feature.priority }}
            </div>
            <div class="feature-card-meta-row">
              Votes: {{ feature.votes }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { useBulkOperations } from '../composables/bulkOperationsManager.js';

export default {
  name: 'FeaturesTab',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    features: {
      type: Array,
      default: () => []
    },
    modules: {
      type: Array,
      default: () => []
    },
    selectedModules: {
      type: Array,
      default: () => []
    },
    filter: {
      type: Object,
      default: () => ({ module: '', status: '' })
    },
    getModuleFeatureCount: {
      type: Function,
      required: true
    },
    getModuleName: {
      type: Function,
      required: true
    }
  },
  emits: ['create', 'report', 'toggle-module', 'update:filter'],
  setup() {
    return useBulkOperations();
  },
  data() {
    return {
      localFilter: { ...this.filter }
    };
  },
  methods: {
    featureStatusClass(status) {
      if (!status) {
        return 'feature-status-unknown';
      }

      const normalized = String(status)
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-');

      return normalized ? `feature-status-${normalized}` : 'feature-status-unknown';
    },
    handleFeatureClick(feature, event) {
      if (this.isInSelectionMode) {
        event.preventDefault();
        this.handleKeyboardSelection(event, feature.id, 'feature');
      }
      // Normal feature click behavior would go here
    },
    handleKeyDown(featureId, event) {
      if (this.isInSelectionMode) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          this.toggleFeatureSelection(featureId);
        }
      }
    }
  },
  watch: {
    filter: {
      deep: true,
      handler(newValue) {
        this.localFilter = { ...newValue };
      }
    },
    localFilter: {
      deep: true,
      handler(newValue) {
        this.$emit('update:filter', newValue);
      }
    }
  }
};
</script>
