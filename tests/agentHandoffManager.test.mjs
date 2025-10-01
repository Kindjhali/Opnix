import { test } from 'node:test';
import assert from 'node:assert/strict';
import os from 'node:os';
import path from 'node:path';
import fs from 'node:fs/promises';

import { createAgentHandoffManager } from '../services/agentHandoffManager.js';

function tempPath(prefix) {
  return fs.mkdtemp(path.join(os.tmpdir(), prefix));
}

test('agent handoff manager persists and updates handoffs', async (t) => {
  const tmpDir = await tempPath('opnix-handoff-');
  const manager = createAgentHandoffManager({ dataDir: tmpDir });

  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const initialList = await manager.listHandoffs();
  assert.equal(Array.isArray(initialList), true);
  assert.equal(initialList.length, 0);

  const handoff = await manager.createHandoff({
    summary: 'Transfer roadmap milestone ownership',
    originAgent: 'delivery-architect',
    targetAgent: 'implementation-lead',
    context: 'Milestone MS-42 needs implementation follow-up',
    artefacts: [
      { type: 'doc', value: 'spec/runbooks/roadmap-ms42.md', description: 'Runbook outline' }
    ],
    requirements: [
      { requirement: 'Confirm module coverage', status: 'pending' }
    ],
    notes: [{ author: 'delivery-architect', note: 'Escalated from planning sync' }],
    tags: ['roadmap', 'handoff']
  });

  assert.ok(handoff.id, 'handoff should have id');
  assert.equal(handoff.status, 'open');
  assert.equal(handoff.originAgent, 'delivery-architect');
  assert.equal(handoff.targetAgent, 'implementation-lead');
  assert.equal(handoff.requirements.length, 1);

  const reloaded = await manager.getHandoff(handoff.id);
  assert.deepEqual(reloaded.summary, 'Transfer roadmap milestone ownership');

  const list = await manager.listHandoffs();
  assert.equal(list.length, 1);
  assert.equal(list[0].id, handoff.id);

  const updated = await manager.updateHandoff(handoff.id, {
    status: 'inReview',
    notes: [{ author: 'implementation-lead', note: 'Roadmap sync scheduled' }],
    requirements: [
      { requirement: 'Confirm module coverage', status: 'in-progress' },
      { requirement: 'Document risks', status: 'pending' }
    ]
  });

  assert.equal(updated.status, 'inReview');
  assert.equal(updated.notes.length, 2);
  assert.equal(updated.requirements.length, 2);
  assert.equal(updated.requirements[0].status, 'in-progress');

  const secondManager = createAgentHandoffManager({ dataDir: tmpDir });
  const persisted = await secondManager.getHandoff(handoff.id);
  assert.equal(persisted.status, 'inReview');
  assert.equal(persisted.requirements.length, 2);
});
