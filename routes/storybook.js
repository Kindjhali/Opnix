const express = require('express');
const { spawn } = require('child_process');

let storybookProcess = null;
let startingPromise = null;
let teardownAttached = false;

function ensureTeardownHook() {
  if (teardownAttached) return;
  process.on('exit', () => {
    try {
      storybookProcess?.kill();
    } catch {
      // ignore
    }
  });
  teardownAttached = true;
}

async function startStorybookProcess() {
  if (storybookProcess) {
    return { alreadyRunning: true, pid: storybookProcess.pid };
  }
  if (startingPromise) {
    return startingPromise;
  }

  startingPromise = new Promise((resolve, reject) => {
    try {
      const child = spawn('npm', ['run', 'storybook', '--', '--no-open'], {
        stdio: 'pipe',
        detached: false
      });

      storybookProcess = child;
      ensureTeardownHook();

      const handleExit = () => {
        storybookProcess = null;
      };

      child.once('exit', handleExit);
      child.once('error', error => {
        handleExit();
        reject(error);
      });

      resolve({ alreadyRunning: false, pid: child.pid });
    } catch (error) {
      reject(error);
    }
  }).finally(() => {
    startingPromise = null;
  });

  return startingPromise;
}

function storybookStatus() {
  return {
    running: Boolean(storybookProcess),
    pid: storybookProcess?.pid || null
  };
}

function createStorybookRoutes() {
  const router = express.Router();

  router.get('/api/storybook/status', (_req, res) => {
    res.json(storybookStatus());
  });

  router.post('/api/storybook/start', async (_req, res) => {
    try {
      const result = await startStorybookProcess();
      res.json({ success: true, ...storybookStatus(), alreadyRunning: result.alreadyRunning });
    } catch (error) {
      console.error('🎨 Storybook: Start failed via API:', error);
      res.status(500).json({ success: false, error: error.message || 'Failed to start Storybook' });
    }
  });

  return router;
}

module.exports = {
  createStorybookRoutes,
  startStorybookProcess,
  storybookStatus
};
