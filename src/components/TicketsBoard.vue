<template>
  <div class="tab-content tickets-board" :class="{ active }">
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

      <!-- Bulk Operations Toggle -->
      <button
        class="btn bulk-toggle"
        :class="{ active: isInSelectionMode }"
        type="button"
        @click="toggleSelectionMode"
        title="Toggle bulk selection mode"
      >
        {{ isInSelectionMode ? '☑️ Exit Selection' : '☐ Bulk Select' }}
      </button>
    </div>

    <div class="grid ticket-grid">
      <article
        v-for="ticket in filtered"
        :key="ticket.id"
        :class="[
          'ticket-card',
          {
            'high-priority': ticket.priority === 'high',
            'selection-mode': isInSelectionMode,
            'selected': isTicketSelected(ticket.id)
          }
        ]"
        @click="handleTicketClick(ticket, $event)"
        @keydown="handleKeyDown(ticket.id, $event)"
        tabindex="0"
      >
        <div class="ticket-header">
          <!-- Selection Checkbox -->
          <div class="selection-checkbox" v-if="isInSelectionMode">
            <input
              type="checkbox"
              :checked="isTicketSelected(ticket.id)"
              @change="toggleTicketSelection(ticket.id)"
              @click.stop
            />
          </div>

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
        <!-- Progress Indicator for ticket -->
        <div v-if="getTicketSteps(ticket).length > 0" class="ticket-progress">
          <ProgressIndicator
            :title="`${ticket.title} Progress`"
            :steps="getTicketSteps(ticket)"
            :compact="true"
            :show-header="false"
            :show-steps="false"
            :show-summary="false"
            variant="minimal"
          />
        </div>

        <!-- Step Completion Checkmarks -->
        <div v-if="ticket.checklist && ticket.checklist.length > 0" class="ticket-checklist">
          <div class="checklist-header">
            <span class="checklist-title">Checklist</span>
            <span class="checklist-progress">
              {{ getCompletedChecklistItems(ticket).length }}/{{ ticket.checklist.length }}
            </span>
          </div>
          <div class="checklist-items">
            <div
              v-for="(item, index) in ticket.checklist"
              :key="index"
              class="checklist-item"
              :class="{ 'completed': item.completed }"
            >
              <span class="checkmark" :aria-label="item.completed ? 'Completed' : 'Pending'">
                {{ item.completed ? '✓' : '○' }}
              </span>
              <span class="item-text">{{ item.text || item.title || `Step ${index + 1}` }}</span>
            </div>
          </div>
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
import { useBulkOperations } from '../composables/bulkOperationsManager.js';
import ProgressIndicator from './ProgressIndicator.vue';

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
  components: {
    ProgressIndicator
  },
  setup() {
    return useBulkOperations();
  },
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
    },
    handleTicketClick(ticket, event) {
      if (this.isInSelectionMode) {
        event.preventDefault();
        this.handleKeyboardSelection(event, ticket.id, 'ticket');
      } else {
        // Normal ticket click behavior
        this.$emit('status-change', ticket, event);
      }
    },
    handleKeyDown(ticketId, event) {
      if (this.isInSelectionMode) {
        if (event.key === ' ' || event.key === 'Enter') {
          event.preventDefault();
          this.toggleTicketSelection(ticketId);
        }
      }
    },
    getTicketSteps(ticket) {
      // Convert ticket workflow into progress steps
      const steps = [];

      // Standard ticket workflow steps
      const workflowSteps = [
        { id: 'reported', title: 'Reported', status: 'completed' },
        { id: 'analysis', title: 'Analysis', status: ticket.status === 'reported' ? 'pending' : 'completed' },
        { id: 'implementation', title: 'Implementation', status: ticket.status === 'inProgress' ? 'active' : ticket.status === 'finished' ? 'completed' : 'pending' },
        { id: 'testing', title: 'Testing', status: ticket.status === 'finished' ? 'completed' : 'pending' },
        { id: 'completion', title: 'Completion', status: ticket.status === 'finished' ? 'completed' : 'pending' }
      ];

      // Add workflow steps
      steps.push(...workflowSteps);

      // Add checklist items as steps if they exist
      if (ticket.checklist && ticket.checklist.length > 0) {
        ticket.checklist.forEach((item, index) => {
          steps.push({
            id: `checklist-${index}`,
            title: item.text || item.title || `Checklist Item ${index + 1}`,
            status: item.completed ? 'completed' : 'pending',
            description: item.description || '',
            metadata: {
              type: 'checklist',
              required: item.required !== false
            }
          });
        });
      }

      return steps;
    },
    getCompletedChecklistItems(ticket) {
      if (!ticket.checklist) return [];
      return ticket.checklist.filter(item => item.completed);
    }
  }
};
</script>
