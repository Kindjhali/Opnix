<template>
  <nav class="breadcrumb-navigation" aria-label="Breadcrumb navigation">
    <ol class="breadcrumb-list">
      <li
        v-for="(crumb, index) in breadcrumbs"
        :key="crumb.id"
        class="breadcrumb-item"
        :class="{ 'is-current': index === breadcrumbs.length - 1 }"
      >
        <button
          v-if="index < breadcrumbs.length - 1"
          type="button"
          class="breadcrumb-link"
          :aria-label="`Navigate to ${crumb.label}`"
          @click="navigateToPath(crumb.path)"
        >
          <span class="breadcrumb-icon" aria-hidden="true">{{ crumb.icon }}</span>
          <span class="breadcrumb-label">{{ crumb.label }}</span>
          <span v-if="crumb.metadata" class="breadcrumb-metadata">{{ crumb.metadata }}</span>
        </button>
        <span
          v-else
          class="breadcrumb-current"
          :aria-current="'page'"
        >
          <span class="breadcrumb-icon" aria-hidden="true">{{ crumb.icon }}</span>
          <span class="breadcrumb-label">{{ crumb.label }}</span>
          <span v-if="crumb.metadata" class="breadcrumb-metadata">{{ crumb.metadata }}</span>
        </span>
        <span
          v-if="index < breadcrumbs.length - 1"
          class="breadcrumb-separator"
          aria-hidden="true"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
            <path d="M6 3l5 5-5 5" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
        </span>
      </li>
    </ol>
  </nav>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'BreadcrumbNavigation',
  props: {
    activeTab: {
      type: String,
      required: true
    },
    mainTabs: {
      type: Array,
      required: true
    },
    contextStatus: {
      type: Object,
      default: () => ({})
    },
    branchStatus: {
      type: Object,
      default: () => ({})
    },
    currentSessionId: {
      type: String,
      default: null
    },
    currentTaskId: {
      type: String,
      default: null
    },
    currentModule: {
      type: Object,
      default: null
    },
    currentTicket: {
      type: Object,
      default: null
    },
    currentFeature: {
      type: Object,
      default: null
    }
  },
  emits: ['navigate'],
  setup(props, { emit }) {
    const breadcrumbs = computed(() => {
      const crumbs = [
        {
          id: 'root',
          label: 'Opnix',
          icon: '⚡',
          path: '/',
          metadata: props.branchStatus?.name ? `(${props.branchStatus.name})` : null
        }
      ];

      // Add current tab
      const currentTab = props.mainTabs.find(tab => tab.id === props.activeTab);
      if (currentTab) {
        const tabCrumb = {
          id: currentTab.id,
          label: currentTab.label,
          icon: currentTab.icon,
          path: `/${currentTab.id}`,
          metadata: null
        };

        // Add context-specific metadata
        if (props.activeTab === 'canvas' && props.currentModule) {
          tabCrumb.metadata = `(${props.currentModule.name})`;
        } else if (props.activeTab === 'bugs' && props.currentTicket) {
          tabCrumb.metadata = `(#${props.currentTicket.id})`;
        } else if (props.activeTab === 'features' && props.currentFeature) {
          tabCrumb.metadata = `(${props.currentFeature.title})`;
        } else if (props.contextStatus?.currentTask) {
          tabCrumb.metadata = `(${props.contextStatus.currentTask})`;
        }

        crumbs.push(tabCrumb);
      }

      // Add session-specific breadcrumb if available
      if (props.currentSessionId) {
        crumbs.push({
          id: 'session',
          label: 'Session',
          icon: '🔗',
          path: `/session/${props.currentSessionId}`,
          metadata: props.currentSessionId.slice(-6)
        });
      }

      // Add task-specific breadcrumb if available
      if (props.currentTaskId) {
        crumbs.push({
          id: 'task',
          label: 'Task',
          icon: '📋',
          path: `/task/${props.currentTaskId}`,
          metadata: props.currentTaskId.slice(-6)
        });
      }

      return crumbs;
    });

    const navigateToPath = (path) => {
      emit('navigate', path);
    };

    return {
      breadcrumbs,
      navigateToPath
    };
  }
};
</script>