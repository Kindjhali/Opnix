
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
        { id: 'ms-a', title: 'Milestone A', status: 'active', progress: 50 },
        { id: 'ms-b', title: 'Milestone B', status: 'active', progress: 100, dependencies: ['ms-a'] }
      ],
      history: []
    };

    await writeRoadmapState(seedState, { immediate: true });
    await roadmapStateManager.load();

    const progressResult = await updateRoadmapMilestone('ms-a', { progress: 80 }, { skipGit: true });
    const cascadeIds = (progressResult.cascadedChanges || []).map(change => String(change.id));
    assert.ok(cascadeIds.includes('ms-b'), 'dependent milestone should appear in cascaded changes');

    const progressState = progressResult.state;
    const dependentAfterProgress = progressState.milestones.find(item => String(item.id) === 'ms-b');
    assert.ok(dependentAfterProgress, 'dependent milestone should persist after progress update');
    assert.equal(dependentAfterProgress.progress, 80, 'dependent progress should match dependency progress');
    assert.equal(dependentAfterProgress.dependencySummary.status, 'pending');
    assert.equal(dependentAfterProgress.dependencySummary.gatingProgress, 80);

    const blockedResult = await updateRoadmapMilestone('ms-a', { status: 'blocked' }, { skipGit: true });
    const blockedCascadeIds = (blockedResult.cascadedChanges || []).map(change => String(change.id));
    assert.ok(blockedCascadeIds.includes('ms-b'), 'dependent cascade should fire when dependency becomes blocked');

    const blockedState = blockedResult.state;
    const dependentAfterBlocked = blockedState.milestones.find(item => String(item.id) === 'ms-b');
    assert.ok(dependentAfterBlocked);
    assert.equal(dependentAfterBlocked.status, 'blocked', 'dependent should be blocked when dependency is blocked');
    assert.equal(dependentAfterBlocked.progress, 0, 'dependent progress should reset when dependency blocked');
    assert.equal(dependentAfterBlocked.dependencySummary.status, 'blocked');

    console.log('roadmap dependency cascade tests passed');
process.exit(0);
  } finally {
    await writeFile(STATE_PATH, backup, 'utf8');
    await roadmapStateManager.load();
  }
})();
