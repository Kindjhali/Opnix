<template>
  <section class="terminal-section" :class="{ active }">
    <header class="terminal-panel-header">
      <div class="terminal-header-meta">
        <h3 class="terminal-title">Terminal</h3>
        <div
          class="terminal-branch-indicator"
          :class="branchIndicatorClasses"
          role="status"
          :aria-label="branchStatusAriaLabel"
        >
          <span class="terminal-branch-icon" aria-hidden="true">git</span>
          <span class="terminal-branch-name">{{ branchLabel }}</span>
          <span v-if="branchStatusLoading" class="terminal-branch-badge" aria-hidden="true">syncing...</span>
          <template v-else>
            <span
              v-if="branchInfo.ahead"
              class="terminal-branch-badge branch-ahead"
              aria-label="Commits ahead"
            >+{{ branchInfo.ahead }}</span>
            <span
              v-if="branchInfo.behind"
              class="terminal-branch-badge branch-behind"
              aria-label="Commits behind"
            >-{{ branchInfo.behind }}</span>
            <span
              v-if="branchInfo.dirty && !branchInfo.notGitRepo"
              class="terminal-branch-badge"
              aria-label="Working tree has uncommitted changes"
            >*</span>
          </template>
        </div>
        <span v-if="branchUpdatedLabel" class="terminal-branch-updated">{{ branchUpdatedLabel }}</span>
        <span v-if="branchStatusError" class="terminal-branch-error" role="alert">{{ branchStatusError }}</span>
        <div
          class="terminal-progress-indicator"
          v-if="ticketProgress && totalTickets"
          role="status"
          :aria-label="progressAriaLabel"
        >
          <span class="terminal-progress-label">Tickets</span>
          <div class="terminal-progress-bar" aria-hidden="true">
            <span
              class="terminal-progress-open"
              :class="progressOpenClass"
            ></span>
          </div>
          <span class="terminal-progress-meta">{{ ticketProgress.open }} open · {{ ticketProgress.closed }} closed</span>
        </div>
        <div
          v-if="contextInfo.available"
          class="terminal-context-indicator"
          :class="contextIndicatorClasses"
          role="status"
          :aria-label="contextAriaLabel"
        >
          <span class="terminal-context-label">Context</span>
          <div class="terminal-context-bar" aria-hidden="true">
            <span class="terminal-context-fill" :class="contextBarClass"></span>
          </div>
          <span class="terminal-context-usage">{{ contextUsageLabel }}</span>
          <span v-if="contextStatusLoading" class="terminal-context-meta">syncing...</span>
          <span v-else-if="contextInfo.warning" class="terminal-context-meta warning">{{ contextInfo.warning }}</span>
        </div>
        <span
          v-if="contextInfo.available"
          class="terminal-files-indicator"
          role="status"
          :aria-label="filesEditedAriaLabel"
        >Files {{ contextInfo.filesEdited }}</span>
        <span v-if="contextStatusError" class="terminal-context-error" role="alert">{{ contextStatusError }}</span>
      </div>
      <div class="terminal-header-controls">
        <label>
          Working Directory
          <input
            class="terminal-cwd-input"
            type="text"
            :value="workingDirectory"
            @input="$emit('update:workingDirectory', $event.target.value)"
            placeholder="./"
          >
        </label>
        <button class="btn secondary" type="button" @click="$emit('clear')" :disabled="running">Clear</button>
      </div>
    </header>

    <div class="terminal-window">
      <div ref="logRef" class="terminal-log" :aria-busy="loading">
        <div v-if="loading" class="terminal-log-empty">Loading terminal history…</div>
        <div v-else-if="!history.length" class="terminal-log-empty">No terminal history yet. Run a command to get started.</div>
        <template v-else>
          <article v-for="entry in history" :key="entry.id" class="terminal-entry">
            <div class="terminal-line">
              <span class="terminal-prompt">{{ prompt(entry) }}</span>
              <span class="terminal-command-text">{{ entry.command }}</span>
            </div>
            <pre v-if="entry.stdout" class="terminal-output-block">{{ entry.stdout }}</pre>
            <pre v-if="entry.stderr" class="terminal-output-block terminal-output-error">{{ entry.stderr }}</pre>
            <div class="terminal-meta">
              <span>Exit: {{ entry.exitCode }}</span>
              <span>Dir: {{ entry.cwd }}</span>
              <span>Duration: {{ entry.durationMs }} ms</span>
              <span>Ran: {{ formatTimestamp(entry.ranAt) }}</span>
            </div>
          </article>
        </template>
      </div>

      <div class="terminal-input-shell">
        <span class="terminal-prompt">{{ promptIcon }}</span>
        <div
          class="terminal-input"
          contenteditable
          role="textbox"
          :data-placeholder="running ? 'Running command…' : 'Type a command and press Enter'"
          :aria-disabled="running"
          ref="inputRef"
          @keydown="handleKeydown"
          @input="onInput"
        ></div>
        <button class="terminal-run" type="button" @click="emitRun" :disabled="running || !localCommand">RUN</button>
      </div>

      <p v-if="error" class="terminal-error">{{ error }}</p>
    </div>
  </section>
</template>

<script>
export default {
  name: 'TerminalPanel',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    history: {
      type: Array,
      default: () => []
    },
    command: {
      type: String,
      default: ''
    },
    workingDirectory: {
      type: String,
      default: ''
    },
    loading: {
      type: Boolean,
      default: false
    },
    running: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    },
    branchStatus: {
      type: Object,
      default: () => ({})
    },
    branchStatusLoading: {
      type: Boolean,
      default: false
    },
    branchStatusError: {
      type: String,
      default: ''
    },
    ticketProgress: {
      type: Object,
      default: null
    },
    contextStatus: {
      type: Object,
      default: () => ({})
    },
    contextStatusLoading: {
      type: Boolean,
      default: false
    },
    contextStatusError: {
      type: String,
      default: ''
    }
  },
  emits: ['update:command', 'update:workingDirectory', 'run', 'clear'],
  data() {
    return {
      localCommand: this.command
    };
  },
  watch: {
    command(value) {
      if (value !== this.localCommand) {
        this.localCommand = value;
        this.syncInput();
      }
    },
    history() {
      this.$nextTick(() => {
        const el = this.$refs.logRef;
        if (el) {
          el.scrollTop = el.scrollHeight;
        }
      });
    }
  },
  computed: {
    promptIcon() {
      return this.running ? '…$' : 'claude$';
    },
    branchInfo() {
      const status = this.branchStatus || {};
      const parseCount = value => {
        const parsed = Number.parseInt(value, 10);
        return Number.isNaN(parsed) ? 0 : parsed;
      };
      return {
        label: status.notGitRepo ? 'No git repo' : (status.name || 'unknown'),
        ahead: parseCount(status.ahead),
        behind: parseCount(status.behind),
        dirty: Boolean(status.dirty),
        detached: Boolean(status.detached),
        notGitRepo: Boolean(status.notGitRepo),
        updatedAt: status.lastUpdated || status.timestamp || ''
      };
    },
    branchLabel() {
      if (this.branchStatusLoading) {
        return 'Refreshing branch';
      }
      const info = this.branchInfo;
      if (info.notGitRepo) return info.label;
      if (info.detached) return `${info.label} (detached)`;
      return info.label;
    },
    branchIndicatorClasses() {
      return {
        'is-dirty': this.branchInfo.dirty && !this.branchInfo.notGitRepo,
        'is-loading': this.branchStatusLoading
      };
    },
    branchUpdatedLabel() {
      const value = this.branchInfo.updatedAt;
      if (!value) return '';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return '';
      return `Updated ${date.toLocaleTimeString()}`;
    },
    branchStatusAriaLabel() {
      if (this.branchStatusError) {
        return `Branch status unavailable: ${this.branchStatusError}`;
      }
      if (this.branchStatusLoading) {
        return 'Refreshing branch status';
      }
      const info = this.branchInfo;
      const parts = [];
      if (info.notGitRepo) {
        parts.push('No git repository detected');
      } else {
        parts.push(`Branch ${info.label}`);
        if (info.detached) {
          parts.push('detached HEAD');
        }
        if (info.ahead) {
          parts.push(`${info.ahead} commits ahead`);
        }
        if (info.behind) {
          parts.push(`${info.behind} commits behind`);
        }
        if (info.dirty) {
          parts.push('working tree has uncommitted changes');
        }
      }
      return parts.length ? parts.join(', ') : 'Branch status ready';
    },
    totalTickets() {
      if (!this.ticketProgress) return 0;
      const { open = 0, closed = 0 } = this.ticketProgress;
      return open + closed;
    },
    progressAriaLabel() {
      if (!this.ticketProgress) return 'Ticket progress unavailable';
      const { open = 0, closed = 0, openPct = 0, closedPct = 0 } = this.ticketProgress;
      return `Ticket progress: ${open} open (${openPct}% open), ${closed} closed (${closedPct}% closed)`;
    },
    progressOpenClass() {
      if (!this.ticketProgress) return 'terminal-progress-open--pct-0';
      const pct = Number.isFinite(this.ticketProgress.openPct) ? this.ticketProgress.openPct : 0;
      const clamped = Math.max(0, Math.min(100, Math.round(pct)));
      return `terminal-progress-open--pct-${clamped}`;
    },
    contextInfo() {
      const status = this.contextStatus || {};
      const limit = Number(status.contextLimit) || 0;
      const used = Number(status.contextUsed) || 0;
      const remaining = Number(status.remaining);
      const percentage = typeof status.percentage === 'number'
        ? Math.max(0, Math.min(100, status.percentage))
        : (limit > 0 ? Math.max(0, Math.min(100, (used / limit) * 100)) : 0);
      const available = limit > 0 || Boolean(status.displayText);
      return {
        available,
        used,
        limit,
        remaining: Number.isFinite(remaining) ? remaining : Math.max(0, limit - used),
        percentage,
        warning: status.warning || '',
        currentTask: status.currentTask || '',
        filesEdited: Number(status.filesEdited) || 0,
        daicState: status.daicState || ''
      };
    },
    contextBarClass() {
      const pct = Math.max(0, Math.min(100, Math.round(this.contextInfo.percentage || 0)));
      return `terminal-context-fill--pct-${pct}`;
    },
    contextUsageLabel() {
      if (!this.contextInfo.available) {
        return 'Tracking disabled';
      }
      const limitK = this.contextInfo.limit ? Math.round(this.contextInfo.limit / 1000) : 0;
      const usedK = Math.round(this.contextInfo.used / 1000);
      if (!limitK) {
        return `${usedK}k used`;
      }
      return `${usedK}k / ${limitK}k`;
    },
    contextIndicatorClasses() {
      const pct = this.contextInfo.percentage;
      return {
        'is-warning': pct >= 75 && pct < 90,
        'is-critical': pct >= 90
      };
    },
    contextAriaLabel() {
      if (this.contextStatusError) {
        return `Context status unavailable: ${this.contextStatusError}`;
      }
      if (this.contextStatusLoading) {
        return 'Refreshing context usage';
      }
      if (!this.contextInfo.available) {
        return 'Context usage tracking disabled';
      }
      const parts = [];
      parts.push(`Context usage ${this.contextInfo.percentage.toFixed(1)} percent`);
      if (this.contextInfo.limit) {
        parts.push(`${Math.round(this.contextInfo.used / 1000)} thousand of ${Math.round(this.contextInfo.limit / 1000)} thousand tokens`);
      } else {
        parts.push(`${Math.round(this.contextInfo.used / 1000)} thousand tokens used`);
      }
      if (this.contextInfo.warning) {
        parts.push(this.contextInfo.warning);
      }
      if (this.contextInfo.currentTask) {
        parts.push(`Task ${this.contextInfo.currentTask}`);
      }
      if (this.contextInfo.daicState) {
        parts.push(`DAIC state ${this.contextInfo.daicState}`);
      }
      parts.push(`Files edited ${this.contextInfo.filesEdited}`);
      return parts.join(', ');
    },
    filesEditedAriaLabel() {
      if (!this.contextInfo.available) {
        return 'File edit tracking unavailable';
      }
      return `Files edited ${this.contextInfo.filesEdited}`;
    }
  },
  mounted() {
    this.syncInput();
  },
  methods: {
    prompt(entry) {
      return entry && entry.command ? 'claude$' : 'claude$';
    },
    formatTimestamp(value) {
      if (!value) return 'unknown';
      const date = new Date(value);
      if (Number.isNaN(date.getTime())) return value;
      return date.toLocaleTimeString();
    },
    syncInput() {
      const input = this.$refs.inputRef;
      if (input) {
        input.textContent = this.localCommand;
      }
    },
    onInput(event) {
      this.localCommand = event.target.textContent;
      this.$emit('update:command', this.localCommand);
    },
    handleKeydown(event) {
      if (this.running) {
        event.preventDefault();
        return;
      }
      if (event.key === 'Enter' && !event.shiftKey) {
        event.preventDefault();
        this.emitRun();
      }
    },
    emitRun() {
      if (!this.localCommand || this.running) return;
      this.$emit('run');
    }
  }
};
</script>
