<template>
  <div class="docs-viewer">
    <p v-if="docGenerationError" class="form-error">{{ docGenerationError }}</p>
    <p v-if="runbookGenerationError" class="form-error">{{ runbookGenerationError }}</p>
    <div v-if="docGenerating" class="doc-status">Generating documentation...</div>

    <div class="card">
      <h2 class="doc-card-title">{{ docTitle }}</h2>
      <div v-html="generatedDocs"></div>
    </div>

    <div class="card doc-export-card" v-if="latestDoc">
      <div class="doc-export-header">
        <h2>Documentation Export</h2>
        <span class="doc-filename">{{ latestDoc.filename }}</span>
      </div>
      <div class="doc-meta">
        <span><strong>Workspace:</strong> {{ latestDoc.relativePath || latestDoc.path }}</span>
        <span v-if="latestDoc.format"><strong>Format:</strong> {{ latestDoc.format }}</span>
      </div>
      <div v-if="latestDocHtml" class="doc-preview doc-preview-html" v-html="latestDocHtml"></div>
      <pre v-else class="doc-preview">{{ fallbackDocText }}</pre>
    </div>

    <div class="card runbook-card" v-if="latestRunbook">
      <div class="runbook-card-header">
        <h2>Operational Runbook</h2>
        <span class="runbook-filename">{{ latestRunbook.filename }}</span>
      </div>
      <div class="runbook-meta">
        <span><strong>Workspace:</strong> {{ latestRunbook.workspacePath }}</span>
        <span><strong>Export:</strong> {{ latestRunbook.specRelativePath }}</span>
      </div>
      <div v-if="runbookMessages && runbookMessages.length" class="runbook-messages">
        <h4>Interview Notes</h4>
        <ul>
          <li v-for="(message, index) in runbookMessages" :key="'runbook-msg-' + index">{{ message }}</li>
        </ul>
      </div>
      <div class="runbook-preview" v-html="latestRunbookHtml || latestRunbookContent"></div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DocsViewer',
  props: {
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
    latestDoc: {
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
    }
  },
  computed: {
    fallbackDocText() {
      if (this.latestDocContent) return this.latestDocContent;
      if (this.latestDoc && this.latestDoc.content) return this.latestDoc.content;
      return 'Documentation file created.';
    }
  }
};
</script>
