import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import implementationChainerModule from '../services/implementationChainer.js';

const { createImplementationChainer } = implementationChainerModule;

function createFailingFs({ failOnWrite }) {
  const actual = fs;
  let writeCount = 0;
  return {
    access: (...args) => actual.access(...args),
    mkdir: (...args) => actual.mkdir(...args),
    readFile: (...args) => actual.readFile(...args),
    readdir: (...args) => actual.readdir(...args),
    rmdir: (...args) => actual.rmdir(...args),
    stat: (...args) => actual.stat(...args),
    writeFile: async (...args) => {
      writeCount += 1;
      if (writeCount === failOnWrite) {
        throw new Error('Simulated failure');
      }
      return actual.writeFile(...args);
    },
    chmod: actual.chmod ? (...args) => actual.chmod(...args) : undefined,
    rm: (...args) => actual.rm(...args)
  };
}

test('implementation chainer creates workspaces and manifest entries', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'impl-chainer-success-'));
  try {
    const planTasksRelative = path.join('.opnix', 'scaffold', 'plan-tasks.json');
    await fs.mkdir(path.join(root, path.dirname(planTasksRelative)), { recursive: true });
    await fs.writeFile(path.join(root, planTasksRelative), JSON.stringify({ tasks: [] }, null, 2));

    const planArtifactRelative = path.join('spec', 'cli-plan.md');
    await fs.mkdir(path.join(root, path.dirname(planArtifactRelative)), { recursive: true });
    await fs.writeFile(path.join(root, planArtifactRelative), '# Plan\n');

    const chainer = createImplementationChainer({ rootDir: root });

    const result = await chainer.chainTasksToImplementation({
      tasks: [
        { ticketId: 101, title: 'Enable dark mode', description: 'Add theme toggle' },
        { ticketId: 102, title: 'Improve API resilience', description: 'Refine endpoints' }
      ],
      sessionId: 'cli-session-123',
      planArtifactRelativePath: planArtifactRelative,
      planTasksScaffold: planTasksRelative
    });

    assert.equal(result.workspaces.length, 2);

    const workspaceRoot = path.join(root, '.opnix', 'workspaces');
    for (const workspace of result.workspaces) {
      const workspaceDir = path.join(workspaceRoot, workspace.branchName.replace(/\//g, path.sep));
      const readme = await fs.readFile(path.join(workspaceDir, 'README.md'), 'utf8');
      assert.match(readme, /Workspace:/);
      assert.match(readme, /Recommended Branch/);

      const branchScriptExists = await fs.access(path.join(workspaceDir, 'create-branch.sh')).then(() => true).catch(() => false);
      assert.equal(branchScriptExists, true);

      const taskFile = JSON.parse(await fs.readFile(path.join(workspaceDir, 'task.json'), 'utf8'));
      assert.equal(taskFile.branchName, workspace.branchName);

      const devNotes = await fs.readFile(path.join(workspaceDir, 'DEV_NOTES.md'), 'utf8');
      assert.match(devNotes, /Development Notes/);

      const acceptanceChecklist = await fs.readFile(path.join(workspaceDir, 'ACCEPTANCE.md'), 'utf8');
      assert.match(acceptanceChecklist, /Acceptance Checklist/);

      const todo = await fs.readFile(path.join(workspaceDir, 'TODO.md'), 'utf8');
      assert.match(todo, /Workspace TODOs/);

      const rollback = JSON.parse(await fs.readFile(path.join(workspaceDir, 'rollback.json'), 'utf8'));
      assert.equal(Array.isArray(rollback.steps), true);
      assert.ok(rollback.steps.some(step => step.action === 'delete-branch'));

      const expectedRollbackRelative = path.relative(root, path.join(workspaceDir, 'rollback.json'));
      assert.equal(workspace.rollbackPath, expectedRollbackRelative);
    }

    const manifestPath = path.join(workspaceRoot, 'manifest.json');
    const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
    assert.equal(Array.isArray(manifest.workspaces), true);
    assert.equal(manifest.workspaces.length, 2);
    manifest.workspaces.forEach(entry => {
      assert.equal(entry.branchStatus, 'pending');
      assert.equal(entry.branchCreatedAt, null);
      assert.equal(entry.lastCheckoutAt, null);
      assert.ok(Array.isArray(entry.scaffoldFiles));
      assert.ok(entry.scaffoldFiles.includes(path.join(entry.relativePath, 'README.md')));
      assert.ok(entry.scaffoldFiles.includes(entry.taskFile));
      assert.ok(entry.scaffoldFiles.includes(path.join(entry.relativePath, 'rollback.json')));
      assert.ok(entry.rollbackPlan);
      assert.ok(Array.isArray(entry.rollbackPlan.steps));
    });
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('implementation chainer rolls back on failure', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'impl-chainer-failure-'));
  try {
    const failingFs = createFailingFs({ failOnWrite: 5 });
    const chainer = createImplementationChainer({ rootDir: root, fsImpl: failingFs });

    await assert.rejects(() => chainer.chainTasksToImplementation({
      tasks: [
        { ticketId: 1, title: 'Primary task' },
        { ticketId: 2, title: 'Secondary task' }
      ],
      sessionId: 'cli-session-failure'
    }), /Simulated failure/);

    const workspaceRoot = path.join(root, '.opnix', 'workspaces');
    const exists = await fs.access(workspaceRoot).then(() => true).catch(() => false);
    if (exists) {
      const entries = await fs.readdir(workspaceRoot);
      assert.equal(entries.length, 0);
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});
