const express = require('express');

function createApprovalGatesRoutes({ approvalGatesManager, discussionManager = null }) {
  if (!approvalGatesManager) {
    throw new Error('approvalGatesManager is required');
  }

  const router = express.Router();

  router.get('/', async (_req, res) => {
    try {
      const state = await approvalGatesManager.getState();
      res.json({ success: true, state });
    } catch (error) {
      console.error('Failed to read approval gates:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to read approval gates' });
    }
  });

  router.get('/approvals', async (_req, res) => {
    try {
      const approvals = await approvalGatesManager.getApprovals();
      res.json({ success: true, approvals });
    } catch (error) {
      console.error('Failed to list approvals:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list approvals' });
    }
  });

  router.get('/commands', async (_req, res) => {
    try {
      const state = await approvalGatesManager.getState();
      res.json({ success: true, commands: state.commands || {} });
    } catch (error) {
      console.error('Failed to list command gates:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list command gates' });
    }
  });

  router.get('/tools', async (_req, res) => {
    try {
      const state = await approvalGatesManager.getState();
      res.json({ success: true, tools: state.tools || {} });
    } catch (error) {
      console.error('Failed to list tool gates:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list tool gates' });
    }
  });

  router.post('/:gateId/approve', async (req, res) => {
    try {
      const { gateId } = req.params;
      const { approvedBy, role, notes } = req.body || {};
      if (!approvedBy) {
        return res.status(400).json({ success: false, error: 'approvedBy is required' });
      }

      if (gateId === 'pre-implementation-discussion' && discussionManager) {
        const hasCompleted = await discussionManager.hasCompletedDiscussion();
        if (!hasCompleted) {
          return res.status(412).json({
            success: false,
            error: 'Pre-implementation discussion outcome not recorded. Complete the discussion before approving the gate.'
          });
        }
      }

      const approval = await approvalGatesManager.approveGate(gateId, { approvedBy, role, notes });
      res.json({ success: true, approval });
    } catch (error) {
      console.error('Failed to approve gate:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to approve gate' });
    }
  });

  router.post('/:gateId/reset', async (req, res) => {
    try {
      const { gateId } = req.params;
      const { notes } = req.body || {};
      const approval = await approvalGatesManager.resetGate(gateId, { notes });
      res.json({ success: true, approval });
    } catch (error) {
      console.error('Failed to reset gate:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to reset gate' });
    }
  });

  return router;
}

module.exports = createApprovalGatesRoutes;
