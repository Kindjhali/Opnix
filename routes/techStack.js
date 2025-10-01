const express = require('express');

function createTechStackRoutes({ techStackManager }) {
  if (!techStackManager) {
    throw new Error('Tech stack manager dependency is required');
  }

  const router = express.Router();

  router.get('/api/tech-stack', async (_req, res) => {
    try {
      const summary = await techStackManager.getTechStackSummary({ refresh: true });
      res.json({ success: true, summary });
    } catch (error) {
      console.error('Tech stack summary error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to load tech stack summary' });
    }
  });

  router.post('/api/tech-stack/export', async (_req, res) => {
    try {
      const result = await techStackManager.exportTechStackMarkdown();
      res.json(result);
    } catch (error) {
      console.error('Tech stack export error:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to export tech stack summary' });
    }
  });

  return router;
}

module.exports = {
  createTechStackRoutes
};
