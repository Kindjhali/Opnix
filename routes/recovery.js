const express = require('express');
const checkpointManager = require('../services/checkpointManager');
const sessionRestoration = require('../services/sessionRestoration');
const gracefulFailureHandler = require('../services/gracefulFailureHandler');

const router = express.Router();

// Initialize recovery services
async function initializeRecoveryServices() {
  try {
    await sessionRestoration.initialize();
    await gracefulFailureHandler.initialize();
  } catch (error) {
    console.error('Failed to initialize recovery services:', error);
  }
}

// Initialize on module load
initializeRecoveryServices();

// Checkpoint management endpoints
router.post('/checkpoints/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { data, type = 'manual', description = 'Manual checkpoint', critical = false, context = {} } = req.body;

    if (!data) {
      return res.status(400).json({ error: 'Checkpoint data is required' });
    }

    const checkpointId = await checkpointManager.createCheckpoint(sessionId, data, {
      type,
      description,
      critical,
      context
    });

    res.json({
      success: true,
      checkpointId,
      sessionId,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/checkpoints/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const checkpoints = await checkpointManager.getSessionCheckpoints(sessionId);
    res.json({ sessionId, checkpoints });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/checkpoints/:sessionId/:checkpointId', async (req, res) => {
  try {
    const { checkpointId } = req.params;
    const checkpoint = await checkpointManager.loadCheckpoint(checkpointId);
    res.json(checkpoint);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/checkpoints/:sessionId/auto-start', async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    const requestedConfig = {
      dataProvider: req.body?.dataProvider ?? null,
      interval: req.body?.interval ?? null,
      description: req.body?.description ?? ''
    };

    // For API usage, we need a different approach since we can't pass functions
    // This would typically be used internally by the application
    res.status(400).json({
      error: 'Auto-checkpointing must be started internally by the application',
      sessionId,
      requestedConfig
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/checkpoints/:sessionId/auto-stop', async (req, res) => {
  try {
    const { sessionId } = req.params;
    checkpointManager.stopAutoCheckpointing(sessionId);
    res.json({ success: true, sessionId, stopped: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Session restoration endpoints
router.get('/restoration/candidates', async (req, res) => {
  try {
    const candidates = await sessionRestoration.getRestorationCandidates();
    res.json({ candidates });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/restoration/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { checkpointId, forceRestore = false, userConfirmed = false } = req.body;

    const result = await sessionRestoration.restoreSession(sessionId, {
      checkpointId,
      forceRestore,
      userConfirmed
    });

    res.json(result);
  } catch (error) {
    if (error.message.includes('confirmation required')) {
      res.status(409).json({
        error: error.message,
        requiresConfirmation: true
      });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

router.post('/restoration/auto-detect', async (req, res) => {
  try {
    const result = await sessionRestoration.detectAndRestoreInterruptedSessions();
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/restoration/config', async (req, res) => {
  try {
    res.json({ config: sessionRestoration.config });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/restoration/config', async (req, res) => {
  try {
    const updates = req.body;
    await sessionRestoration.updateConfig(updates);
    res.json({
      success: true,
      config: sessionRestoration.config
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/restoration/log', async (req, res) => {
  try {
    const { limit = 100 } = req.query;
    const log = await sessionRestoration.getRecoveryLog(parseInt(limit));
    res.json({ log });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Failure handling endpoints
router.post('/failures/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { error, context = {} } = req.body;

    if (!error) {
      return res.status(400).json({ error: 'Error information is required' });
    }

    const errorObj = new Error(error.message || error);
    if (error.code) errorObj.code = error.code;
    if (error.stack) errorObj.stack = error.stack;

    const result = await gracefulFailureHandler.handleSessionFailure(sessionId, errorObj, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/failures/backend/:operation', async (req, res) => {
  try {
    const { operation } = req.params;
    const { error, context = {} } = req.body;

    if (!error) {
      return res.status(400).json({ error: 'Error information is required' });
    }

    const errorObj = new Error(error.message || error);
    if (error.code) errorObj.code = error.code;
    if (error.stack) errorObj.stack = error.stack;

    const result = await gracefulFailureHandler.handleBackendError(operation, errorObj, context);
    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/failures/recovery-prompts', async (req, res) => {
  try {
    const prompts = await gracefulFailureHandler.getPendingRecoveryPrompts();
    res.json({ prompts });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/failures/recovery-prompts/:promptId/respond', async (req, res) => {
  try {
    const { promptId } = req.params;
    const { userResponse } = req.body;

    if (!userResponse) {
      return res.status(400).json({ error: 'User response is required' });
    }

    const result = await gracefulFailureHandler.respondToRecoveryPrompt(promptId, userResponse);
    res.json(result);
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Recovery status and health endpoints
router.get('/status', async (req, res) => {
  try {
    const [
      candidates,
      pendingPrompts,
      recoveryLog
    ] = await Promise.all([
      sessionRestoration.getRestorationCandidates(),
      gracefulFailureHandler.getPendingRecoveryPrompts(),
      sessionRestoration.getRecoveryLog(10)
    ]);

    res.json({
      recovery: {
        candidateSessions: candidates.length,
        pendingPrompts: pendingPrompts.length,
        recentLogEntries: recoveryLog.length,
        autoRestoreEnabled: sessionRestoration.config.autoRestore,
        lastCheck: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cleanup endpoints
router.delete('/checkpoints/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const { keepCritical = true } = req.query;

    await checkpointManager.cleanup(sessionId, keepCritical === 'true');
    res.json({
      success: true,
      sessionId,
      keepCritical: keepCritical === 'true'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.delete('/restoration/log', async (req, res) => {
  try {
    await sessionRestoration.clearRecoveryLog();
    res.json({ success: true, message: 'Recovery log cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;