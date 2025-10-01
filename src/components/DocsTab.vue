<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn feature" type="button" @click="forwardStartRunbookInterview" :disabled="runbookBusy">🎯 Runbook Interview</button>
      <button class="btn doc" type="button" @click="forwardGenerateDocs" :disabled="docGenerating">📖 Generate Documentation</button>
      <button class="btn secondary" type="button" @click="forwardExportDocs" :disabled="docGenerating">📥 Export Markdown</button>
      <button class="btn secondary" type="button" @click="forwardQuickGenerateRunbook" :disabled="runbookBusy">⚡ Generate Runbook</button>
      <select :value="docType" @change="onDocTypeChange($event.target.value)">
        <option value="overview">Project Overview</option>
        <option value="modules">Module Documentation</option>
        <option value="api">API Documentation</option>
        <option value="features">Feature Specifications</option>
      </select>
    </div>

    <DocsViewer
      :doc-title="docTitle"
      :generated-docs="generatedDocs"
      :doc-generation-error="docGenerationError"
      :latest-doc="latestDocMeta"
      :latest-doc-content="latestDocContent"
      :latest-doc-html="latestDocHtml"
      :doc-generating="docGenerating"
      :runbook-generation-error="runbookGenerationError"
      :latest-runbook="latestRunbook"
      :latest-runbook-content="latestRunbookContent"
      :latest-runbook-html="latestRunbookHtml"
      :runbook-messages="runbookMessages"
    />
  </div>
</template>

<script>
import DocsViewer from './DocsViewer.vue';

export default {
  name: 'DocsTab',
  components: {
    DocsViewer
  },
  props: {
    active: {
      type: Boolean,
      default: false
    },
    docType: {
      type: String,
      default: 'overview'
    },
    docTitle: {
      type: String,
      default: 'Project Overview'
    },
    generatedDocs: {
      type: String,
      default: ''
    },
    docGenerationError: {
      type: String,
      default: ''
    },
    latestDocMeta: {
      type: Object,
      default: null
    },
    latestDocContent: {
      type: String,
      default: ''
    },
    latestDocHtml: {
      type: String,
      default: ''
    },
    docGenerating: {
      type: Boolean,
      default: false
    },
    runbookGenerationError: {
      type: String,
      default: ''
    },
    latestRunbook: {
      type: Object,
      default: null
    },
    latestRunbookContent: {
      type: String,
      default: ''
    },
    latestRunbookHtml: {
      type: String,
      default: ''
    },
    runbookMessages: {
      type: Array,
      default: () => []
    },
    generateDocs: {
      type: Function,
      default: null
    },
    exportDocs: {
      type: Function,
      default: null
    },
    updateDocType: {
      type: Function,
      default: null
    },
    startRunbookInterview: {
      type: Function,
      default: null
    },
    quickGenerateRunbook: {
      type: Function,
      default: null
    },
    runbookGenerating: {
      type: Boolean,
      default: false
    },
    runbookInterviewLoading: {
      type: Boolean,
      default: false
    }
  },
  computed: {
    runbookBusy() {
      return this.runbookGenerating || this.runbookInterviewLoading;
    }
  },
  methods: {
    async forwardGenerateDocs() {
      if (typeof this.generateDocs === 'function') {
        await this.generateDocs();
      }
    },
    forwardExportDocs() {
      if (typeof this.exportDocs === 'function') {
        this.exportDocs();
      }
    },
    onDocTypeChange(value) {
      if (typeof this.updateDocType === 'function') {
        this.updateDocType(value);
      }
    },
    forwardStartRunbookInterview() {
      if (typeof this.startRunbookInterview === 'function') {
        this.startRunbookInterview();
      }
    },
    forwardQuickGenerateRunbook() {
      if (typeof this.quickGenerateRunbook === 'function') {
        this.quickGenerateRunbook();
      }
    }
  }
};
</script>
