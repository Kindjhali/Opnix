// const fs = require('fs').promises;
// const path = require('path');

class BulkOperationsManager {
  constructor() {
    this.undoStack = [];
    this.maxUndoOperations = 10;
  }

  // Create a snapshot for undo functionality
  createSnapshot(type, data, description) {
    const snapshot = {
      id: Date.now(),
      type,
      data: JSON.parse(JSON.stringify(data)), // Deep clone
      description,
      timestamp: new Date().toISOString()
    };

    this.undoStack.push(snapshot);

    // Keep only the last maxUndoOperations snapshots
    if (this.undoStack.length > this.maxUndoOperations) {
      this.undoStack.shift();
    }

    return snapshot.id;
  }

  // Get available undo operations
  getUndoHistory() {
    return this.undoStack.map(snapshot => ({
      id: snapshot.id,
      type: snapshot.type,
      description: snapshot.description,
      timestamp: snapshot.timestamp
    }));
  }

  // Restore from snapshot
  async restoreSnapshot(snapshotId, writeDataFn) {
    const snapshot = this.undoStack.find(s => s.id === snapshotId);
    if (!snapshot) {
      throw new Error('Snapshot not found');
    }

    try {
      await writeDataFn(snapshot.data);
      return {
        success: true,
        description: snapshot.description,
        timestamp: snapshot.timestamp
      };
    } catch (error) {
      throw new Error(`Failed to restore snapshot: ${error.message}`);
    }
  }

  // Bulk update tickets
  async bulkUpdateTickets(ticketIds, updates, readDataFn, writeDataFn, validateFn, syncRoadmapFn) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw new Error('Invalid ticket IDs provided');
    }

    const data = await readDataFn();

    // Create snapshot before changes
    const snapshotId = this.createSnapshot('tickets', data, `Bulk update ${ticketIds.length} tickets`);

    const results = {
      success: [],
      failed: [],
      snapshotId,
      summary: {}
    };

    const originalTickets = [...data.tickets];

    for (const ticketId of ticketIds) {
      try {
        const index = data.tickets.findIndex(t => t.id === parseInt(ticketId, 10));

        if (index === -1) {
          results.failed.push({
            id: ticketId,
            error: 'Ticket not found'
          });
          continue;
        }

        const currentTicket = data.tickets[index];
        const payload = { ...updates };

        // Validate status changes if status is being updated
        if (payload.status !== undefined) {
          if (validateFn && !validateFn(currentTicket.status, payload.status, payload.statusHook)) {
            results.failed.push({
              id: ticketId,
              error: 'Invalid status transition or missing status hook'
            });
            continue;
          }

          // Handle completion logic for finished tickets
          if (payload.status === 'finished' && currentTicket.status !== 'finished') {
            if (!payload.completionSummary) {
              payload.completionSummary = `Bulk completion of ticket #${ticketId}`;
            }
            if (!payload.completedAt) {
              payload.completedAt = new Date().toISOString();
            }
          }
        }

        // Remove statusHook from final update
        delete payload.statusHook;

        // Apply updates
        data.tickets[index] = {
          ...currentTicket,
          ...payload,
          id: currentTicket.id,
          created: currentTicket.created,
          updated: new Date().toISOString()
        };

        results.success.push({
          id: ticketId,
          before: currentTicket.status,
          after: data.tickets[index].status
        });

      } catch (error) {
        results.failed.push({
          id: ticketId,
          error: error.message
        });
      }
    }

    // Only save if we have some successful updates
    if (results.success.length > 0) {
      try {
        await writeDataFn(data);
        if (syncRoadmapFn) {
          await syncRoadmapFn({ reason: 'ticket:bulk-update', overrides: { tickets: data } });
        }
      } catch (error) {
        // Rollback on save failure
        data.tickets = originalTickets;
        throw new Error(`Failed to save bulk updates: ${error.message}`);
      }
    }

    // Generate summary
    results.summary = {
      total: ticketIds.length,
      successful: results.success.length,
      failed: results.failed.length,
      statusChanges: this.summarizeStatusChanges(results.success)
    };

    return results;
  }

  // Bulk update features
  async bulkUpdateFeatures(featureIds, updates, readFeaturesFn, writeFeaturesFn, validateFn, syncRoadmapFn) {
    if (!Array.isArray(featureIds) || featureIds.length === 0) {
      throw new Error('Invalid feature IDs provided');
    }

    const features = await readFeaturesFn();

    // Create snapshot before changes
    const snapshotId = this.createSnapshot('features', features, `Bulk update ${featureIds.length} features`);

    const results = {
      success: [],
      failed: [],
      snapshotId,
      summary: {}
    };

    const originalFeatures = [...features];

    for (const featureId of featureIds) {
      try {
        const index = features.findIndex(f => String(f.id) === String(featureId));

        if (index === -1) {
          results.failed.push({
            id: featureId,
            error: 'Feature not found'
          });
          continue;
        }

        const currentFeature = features[index];
        const payload = { ...updates };

        // Validate status changes if status is being updated
        if (payload.status !== undefined && validateFn) {
          const validation = validateFn(currentFeature.status, payload.status, currentFeature.acceptanceCriteria || []);
          if (!validation.ok) {
            results.failed.push({
              id: featureId,
              error: validation.message
            });
            continue;
          }

          // Handle completion logic for deployed features
          if (payload.status === 'deployed' && currentFeature.status !== 'deployed') {
            if (!payload.completedAt) {
              payload.completedAt = new Date().toISOString();
            }
            if (!payload.completionSummary) {
              payload.completionSummary = `Bulk deployment of feature ${featureId}`;
            }
          }
        }

        // Apply updates
        features[index] = {
          ...currentFeature,
          ...payload,
          id: currentFeature.id,
          created: currentFeature.created,
          updated: new Date().toISOString()
        };

        results.success.push({
          id: featureId,
          before: currentFeature.status,
          after: features[index].status
        });

      } catch (error) {
        results.failed.push({
          id: featureId,
          error: error.message
        });
      }
    }

    // Only save if we have some successful updates
    if (results.success.length > 0) {
      try {
        await writeFeaturesFn(features);
        if (syncRoadmapFn) {
          await syncRoadmapFn({ reason: 'feature:bulk-update', overrides: { features } });
        }
      } catch (error) {
        // Rollback on save failure - restore original array
        features.splice(0, features.length, ...originalFeatures);
        throw new Error(`Failed to save bulk updates: ${error.message}`);
      }
    }

    // Generate summary
    results.summary = {
      total: featureIds.length,
      successful: results.success.length,
      failed: results.failed.length,
      statusChanges: this.summarizeStatusChanges(results.success)
    };

    return results;
  }

  // Bulk delete tickets
  async bulkDeleteTickets(ticketIds, readDataFn, writeDataFn, syncRoadmapFn) {
    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      throw new Error('Invalid ticket IDs provided');
    }

    const data = await readDataFn();

    // Create snapshot before changes
    const snapshotId = this.createSnapshot('tickets', data, `Bulk delete ${ticketIds.length} tickets`);

    const results = {
      success: [],
      failed: [],
      snapshotId,
      summary: {}
    };

    const ticketIdsToDelete = ticketIds.map(id => parseInt(id, 10));
    // const originalCount = data.tickets.length;

    // Filter out tickets to delete
    const deletedTickets = [];
    data.tickets = data.tickets.filter(ticket => {
      if (ticketIdsToDelete.includes(ticket.id)) {
        deletedTickets.push(ticket);
        results.success.push({ id: ticket.id, title: ticket.title });
        return false;
      }
      return true;
    });

    // Check for tickets that weren't found
    for (const ticketId of ticketIds) {
      const id = parseInt(ticketId, 10);
      if (!deletedTickets.find(t => t.id === id)) {
        results.failed.push({
          id: ticketId,
          error: 'Ticket not found'
        });
      }
    }

    // Save changes if any tickets were deleted
    if (deletedTickets.length > 0) {
      try {
        await writeDataFn(data);
        if (syncRoadmapFn) {
          await syncRoadmapFn({ reason: 'ticket:bulk-delete', overrides: { tickets: data } });
        }
      } catch (error) {
        throw new Error(`Failed to save bulk deletion: ${error.message}`);
      }
    }

    results.summary = {
      total: ticketIds.length,
      successful: results.success.length,
      failed: results.failed.length,
      deletedCount: deletedTickets.length
    };

    return results;
  }

  // Helper to summarize status changes
  summarizeStatusChanges(successResults) {
    const changes = {};
    successResults.forEach(result => {
      const change = `${result.before} → ${result.after}`;
      changes[change] = (changes[change] || 0) + 1;
    });
    return changes;
  }

  // Get operation statistics
  getOperationStats() {
    const stats = {
      totalOperations: this.undoStack.length,
      operationTypes: {},
      oldestOperation: null,
      newestOperation: null
    };

    if (this.undoStack.length > 0) {
      stats.oldestOperation = this.undoStack[0].timestamp;
      stats.newestOperation = this.undoStack[this.undoStack.length - 1].timestamp;

      this.undoStack.forEach(op => {
        stats.operationTypes[op.type] = (stats.operationTypes[op.type] || 0) + 1;
      });
    }

    return stats;
  }

  // Clear undo history
  clearUndoHistory() {
    const cleared = this.undoStack.length;
    this.undoStack = [];
    return cleared;
  }
}

module.exports = BulkOperationsManager;