<template>
  <div class="app-container">
    <AppHeader :current-theme="currentTheme" @set-theme="setTheme" />
    
    <WorkbenchStrip
      :claude-command="claudeCommand"
      :task-queue="taskQueue"
      :stats="stats"
      :ticket-progress="ticketProgress"
      :latest-audit="latestAudit"
      :terminal-history="terminalHistory"
      :terminal-command="terminalCommand"
      :terminal-working-directory="terminalWorkingDirectory"
      :terminal-loading="terminalLoading"
      :terminal-running="terminalRunning"
      :terminal-error="terminalError"
      :branch-status="branchStatus"
      :branch-status-loading="branchStatusLoading"
      :branch-status-error="branchStatusError"
      :context-status="contextStatus"
      :context-status-loading="contextStatusLoading"
      :context-status-error="contextStatusError"
      @update:claudeCommand="claudeCommand = $event"
      @execute-command="executeClaudeCommand"
      @clear-tasks="clearTaskQueue"
      @update:terminalCommand="terminalCommand = $event"
      @update:terminalWorkingDirectory="terminalWorkingDirectory = $event"
      @run-terminal-command="runTerminalCommand"
      @clear-terminal="clearTerminalHistory"
    />

    <TabNavigation
      :main-tabs="mainTabs"
      :active-tab="activeTab"
      @select-tab="setTab"
    />

    <TabContentRouter
      :active-tab="activeTab"
      :canvas-props="canvasProps"
      :tickets-props="ticketsProps"
      :features-props="featuresProps"
      :modules-props="modulesProps"
      :roadmap-props="roadmapProps"
      :specs-props="specsProps"
      :diagrams-props="diagramsProps"
      :api-props="apiProps"
      :storybook-props="storybookProps"
      :docs-props="docsProps"
    />



    <ModalsLayer
      :runbook-modal-active="runbookModalOpen"
      :runbook-interview-error="runbookInterviewError"
      :runbook-generating="runbookGenerating"
      :runbook-interview-loading="runbookInterviewLoading"
      :runbook-interview-submitting="runbookInterviewSubmitting"
      :runbook-history="runbookHistory"
      :runbook-current-question="runbookCurrentQuestion"
      :runbook-draft-answer="runbookDraftAnswer"
      :latest-runbook="latestRunbook"
      :bug-modal-active="showBugModal"
      :bug-draft="newBug"
      :modules="modules"
      :ticket-modal-active="showTicketCompletionModal"
      :ticket-completion-summary="ticketCompletionSummary"
      :ticket-completion-error="ticketCompletionError"
      :feature-modal-active="showFeatureModal"
      :feature-draft="newFeature"
      :add-module-modal-active="showAddModuleModal"
      :module-draft="newModule"
      @close-runbook="closeRunbookModal"
      @update-runbook-draft="updateRunbookDraft"
      @submit-runbook="submitRunbookAnswer"
      @skip-runbook="skipRunbookInterview"
      @close-bug="closeBugModal"
      @submit-bug="addBug"
      @update-bug="updateBugDraft"
      @cancel-ticket="cancelTicketCompletion"
      @confirm-ticket="confirmTicketCompletion"
      @update-ticket-summary="updateTicketCompletionSummary"
      @close-feature="closeFeatureModal"
      @submit-feature="addFeature"
      @update-feature="updateFeatureDraft"
      @close-add-module="closeAddModuleModal"
      @submit-add-module="addModule"
      @update-module-draft="updateModuleDraft"
    />

</div>
</template>

<script>
import appOptions from "./appOptions.js";
import AppHeader from "./components/AppHeader.vue";
import WorkbenchStrip from "./components/WorkbenchStrip.vue";
import TabNavigation from "./components/TabNavigation.vue";
import TabContentRouter from "./components/TabContentRouter.vue";
import ModalsLayer from "./components/ModalsLayer.vue";

export default {
  ...appOptions,
  components: {
    ...(appOptions.components || {}),
    AppHeader,
    WorkbenchStrip,
    TabNavigation,
    TabContentRouter,
    ModalsLayer
  }
};
</script>
