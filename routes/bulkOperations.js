const express = require('express');
const BulkOperationsManager = require('../services/bulkOperationsManager');

const router = express.Router();
const bulkOpsManager = new BulkOperationsManager();

// Bulk update tickets endpoint
router.post('/tickets/update', async (req, res) => {
  try {
    const { ticketIds, updates } = req.body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ticketIds must be a non-empty array'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'updates object is required'
      });
    }

    // Get dependencies from the server context
    const {
      readData,
      writeData,
      validateTicketStatusChange,
      syncRoadmapState
    } = req.bulkOpsDeps || {};

    if (!readData || !writeData) {
      return res.status(500).json({
        success: false,
        error: 'Required dependencies not available'
      });
    }

    const results = await bulkOpsManager.bulkUpdateTickets(
      ticketIds,
      updates,
      readData,
      writeData,
      validateTicketStatusChange,
      syncRoadmapState
    );

    res.json({
      success: true,
      results,
      message: `Bulk update completed: ${results.summary.successful}/${results.summary.total} tickets updated`
    });

    console.log(`✓ Bulk updated ${results.summary.successful} tickets`);
  } catch (error) {
    console.error('Bulk ticket update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk update features endpoint
router.post('/features/update', async (req, res) => {
  try {
    const { featureIds, updates } = req.body;

    if (!Array.isArray(featureIds) || featureIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'featureIds must be a non-empty array'
      });
    }

    if (!updates || typeof updates !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'updates object is required'
      });
    }

    // Get dependencies from the server context
    const {
      readFeaturesFile,
      writeFeaturesFile,
      validateFeatureStatusChange,
      syncRoadmapState
    } = req.bulkOpsDeps || {};

    if (!readFeaturesFile || !writeFeaturesFile) {
      return res.status(500).json({
        success: false,
        error: 'Required feature dependencies not available'
      });
    }

    const results = await bulkOpsManager.bulkUpdateFeatures(
      featureIds,
      updates,
      readFeaturesFile,
      writeFeaturesFile,
      validateFeatureStatusChange,
      syncRoadmapState
    );

    res.json({
      success: true,
      results,
      message: `Bulk update completed: ${results.summary.successful}/${results.summary.total} features updated`
    });

    console.log(`✓ Bulk updated ${results.summary.successful} features`);
  } catch (error) {
    console.error('Bulk feature update error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Bulk delete tickets endpoint
router.post('/tickets/delete', async (req, res) => {
  try {
    const { ticketIds } = req.body;

    if (!Array.isArray(ticketIds) || ticketIds.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'ticketIds must be a non-empty array'
      });
    }

    // Get dependencies from the server context
    const { readData, writeData, syncRoadmapState } = req.bulkOpsDeps || {};

    if (!readData || !writeData) {
      return res.status(500).json({
        success: false,
        error: 'Required dependencies not available'
      });
    }

    const results = await bulkOpsManager.bulkDeleteTickets(
      ticketIds,
      readData,
      writeData,
      syncRoadmapState
    );

    res.json({
      success: true,
      results,
      message: `Bulk deletion completed: ${results.summary.successful}/${results.summary.total} tickets deleted`
    });

    console.log(`✓ Bulk deleted ${results.summary.successful} tickets`);
  } catch (error) {
    console.error('Bulk ticket deletion error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get undo history endpoint
router.get('/undo/history', (req, res) => {
  try {
    const history = bulkOpsManager.getUndoHistory();
    res.json({
      success: true,
      history,
      total: history.length
    });
  } catch (error) {
    console.error('Undo history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Restore from snapshot (undo) endpoint
router.post('/undo/:snapshotId', async (req, res) => {
  try {
    const { snapshotId } = req.params;
    const { type } = req.body; // 'tickets' or 'features'

    if (!type || !['tickets', 'features'].includes(type)) {
      return res.status(400).json({
        success: false,
        error: 'type must be either "tickets" or "features"'
      });
    }

    // Get appropriate write function based on type
    const { writeData, writeFeaturesFile } = req.bulkOpsDeps || {};

    let writeDataFn;
    if (type === 'tickets') {
      writeDataFn = writeData;
    } else if (type === 'features') {
      writeDataFn = writeFeaturesFile;
    }

    if (!writeDataFn) {
      return res.status(500).json({
        success: false,
        error: 'Required dependencies not available'
      });
    }

    const result = await bulkOpsManager.restoreSnapshot(
      parseInt(snapshotId, 10),
      writeDataFn
    );

    res.json({
      success: true,
      result,
      message: `Successfully restored: ${result.description}`
    });

    console.log(`✓ Restored snapshot ${snapshotId}: ${result.description}`);
  } catch (error) {
    console.error('Undo operation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get operation statistics endpoint
router.get('/stats', (req, res) => {
  try {
    const stats = bulkOpsManager.getOperationStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Bulk operations stats error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Clear undo history endpoint
router.delete('/undo/clear', (req, res) => {
  try {
    const clearedCount = bulkOpsManager.clearUndoHistory();
    res.json({
      success: true,
      message: `Cleared ${clearedCount} undo operations`,
      clearedCount
    });

    console.log(`✓ Cleared ${clearedCount} undo operations`);
  } catch (error) {
    console.error('Clear undo history error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Batch status validation endpoint
router.post('/validate', async (req, res) => {
  try {
    const { operations } = req.body;

    if (!Array.isArray(operations)) {
      return res.status(400).json({
        success: false,
        error: 'operations must be an array'
      });
    }

    const {
      readData,
      readFeaturesFile,
      validateTicketStatusChange,
      validateFeatureStatusChange
    } = req.bulkOpsDeps || {};

    const validationResults = [];

    for (const op of operations) {
      const { type, itemId, updates } = op;

      try {
        if (type === 'ticket' && validateTicketStatusChange) {
          const data = await readData();
          const ticket = data.tickets.find(t => t.id === parseInt(itemId, 10));

          if (!ticket) {
            validationResults.push({
              type,
              itemId,
              valid: false,
              error: 'Ticket not found'
            });
            continue;
          }

          if (updates.status !== undefined) {
            const valid = validateTicketStatusChange(ticket.status, updates.status, updates.statusHook);
            validationResults.push({
              type,
              itemId,
              valid,
              error: valid ? null : 'Invalid status transition'
            });
          } else {
            validationResults.push({
              type,
              itemId,
              valid: true,
              error: null
            });
          }
        } else if (type === 'feature' && validateFeatureStatusChange) {
          const features = await readFeaturesFile();
          const feature = features.find(f => String(f.id) === String(itemId));

          if (!feature) {
            validationResults.push({
              type,
              itemId,
              valid: false,
              error: 'Feature not found'
            });
            continue;
          }

          if (updates.status !== undefined) {
            const validation = validateFeatureStatusChange(
              feature.status,
              updates.status,
              feature.acceptanceCriteria || []
            );
            validationResults.push({
              type,
              itemId,
              valid: validation.ok,
              error: validation.ok ? null : validation.message
            });
          } else {
            validationResults.push({
              type,
              itemId,
              valid: true,
              error: null
            });
          }
        } else {
          validationResults.push({
            type,
            itemId,
            valid: false,
            error: 'Unsupported operation type or missing validation function'
          });
        }
      } catch (error) {
        validationResults.push({
          type,
          itemId,
          valid: false,
          error: error.message
        });
      }
    }

    const validCount = validationResults.filter(r => r.valid).length;
    const invalidCount = validationResults.length - validCount;

    res.json({
      success: true,
      validationResults,
      summary: {
        total: validationResults.length,
        valid: validCount,
        invalid: invalidCount
      }
    });
  } catch (error) {
    console.error('Batch validation error:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;