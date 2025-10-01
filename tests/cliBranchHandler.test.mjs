import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';
import util from 'node:util';
import childProcess from 'node:child_process';

import cliBranchHandlerModule from '../services/cliBranchHandler.js';

const execAsync = util.promisify(childProcess.exec);
const { createCliBranchHandler } = cliBranchHandlerModule;

async function setupGitRepository() {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'cli-branch-handler-'));
  await execAsync('git init', { cwd: root });
  await execAsync('git config user.email "cli-branch@example.com"', { cwd: root });
  await execAsync('git config user.name "CLI Branch"', { cwd: root });
  await fs.writeFile(path.join(root, 'README.md'), '# Test repository\n');
  await execAsync('git add README.md', { cwd: root });
  await execAsync('git commit -m "Initial commit"', { cwd: root });
  return root;
}

async function prepareManifest(root, branchName, ticketId, title) {
  const workspaceRoot = path.join(root, '.opnix', 'workspaces');
  const workspacePath = path.join(workspaceRoot, branchName.replace(/\//g, path.sep));
  await fs.mkdir(workspacePath, { recursive: true });
  const manifest = {
    generatedAt: new Date().toISOString(),
    workspaces: [
      {
        branchName,
        ticketId,
        title,
        workspacePath,
        relativePath: path.relative(root, workspacePath),
        branchScript: null,
        planTasks: null,
        planArtifact: null,
        createdAt: new Date().toISOString()
      }
    ]
  };
  await fs.writeFile(
    path.join(workspaceRoot, 'manifest.json'),
    JSON.stringify(manifest, null, 2)
  );
  return { workspaceRoot, workspacePath };
}

test('cliBranchHandler creates branch from manifest entry', async () => {
  const root = await setupGitRepository();
  try {
    const ticketId = '101';
    const branchName = 'feature/101-enable-dark-mode';
    await prepareManifest(root, branchName, ticketId, 'Enable dark mode');

    const handler = createCliBranchHandler({
      rootDir: root,
      workspaceRoot: path.join(root, '.opnix', 'workspaces'),
      execAsync,
      fsImpl: fs,
      logger: console
    });

    const response = await handler.handleCommand(`/branch ${ticketId}`);

    assert.equal(response.created, true);
    assert.equal(response.branchName, branchName);
    assert.ok(Array.isArray(response.messages));
    assert.match(response.result, /Branch .* created/);

    const { stdout: currentBranchStdout } = await execAsync('git rev-parse --abbrev-ref HEAD', { cwd: root });
    assert.equal(currentBranchStdout.trim(), branchName);

    const manifestPath = path.join(root, '.opnix', 'workspaces', 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const entry = manifest.workspaces.find(item => item.branchName === branchName);
    assert.ok(entry);
    assert.equal(entry.branchStatus, 'created');
    assert.ok(entry.branchCreatedAt);
    assert.ok(entry.lastCheckoutAt);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

test('cliBranchHandler cleans up branch and workspace when requested', async () => {
  const root = await setupGitRepository();
  try {
    const ticketId = '102';
    const branchName = 'feature/102-api-hardening';
    const { workspacePath } = await prepareManifest(root, branchName, ticketId, 'API hardening');

    const handler = createCliBranchHandler({
      rootDir: root,
      workspaceRoot: path.join(root, '.opnix', 'workspaces'),
      execAsync,
      fsImpl: fs,
      logger: console
    });

    await handler.handleCommand(`/branch ${ticketId}`);
    const cleanupResponse = await handler.handleCommand(`/branch ${ticketId} --cleanup`);

    assert.equal(cleanupResponse.cleanup, true);
    assert.equal(cleanupResponse.branchName, branchName);
    assert.ok(cleanupResponse.messages.some(line => line.includes('Deleted branch')));

    await assert.rejects(
      execAsync(`git rev-parse --verify ${branchName}`, { cwd: root })
    );

    const workspaceExists = await fs
      .access(workspacePath)
      .then(() => true)
      .catch(() => false);
    assert.equal(workspaceExists, false);

    const manifestPath = path.join(root, '.opnix', 'workspaces', 'manifest.json');
    const manifestRaw = await fs.readFile(manifestPath, 'utf8');
    const manifest = JSON.parse(manifestRaw);
    const entry = manifest.workspaces.find(item => item.branchName === branchName);
    assert.equal(entry, undefined);
  } finally {
    await fs.rm(root, { recursive: true, force: true });
  }
});

