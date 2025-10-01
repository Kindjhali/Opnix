<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn" type="button" @click="forwardGenerateApiSpec">🔄 Generate API Spec</button>
      <select :value="apiFormat" @change="onFormatChange($event.target.value)">
        <option value="openapi">OpenAPI 3.0</option>
        <option value="custom">Custom Lightweight</option>
        <option value="json">JSON Schema</option>
      </select>
      <button class="btn secondary" type="button" @click="forwardExportApiSpec">📥 Export</button>
      <button class="btn feature" type="button" @click="forwardTestApi">🧪 Test Endpoints</button>
    </div>

    <div v-if="apiSpecWarnings && apiSpecWarnings.length" class="diagram-status diagram-status--warning" role="status">
      <strong>Warnings</strong>
      <ul class="api-warning-list">
        <li v-for="(warning, index) in apiSpecWarnings" :key="'api-warning-' + index">{{ warning }}</li>
      </ul>
    </div>

    <div class="api-spec">{{ apiSpecContent }}</div>
  </div>
</template>

<script>
export default {
  name: 'ApiTab',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    apiFormat: {
      type: String,
      default: 'openapi'
    },
    apiSpecContent: {
      type: String,
      default: ''
    },
    apiSpecWarnings: {
      type: Array,
      default: () => []
    },
    generateApiSpec: {
      type: Function,
      default: null
    },
    exportApiSpec: {
      type: Function,
      default: null
    },
    testApi: {
      type: Function,
      default: null
    },
    updateApiFormat: {
      type: Function,
      default: null
    }
  },
  methods: {
    forwardGenerateApiSpec() {
      if (typeof this.generateApiSpec === 'function') {
        this.generateApiSpec();
      }
    },
    forwardExportApiSpec() {
      if (typeof this.exportApiSpec === 'function') {
        this.exportApiSpec();
      }
    },
    forwardTestApi() {
      if (typeof this.testApi === 'function') {
        this.testApi();
      }
    },
    onFormatChange(value) {
      if (typeof this.updateApiFormat === 'function') {
        this.updateApiFormat(value);
      }
    }
  }
};
</script>
