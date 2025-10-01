<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn" type="button" @click="forwardGenerateDiagram('architecture')">🏗️ Architecture</button>
      <button class="btn" type="button" @click="forwardGenerateDiagram('flow')">🔄 Flow</button>
      <button class="btn" type="button" @click="forwardGenerateDiagram('sequence')">📋 Sequence</button>
      <button class="btn" type="button" @click="forwardGenerateDiagram('entity')">🗂️ Entity</button>
      <button class="btn secondary" type="button" @click="forwardGenerateFromModules">📦 From Modules</button>
    </div>

    <div class="mermaid-container">
      <div id="mermaid-output"></div>
    </div>

    <div v-if="mermaidError" class="diagram-status diagram-status--error" role="alert">
      <strong>Mermaid Error</strong>
      <span>{{ mermaidError }}</span>
    </div>

    <textarea
      :value="mermaidCode"
      style="width: 100%; min-height: 200px; margin-top: 1rem;"
      placeholder="Mermaid code..."
      @input="onMermaidInput($event.target.value)"
    ></textarea>
    <button class="btn" type="button" @click="forwardRenderMermaid">Render Diagram</button>
  </div>
</template>

<script>
export default {
  name: 'DiagramsTab',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    mermaidCode: {
      type: String,
      default: ''
    },
    generateDiagram: {
      type: Function,
      default: null
    },
    generateFromModules: {
      type: Function,
      default: null
    },
    renderMermaid: {
      type: Function,
      default: null
    },
    updateMermaidCode: {
      type: Function,
      default: null
    },
    mermaidError: {
      type: String,
      default: ''
    }
  },
  watch: {
    active(newValue) {
      if (newValue && this.mermaidCode && typeof this.renderMermaid === 'function') {
        this.renderMermaid();
      }
    }
  },
  methods: {
    forwardGenerateDiagram(type) {
      if (typeof this.generateDiagram === 'function') {
        this.generateDiagram(type);
      }
    },
    forwardGenerateFromModules() {
      if (typeof this.generateFromModules === 'function') {
        this.generateFromModules();
      }
    },
    forwardRenderMermaid() {
      if (typeof this.renderMermaid === 'function') {
        this.renderMermaid();
      }
    },
    onMermaidInput(value) {
      if (typeof this.updateMermaidCode === 'function') {
        this.updateMermaidCode(value);
      }
    }
  }
};
</script>
