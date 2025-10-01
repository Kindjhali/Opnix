<template>
  <div class="progress-indicator" :class="{ 'compact': compact, [`variant-${variant}`]: variant }">
    <div v-if="showHeader" class="progress-header">
      <h3 class="progress-title">{{ title }}</h3>
      <div class="progress-summary">
        <span class="progress-percentage" :aria-label="`${progressPercentage}% complete`">
          {{ progressPercentage }}%
        </span>
        <span class="progress-fraction">{{ completedSteps }}/{{ totalSteps }}</span>
      </div>
    </div>

    <div
      class="progress-bar-container"
      role="progressbar"
      :aria-valuenow="progressPercentage"
      :aria-valuemin="0"
      :aria-valuemax="100"
      :aria-label="`Progress: ${progressPercentage}% complete`"
    >
      <div class="progress-bar-track">
        <div
          class="progress-bar-fill"
          :style="{ width: `${progressPercentage}%` }"
          :class="progressBarClass"
        ></div>
      </div>
    </div>

    <div v-if="showSteps && steps.length > 0" class="progress-steps">
      <div
        v-for="(step, index) in steps"
        :key="step.id || index"
        class="progress-step"
        :class="{
          'completed': step.status === 'completed' || step.status === 'finished',
          'in-progress': step.status === 'inProgress' || step.status === 'active',
          'pending': step.status === 'pending' || step.status === 'reported',
          'blocked': step.status === 'blocked',
          'error': step.status === 'error'
        }"
      >
        <div class="step-marker">
          <span
            v-if="step.status === 'completed' || step.status === 'finished'"
            class="step-checkmark"
            aria-hidden="true"
          >✓</span>
          <span
            v-else-if="step.status === 'inProgress' || step.status === 'active'"
            class="step-spinner"
            aria-hidden="true"
          >◐</span>
          <span
            v-else-if="step.status === 'blocked'"
            class="step-blocked"
            aria-hidden="true"
          >⚠</span>
          <span
            v-else-if="step.status === 'error'"
            class="step-error"
            aria-hidden="true"
          >✗</span>
          <span
            v-else
            class="step-number"
            aria-hidden="true"
          >{{ index + 1 }}</span>
        </div>
        <div class="step-content">
          <div class="step-title">{{ step.title || step.name || `Step ${index + 1}` }}</div>
          <div v-if="step.description" class="step-description">{{ step.description }}</div>
          <div v-if="step.metadata" class="step-metadata">
            <span v-if="step.metadata.assignee" class="step-assignee">{{ step.metadata.assignee }}</span>
            <span v-if="step.metadata.priority" class="step-priority priority-{{ step.metadata.priority }}">
              {{ step.metadata.priority }}
            </span>
            <span v-if="step.metadata.dueDate" class="step-due-date">Due: {{ formatDate(step.metadata.dueDate) }}</span>
          </div>
        </div>
      </div>
    </div>

    <div v-if="showSummary" class="progress-summary-detailed">
      <div class="summary-stats">
        <div class="stat-item">
          <span class="stat-label">Completed</span>
          <span class="stat-value completed">{{ completedSteps }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">In Progress</span>
          <span class="stat-value in-progress">{{ inProgressSteps }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">Pending</span>
          <span class="stat-value pending">{{ pendingSteps }}</span>
        </div>
        <div v-if="blockedSteps > 0" class="stat-item">
          <span class="stat-label">Blocked</span>
          <span class="stat-value blocked">{{ blockedSteps }}</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
import { computed } from 'vue';

export default {
  name: 'ProgressIndicator',
  props: {
    title: {
      type: String,
      default: 'Progress'
    },
    steps: {
      type: Array,
      default: () => []
    },
    compact: {
      type: Boolean,
      default: false
    },
    variant: {
      type: String,
      default: 'default', // 'default', 'minimal', 'detailed'
      validator: (value) => ['default', 'minimal', 'detailed'].includes(value)
    },
    showHeader: {
      type: Boolean,
      default: true
    },
    showSteps: {
      type: Boolean,
      default: true
    },
    showSummary: {
      type: Boolean,
      default: false
    },
    overrideProgress: {
      type: Number,
      default: null,
      validator: (value) => value === null || (value >= 0 && value <= 100)
    }
  },
  setup(props) {
    const completedSteps = computed(() => {
      return props.steps.filter(step =>
        step.status === 'completed' || step.status === 'finished'
      ).length;
    });

    const inProgressSteps = computed(() => {
      return props.steps.filter(step =>
        step.status === 'inProgress' || step.status === 'active'
      ).length;
    });

    const pendingSteps = computed(() => {
      return props.steps.filter(step =>
        step.status === 'pending' || step.status === 'reported'
      ).length;
    });

    const blockedSteps = computed(() => {
      return props.steps.filter(step =>
        step.status === 'blocked' || step.status === 'error'
      ).length;
    });

    const totalSteps = computed(() => {
      return props.steps.length;
    });

    const progressPercentage = computed(() => {
      if (props.overrideProgress !== null) {
        return Math.round(props.overrideProgress);
      }
      if (totalSteps.value === 0) return 0;
      return Math.round((completedSteps.value / totalSteps.value) * 100);
    });

    const progressBarClass = computed(() => {
      const percentage = progressPercentage.value;
      if (percentage === 100) return 'completed';
      if (percentage >= 75) return 'high';
      if (percentage >= 50) return 'medium';
      if (percentage >= 25) return 'low';
      return 'minimal';
    });

    const formatDate = (dateString) => {
      try {
        return new Date(dateString).toLocaleDateString();
      } catch {
        return dateString;
      }
    };

    return {
      completedSteps,
      inProgressSteps,
      pendingSteps,
      blockedSteps,
      totalSteps,
      progressPercentage,
      progressBarClass,
      formatDate
    };
  }
};
</script>