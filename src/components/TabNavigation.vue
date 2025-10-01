<template>
  <nav class="tab-navigation tabs icon-tabs" aria-label="Main surfaces">
    <button
      v-for="tab in enhancedTabs"
      :key="tab.id"
      type="button"
      class="tab"
      :class="{
        active: activeTab === tab.id,
        'has-status': tab.status,
        [`status-${tab.status}`]: tab.status
      }"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      :title="`${tab.label}${tab.statusText ? ` - ${tab.statusText}` : ''}`"
      @click="emitSelect(tab.id)"
    >
      <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      <span class="tab-label" aria-hidden="true">{{ tab.label }}</span>
      <span class="sr-only">{{ tab.label }}{{ tab.statusText ? ` - ${tab.statusText}` : '' }}</span>
    </button>
  </nav>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'TabNavigation',
  props: {
    mainTabs: {
      type: Array,
      required: true
    },
    activeTab: {
      type: String,
      required: true
    },
    stats: {
      type: Object,
      default: () => ({})
    },
    branchStatus: {
      type: Object,
      default: () => ({})
    },
    contextStatus: {
      type: Object,
      default: () => ({})
    },
    terminalRunning: {
      type: Boolean,
      default: false
    },
    terminalError: {
      type: String,
      default: ''
    }
  },
  emits: ['select-tab'],
  setup(props) {
    const enhancedTabs = computed(() => {
      return props.mainTabs.map(tab => {
        const enhanced = { ...tab };

        // Add status indicators based on tab type and app state
        switch (tab.id) {
          case 'bugs':
            if (props.stats?.open > 0) {
              enhanced.status = 'pending';
              enhanced.statusText = `${props.stats.open} open tickets`;
            } else if (props.stats?.finished > 0) {
              enhanced.status = 'active';
              enhanced.statusText = 'All tickets resolved';
            }
            break;

          case 'features':
            if (props.stats?.inProgress > 0) {
              enhanced.status = 'pending';
              enhanced.statusText = `${props.stats.inProgress} in progress`;
            }
            break;

          case 'canvas':
            if (props.branchStatus?.dirty) {
              enhanced.status = 'pending';
              enhanced.statusText = 'Uncommitted changes';
            } else if (props.branchStatus?.ahead > 0) {
              enhanced.status = 'active';
              enhanced.statusText = `${props.branchStatus.ahead} commits ahead`;
            }
            break;

          case 'docs':
            if (props.contextStatus?.currentTask && props.contextStatus.currentTask !== 'System Ready') {
              enhanced.status = 'active';
              enhanced.statusText = props.contextStatus.currentTask;
            }
            break;

          case 'api':
            if (props.terminalError) {
              enhanced.status = 'error';
              enhanced.statusText = 'Terminal error';
            } else if (props.terminalRunning) {
              enhanced.status = 'active';
              enhanced.statusText = 'Command running';
            }
            break;

          case 'roadmap':
            if (props.contextStatus?.percentage > 80) {
              enhanced.status = 'pending';
              enhanced.statusText = 'Context usage high';
            }
            break;
        }

        return enhanced;
      });
    });

    return {
      enhancedTabs
    };
  },
  methods: {
    emitSelect(tabId) {
      this.$emit('select-tab', tabId);
    }
  }
};
</script>
