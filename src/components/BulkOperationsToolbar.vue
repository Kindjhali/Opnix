<template>
  <div class="bulk-operations-toolbar" :class="{ visible: isVisible }">
    <div class="toolbar-content">
      <!-- Selection Summary -->
      <div class="selection-summary">
        <span class="selection-count">{{ selectionSummary }}</span>
        <button class="btn-icon" @click="clearSelections" title="Clear selection">
          <span class="icon">✕</span>
        </button>
      </div>

      <!-- Action Buttons -->
      <div class="action-buttons">
        <!-- Status Update Actions -->
        <div class="action-group" v-if="type === 'tickets'">
          <label class="action-label">Status:</label>
          <button
            class="btn status-btn reported"
            @click="updateStatus('reported')"
            :disabled="isLoading"
            title="Mark as Reported"
          >
            📋 Reported
          </button>
          <button
            class="btn status-btn in-progress"
            @click="updateStatus('inProgress')"
            :disabled="isLoading"
            title="Mark as In Progress"
          >
            🔧 In Progress
          </button>
          <button
            class="btn status-btn finished"
            @click="updateStatus('finished')"
            :disabled="isLoading"
            title="Mark as Finished"
          >
            ✅ Finished
          </button>
        </div>

        <div class="action-group" v-if="type === 'features'">
          <label class="action-label">Status:</label>
          <button
            class="btn status-btn proposed"
            @click="updateStatus('proposed')"
            :disabled="isLoading"
            title="Mark as Proposed"
          >
            💡 Proposed
          </button>
          <button
            class="btn status-btn approved"
            @click="updateStatus('approved')"
            :disabled="isLoading"
            title="Mark as Approved"
          >
            👍 Approved
          </button>
          <button
            class="btn status-btn in-development"
            @click="updateStatus('in-development')"
            :disabled="isLoading"
            title="Mark as In Development"
          >
            🔨 In Development
          </button>
          <button
            class="btn status-btn testing"
            @click="updateStatus('testing')"
            :disabled="isLoading"
            title="Mark as Testing"
          >
            🧪 Testing
          </button>
          <button
            class="btn status-btn deployed"
            @click="updateStatus('deployed')"
            :disabled="isLoading"
            title="Mark as Deployed"
          >
            🚀 Deployed
          </button>
        </div>

        <!-- Priority Update Actions (for tickets) -->
        <div class="action-group" v-if="type === 'tickets'">
          <label class="action-label">Priority:</label>
          <button
            class="btn priority-btn low"
            @click="updatePriority('low')"
            :disabled="isLoading"
            title="Set Low Priority"
          >
            🔵 Low
          </button>
          <button
            class="btn priority-btn medium"
            @click="updatePriority('medium')"
            :disabled="isLoading"
            title="Set Medium Priority"
          >
            🟡 Medium
          </button>
          <button
            class="btn priority-btn high"
            @click="updatePriority('high')"
            :disabled="isLoading"
            title="Set High Priority"
          >
            🔴 High
          </button>
        </div>

        <!-- Bulk Actions -->
        <div class="action-group danger-actions">
          <button
            class="btn danger"
            @click="showDeleteConfirmation = true"
            :disabled="isLoading"
            title="Delete selected items"
          >
            🗑️ Delete
          </button>
        </div>

        <!-- Utility Actions -->
        <div class="action-group utility-actions">
          <button
            class="btn secondary"
            @click="selectAll"
            :disabled="isLoading"
            title="Select all visible items"
          >
            ☑️ Select All
          </button>
          <button
            class="btn secondary"
            @click="exportSelected"
            :disabled="isLoading"
            title="Export selected items"
          >
            📤 Export
          </button>
        </div>
      </div>

      <!-- Undo Button -->
      <div class="undo-section" v-if="canUndo">
        <button
          class="btn undo-btn"
          @click="showUndoMenu = !showUndoMenu"
          :disabled="isLoading"
          title="Undo last operation"
        >
          ↶ Undo
        </button>

        <!-- Undo Dropdown Menu -->
        <div class="undo-menu" v-if="showUndoMenu">
          <div class="undo-menu-header">Recent Operations</div>
          <div
            v-for="operation in undoHistory.slice(0, 5)"
            :key="operation.id"
            class="undo-item"
            @click="undoOperation(operation.id)"
          >
            <div class="undo-description">{{ operation.description }}</div>
            <div class="undo-timestamp">{{ formatTimestamp(operation.timestamp) }}</div>
          </div>
          <div class="undo-menu-footer">
            <button class="btn-link" @click="clearUndoHistory">Clear History</button>
          </div>
        </div>
      </div>

      <!-- Loading Indicator -->
      <div class="loading-indicator" v-if="isLoading">
        <span class="spinner"></span>
        Processing...
      </div>
    </div>

    <!-- Delete Confirmation Modal -->
    <div class="modal-overlay" v-if="showDeleteConfirmation" @click="showDeleteConfirmation = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Confirm Deletion</h3>
        </div>
        <div class="modal-body">
          <p>Are you sure you want to delete {{ selectionSummary }}?</p>
          <p class="warning-text">This action cannot be undone.</p>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="showDeleteConfirmation = false">Cancel</button>
          <button class="btn danger" @click="confirmDelete" :disabled="isLoading">Delete</button>
        </div>
      </div>
    </div>

    <!-- Status Update Confirmation Modal -->
    <div class="modal-overlay" v-if="showStatusConfirmation" @click="showStatusConfirmation = false">
      <div class="modal" @click.stop>
        <div class="modal-header">
          <h3>Confirm Status Change</h3>
        </div>
        <div class="modal-body">
          <p>Change status of {{ selectionSummary }} to <strong>{{ pendingStatusChange }}</strong>?</p>
          <div v-if="pendingStatusChange === 'finished' && type === 'tickets'" class="completion-summary-input">
            <label for="completionSummary">Completion Summary (required):</label>
            <textarea
              id="completionSummary"
              v-model="completionSummary"
              placeholder="Describe what was completed..."
              rows="3"
              required
            ></textarea>
          </div>
        </div>
        <div class="modal-footer">
          <button class="btn secondary" @click="showStatusConfirmation = false">Cancel</button>
          <button
            class="btn primary"
            @click="confirmStatusChange"
            :disabled="isLoading || (pendingStatusChange === 'finished' && !completionSummary.trim())"
          >
            Update Status
          </button>
        </div>
      </div>
    </div>

    <!-- Operation Result Toast -->
    <div class="toast" v-if="lastOperationResult" :class="lastOperationResult.success ? 'success' : 'error'">
      {{ lastOperationResult.message }}
      <button class="toast-close" @click="lastOperationResult = null">×</button>
    </div>
  </div>
</template>

<script>
import { useBulkOperations } from '../composables/bulkOperationsManager.js';

export default {
  name: 'BulkOperationsToolbar',
  props: {
    type: {
      type: String,
      required: true,
      validator: value => ['tickets', 'features'].includes(value)
    },
    items: {
      type: Array,
      default: () => []
    }
  },
  emits: ['refresh', 'export'],
  setup() {
    return useBulkOperations();
  },
  data() {
    return {
      showDeleteConfirmation: false,
      showStatusConfirmation: false,
      showUndoMenu: false,
      pendingStatusChange: null,
      completionSummary: '',
      lastOperationResult: null
    };
  },
  computed: {
    isVisible() {
      return this.isInSelectionMode && (this.hasSelectedTickets || this.hasSelectedFeatures);
    },
    canUndo() {
      return this.undoHistory.length > 0;
    }
  },
  methods: {
    async updateStatus(status) {
      this.pendingStatusChange = status;
      this.completionSummary = '';
      this.showStatusConfirmation = true;
    },

    async confirmStatusChange() {
      try {
        const updates = { status: this.pendingStatusChange };

        if (this.pendingStatusChange === 'finished' && this.completionSummary.trim()) {
          updates.completionSummary = this.completionSummary.trim();
        }

        let result;
        if (this.type === 'tickets') {
          result = await this.bulkUpdateTickets(updates);
        } else {
          result = await this.bulkUpdateFeatures(updates);
        }

        this.showOperationResult(true, result.message);
        this.showStatusConfirmation = false;
        this.$emit('refresh');
      } catch (error) {
        this.showOperationResult(false, error.message);
      }
    },

    async updatePriority(priority) {
      try {
        const result = await this.bulkUpdateTickets({ priority });
        this.showOperationResult(true, result.message);
        this.$emit('refresh');
      } catch (error) {
        this.showOperationResult(false, error.message);
      }
    },

    async confirmDelete() {
      try {
        let result;
        if (this.type === 'tickets') {
          result = await this.bulkDeleteTickets();
        } else {
          // Features don't have bulk delete in the API routes yet,
          // but we can extend this later
          throw new Error('Bulk feature deletion not yet implemented');
        }

        this.showOperationResult(true, result.message);
        this.showDeleteConfirmation = false;
        this.$emit('refresh');
      } catch (error) {
        this.showOperationResult(false, error.message);
      }
    },

    selectAll() {
      if (this.type === 'tickets') {
        this.selectAllTickets(this.items);
      } else {
        this.selectAllFeatures(this.items);
      }
    },

    exportSelected() {
      this.$emit('export', {
        type: this.type,
        items: this.getSelectedItems()
      });
    },

    getSelectedItems() {
      if (this.type === 'tickets') {
        return this.items.filter(item => this.isTicketSelected(item.id));
      } else {
        return this.items.filter(item => this.isFeatureSelected(item.id));
      }
    },

    async undoOperation(snapshotId) {
      try {
        const result = await this.undoOperation(snapshotId, this.type);
        this.showOperationResult(true, result.message);
        this.showUndoMenu = false;
        this.$emit('refresh');
      } catch (error) {
        this.showOperationResult(false, error.message);
      }
    },

    async clearUndoHistory() {
      try {
        await this.clearUndoHistory();
        this.showUndoMenu = false;
        this.showOperationResult(true, 'Undo history cleared');
      } catch (error) {
        this.showOperationResult(false, error.message);
      }
    },

    showOperationResult(success, message) {
      this.lastOperationResult = { success, message };
      setTimeout(() => {
        this.lastOperationResult = null;
      }, 5000);
    },

    formatTimestamp(timestamp) {
      return new Date(timestamp).toLocaleTimeString();
    }
  },

  // Close dropdowns when clicking outside
  mounted() {
    document.addEventListener('click', (event) => {
      if (!this.$el.contains(event.target)) {
        this.showUndoMenu = false;
      }
    });
  }
};
</script>

