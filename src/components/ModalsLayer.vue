<template>
  <div class="modals-layer" aria-live="polite">
    <RunbookModal
      :active="runbookModalActive"
      :interview-error="runbookInterviewError"
      :generating="runbookGenerating"
      :loading="runbookInterviewLoading"
      :submitting="runbookInterviewSubmitting"
      :history="runbookHistory"
      :current-question="runbookCurrentQuestion"
      :draft-answer="runbookDraftAnswer"
      :latest-runbook="latestRunbook"
      :skip-disabled="runbookGenerating"
      @close="$emit('close-runbook')"
      @update:draftAnswer="$emit('update-runbook-draft', $event)"
      @submit="$emit('submit-runbook')"
      @skip="$emit('skip-runbook')"
    />

    <BugModal
      :active="bugModalActive"
      :bug="bugDraft"
      :modules="modules"
      @close="$emit('close-bug')"
      @submit="$emit('submit-bug')"
      @update:bug="$emit('update-bug', $event)"
    />

    <TicketCompletionModal
      :active="ticketModalActive"
      :summary="ticketCompletionSummary"
      :error="ticketCompletionError"
      @cancel="$emit('cancel-ticket')"
      @confirm="$emit('confirm-ticket')"
      @update:summary="$emit('update-ticket-summary', $event)"
    />

    <FeatureModal
      :active="featureModalActive"
      :feature="featureDraft"
      :modules="modules"
      @close="$emit('close-feature')"
      @submit="$emit('submit-feature')"
      @update:feature="$emit('update-feature', $event)"
    />

    <AddModuleModal
      :active="addModuleModalActive"
      :module-draft="moduleDraft"
      @close="$emit('close-add-module')"
      @submit="$emit('submit-add-module')"
      @update:moduleDraft="$emit('update-module-draft', $event)"
    />
  </div>
</template>

<script>
import RunbookModal from './RunbookModal.vue';
import BugModal from './BugModal.vue';
import TicketCompletionModal from './TicketCompletionModal.vue';
import FeatureModal from './FeatureModal.vue';
import AddModuleModal from './AddModuleModal.vue';

export default {
  name: 'ModalsLayer',
  components: {
    RunbookModal,
    BugModal,
    TicketCompletionModal,
    FeatureModal,
    AddModuleModal
  },
  props: {
    runbookModalActive: Boolean,
    runbookInterviewError: {
      type: String,
      default: ''
    },
    runbookGenerating: Boolean,
    runbookInterviewLoading: Boolean,
    runbookInterviewSubmitting: Boolean,
    runbookHistory: {
      type: Array,
      default: () => []
    },
    runbookCurrentQuestion: {
      type: Object,
      default: null
    },
    runbookDraftAnswer: {
      type: String,
      default: ''
    },
    latestRunbook: {
      type: Object,
      default: null
    },
    bugModalActive: Boolean,
    bugDraft: {
      type: Object,
      default: () => ({})
    },
    modules: {
      type: Array,
      default: () => []
    },
    ticketModalActive: Boolean,
    ticketCompletionSummary: {
      type: String,
      default: ''
    },
    ticketCompletionError: {
      type: String,
      default: ''
    },
    featureModalActive: Boolean,
    featureDraft: {
      type: Object,
      default: () => ({})
    },
    addModuleModalActive: Boolean,
    moduleDraft: {
      type: Object,
      default: () => ({})
    }
  }
};
</script>
