<template>
  <div class="roadmap-view-toggle" role="tablist" aria-label="Roadmap view selector">
    <button
      class="view-btn"
      type="button"
      :class="{ active: view === 'minimal' }"
      :aria-selected="view === 'minimal'"
      :disabled="disabled"
      @click="emitChange('minimal')"
    >
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      </span>
      <span class="label">Minimal</span>
    </button>

    <button
      class="view-btn"
      type="button"
      :class="{ active: view === 'detailed' }"
      :aria-selected="view === 'detailed'"
      :disabled="disabled"
      @click="emitChange('detailed')"
    >
      <span class="icon" aria-hidden="true">
        <svg viewBox="0 0 24 24">
          <rect x="3" y="4" width="18" height="2" />
          <rect x="3" y="10" width="18" height="2" />
          <rect x="3" y="16" width="18" height="2" />
        </svg>
      </span>
      <span class="label">Detailed</span>
    </button>
  </div>
</template>

<script>
export default {
  name: 'RoadmapViewToggle',
  props: {
    view: {
      type: String,
      required: true,
      validator: value => ['minimal', 'detailed'].includes(value)
    },
    disabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['change'],
  methods: {
    emitChange(mode) {
      if (this.disabled || mode === this.view) {
        return;
      }
      this.$emit('change', mode);
    }
  }
};
</script>
