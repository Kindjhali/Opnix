import { ref, computed, reactive } from 'vue';

// Global state for bulk operations
const bulkState = reactive({
  selectedTickets: new Set(),
  selectedFeatures: new Set(),
  isSelectionMode: false,
  lastOperation: null,
  undoHistory: [],
  lastSelectedTicket: null,
  lastSelectedFeature: null
});

export function useBulkOperations() {
  const isLoading = ref(false);
  const error = ref(null);

  // Selection management
  const selectedTicketIds = computed(() => Array.from(bulkState.selectedTickets));
  const selectedFeatureIds = computed(() => Array.from(bulkState.selectedFeatures));
  const hasSelectedTickets = computed(() => bulkState.selectedTickets.size > 0);
  const hasSelectedFeatures = computed(() => bulkState.selectedFeatures.size > 0);
  const isInSelectionMode = computed(() => bulkState.isSelectionMode);

  // Toggle selection mode
  function toggleSelectionMode() {
    bulkState.isSelectionMode = !bulkState.isSelectionMode;
    if (!bulkState.isSelectionMode) {
      clearSelections();
    }
  }

  // Enable selection mode
  function enableSelectionMode() {
    bulkState.isSelectionMode = true;
  }

  // Disable selection mode
  function disableSelectionMode() {
    bulkState.isSelectionMode = false;
    clearSelections();
  }

  // Toggle ticket selection
  function toggleTicketSelection(ticketId) {
    if (bulkState.selectedTickets.has(ticketId)) {
      bulkState.selectedTickets.delete(ticketId);
    } else {
      bulkState.selectedTickets.add(ticketId);
      bulkState.lastSelectedTicket = ticketId;
    }
  }

  // Toggle feature selection
  function toggleFeatureSelection(featureId) {
    if (bulkState.selectedFeatures.has(featureId)) {
      bulkState.selectedFeatures.delete(featureId);
    } else {
      bulkState.selectedFeatures.add(featureId);
      bulkState.lastSelectedFeature = featureId;
    }
  }

  // Select all visible tickets
  function selectAllTickets(visibleTickets) {
    visibleTickets.forEach(ticket => {
      bulkState.selectedTickets.add(ticket.id);
    });
  }

  // Select all visible features
  function selectAllFeatures(visibleFeatures) {
    visibleFeatures.forEach(feature => {
      bulkState.selectedFeatures.add(feature.id);
    });
  }

  // Clear all selections
  function clearSelections() {
    bulkState.selectedTickets.clear();
    bulkState.selectedFeatures.clear();
  }

  // Check if ticket is selected
  function isTicketSelected(ticketId) {
    return bulkState.selectedTickets.has(ticketId);
  }

  // Check if feature is selected
  function isFeatureSelected(featureId) {
    return bulkState.selectedFeatures.has(featureId);
  }

  // Range selection helper
  function selectRange(allItems, startId, endId, type) {
    const itemIds = allItems.map(item => item.id);
    const startIndex = itemIds.indexOf(startId);
    const endIndex = itemIds.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) {
      return;
    }

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    for (let i = minIndex; i <= maxIndex; i++) {
      const itemId = itemIds[i];
      if (type === 'ticket') {
        bulkState.selectedTickets.add(itemId);
      } else if (type === 'feature') {
        bulkState.selectedFeatures.add(itemId);
      }
    }
  }

  // Keyboard selection handlers
  function handleKeyboardSelection(event, itemId, type, allItems = []) {
    if (!bulkState.isSelectionMode) return;

    if (event.shiftKey) {
      // Range selection
      const lastSelected = type === 'ticket'
        ? bulkState.lastSelectedTicket
        : bulkState.lastSelectedFeature;

      if (lastSelected && allItems.length > 0) {
        selectRange(allItems, lastSelected, itemId, type);
      } else {
        // No previous selection, just toggle this one
        if (type === 'ticket') {
          toggleTicketSelection(itemId);
        } else if (type === 'feature') {
          toggleFeatureSelection(itemId);
        }
      }
    } else if (event.ctrlKey || event.metaKey) {
      if (type === 'ticket') {
        toggleTicketSelection(itemId);
      } else if (type === 'feature') {
        toggleFeatureSelection(itemId);
      }
    }
  }

  // API calls for bulk operations
  async function bulkUpdateTickets(updates) {
    if (bulkState.selectedTickets.size === 0) {
      throw new Error('No tickets selected');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/bulk/tickets/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketIds: selectedTicketIds.value,
          updates
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Bulk update failed');
      }

      const result = await response.json();
      bulkState.lastOperation = result;

      // Refresh undo history
      await refreshUndoHistory();

      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function bulkUpdateFeatures(updates) {
    if (bulkState.selectedFeatures.size === 0) {
      throw new Error('No features selected');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/bulk/features/update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          featureIds: selectedFeatureIds.value,
          updates
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Bulk update failed');
      }

      const result = await response.json();
      bulkState.lastOperation = result;

      // Refresh undo history
      await refreshUndoHistory();

      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  async function bulkDeleteTickets() {
    if (bulkState.selectedTickets.size === 0) {
      throw new Error('No tickets selected');
    }

    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/bulk/tickets/delete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ticketIds: selectedTicketIds.value
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Bulk deletion failed');
      }

      const result = await response.json();
      bulkState.lastOperation = result;

      // Refresh undo history
      await refreshUndoHistory();

      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Validate bulk operations before executing
  async function validateBulkOperations(operations) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/bulk/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ operations })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Validation failed');
      }

      return await response.json();
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Undo operations
  async function undoOperation(snapshotId, type) {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch(`/api/bulk/undo/${snapshotId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ type })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Undo failed');
      }

      const result = await response.json();

      // Refresh undo history
      await refreshUndoHistory();

      return result;
    } catch (err) {
      error.value = err.message;
      throw err;
    } finally {
      isLoading.value = false;
    }
  }

  // Get undo history
  async function refreshUndoHistory() {
    try {
      const response = await fetch('/api/bulk/undo/history');
      if (response.ok) {
        const result = await response.json();
        bulkState.undoHistory = result.history || [];
      }
    } catch (err) {
      console.warn('Failed to refresh undo history:', err);
    }
  }

  // Get operation statistics
  async function getOperationStats() {
    try {
      const response = await fetch('/api/bulk/stats');
      if (response.ok) {
        const result = await response.json();
        return result.stats;
      }
    } catch (err) {
      console.warn('Failed to get operation stats:', err);
    }
    return null;
  }

  // Clear undo history
  async function clearUndoHistory() {
    try {
      const response = await fetch('/api/bulk/undo/clear', {
        method: 'DELETE'
      });
      if (response.ok) {
        bulkState.undoHistory = [];
        return await response.json();
      }
    } catch (err) {
      error.value = err.message;
      throw err;
    }
  }

  // Helper to get selection summary
  const selectionSummary = computed(() => {
    const ticketCount = bulkState.selectedTickets.size;
    const featureCount = bulkState.selectedFeatures.size;

    if (ticketCount > 0 && featureCount > 0) {
      return `${ticketCount} tickets, ${featureCount} features selected`;
    } else if (ticketCount > 0) {
      return `${ticketCount} ticket${ticketCount === 1 ? '' : 's'} selected`;
    } else if (featureCount > 0) {
      return `${featureCount} feature${featureCount === 1 ? '' : 's'} selected`;
    }
    return 'No items selected';
  });

  // Initialize - load undo history on first use
  refreshUndoHistory();

  return {
    // State
    isLoading,
    error,
    selectedTicketIds,
    selectedFeatureIds,
    hasSelectedTickets,
    hasSelectedFeatures,
    isInSelectionMode,
    lastOperation: computed(() => bulkState.lastOperation),
    undoHistory: computed(() => bulkState.undoHistory),
    selectionSummary,

    // Selection methods
    toggleSelectionMode,
    enableSelectionMode,
    disableSelectionMode,
    toggleTicketSelection,
    toggleFeatureSelection,
    selectAllTickets,
    selectAllFeatures,
    clearSelections,
    isTicketSelected,
    isFeatureSelected,
    handleKeyboardSelection,

    // API methods
    bulkUpdateTickets,
    bulkUpdateFeatures,
    bulkDeleteTickets,
    validateBulkOperations,
    undoOperation,
    refreshUndoHistory,
    getOperationStats,
    clearUndoHistory
  };
}