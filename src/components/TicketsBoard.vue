<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn danger" type="button" @click="$emit('create')">+ New Bug</button>
      <button class="btn secondary" type="button" @click="$emit('analyze')">🐍 Python Analysis</button>
      <select v-model="localFilter.priority">
        <option value="">All Priorities</option>
        <option value="high">High</option>
        <option value="medium">Medium</option>
        <option value="low">Low</option>
      </select>
      <select v-model="localFilter.status">
        <option value="">All Status</option>
        <option v-for="option in ticketStatusOptions" :key="option.value" :value="option.value">
          {{ option.label }}
        </option>
      </select>
      <button class="btn secondary" type="button" @click="$emit('export')">Export JSON</button>
    </div>

    <div class="grid ticket-grid">
      <article
        v-for="ticket in filtered"
        :key="ticket.id"
        :class="['ticket-card', { 'high-priority': ticket.priority === 'high' }]"
      >
        <div class="ticket-header">
          <span class="badge" :class="ticket.priority">{{ ticket.priority }}</span>
          <span class="ticket-id">#{{ ticket.id }}</span>
        </div>
        <h3 class="ticket-title">{{ ticket.title }}</h3>
        <p class="ticket-description">{{ ticket.description }}</p>
        <div class="ticket-modules">
          <span v-for="moduleId in ticket.modules" :key="moduleId" class="module-tag">
            {{ moduleId }}
          </span>
        </div>
        <div v-if="ticket.completionSummary" class="completion-summary">
          <strong>Completion Summary</strong>
          <p>{{ ticket.completionSummary }}</p>
        </div>
        <div class="ticket-status-row">
          <div class="ticket-status-control">
            <span class="badge" :class="ticket.status">{{ statusLabel(ticket.status) }}</span>
            <select class="status-select" :value="ticket.status" @change="$emit('status-change', ticket, $event)">
              <option v-for="option in ticketStatusOptions" :key="option.value" :value="option.value">
                {{ option.label }}
              </option>
            </select>
          </div>
          <span class="ticket-date">{{ formatDate(ticket.created) }}</span>
        </div>
      </article>
    </div>
  </div>
</template>

<script>
import { getTicketStatusLabel, formatTicketDate } from '../composables/ticketManager.js';

export default {
  name: 'TicketsBoard',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    tickets: {
      type: Array,
      default: () => []
    },
    ticketStatusOptions: {
      type: Array,
      default: () => []
    },
    filter: {
      type: Object,
      default: () => ({ priority: '', status: '' })
    }
  },
  emits: ['create', 'analyze', 'export', 'status-change', 'update:filter'],
  data() {
    return {
      localFilter: { ...this.filter }
    };
  },
  watch: {
    filter: {
      deep: true,
      handler(newFilter) {
        this.localFilter = { ...newFilter };
      }
    },
    localFilter: {
      deep: true,
      handler(newFilter) {
        this.$emit('update:filter', newFilter);
      }
    }
  },
  computed: {
    filtered() {
      return this.tickets
        .filter(ticket => {
          if (this.localFilter.priority && ticket.priority !== this.localFilter.priority) return false;
          if (this.localFilter.status && ticket.status !== this.localFilter.status) return false;
          return true;
        })
        .sort((a, b) => new Date(a.created) - new Date(b.created));
    }
  },
  methods: {
    statusLabel(status) {
      return getTicketStatusLabel(status);
    },
    formatDate(date) {
      return formatTicketDate(date);
    }
  }
};
</script>

<style scoped>
.ticket-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 1rem;
}

.ticket-id {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.ticket-title {
  color: var(--text-bright);
  margin-bottom: 0.5rem;
}

.ticket-description {
  margin-bottom: 1rem;
}

.ticket-modules {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-bottom: 1rem;
}

.ticket-status-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
}

.ticket-status-control {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.ticket-date {
  color: var(--text-muted);
  font-size: 0.8rem;
}

.completion-summary {
  margin-bottom: 1rem;
  padding: 0.75rem;
  border: 1px solid var(--accent-cyan);
  border-radius: 0.5rem;
  background: rgba(15, 182, 255, 0.08);
}
</style>
