<template>
  <section class="tab-content-router">
    <CanvasTab
      v-if="activeTab === 'canvas'"
      :active="canvasProps.active"
      @layout="canvasProps.onLayout"
      @detect="canvasProps.onDetect"
      @analyze="canvasProps.onAnalyze"
      @export="canvasProps.onExport"
    />

    <TicketsBoard
      v-else-if="activeTab === 'bugs'"
      :active="ticketsProps.active"
      :tickets="ticketsProps.tickets"
      :ticket-status-options="ticketsProps.ticketStatusOptions"
      :filter="ticketsProps.filter"
      @create="ticketsProps.onCreate"
      @analyze="ticketsProps.onAnalyze"
      @export="ticketsProps.onExport"
      @status-change="ticketsProps.onStatusChange"
      @update:filter="ticketsProps.onUpdateFilter"
    />

    <FeaturesTab
      v-else-if="activeTab === 'features'"
      :active="featuresProps.active"
      :features="featuresProps.features"
      :modules="featuresProps.modules"
      :selected-modules="featuresProps.selectedModules"
      :filter="featuresProps.filter"
      :get-module-feature-count="featuresProps.getModuleFeatureCount"
      :get-module-name="featuresProps.getModuleName"
      :get-feature-status-color="featuresProps.getFeatureStatusColor"
      @create="featuresProps.onCreate"
      @report="featuresProps.onReport"
      @toggle-module="featuresProps.onToggleModule"
      @update:filter="featuresProps.onUpdateFilter"
    />

    <ModulesCanvas
      v-else-if="activeTab === 'modules'"
      :active="modulesProps.active"
      :modules="modulesProps.modules"
      :summary="modulesProps.summary"
      :get-module-bug-count="modulesProps.getModuleBugCount"
      :get-module-feature-count="modulesProps.getModuleFeatureCount"
      :get-health-color="modulesProps.getHealthColor"
      @create="modulesProps.onCreate"
      @detect="modulesProps.onDetect"
      @analyze-dependencies="modulesProps.onAnalyzeDependencies"
      @analyze="modulesProps.onAnalyze"
    />

    <RoadmapTab
      v-else-if="activeTab === 'roadmap'"
      v-bind="roadmapProps"
    />

    <SpecsTab
      v-else-if="activeTab === 'specs'"
      :active="specsProps.active"
      :current-phase="specsProps.currentPhase"
      :questions="specsProps.questions"
      :export-format="specsProps.exportFormat"
      :generated-spec="specsProps.generatedSpec"
      :latest-spec-meta="specsProps.latestSpecMeta"
      :cli-sessions="specsProps.cliSessions"
      :cli-sessions-loading="specsProps.cliSessionsLoading"
      :cli-sessions-error="specsProps.cliSessionsError"
      :selected-session-id="specsProps.selectedSessionId"
      :session-details="specsProps.sessionDetails"
      :session-details-error="specsProps.sessionDetailsError"
      :cli-gate-log="specsProps.cliGateLog"
      :find-cli-question-prompt="specsProps.findCliQuestionPrompt"
      :format-cli-timestamp="specsProps.formatCliTimestamp"
      :format-cli-session-status="specsProps.formatCliSessionStatus"
      :format-gate-timestamp="specsProps.formatGateTimestamp"
      :format-gate-context="specsProps.formatGateContext"
      @update:export-format="specsProps.onUpdateExportFormat"
      @generate="specsProps.onGenerate"
      @refresh-sessions="specsProps.onRefreshSessions"
      @view-session="specsProps.onViewSession"
      @close-session="specsProps.onCloseSession"
      @answer="specsProps.onAnswer"
      @reload-questions="specsProps.onReloadQuestions"
    />

    <DiagramsTab
      v-else-if="activeTab === 'diagrams'"
      :active="diagramsProps.active"
      :mermaid-code="diagramsProps.mermaidCode"
      :generate-diagram="diagramsProps.generateDiagram"
      :generate-from-modules="diagramsProps.generateFromModules"
      :render-mermaid="diagramsProps.renderMermaid"
      :update-mermaid-code="diagramsProps.updateMermaidCode"
      :mermaid-error="diagramsProps.mermaidError"
    />

    <ApiTab
      v-else-if="activeTab === 'api'"
      :active="apiProps.active"
      :api-format="apiProps.apiFormat"
      :api-spec-content="apiProps.apiSpecContent"
      :api-spec-warnings="apiProps.apiSpecWarnings"
      @generate-api-spec="apiProps.onGenerateApiSpec"
      @export-api-spec="apiProps.onExportApiSpec"
      @test-api="apiProps.onTestApi"
      @update:api-format="apiProps.onUpdateApiFormat"
    />

    <StorybookFrame
      v-else-if="activeTab === 'storybook'"
      :active="storybookProps.active"
      :theme="storybookProps.theme"
      :status="storybookProps.status"
      :frame-version="storybookProps.frameVersion"
      :on-start="storybookProps.onStart"
      :on-refresh="storybookProps.onRefresh"
    />

    <DocsTab
      v-else-if="activeTab === 'docs'"
      :active="docsProps.active"
      :doc-type="docsProps.docType"
      :doc-title="docsProps.docTitle"
      :generated-docs="docsProps.generatedDocs"
      :runbook-generation-error="docsProps.runbookGenerationError"
      :latest-runbook="docsProps.latestRunbook"
      :latest-runbook-content="docsProps.latestRunbookContent"
      :latest-runbook-html="docsProps.latestRunbookHtml"
      :runbook-messages="docsProps.runbookMessages"
      :runbook-generating="docsProps.runbookGenerating"
      :runbook-interview-loading="docsProps.runbookInterviewLoading"
      @generate-docs="docsProps.onGenerateDocs"
      @export-docs="docsProps.onExportDocs"
      @update:doc-type="docsProps.onUpdateDocType"
      @start-runbook-interview="docsProps.onStartRunbookInterview"
      @quick-generate-runbook="docsProps.onQuickGenerateRunbook"
    />
  </section>
</template>

<script>
import CanvasTab from './CanvasTab.vue';
import TicketsBoard from './TicketsBoard.vue';
import FeaturesTab from './FeaturesTab.vue';
import ModulesCanvas from './ModulesCanvas.vue';
import RoadmapTab from './RoadmapTab.vue';
import SpecsTab from './SpecsTab.vue';
import DiagramsTab from './DiagramsTab.vue';
import ApiTab from './ApiTab.vue';
import StorybookFrame from './StorybookFrame.vue';
import DocsTab from './DocsTab.vue';

export default {
  name: 'TabContentRouter',
  components: {
    CanvasTab,
    TicketsBoard,
    FeaturesTab,
    ModulesCanvas,
    RoadmapTab,
    SpecsTab,
    DiagramsTab,
    ApiTab,
    StorybookFrame,
    DocsTab
  },
  props: {
    activeTab: {
      type: String,
      required: true
    },
    canvasProps: {
      type: Object,
      default: () => ({})
    },
    ticketsProps: {
      type: Object,
      default: () => ({})
    },
    featuresProps: {
      type: Object,
      default: () => ({})
    },
    modulesProps: {
      type: Object,
      default: () => ({})
    },
    roadmapProps: {
      type: Object,
      default: () => ({})
    },
    specsProps: {
      type: Object,
      default: () => ({})
    },
    diagramsProps: {
      type: Object,
      default: () => ({})
    },
    apiProps: {
      type: Object,
      default: () => ({})
    },
    storybookProps: {
      type: Object,
      default: () => ({})
    },
    docsProps: {
      type: Object,
      default: () => ({})
    }
  }
};
</script>
