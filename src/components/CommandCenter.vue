<template>
  <section class="command-center" aria-label="Command Center">
    <header class="command-header">
      <div class="command-title">
        <span class="command-icon" aria-hidden="true">⌘</span>
        <div>
          <h2>Command Center</h2>
          <p class="command-subtitle">Launch Claude workflows and track automation activity.</p>
        </div>
      </div>
      <div class="command-shortcuts" aria-hidden="true">
        <code>/spec</code>
        <code>/new-feature</code>
        <code>/runbook</code>
        <code>/run tests</code>
      </div>
    </header>

    <div class="command-input-row">
      <label class="command-input-label" for="claude-command-input">claude$</label>
      <input
        id="claude-command-input"
        class="command-input"
        type="text"
        v-model="commandValue"
        @keyup.enter="runCommand"
        :placeholder="placeholder"
        aria-label="Claude command"
      >
      <button class="command-execute" type="button" @click="runCommand">Execute</button>
    </div>

    <div class="task-queue" v-if="taskQueue.length">
      <div class="task-queue-header">
        <h3>Activity</h3>
        <button class="task-clear" type="button" @click="clearTasks" aria-label="Clear completed tasks">✕</button>
      </div>
      <ul class="task-list">
        <li v-for="task in taskQueue" :key="task.id" class="task-item">
          <span class="task-agent">{{ task.agent }}</span>
          <span class="task-description">{{ task.description }}</span>
          <span :class="['task-status', task.status]">{{ task.status }}</span>
        </li>
      </ul>
    </div>

    <StatuslinePanel
      :stats="stats"
      :ticket-progress="ticketProgress"
      :latest-audit="latestAudit"
    />
  </section>
</template>

<script>
import StatuslinePanel from './StatuslinePanel.vue';

export default {
  name: 'CommandCenter',
  components: {
    StatuslinePanel
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
      default: () => ({ open: 0, closed: 0, total: 0, openPct: 0, closedPct: 0, reported: 0, inProgress: 0, finished: 0 })
    },
    latestAudit: {
      type: Object,
      default: null
    },
    placeholder: {
      type: String,
      default: 'setup audit | analyze modules | detect dependencies | fix issue #123 | generate docs (auto --ultrathink)'
    },
    onExecute: {
      type: Function,
      default: null
    }
  },
  emits: ['update:claudeCommand'],
  computed: {
    commandValue: {
      get() {
        return this.claudeCommand;
      },
      set(value) {
        this.$emit('update:claudeCommand', value);
      }
    }
  },
  methods: {
    runCommand() {
      if (typeof this.onExecute === 'function') {
        this.onExecute();
      }
    },
    clearTasks() {
      this.$emit('clear-tasks');
    }
  }
};
</script>
