import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';

import ApprovalGatesManager from '../services/approvalGatesManager.js';

test('approval gates lifecycle and requirement checks', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'approval-gates-'));
  const dataFile = path.join(tempDir, 'approval-gates.json');
  try {
    const manager = new ApprovalGatesManager({ dataFile, logger: console });

    const initialState = await manager.getState();
    const preImpl = initialState.approvals['pre-implementation-discussion'];
    assert(preImpl, 'pre-implementation gate should exist');
    assert.equal(preImpl.status, 'pending');

    const commandStatus = await manager.checkCommand('/branch');
    assert.equal(commandStatus.passed, false);
    assert.equal(commandStatus.missing.length, 1);

    const toolStatus = await manager.checkTool('git-branch-create');
    assert.equal(toolStatus.passed, false);

    await manager.approveGate('pre-implementation-discussion', {
      approvedBy: 'Lead Architect',
      role: 'architect',
      notes: 'Architecture review completed'
    });

    const approved = await manager.getApproval('pre-implementation-discussion');
    assert.equal(approved.status, 'approved');
    assert.equal(approved.approvedBy, 'Lead Architect');
    assert.equal(approved.approvedRole, 'architect');

    const postApprovalCommand = await manager.checkCommand('/branch');
    assert.equal(postApprovalCommand.passed, true);

    await manager.resetGate('pre-implementation-discussion', { notes: 'Scope changed' });
    const reset = await manager.getApproval('pre-implementation-discussion');
    assert.equal(reset.status, 'pending');
    assert.equal(reset.notes, 'Scope changed');

    const postResetTool = await manager.checkTool('implementation-chain');
    assert.equal(postResetTool.passed, false);
  } finally {
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});

