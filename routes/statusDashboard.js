const express = require('express');
const statusDashboardManager = require('../services/statusDashboardManager');

const router = express.Router();

// Branch status indicator endpoint
router.get('/branch', async (req, res) => {
  try {
    const branchStatus = await statusDashboardManager.getBranchStatus();
    res.json({
      success: true,
      data: branchStatus
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Task progress indicator endpoint
router.get('/tasks', async (req, res) => {
  try {
    const taskProgress = await statusDashboardManager.getTaskProgress();
    res.json({
      success: true,
      data: taskProgress
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Token usage tracking endpoints
router.get('/tokens', (req, res) => {
  try {
    const tokenStats = statusDashboardManager.getTokenUsageStats();
    res.json({
      success: true,
      data: tokenStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/tokens/track', (req, res) => {
  try {
    const { inputTokens, outputTokens, provider } = req.body;

    if (typeof inputTokens !== 'number' || typeof outputTokens !== 'number') {
      return res.status(400).json({
        success: false,
        error: 'inputTokens and outputTokens must be numbers'
      });
    }

    const tokenStats = statusDashboardManager.trackTokenUsage(inputTokens, outputTokens, provider);
    res.json({
      success: true,
      data: tokenStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/tokens/reset', (req, res) => {
  try {
    statusDashboardManager.resetTokenUsage();
    const tokenStats = statusDashboardManager.getTokenUsageStats();
    res.json({
      success: true,
      data: tokenStats,
      message: 'Token usage reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// File monitoring endpoints
router.get('/files', (req, res) => {
  try {
    const fileStats = statusDashboardManager.getFileMonitorStats();
    res.json({
      success: true,
      data: fileStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/files/track', (req, res) => {
  try {
    const { filePath, operation } = req.body;

    if (!filePath) {
      return res.status(400).json({
        success: false,
        error: 'filePath is required'
      });
    }

    const fileStats = statusDashboardManager.trackFileChange(filePath, operation);
    res.json({
      success: true,
      data: fileStats
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Project health dashboard endpoint
router.get('/health', async (req, res) => {
  try {
    const health = await statusDashboardManager.getProjectHealth();
    res.json({
      success: true,
      data: health
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Color palette and theme endpoints
router.get('/theme', (req, res) => {
  try {
    const colors = statusDashboardManager.getThemeColors();
    res.json({
      success: true,
      data: {
        theme: 'canyon',
        colors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/theme/:themeName', (req, res) => {
  try {
    const { themeName } = req.params;
    const colors = statusDashboardManager.getThemeColors(themeName);
    res.json({
      success: true,
      data: {
        theme: themeName || 'canyon',
        colors
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/colors/:status', (req, res) => {
  try {
    const { status } = req.params;
    const color = statusDashboardManager.getStatusColors(status);
    res.json({
      success: true,
      data: {
        status,
        theme: 'canyon',
        color
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.get('/colors/:status/:theme', (req, res) => {
  try {
    const { status, theme } = req.params;
    const color = statusDashboardManager.getStatusColors(status, theme);
    res.json({
      success: true,
      data: {
        status,
        theme: theme || 'canyon',
        color
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Alerts management
router.get('/alerts', (req, res) => {
  try {
    const { limit = 10 } = req.query;
    const alerts = statusDashboardManager.alerts.slice(-parseInt(limit));
    res.json({
      success: true,
      data: alerts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/alerts', (req, res) => {
  try {
    const { type, level, message, details } = req.body;

    if (!type || !level || !message) {
      return res.status(400).json({
        success: false,
        error: 'type, level, and message are required'
      });
    }

    statusDashboardManager.addAlert({
      type,
      level,
      message,
      details
    });

    res.json({
      success: true,
      message: 'Alert added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Blockers management
router.get('/blockers', (req, res) => {
  try {
    const blockers = statusDashboardManager.blockers;
    res.json({
      success: true,
      data: blockers
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.post('/blockers', (req, res) => {
  try {
    const { type, title, description, priority } = req.body;

    if (!type || !title) {
      return res.status(400).json({
        success: false,
        error: 'type and title are required'
      });
    }

    statusDashboardManager.addBlocker({
      type,
      title,
      description,
      priority: priority || 'medium'
    });

    res.json({
      success: true,
      message: 'Blocker added successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

router.delete('/blockers/:blockerId', (req, res) => {
  try {
    const { blockerId } = req.params;
    statusDashboardManager.clearBlocker(blockerId);
    res.json({
      success: true,
      message: 'Blocker cleared successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Complete status dashboard endpoint
router.get('/complete', async (req, res) => {
  try {
    const [branchStatus, taskProgress] = await Promise.all([
      statusDashboardManager.getBranchStatus(),
      statusDashboardManager.getTaskProgress()
    ]);

    const tokenStats = statusDashboardManager.getTokenUsageStats();
    const fileStats = statusDashboardManager.getFileMonitorStats();
    const workspaceSummary = await statusDashboardManager.getWorkspaceSummary();
    const health = await statusDashboardManager.getProjectHealth({
      branchStatus,
      taskProgress,
      tokenStats,
      fileStats,
      workspaceSummary
    });

    res.json({
      success: true,
      data: {
        branch: branchStatus,
        tasks: taskProgress,
        tokens: tokenStats,
        files: fileStats,
        workspaces: workspaceSummary,
        health: health,
        alerts: statusDashboardManager.alerts.slice(-5),
        blockers: statusDashboardManager.blockers,
        timestamp: new Date().toISOString()
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Session management
router.post('/session/reset', (req, res) => {
  try {
    statusDashboardManager.resetSession();
    res.json({
      success: true,
      message: 'Session reset successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Legacy compatibility endpoint for existing status bar
router.get('/status', async (req, res) => {
  try {
    const tokenStats = statusDashboardManager.getTokenUsageStats();
    const fileStats = statusDashboardManager.getFileMonitorStats();
    const branchStatus = await statusDashboardManager.getBranchStatus();

    // Format response for compatibility with existing terminal status bar
    res.json({
      percentage: tokenStats.usagePercentage,
      contextUsed: tokenStats.totalTokens,
      contextLimit: tokenStats.quota,
      currentTask: null, // Will be populated by active task tracking
      filesEdited: fileStats.touched,
      daicState: null, // Placeholder for DAIC integration
      branch: branchStatus.currentBranch,
      divergence: branchStatus.divergenceText,
      health: (await statusDashboardManager.getProjectHealth()).status
    });
  } catch (error) {
    res.status(500).json({
      error: error.message
    });
  }
});

module.exports = router;
