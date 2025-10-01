<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn" type="button" @click="$emit('layout', 'breadthfirst')">📊 Tree</button>
      <button class="btn" type="button" @click="$emit('layout', 'circle')">⭕ Circle</button>
      <button class="btn" type="button" @click="$emit('layout', 'cose')">🌐 Force</button>
      <button class="btn secondary" type="button" @click="$emit('detect')">🔍 Detect</button>
      <button class="btn feature" type="button" @click="$emit('analyze')">📈 Analyze</button>
      <button class="btn doc" type="button" @click="$emit('export')">💾 Export</button>
    </div>
    <div id="canvas-container"></div>
  </div>
</template>

<script>
export default {
  name: 'CanvasTab',
  props: {
    active: {
      type: Boolean,
      default: false
    }
  },
  emits: ['layout', 'detect', 'analyze', 'export']
};
</script>
