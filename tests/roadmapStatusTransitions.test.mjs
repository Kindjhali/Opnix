import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ensureRoadmapStateFile,
  writeRoadmapState,
  updateRoadmapMilestone,
  roadmapStateManager
} from '../services/roadmapState.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT_DIR, 'data', 'roadmap-state.json');

(async () => {
  await ensureRoadmapStateFile();
  const backup = await readFile(STATE_PATH, 'utf8');

  try {
    const seedState = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      summary: { source: 'test', ticketCount: 0, moduleCount: 0, featureCount: 0 },
      milestones: [
        { id: 'ms-status', name: 'Status Transition', status: 'pending', progress: 0 }
      ],
      history: []
    };

    await writeRoadmapState(seedState, { immediate: true });
    await roadmapStateManager.load();

    let result = await updateRoadmapMilestone('ms-status', { status: 'active' });
    let milestone = result.state.milestones.find(item => String(item.id) === 'ms-status');
    assert.ok(milestone, 'milestone should exist after status update');
    assert.equal(milestone.status, 'active');

    result = await updateRoadmapMilestone('ms-status', { status: 'completed' });
    milestone = result.state.milestones.find(item => String(item.id) === 'ms-status');
    assert.equal(milestone.status, 'completed');

    let rejectedTransition = false;
    try {
      await updateRoadmapMilestone('ms-status', { status: 'active' });
    } catch (error) {
      rejectedTransition = true;
      assert.match(error.message, /Invalid roadmap status transition/i);
    }
    assert.equal(rejectedTransition, true, 'completed milestones should not revert to active');

    let rejectedStatus = false;
    try {
      await updateRoadmapMilestone('ms-status', { status: 'unknown-status' });
    } catch (error) {
      rejectedStatus = true;
      assert.match(error.message, /Unknown roadmap status/i);
    }
    assert.equal(rejectedStatus, true, 'unknown statuses should be rejected');

    console.log('roadmap status transition tests passed');
  } finally {
    await writeFile(STATE_PATH, backup, 'utf8');
    await roadmapStateManager.load();
  }
})();
