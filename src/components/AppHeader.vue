<template>
  <header class="header">
    <div class="theme-switcher">
      <button
        class="theme-btn"
        :class="{ active: currentTheme === 'mole' }"
        type="button"
        @click="emitTheme('mole')"
      >
        MOLE
      </button>
      <button
        class="theme-btn"
        :class="{ active: currentTheme === 'canyon' }"
        type="button"
        @click="emitTheme('canyon')"
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
    currentTheme: {
      type: String,
      required: true
    }
  },
  emits: ['set-theme'],
  methods: {
    emitTheme(theme) {
      this.$emit('set-theme', theme);
    }
  }
};
</script>
