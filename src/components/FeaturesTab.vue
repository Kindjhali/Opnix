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
      <div v-for="feature in features" :key="feature.id" class="card">
        <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
          <span class="badge feature">FEATURE</span>
          <span style="color: var(--text-muted);">#F-{{ feature.id }}</span>
        </div>
        <h3 style="color: var(--feature); margin-bottom: 0.5rem;">{{ feature.title }}</h3>
        <p style="margin-bottom: 1rem;">{{ feature.description }}</p>
        <div style="margin-bottom: 1rem;">
          <strong style="color: var(--accent-orange);">Module:</strong>
          {{ getModuleName(feature.moduleId) }}
        </div>
        <div style="margin-bottom: 1rem;" v-if="feature.acceptanceCriteria">
          <strong style="color: var(--accent-orange);">Acceptance Criteria:</strong>
          <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
            <li v-for="(criteria, index) in feature.acceptanceCriteria" :key="index">
              {{ criteria }}
            </li>
          </ul>
        </div>
        <div style="display: flex; justify-content: space-between;">
          <span class="badge" :style="{ background: getFeatureStatusColor(feature.status) }">
            {{ feature.status }}
          </span>
          <div style="text-align: right;">
            <div style="color: var(--text-muted); font-size: 0.8rem;">
              Priority: {{ feature.priority }}
            </div>
            <div style="color: var(--text-muted); font-size: 0.8rem;">
              Votes: {{ feature.votes }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
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
    },
    getFeatureStatusColor: {
      type: Function,
      required: true
    }
  },
  emits: ['create', 'report', 'toggle-module', 'update:filter'],
  data() {
    return {
      localFilter: { ...this.filter }
    };
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
