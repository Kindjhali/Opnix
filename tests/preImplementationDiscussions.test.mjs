import { strict as assert } from 'assert';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { createPreImplementationDiscussionManager } from '../services/preImplementationDiscussionManager.js';

class FakeApprovalGatesManager {
  constructor() {
    this.approvals = {
      'pre-implementation-discussion': {
        id: 'pre-implementation-discussion',
        label: 'Pre-Implementation Discussion',
        status: 'pending'
      }
    };
    this.resetCount = 0;
    this.approveCount = 0;
  }

  async getApproval(id) {
    return this.approvals[id] || null;
  }

  async resetGate(id, { notes = null } = {}) {
    const approval = this.approvals[id] || { id, status: 'pending' };
    approval.status = 'pending';
    approval.notes = notes;
    approval.updatedAt = new Date().toISOString();
    this.approvals[id] = approval;
    this.resetCount += 1;
    return approval;
  }

  async approveGate(id, { approvedBy = 'tester', role = null, notes = null } = {}) {
    const approval = this.approvals[id] || { id, status: 'pending' };
    approval.status = 'approved';
    approval.approvedBy = approvedBy;
    approval.approvedRole = role;
    approval.notes = notes;
    approval.updatedAt = new Date().toISOString();
    this.approvals[id] = approval;
    this.approveCount += 1;
    return approval;
  }
}

async function main() {
  console.log('Testing pre-implementation discussion manager...');

  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opnix-discussions-'));
  const storePath = path.join(tmpDir, 'discussions.json');
  const approvals = new FakeApprovalGatesManager();
  const manager = createPreImplementationDiscussionManager({
    filePath: storePath,
    approvalGatesManager: approvals,
    logger: console
  });

  console.log('Ensuring initial discussion record...');
  const ensureResult = await manager.ensureDiscussion({
    sessionId: 'session-1',
    planArtifactRelativePath: 'plans/plan-alpha.json',
    tasks: [{ ticketId: 101, title: 'Audit login flow' }],
    createdTicketIds: [101],
    createdBy: 'alice'
  });

  assert.equal(ensureResult.created, true, 'First ensure should create a discussion');
  const discussionId = ensureResult.discussion.id;
  const storedDiscussion = await manager.getDiscussion(discussionId);
  assert(storedDiscussion, 'Discussion should be persisted');
  assert.equal(storedDiscussion.status, manager.STATUSES.PENDING);

  console.log('Completing discussion with decisions and risks...');
  const completedDiscussion = await manager.completeDiscussion({
    id: discussionId,
    summary: 'Reviewed architecture changes',
    decisions: ['Proceed with migration strategy A'],
    risks: [{ risk: 'Potential outage window', mitigation: 'Schedule deployment during maintenance window' }],
    actionItems: ['Coordinate with QA for regression plan'],
    participants: [{ name: 'Alice', role: 'Tech Lead' }, 'Bob Reviewer'],
    recordedBy: 'alice',
    autoApprove: true
  });

  assert.equal(completedDiscussion.status, manager.STATUSES.COMPLETED, 'Discussion should be marked completed');
  assert.equal(approvals.approveCount, 1, 'Auto-approval should be triggered after completion');
  const gate = await approvals.getApproval('pre-implementation-discussion');
  assert.equal(gate.status, 'approved', 'Gate should be marked approved after completion');

  console.log('Creating follow-up discussion triggers gate reset...');
  await manager.ensureDiscussion({
    sessionId: 'session-2',
    planArtifactRelativePath: 'plans/plan-beta.json',
    tasks: [],
    createdTicketIds: [],
    createdBy: 'system'
  });
  const pendingGate = await approvals.getApproval('pre-implementation-discussion');
  assert.equal(pendingGate.status, 'pending', 'Gate should reset when a new discussion is created');
  assert(approvals.resetCount >= 1, 'Reset gate should be invoked');

  const hasCompleted = await manager.hasCompletedDiscussion();
  assert.equal(hasCompleted, true, 'At least one discussion should remain completed');

  const pendingDiscussions = await manager.listDiscussions({ status: manager.STATUSES.PENDING });
  assert(pendingDiscussions.length >= 1, 'Pending discussions should include newest entry');

  await fs.rm(tmpDir, { recursive: true, force: true });
  console.log('✓ Pre-implementation discussion manager tests passed\n');
}

main().catch(error => {
  console.error('Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
});
