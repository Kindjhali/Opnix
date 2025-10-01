const express = require('express');
const SessionManager = require('../services/sessionManager');

const router = express.Router();
const sessionManager = new SessionManager();

// Context history aggregation
router.get('/context/history', async (_req, res) => {
  try {
    const history = await sessionManager.readContextHistory();
    res.json({ success: true, history });
  } catch (error) {
    console.error('Failed to read context history:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get recent sessions
router.get('/recent', async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 10;
    const sessions = await sessionManager.getRecentSessions(limit);

    res.json({
      success: true,
      sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Failed to get recent sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get active sessions
router.get('/active', async (req, res) => {
  try {
    const sessions = await sessionManager.getActiveSessions();

    res.json({
      success: true,
      sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Failed to get active sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get paused sessions
router.get('/paused', async (req, res) => {
  try {
    const sessions = await sessionManager.getPausedSessions();

    res.json({
      success: true,
      sessions,
      total: sessions.length
    });
  } catch (error) {
    console.error('Failed to get paused sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get sessions by type
router.get('/type/:type', async (req, res) => {
  try {
    const { type } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const sessions = await sessionManager.getSessionsByType(type, limit);

    res.json({
      success: true,
      sessions,
      total: sessions.length,
      type
    });
  } catch (error) {
    console.error('Failed to get sessions by type:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Search sessions
router.get('/search', async (req, res) => {
  try {
    const { q: query } = req.query;
    if (!query) {
      return res.status(400).json({
        success: false,
        error: 'Query parameter "q" is required'
      });
    }

    const options = {
      type: req.query.type,
      status: req.query.status,
      limit: parseInt(req.query.limit) || 50
    };

    const sessions = await sessionManager.searchSessions(query, options);

    res.json({
      success: true,
      sessions,
      total: sessions.length,
      query,
      options
    });
  } catch (error) {
    console.error('Failed to search sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get session statistics
router.get('/stats', async (req, res) => {
  try {
    const stats = await sessionManager.getSessionStatistics();

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Failed to get session statistics:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get specific session
router.get('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionManager.loadSession(sessionId);

    if (!session) {
      return res.status(404).json({
        success: false,
        error: 'Session not found'
      });
    }

    res.json({
      success: true,
      session
    });
  } catch (error) {
    console.error('Failed to load session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Create new session
router.post('/', async (req, res) => {
  try {
    const { type, data, metadata } = req.body;

    if (!type || !data) {
      return res.status(400).json({
        success: false,
        error: 'type and data are required'
      });
    }

    const session = await sessionManager.createSession(type, data, metadata);

    res.status(201).json({
      success: true,
      session,
      message: `Session created: ${session.id}`
    });

    console.log(`✓ Created session ${session.id} (${type})`);
  } catch (error) {
    console.error('Failed to create session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Resume session
router.post('/:sessionId/resume', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const session = await sessionManager.resumeSession(sessionId);

    res.json({
      success: true,
      session,
      message: `Session resumed: ${sessionId}`
    });

    console.log(`✓ Resumed session ${sessionId}`);
  } catch (error) {
    console.error('Failed to resume session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Pause session
router.post('/:sessionId/pause', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { reason } = req.body;
    const session = await sessionManager.pauseSession(sessionId, reason);

    res.json({
      success: true,
      session,
      message: `Session paused: ${sessionId}`
    });

    console.log(`✓ Paused session ${sessionId}`);
  } catch (error) {
    console.error('Failed to pause session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Complete session
router.post('/:sessionId/complete', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { result } = req.body;
    const session = await sessionManager.completeSession(sessionId, result);

    res.json({
      success: true,
      session,
      message: `Session completed: ${sessionId}`
    });

    console.log(`✓ Completed session ${sessionId}`);
  } catch (error) {
    console.error('Failed to complete session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update session progress
router.put('/:sessionId/progress', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const progress = req.body;
    const session = await sessionManager.updateSessionProgress(sessionId, progress);

    res.json({
      success: true,
      session,
      message: `Session progress updated: ${sessionId}`
    });
  } catch (error) {
    console.error('Failed to update session progress:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update session context (for automatic context restoration)
router.put('/:sessionId/context', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const context = req.body;
    const session = await sessionManager.updateSessionContext(sessionId, context);

    res.json({
      success: true,
      session,
      message: `Session context updated: ${sessionId}`
    });
  } catch (error) {
    console.error('Failed to update session context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Retrieve auto-saved session context
router.get('/:sessionId/context', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const state = await sessionManager.readSessionState(sessionId);
    res.json({
      success: true,
      state
    });
  } catch (error) {
    console.error('Failed to read session context:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Delete session
router.delete('/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const success = await sessionManager.deleteSession(sessionId);

    if (!success) {
      return res.status(404).json({
        success: false,
        error: 'Session not found or could not be deleted'
      });
    }

    res.json({
      success: true,
      message: `Session deleted: ${sessionId}`
    });

    console.log(`✓ Deleted session ${sessionId}`);
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Cleanup old sessions
router.post('/cleanup', async (req, res) => {
  try {
    const { maxAge } = req.body;
    const cleanedCount = await sessionManager.cleanupOldSessions(maxAge);

    res.json({
      success: true,
      cleanedCount,
      message: `Cleaned up ${cleanedCount} old sessions`
    });

    console.log(`✓ Cleaned up ${cleanedCount} old sessions`);
  } catch (error) {
    console.error('Failed to cleanup sessions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
