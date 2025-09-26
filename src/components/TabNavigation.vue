<template>
  <div class="tabs">
    <div
      v-for="tab in app.mainTabs"
      :key="tab.id"
      class="tab"
      :class="{ active: app.activeTab === tab.id }"
      @click="app.setTab(tab.id)"
    >
      <span class="tab-icon">{{ tab.icon }}</span>
      <span class="tab-label">{{ tab.label }}</span>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TabNavigation',
  props: {
    app: {
      type: Object,
      required: true
    }
  }
};
</script>
