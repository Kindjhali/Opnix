const express = require('express');
const fs = require('fs').promises;
const path = require('path');

const router = express.Router();

// Ensure data directory exists
const DATA_DIR = path.join(__dirname, '..', 'data');
const PROGRESS_DIR = path.join(DATA_DIR, 'progress');
const PROGRESS_FILE = path.join(DATA_DIR, 'progress.json');

async function ensureDirectories() {
  try {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(PROGRESS_DIR, { recursive: true });
  } catch (error) {
    console.warn('Could not create progress directories:', error.message);
  }
}

// Initialize directories
ensureDirectories();

// Load progress data from file
async function loadProgressData() {
  try {
    const data = await fs.readFile(PROGRESS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return { sessions: {}, metadata: { version: '1.0.0', createdAt: new Date().toISOString() } };
    }
    throw error;
  }
}

// Save progress data to file
async function saveProgressData(data) {
  const backupFile = path.join(PROGRESS_DIR, `progress-backup-${Date.now()}.json`);

  try {
    // Create backup if file exists
    try {
      await fs.access(PROGRESS_FILE);
      await fs.copyFile(PROGRESS_FILE, backupFile);
    } catch {
      // File doesn't exist, no backup needed
    }

    // Save new data
    await fs.writeFile(PROGRESS_FILE, JSON.stringify(data, null, 2), 'utf8');

    // Clean up old backups (keep only last 10)
    try {
      const backupFiles = await fs.readdir(PROGRESS_DIR);
      const progressBackups = backupFiles
        .filter(file => file.startsWith('progress-backup-'))
        .sort()
        .reverse();

      if (progressBackups.length > 10) {
        const filesToDelete = progressBackups.slice(10);
        await Promise.all(
          filesToDelete.map(file =>
            fs.unlink(path.join(PROGRESS_DIR, file)).catch(console.warn)
          )
        );
      }
    } catch (error) {
      console.warn('Could not clean up old backups:', error.message);
    }

    return true;
  } catch (error) {
    // Try to restore backup if save failed
    try {
      await fs.copyFile(backupFile, PROGRESS_FILE);
    } catch (restoreError) {
      console.error('Failed to restore backup after save failure:', restoreError);
    }
    throw error;
  }
}

// Save individual session to separate file
async function saveSessionFile(sessionId, sessionData) {
  const sessionFile = path.join(PROGRESS_DIR, `session-${sessionId}.json`);
  const sessionWithMetadata = {
    ...sessionData,
    savedAt: new Date().toISOString(),
    version: '1.0.0'
  };

  await fs.writeFile(sessionFile, JSON.stringify(sessionWithMetadata, null, 2), 'utf8');
  return sessionFile;
}

// Load individual session from file
async function loadSessionFile(sessionId) {
  const sessionFile = path.join(PROGRESS_DIR, `session-${sessionId}.json`);

  try {
    const data = await fs.readFile(sessionFile, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return null;
    }
    throw error;
  }
}

// List all session files
async function listSessionFiles() {
  try {
    const files = await fs.readdir(PROGRESS_DIR);
    const sessionFiles = files.filter(file => file.startsWith('session-') && file.endsWith('.json'));

    const sessions = await Promise.all(
      sessionFiles.map(async (file) => {
        try {
          const sessionId = file.replace('session-', '').replace('.json', '');
          const filePath = path.join(PROGRESS_DIR, file);
          const stats = await fs.stat(filePath);
          const data = await fs.readFile(filePath, 'utf8');
          const session = JSON.parse(data);

          return {
            sessionId,
            title: session.title || 'Untitled Session',
            type: session.type || 'general',
            status: session.status || 'pending',
            progress: session.progress || 0,
            createdAt: session.createdAt,
            updatedAt: session.updatedAt,
            lastModified: stats.mtime.toISOString(),
            fileSize: stats.size
          };
        } catch (error) {
          console.warn(`Could not read session file ${file}:`, error.message);
          return null;
        }
      })
    );

    return sessions.filter(Boolean).sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));
  } catch (error) {
    console.warn('Could not list session files:', error.message);
    return [];
  }
}

// GET /api/progress/sessions - List all progress sessions
router.get('/sessions', async (req, res) => {
  try {
    const sessions = await listSessionFiles();
    res.json({ sessions });
  } catch (error) {
    console.error('Failed to list progress sessions:', error);
    res.status(500).json({ error: 'Failed to list sessions', details: error.message });
  }
});

// GET /api/progress/load - Load all progress data
router.get('/load', async (req, res) => {
  try {
    const data = await loadProgressData();
    res.json(data);
  } catch (error) {
    console.error('Failed to load progress data:', error);
    res.status(500).json({ error: 'Failed to load progress data', details: error.message });
  }
});

// GET /api/progress/load/:sessionId - Load specific session
router.get('/load/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    const sessionData = await loadSessionFile(sessionId);

    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    res.json(sessionData);
  } catch (error) {
    console.error('Failed to load session:', error);
    res.status(500).json({ error: 'Failed to load session', details: error.message });
  }
});

// POST /api/progress/save - Save progress data
router.post('/save', async (req, res) => {
  try {
    const { sessionId, progressData, timestamp } = req.body;

    if (!sessionId || !progressData) {
      return res.status(400).json({ error: 'sessionId and progressData are required' });
    }

    // Save to individual session file
    const sessionFile = await saveSessionFile(sessionId, progressData);

    // Update main progress file
    const allData = await loadProgressData();
    allData.sessions[sessionId] = {
      ...progressData,
      lastSaved: timestamp || new Date().toISOString()
    };
    allData.metadata.lastUpdated = new Date().toISOString();

    await saveProgressData(allData);

    res.json({
      success: true,
      sessionId,
      sessionFile,
      savedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to save progress:', error);
    res.status(500).json({ error: 'Failed to save progress', details: error.message });
  }
});

// POST /api/progress/checkpoint - Create checkpoint for session
router.post('/checkpoint', async (req, res) => {
  try {
    const { sessionId, description, metadata } = req.body;

    if (!sessionId) {
      return res.status(400).json({ error: 'sessionId is required' });
    }

    const sessionData = await loadSessionFile(sessionId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    // Create checkpoint
    const checkpoint = {
      id: `checkpoint-${Date.now()}`,
      description: description || 'Auto-checkpoint',
      timestamp: new Date().toISOString(),
      sessionSnapshot: JSON.parse(JSON.stringify(sessionData)), // Deep copy
      metadata: metadata || {}
    };

    // Add checkpoint to session
    if (!sessionData.checkpoints) {
      sessionData.checkpoints = [];
    }
    sessionData.checkpoints.push(checkpoint);

    // Limit checkpoints to last 20
    if (sessionData.checkpoints.length > 20) {
      sessionData.checkpoints = sessionData.checkpoints.slice(-20);
    }

    // Save updated session
    await saveSessionFile(sessionId, sessionData);

    res.json({
      success: true,
      checkpoint,
      checkpointCount: sessionData.checkpoints.length
    });
  } catch (error) {
    console.error('Failed to create checkpoint:', error);
    res.status(500).json({ error: 'Failed to create checkpoint', details: error.message });
  }
});

// POST /api/progress/restore - Restore session from checkpoint
router.post('/restore', async (req, res) => {
  try {
    const { sessionId, checkpointId } = req.body;

    if (!sessionId || !checkpointId) {
      return res.status(400).json({ error: 'sessionId and checkpointId are required' });
    }

    const sessionData = await loadSessionFile(sessionId);
    if (!sessionData) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const checkpoint = sessionData.checkpoints?.find(c => c.id === checkpointId);
    if (!checkpoint) {
      return res.status(404).json({ error: 'Checkpoint not found' });
    }

    // Restore session from checkpoint
    const restoredSession = {
      ...checkpoint.sessionSnapshot,
      id: sessionId, // Preserve original ID
      restoredAt: new Date().toISOString(),
      restoredFrom: checkpointId
    };

    await saveSessionFile(sessionId, restoredSession);

    res.json({
      success: true,
      sessionId,
      checkpointId,
      restoredAt: new Date().toISOString()
    });
  } catch (error) {
    console.error('Failed to restore from checkpoint:', error);
    res.status(500).json({ error: 'Failed to restore from checkpoint', details: error.message });
  }
});

// DELETE /api/progress/session/:sessionId - Delete session
router.delete('/session/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;

    // Remove from main progress file
    const allData = await loadProgressData();
    delete allData.sessions[sessionId];
    await saveProgressData(allData);

    // Remove session file
    const sessionFile = path.join(PROGRESS_DIR, `session-${sessionId}.json`);
    try {
      await fs.unlink(sessionFile);
    } catch (error) {
      if (error.code !== 'ENOENT') {
        console.warn('Could not delete session file:', error.message);
      }
    }

    res.json({ success: true, sessionId });
  } catch (error) {
    console.error('Failed to delete session:', error);
    res.status(500).json({ error: 'Failed to delete session', details: error.message });
  }
});

// GET /api/progress/stats - Get progress statistics
router.get('/stats', async (req, res) => {
  try {
    const sessions = await listSessionFiles();

    const stats = {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'active').length,
      completedSessions: sessions.filter(s => s.status === 'completed').length,
      averageProgress: sessions.length > 0
        ? Math.round(sessions.reduce((sum, s) => sum + s.progress, 0) / sessions.length)
        : 0,
      recentSessions: sessions.slice(0, 5),
      sessionsByType: {}
    };

    // Group by type
    sessions.forEach(session => {
      if (!stats.sessionsByType[session.type]) {
        stats.sessionsByType[session.type] = 0;
      }
      stats.sessionsByType[session.type]++;
    });

    res.json(stats);
  } catch (error) {
    console.error('Failed to get progress stats:', error);
    res.status(500).json({ error: 'Failed to get stats', details: error.message });
  }
});

// POST /api/progress/cleanup - Clean up old sessions and backups
router.post('/cleanup', async (req, res) => {
  try {
    const { olderThanDays = 30, keepRecent = 10 } = req.body;
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - olderThanDays);

    const sessions = await listSessionFiles();
    let deletedCount = 0;

    // Keep most recent sessions and delete old ones
    const sessionsToDelete = sessions
      .filter(session => new Date(session.lastModified) < cutoffDate)
      .slice(keepRecent); // Skip the most recent ones

    for (const session of sessionsToDelete) {
      try {
        const sessionFile = path.join(PROGRESS_DIR, `session-${session.sessionId}.json`);
        await fs.unlink(sessionFile);
        deletedCount++;
      } catch (error) {
        console.warn(`Could not delete session ${session.sessionId}:`, error.message);
      }
    }

    // Clean up backup files
    const backupFiles = await fs.readdir(PROGRESS_DIR);
    const oldBackups = backupFiles
      .filter(file => file.startsWith('progress-backup-'))
      .sort()
      .slice(0, -5); // Keep last 5 backups

    for (const backup of oldBackups) {
      try {
        await fs.unlink(path.join(PROGRESS_DIR, backup));
      } catch (error) {
        console.warn(`Could not delete backup ${backup}:`, error.message);
      }
    }

    res.json({
      success: true,
      deletedSessions: deletedCount,
      deletedBackups: oldBackups.length,
      remainingSessions: sessions.length - deletedCount
    });
  } catch (error) {
    console.error('Failed to cleanup progress data:', error);
    res.status(500).json({ error: 'Failed to cleanup', details: error.message });
  }
});

module.exports = router;