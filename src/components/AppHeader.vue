<template>
  <header class="header">
    <div class="theme-switcher">
      <button
        class="theme-btn"
        :class="{ active: app.currentTheme === 'mole' }"
        type="button"
        @click="app.setTheme('mole')"
      >
        MOLE
      </button>
      <button
        class="theme-btn"
        :class="{ active: app.currentTheme === 'canyon' }"
        type="button"
        @click="app.setTheme('canyon')"
      >
        CANYON
      </button>
    </div>
    <h1>OTKIT</h1>
    <p class="subtitle">OPERATIONAL TOOLKIT // v1.0</p>
  </header>
</template>

<script>
export default {
  name: 'AppHeader',
  props: {
    app: {
      type: Object,
      required: true
    }
  }
};
</script>
