import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import statusDashboardManager from '../services/statusDashboardManager.js';

function withStubbedData({ tickets = { tickets: [] }, checklists = { checklists: [] }, roadmap = { milestones: {} } }) {
  const originalLoadTicketsData = statusDashboardManager.loadTicketsData;
  const originalLoadChecklistData = statusDashboardManager.loadChecklistData;
  const originalLoadRoadmapData = statusDashboardManager.loadRoadmapData;

  statusDashboardManager.loadTicketsData = async () => tickets;
  statusDashboardManager.loadChecklistData = async () => checklists;
  statusDashboardManager.loadRoadmapData = async () => roadmap;

  return () => {
    statusDashboardManager.loadTicketsData = originalLoadTicketsData;
    statusDashboardManager.loadChecklistData = originalLoadChecklistData;
    statusDashboardManager.loadRoadmapData = originalLoadRoadmapData;
    statusDashboardManager.resetSession();
  };
}

test('status dashboard normalises ticket, checklist, and roadmap statuses', async () => {
  const restore = withStubbedData({
    tickets: {
      tickets: [
        { status: 'reported' },
        { status: 'in_progress' },
        { status: 'Finished' },
        { status: 'complete' },
        { status: 'Blocked' },
        { status: 'open' }
      ]
    },
    checklists: {
      checklists: [
        {
          status: 'in-progress',
          items: [
            { status: 'pending' },
            { status: 'Complete' },
            { status: 'blocked' }
          ]
        },
        {
          status: 'pending',
          items: [
            { completed: true },
            { status: 'in_progress' }
          ]
        }
      ]
    },
    roadmap: {
      milestones: {
        a: { status: 'active' },
        b: { status: 'pending' },
        c: { status: 'Blocked' },
        d: { status: 'Completed' },
        e: { status: 'paused' },
        f: { status: 'in-progress' }
      }
    }
  });

  const progress = await statusDashboardManager.getTaskProgress();

  assert.deepEqual(progress.tickets, {
    total: 6,
    completed: 2,
    inProgress: 1,
    blocked: 1,
    reported: 2,
    open: 4,
    completionRate: 33
  });

  assert.deepEqual(progress.checklists, {
    total: 5,
    completed: 2,
    inProgress: 1,
    blocked: 1,
    completionRate: 40
  });

  assert.deepEqual(progress.roadmap, {
    total: 6,
    completed: 1,
    active: 2,
    blocked: 1,
    paused: 1,
    pending: 1,
    completionRate: 17
  });

  assert.equal(progress.overall.completionRate, Math.round((33 + 40 + 17) / 3));
  assert.equal(progress.overall.activeTasksCount, progress.tickets.inProgress + progress.checklists.inProgress + progress.roadmap.active);
  assert.equal(progress.overall.blockedTasksCount, progress.tickets.blocked + progress.checklists.blocked + progress.roadmap.blocked);

  restore();
});

test('workspace summary aggregates manifest data', async () => {
  const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'workspace-summary-'));
  const originalPath = statusDashboardManager.workspaceManifestPath;

  try {
    const manifestPath = path.join(tempDir, 'manifest.json');
    const now = Date.now();
    const manifest = {
      generatedAt: new Date(now).toISOString(),
      workspaces: [
        {
          branchName: 'feature/100-initial-setup',
          ticketId: 100,
          branchStatus: 'pending',
          relativePath: '.opnix/workspaces/feature/100-initial-setup',
          createdAt: new Date(now - (4 * 24 * 60 * 60 * 1000)).toISOString()
        },
        {
          branchName: 'feature/101-auth-flow',
          ticketId: 101,
          branchStatus: 'created',
          relativePath: '.opnix/workspaces/feature/101-auth-flow',
          branchCreatedAt: new Date(now - (2 * 60 * 60 * 1000)).toISOString(),
          lastCheckoutAt: new Date(now - (30 * 60 * 1000)).toISOString()
        },
        {
          branchName: 'bugfix/102-crash',
          ticketId: 102,
          branchStatus: 'active',
          relativePath: '.opnix/workspaces/bugfix/102-crash',
          branchCreatedAt: new Date(now - (6 * 60 * 60 * 1000)).toISOString(),
          lastCheckoutAt: new Date(now - (10 * 60 * 1000)).toISOString()
        }
      ]
    };

    await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));
    statusDashboardManager.workspaceManifestPath = manifestPath;

    const summary = await statusDashboardManager.getWorkspaceSummary(2);

    assert.equal(summary.total, 3);
    assert.equal(summary.pendingCount, 1);
    assert.equal(summary.activeCount, 2);
    assert.equal(summary.statusCounts.pending, 1);
    assert.equal(summary.statusCounts.created, 1);
    assert.equal(summary.statusCounts.active, 1);
    assert.equal(summary.staleCount, 1);
    assert.equal(summary.recent.length, 2);
    assert.equal(summary.recent[0].branchName, 'bugfix/102-crash');
    assert.equal(summary.recent[1].branchName, 'feature/101-auth-flow');
  } finally {
    statusDashboardManager.workspaceManifestPath = originalPath;
    await fs.rm(tempDir, { recursive: true, force: true });
  }
});
