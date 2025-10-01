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

    <TerminalPanel
      :history="terminalHistory"
      :command="terminalCommand"
      :working-directory="terminalWorkingDirectory"
      :loading="terminalLoading"
      :running="terminalRunning"
      :error="terminalError"
      :branch-status="branchStatus"
      :branch-status-loading="branchStatusLoading"
      :branch-status-error="branchStatusError"
      :ticket-progress="ticketProgress"
      :context-status="contextStatus"
      :context-status-loading="contextStatusLoading"
      :context-status-error="contextStatusError"
      @update:command="$emit('update:terminalCommand', $event)"
      @update:workingDirectory="$emit('update:terminalWorkingDirectory', $event)"
      @run="$emit('run-terminal-command')"
      @clear="$emit('clear-terminal')"
    />
  </section>
</template>

<script>
import CommandCenter from './CommandCenter.vue';
import TerminalPanel from './TerminalPanel.vue';

export default {
  name: 'WorkbenchStrip',
  components: {
    CommandCenter,
    TerminalPanel
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
