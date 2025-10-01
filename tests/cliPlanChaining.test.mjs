import { test, after } from 'node:test';
import assert from 'node:assert/strict';

import server from '../server.js';
import { stopRoadmapSyncWatchers } from '../services/roadmapSyncWatcher.js';
import questionFileWatcher from '../services/questionFileWatcher.js';

const { __internals } = server;

// Cleanup function
async function cleanup() {
  try {
    await stopRoadmapSyncWatchers();
    questionFileWatcher.stop();
  } catch (error) {
    // Ignore cleanup errors
  }
}

test('appendPlanStageIfAvailable appends plan artefacts and messages', async () => {
  const collector = { messages: [], artifacts: [] };
  const stubFlow = {
    async generatePlanStage() {
      return {
        result: 'Delivery plan ready',
        messages: ['Delivery plan compiled from latest audit.', 'Plan saved to spec/cli-plan-123.md'],
        artifacts: [
          { type: 'cli-plan', path: '/tmp/cli-plan-123.md', filename: 'cli-plan-123.md', relativePath: 'spec/cli-plan-123.md' }
        ],
        metadata: { followUpsCount: 2 }
      };
    }
  };

  const planResult = await __internals.appendPlanStageIfAvailable({ collector, flow: stubFlow });

  assert(planResult, 'Plan result should be returned');
  assert.equal(collector.messages.length, 2);
  assert.equal(collector.artifacts.length, 1);
  assert.equal(collector.artifacts[0].type, 'cli-plan');
});

test('appendPlanStageIfAvailable handles missing flow', async () => {
  const collector = { messages: ['foo'], artifacts: [] };
  const planResult = await __internals.appendPlanStageIfAvailable({ collector, flow: null });
  assert.equal(planResult, null);
  assert.deepEqual(collector.messages, ['foo']);
  assert.equal(collector.artifacts.length, 0);
});

test('appendTasksStageIfAvailable appends task artefacts and messages', async () => {
  const collector = { messages: [], artifacts: [] };
  const stubFlow = {
    async generateTasksStage() {
      return {
        result: 'Task summary ready',
        messages: ['Task queue compiled.', 'Tasks saved to spec/cli-tasks-123.md'],
        artifacts: [
          { type: 'cli-tasks', path: '/tmp/cli-tasks-123.md', filename: 'cli-tasks-123.md', relativePath: 'spec/cli-tasks-123.md' }
        ],
        metadata: { openTickets: 3 }
      };
    }
  };

  const tasksResult = await __internals.appendTasksStageIfAvailable({ collector, flow: stubFlow });

  assert(tasksResult, 'Tasks result should be returned');
  assert.equal(collector.messages.length, 2);
  assert.equal(collector.artifacts.length, 1);
  assert.equal(collector.artifacts[0].type, 'cli-tasks');
});

after(async () => {
  await cleanup();
});
