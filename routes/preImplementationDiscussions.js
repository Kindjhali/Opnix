const express = require('express');

function createPreImplementationDiscussionRoutes({ discussionManager, approvalGatesManager = null } = {}) {
  if (!discussionManager) {
    throw new Error('discussionManager is required');
  }

  const router = express.Router();

  router.get('/', async (req, res) => {
    try {
      const { status } = req.query;
      const discussions = await discussionManager.listDiscussions({ status });
      res.json({ success: true, discussions });
    } catch (error) {
      console.error('Failed to list pre-implementation discussions:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to list discussions' });
    }
  });

  router.get('/status/summary', async (_req, res) => {
    try {
      const discussions = await discussionManager.listDiscussions();
      const pending = discussions.filter(entry => entry.status === discussionManager.STATUSES.PENDING).length;
      const completed = discussions.filter(entry => entry.status === discussionManager.STATUSES.COMPLETED).length;
      res.json({ success: true, pending, completed, total: discussions.length });
    } catch (error) {
      console.error('Failed to summarise discussions:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to summarise discussions' });
    }
  });

  router.get('/:id', async (req, res) => {
    try {
      const discussion = await discussionManager.getDiscussion(req.params.id);
      if (!discussion) {
        return res.status(404).json({ success: false, error: 'Discussion not found' });
      }
      res.json({ success: true, discussion });
    } catch (error) {
      console.error('Failed to load discussion:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to load discussion' });
    }
  });

  router.post('/:id/complete', async (req, res) => {
    try {
      const {
        summary,
        decisions,
        risks,
        actionItems,
        notes,
        participants,
        recordedBy,
        autoApprove = false
      } = req.body || {};

      const discussion = await discussionManager.completeDiscussion({
        id: req.params.id,
        summary,
        decisions,
        risks,
        actionItems,
        notes,
        participants,
        recordedBy,
        autoApprove
      });

      res.json({ success: true, discussion });
    } catch (error) {
      console.error('Failed to complete discussion:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to complete discussion' });
    }
  });

  router.post('/:id/reset', async (req, res) => {
    try {
      const { notes, keepSummary = false } = req.body || {};
      const discussion = await discussionManager.resetDiscussion(req.params.id, { notes, keepSummary });
      res.json({ success: true, discussion });
    } catch (error) {
      console.error('Failed to reset discussion:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to reset discussion' });
    }
  });

  router.post('/:id/archive', async (req, res) => {
    try {
      const discussion = await discussionManager.archiveDiscussion(req.params.id);
      res.json({ success: true, discussion });
    } catch (error) {
      console.error('Failed to archive discussion:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to archive discussion' });
    }
  });

  router.get('/gates/status', async (_req, res) => {
    try {
      const hasCompleted = await discussionManager.hasCompletedDiscussion();
      const gate = approvalGatesManager ? await approvalGatesManager.getApproval('pre-implementation-discussion') : null;
      res.json({
        success: true,
        hasCompletedDiscussion: hasCompleted,
        gate
      });
    } catch (error) {
      console.error('Failed to load gate status:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to load gate status' });
    }
  });

  return router;
}

module.exports = createPreImplementationDiscussionRoutes;
