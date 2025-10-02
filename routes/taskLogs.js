const express = require('express');
const taskLogger = require('../services/taskLogger');
const compactionAlerter = require('../services/compactionAlerter');

const router = express.Router();

// Note: task logger and compaction alerter are initialized in server.js start() function
// to ensure process.env.PROJECT_PATH is set correctly before initialization

// Start a new task
router.post('/tasks', async (req, res) => {
  try {
    const { name, description, author = 'api-user', context = {} } = req.body;

    if (!name || !description) {
      return res.status(400).json({ error: 'Task name and description are required' });
    }

    const taskId = await taskLogger.startTask(name, description, author, context);

    res.json({
      success: true,
      taskId,
      message: `Task '${name}' started successfully`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Add a note to an active task
router.post('/tasks/:taskId/notes', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { message, type = 'note', context = {} } = req.body;

    if (!message) {
      return res.status(400).json({ error: 'Note message is required' });
    }

    await taskLogger.addTaskNote(taskId, message, type, context);

    res.json({
      success: true,
      message: 'Note added successfully'
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Update task metrics
router.put('/tasks/:taskId/metrics', async (req, res) => {
  try {
    const { taskId } = req.params;
    const metrics = req.body;

    await taskLogger.updateTaskMetrics(taskId, metrics);

    res.json({
      success: true,
      message: 'Task metrics updated successfully'
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Complete a task
router.post('/tasks/:taskId/complete', async (req, res) => {
  try {
    const { taskId } = req.params;
    const { summary, outcome = 'success' } = req.body;

    if (!summary) {
      return res.status(400).json({ error: 'Task summary is required for completion' });
    }

    const result = await taskLogger.completeTask(taskId, summary, outcome);

    res.json({
      success: true,
      ...result,
      message: 'Task completed successfully'
    });
  } catch (error) {
    if (error.message.includes('not found')) {
      res.status(404).json({ error: error.message });
    } else {
      res.status(500).json({ error: error.message });
    }
  }
});

// Get task recaps
router.get('/recaps', async (req, res) => {
  try {
    const { limit = 10, author } = req.query;
    const recaps = await taskLogger.getTaskRecaps(parseInt(limit), author);

    res.json({
      recaps,
      count: recaps.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get active tasks
router.get('/tasks/active', async (req, res) => {
  try {
    const activeTasks = await taskLogger.getActiveTasks();

    res.json({
      activeTasks,
      count: activeTasks.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get specific task details
router.get('/tasks/:taskId', async (req, res) => {
  try {
    const { taskId } = req.params;
    const task = await taskLogger.loadTaskLog(taskId);

    if (!task) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(task);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get compaction alerts
router.get('/compaction-alerts', async (req, res) => {
  try {
    const alerts = await taskLogger.getCompactionAlerts();

    res.json({
      alerts,
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Get project narrative
router.get('/narrative', async (req, res) => {
  try {
    const narrative = await taskLogger.getNarrativeSummary();

    if (!narrative) {
      return res.status(404).json({ error: 'Narrative not found' });
    }

    res.json(narrative);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Archive old logs
router.post('/archive', async (req, res) => {
  try {
    const { daysOld = 30 } = req.body;
    const archived = await taskLogger.archiveOldLogs(daysOld);

    res.json({
      success: true,
      archived,
      count: archived.length,
      message: `Archived ${archived.length} old task logs`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// CLI endpoint for quick task summaries
router.get('/cli/summary', async (req, res) => {
  try {
    const [activeTasks, recentRecaps, alerts] = await Promise.all([
      taskLogger.getActiveTasks(),
      taskLogger.getTaskRecaps(5),
      taskLogger.getCompactionAlerts()
    ]);

    const summary = {
      activeTasks: activeTasks.length,
      recentlyCompleted: recentRecaps.filter(r => r.outcome === 'success').length,
      pendingAlerts: alerts.length,
      recentTasks: recentRecaps.slice(0, 3).map(recap => ({
        name: recap.name,
        duration: recap.duration,
        outcome: recap.outcome
      }))
    };

    res.json(summary);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Compaction management endpoints
router.get('/compaction/status', async (req, res) => {
  try {
    const status = await compactionAlerter.getCompactionStatus();
    res.json(status);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.post('/compaction/check', async (req, res) => {
  try {
    const alerts = await compactionAlerter.runCompactionCheck();
    res.json({
      success: true,
      alerts,
      alertCount: alerts.length,
      message: `Compaction check completed, ${alerts.length} alerts generated`
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.put('/compaction/config', async (req, res) => {
  try {
    await compactionAlerter.updateConfig(req.body);
    res.json({
      success: true,
      message: 'Compaction configuration updated'
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

router.get('/compaction/alerts', async (req, res) => {
  try {
    const { limit = 20 } = req.query;
    const alerts = await compactionAlerter.getRecentAlerts(parseInt(limit));
    res.json({
      alerts,
      count: alerts.length
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;