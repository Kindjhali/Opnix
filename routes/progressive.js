const express = require('express');

let progressiveDeps = null;

function setProgressiveDependencies(deps) {
  progressiveDeps = deps;
}

function getDeps() {
  if (!progressiveDeps) {
    throw new Error('Progressive routes not initialised with dependencies');
  }
  return progressiveDeps;
}

async function getSystem(req, res, handler) {
  const { initializeProgressiveSystem, logServerError } = getDeps();
  try {
    const system = await initializeProgressiveSystem();
    return handler(system);
  } catch (error) {
    logServerError('progressive:init', error);
    res.status(500).json({ error: 'Failed to initialize progressive system' });
    return null;
  }
}

function createStatusRoute() {
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      const status = await system.getSystemStatus();
      res.json(status);
    });
  };
}

function createInitializeRoute() {
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      const analysis = await system.initialize();
      res.json({
        success: true,
        analysis,
        message: 'Progressive Document System initialized and initial analysis complete'
      });
    });
  };
}

function createQuestionStartRoute() {
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      const session = await system.startProgressiveQuestioning();
      res.json(session);
    });
  };
}

function createQuestionRespondRoute() {
  const { logServerError } = getDeps();
  return async (req, res) => {
    const { questionId, response } = req.body || {};

    if (!questionId || response === undefined) {
      res.status(400).json({ error: 'Question ID and response are required' });
      return;
    }

    await getSystem(req, res, async (system) => {
      try {
        const result = await system.processQuestionResponse(questionId, response);
        res.json(result);
      } catch (error) {
        logServerError('progressive:respond', error);
        res.status(500).json({ error: 'Failed to process question response' });
      }
    });
  };
}

function createGeneratePackageRoute() {
  const { logServerError } = getDeps();
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      try {
        const documentPackage = await system.generateCompleteDocumentPackage();
        res.json(documentPackage);
      } catch (error) {
        logServerError('progressive:generate-package', error);
        res.status(500).json({ error: 'Failed to generate document package' });
      }
    });
  };
}

function createRegenerateRoute() {
  const { logServerError } = getDeps();
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      try {
        const result = await system.regenerateAllArtifacts();
        res.json({ success: true, result, message: 'All artifacts regenerated successfully' });
      } catch (error) {
        logServerError('progressive:regenerate', error);
        res.status(500).json({ error: 'Failed to regenerate artifacts' });
      }
    });
  };
}

function createCanvasUpdateRoute() {
  const { logServerError } = getDeps();
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      try {
        const canvasData = await system.updateCanvasWithAnalysis();
        res.json({ success: true, canvasData, message: 'Canvas updated with progressive analysis' });
      } catch (error) {
        logServerError('progressive:canvas-update', error);
        res.status(500).json({ error: 'Failed to update canvas' });
      }
    });
  };
}

function createModulesEnhancedRoute() {
  const { logServerError, moduleDetector, ROOT_DIR } = getDeps();
  return async (req, res) => {
    await getSystem(req, res, async (system) => {
      try {
        const moduleData = await moduleDetector.detectModules(ROOT_DIR);
        const canvasData = await system.updateCanvasWithAnalysis();
        res.json({
          ...moduleData,
          progressiveAnalysis: canvasData.analysis,
          enhancedModules: canvasData.modules
        });
      } catch (error) {
        logServerError('progressive:modules-enhanced', error);
        res.status(500).json({ error: 'Failed to get enhanced module data' });
      }
    });
  };
}

function createProgressiveRoutes(deps) {
  setProgressiveDependencies(deps);
  const router = express.Router();

  router.get('/api/progressive/status', createStatusRoute());
  router.post('/api/progressive/initialize', createInitializeRoute());
  router.post('/api/progressive/questions/start', createQuestionStartRoute());
  router.post('/api/progressive/questions/respond', createQuestionRespondRoute());
  router.post('/api/progressive/generate-package', createGeneratePackageRoute());
  router.post('/api/progressive/regenerate', createRegenerateRoute());
  router.post('/api/progressive/canvas/update', createCanvasUpdateRoute());
  router.get('/api/progressive/modules/enhanced', createModulesEnhancedRoute());

  return router;
}

module.exports = createProgressiveRoutes;
