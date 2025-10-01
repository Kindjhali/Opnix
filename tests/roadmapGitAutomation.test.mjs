import assert from 'node:assert/strict';
import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  ensureRoadmapStateFile,
  writeRoadmapState,
  updateRoadmapMilestone,
  roadmapStateManager,
  setGitAutomationManager
} from '../services/roadmapState.js';
import gitAutomationManager from '../services/gitAutomationManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.join(__dirname, '..');
const STATE_PATH = path.join(ROOT_DIR, 'data', 'roadmap-state.json');

(async () => {
  await ensureRoadmapStateFile();
  let backup = null;
  try {
    backup = await readFile(STATE_PATH, 'utf8');
  } catch {
    backup = null;
  }

  const stubGit = {
    autoCommitMilestoneCalls: 0,
    generatedSummaries: [],
    lastArgs: null,
    generateMilestoneCompletionSummary(milestone, ctx = {}) {
      this.generatedSummaries.push({ id: milestone.id, ctx });
      return `Stub summary for ${milestone.id}`;
    },
    async autoCommitMilestone(milestone, options = {}) {
      this.autoCommitMilestoneCalls += 1;
      this.lastArgs = { milestone: { ...milestone }, options };
      return {
        success: true,
        commitMessage: `Milestone commit for ${milestone.id}`,
        changes: ['M data/roadmap-state.json'],
        branch: 'main'
      };
    }
  };

  const seedState = {
    version: '1.0.0',
    lastUpdated: new Date().toISOString(),
    summary: { source: 'test', ticketCount: 0, moduleCount: 0, featureCount: 0 },
    milestones: [
      { id: 'ms-commit', title: 'Stabilise Release', status: 'active', progress: 75 },
      { id: 'ms-skip', title: 'Skipped Milestone', status: 'active', progress: 10 }
    ],
    history: []
  };

  try {
    setGitAutomationManager(stubGit);

    await writeRoadmapState(seedState, { immediate: true });
    await roadmapStateManager.load();

    const completionResult = await updateRoadmapMilestone('ms-commit', { status: 'completed' }, {
      reason: 'roadmap:manual-edit:test',
      actor: 'tester'
    });

    const storedState = completionResult.state.milestones.find(item => String(item.id) === 'ms-commit');
    assert.ok(storedState, 'milestone should persist after completion');
    assert.equal(storedState.status, 'completed');
    assert.ok(storedState.completedAt, 'completedAt timestamp should be set');
    assert.equal(storedState.completionSummary, 'Stub summary for ms-commit');

    assert.equal(stubGit.autoCommitMilestoneCalls, 1, 'git automation should run once for completed milestone');
    assert.ok(completionResult.gitAutomationResult);
    assert.equal(completionResult.gitAutomationResult.success, true);
    assert.equal(stubGit.generatedSummaries.length > 0, true, 'summary generator should be invoked');

    // Ensure non-manual reasons do not trigger automation
    await writeRoadmapState(seedState, { immediate: true });
    await roadmapStateManager.load();
    stubGit.autoCommitMilestoneCalls = 0;
    stubGit.generatedSummaries.length = 0;

    await updateRoadmapMilestone('ms-skip', { status: 'completed' }, {
      reason: 'watcher:sync',
      actor: 'system'
    });

    assert.equal(stubGit.autoCommitMilestoneCalls, 0, 'automation should not run for non-manual reasons');
    assert.equal(stubGit.generatedSummaries.length, 1, 'summary generator still runs to keep state consistent');

    console.log('roadmap git automation tests passed');
process.exit(0);
  } finally {
    setGitAutomationManager(gitAutomationManager);
    if (backup !== null) {
      await writeFile(STATE_PATH, backup, 'utf8');
      await roadmapStateManager.load();
    }
  }
})();
