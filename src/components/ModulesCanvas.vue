<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn" type="button" @click="$emit('create')">+ Add Module</button>
      <button class="btn secondary" type="button" @click="$emit('detect')">🔍 Auto-Detect</button>
      <button class="btn doc" type="button" @click="$emit('analyze-dependencies')">📊 Analyze Dependencies</button>
    </div>

    <div
      v-if="summary && summary.moduleCount"
      class="card modules-summary-card"
    >
      <div>
        <h3 class="modules-summary-heading">Detection Summary</h3>
        <div class="modules-summary-subtitle">Based on live filesystem scan</div>
      </div>
      <div class="modules-summary-metrics">
        <SummaryMetric label="Modules" :value="summary.moduleCount" variant="accent-blue" />
        <SummaryMetric label="Links" :value="summary.dependencyCount" variant="accent-orange" />
        <SummaryMetric label="External" :value="summary.externalDependencyCount" variant="accent-cyan" />
        <SummaryMetric label="Lines" :value="summary.totalLines" variant="accent-pink" />
      </div>
    </div>

    <div class="grid">
      <article v-for="module in modules" :key="module.id" class="module-card">
        <header class="module-header">
          <div class="module-name">{{ module.name }}</div>
          <div class="module-health" :class="moduleHealthClass(module.health)"></div>
        </header>

        <section class="module-stats">
          <SummaryMetric label="Bugs" :value="getModuleBugCount(module.id)" />
          <SummaryMetric label="Features" :value="getModuleFeatureCount(module.id)" />
          <SummaryMetric label="Health" :value="`${module.health}%`" />
        </section>

        <ModuleListSection title="Dependencies" :items="module.dependencies" />

        <ModuleListSection
          v-if="module.externalDependencies && module.externalDependencies.length"
          title="External Packages"
          :items="module.externalDependencies"
          item-class="external"
        />

        <ModuleListSection
          v-if="module.pathHints && module.pathHints.length"
          title="Paths"
          :items="module.pathHints"
          item-class="path"
        />

        <footer class="module-action-footer">
          <button class="btn module-action-button" type="button" @click="$emit('analyze', module)">
            Analyze Module
          </button>
        </footer>
      </article>
    </div>
  </div>
</template>

<script>
const SummaryMetric = {
  name: 'SummaryMetric',
  props: {
    label: {
      type: String,
      required: true
    },
    value: {
      type: [String, Number],
      required: true
    },
    variant: {
      type: String,
      default: 'default'
    }
  },
  computed: {
    variantClass() {
      return this.variant ? `summary-metric--${this.variant}` : 'summary-metric--default';
    }
  },
  template: `
    <div :class="['summary-metric', variantClass]">
      <div class="summary-metric-value">{{ value }}</div>
      <div class="summary-metric-label">{{ label }}</div>
    </div>
  `
};

const ModuleListSection = {
  name: 'ModuleListSection',
  props: {
    title: {
      type: String,
      required: true
    },
    items: {
      type: Array,
      default: () => []
    },
    itemClass: {
      type: String,
      default: ''
    }
  },
  template: `
    <section class="module-dependencies">
      <div class="module-section-heading">
        {{ title }} ({{ (items || []).length }}):
      </div>
      <div>
        <span
          v-for="item in items || []"
          :key="item"
          class="dependency-item"
          :class="itemClass"
        >
          {{ item }}
        </span>
      </div>
    </section>
  `
};

export default {
  name: 'ModulesCanvas',
  components: {
    SummaryMetric,
    ModuleListSection
  },
  props: {
    active: {
      type: Boolean,
      default: false
    },
    modules: {
      type: Array,
      default: () => []
    },
    summary: {
      type: Object,
      default: null
    },
    getModuleBugCount: {
      type: Function,
      required: true
    },
    getModuleFeatureCount: {
      type: Function,
      required: true
    }
  },
  methods: {
    moduleHealthClass(value) {
      const numeric = Number(value);

      if (!Number.isFinite(numeric)) {
        return 'module-health--warning';
      }

      if (numeric >= 80) {
        return 'module-health--strong';
      }

      if (numeric >= 60) {
        return 'module-health--warning';
      }

      return 'module-health--critical';
    }
  },
  emits: ['create', 'detect', 'analyze', 'analyze-dependencies']
};
</script>
