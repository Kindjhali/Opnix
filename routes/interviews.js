const express = require('express');
const { interviewLoader } = require('../services/interviewLoader');
const questionFileWatcher = require('../services/questionFileWatcher');

/**
 * Create interview-related routes
 */
function createInterviewsRoutes() {
  const router = express.Router();

  /**
   * POST /api/interviews/reload
   * Manually trigger a reload of interview questions
   */
  router.post('/api/interviews/reload', async (req, res) => {
    try {
      // For now, we'll allow any authenticated request
      // In production, you might want to check req.user.canReloadQuestions
      
      // Invalidate cache
      interviewLoader.invalidateCache();
      
      // Force reload from file watcher
      const changeData = await questionFileWatcher.forceReload();
      
      // Get updated question count
      const questionCount = interviewLoader.getQuestionCount();
      
      res.json({
        success: true,
        newVersion: interviewLoader.cacheVersion,
        questionsReloaded: questionCount,
        diff: changeData?.diff || { sections: [], questions: [] },
        message: `Successfully reloaded ${questionCount} questions`
      });
      
    } catch (error) {
      console.error('Failed to reload interview questions:', error);
      res.status(500).json({ 
        success: false,
        error: error.message || 'Failed to reload interview questions' 
      });
    }
  });

  /**
   * GET /api/interviews/status
   * Get current interview system status
   */
  router.get('/api/interviews/status', async (req, res) => {
    try {
      const blueprint = await interviewLoader.loadInterviewBlueprint();
      const questionCount = interviewLoader.getQuestionCount();
      
      res.json({
        cacheVersion: interviewLoader.cacheVersion,
        questionCount,
        watcherRunning: questionFileWatcher.isRunning(),
        lastHash: questionFileWatcher.lastHash,
        sections: blueprint.sections ? Object.keys(blueprint.sections).length : 0
      });
      
    } catch (error) {
      res.status(500).json({ 
        error: 'Failed to get interview status',
        details: error.message 
      });
    }
  });

  return router;
}

module.exports = { createInterviewsRoutes };