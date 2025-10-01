<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn" type="button" @click="$emit('create')">+ Add Module</button>
      <button class="btn secondary" type="button" @click="$emit('detect')">🔍 Auto-Detect</button>
      <button class="btn doc" type="button" @click="$emit('analyze-dependencies')">📊 Analyze Dependencies</button>
    </div>

    <div
      v-if="summary && summary.moduleCount"
      class="card" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 2rem; align-items: center;"
    >
      <div>
        <h3 style="color: var(--accent-cyan); margin-bottom: 0.5rem;">Detection Summary</h3>
        <div style="color: var(--text-muted); font-size: 0.9rem;">Based on live filesystem scan</div>
      </div>
      <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
        <SummaryMetric label="Modules" :value="summary.moduleCount" color="var(--accent-blue)" />
        <SummaryMetric label="Links" :value="summary.dependencyCount" color="var(--accent-orange)" />
        <SummaryMetric label="External" :value="summary.externalDependencyCount" color="var(--accent-cyan)" />
        <SummaryMetric label="Lines" :value="summary.totalLines" color="var(--accent-pink)" />
      </div>
    </div>

    <div class="grid">
      <article v-for="module in modules" :key="module.id" class="module-card">
        <header class="module-header">
          <div class="module-name">{{ module.name }}</div>
          <div class="module-health" :style="{ background: getHealthColor(module.health) }"></div>
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

        <footer style="margin-top: 1rem;">
          <button class="btn" style="width: 100%; padding: 0.5rem;" type="button" @click="$emit('analyze', module)">
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
    color: {
      type: String,
      default: 'var(--text-bright)'
    }
  },
  template: `
    <div>
      <div :style="{ fontSize: '1.8rem', color, fontWeight: 'bold' }">{{ value }}</div>
      <div style="text-transform: uppercase; font-size: 0.75rem; color: var(--text-muted);">{{ label }}</div>
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
      <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
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
    },
    getHealthColor: {
      type: Function,
      required: true
    }
  },
  emits: ['create', 'detect', 'analyze', 'analyze-dependencies']
};
</script>
