<template>
  <nav class="tabs icon-tabs" aria-label="Main surfaces">
    <button
      v-for="tab in mainTabs"
      :key="tab.id"
      type="button"
      class="tab"
      :class="{ active: activeTab === tab.id }"
      :aria-current="activeTab === tab.id ? 'page' : undefined"
      :title="tab.label"
      @click="emitSelect(tab.id)"
    >
      <span class="tab-icon" aria-hidden="true">{{ tab.icon }}</span>
      <span class="tab-label" aria-hidden="true">{{ tab.label }}</span>
      <span class="sr-only">{{ tab.label }}</span>
    </button>
  </nav>
</template>

<script>
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
    }
  },
  emits: ['select-tab'],
  methods: {
    emitSelect(tabId) {
      this.$emit('select-tab', tabId);
    }
  }
};
</script>
