<template>
  <section class="workbench-strip">
    <CommandCenter
      :claude-command="claudeCommand"
      :task-queue="taskQueue"
      :stats="stats"
      :ticket-progress="ticketProgress"
      :latest-audit="latestAudit"
      @update:claudeCommand="$emit('update:claudeCommand', $event)"
      :on-execute="emitExecute"
      @clear-tasks="$emit('clear-tasks')"
    />

    <XTerminal />
  </section>
</template>

<script>
import CommandCenter from './CommandCenter.vue';
import XTerminal from './XTerminal.vue';

export default {
  name: 'WorkbenchStrip',
  components: {
    CommandCenter,
    XTerminal
  },
  props: {
    claudeCommand: {
      type: String,
      default: ''
    },
    taskQueue: {
      type: Array,
      default: () => []
    },
    stats: {
      type: Object,
      default: null
    },
    ticketProgress: {
      type: Object,
      default: () => ({})
    },
    latestAudit: {
      type: Object,
      default: null
    },
    terminalHistory: {
      type: Array,
      default: () => []
    },
    terminalCommand: {
      type: String,
      default: ''
    },
    terminalWorkingDirectory: {
      type: String,
      default: '.'
    },
    terminalLoading: Boolean,
    terminalRunning: Boolean,
    terminalError: {
      type: String,
      default: ''
    },
    branchStatus: {
      type: Object,
      default: () => ({})
    },
    branchStatusLoading: Boolean,
    branchStatusError: {
      type: String,
      default: ''
    },
    contextStatus: {
      type: Object,
      default: () => ({})
    },
    contextStatusLoading: Boolean,
    contextStatusError: {
      type: String,
      default: ''
    }
  },
  methods: {
    emitExecute() {
      this.$emit('execute-command');
    }
  }
};
</script>
