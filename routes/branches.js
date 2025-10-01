const express = require('express');
const { exec } = require('child_process');
const util = require('util');
const path = require('path');
const fs = require('fs').promises;
const { deriveBranchName } = require('../services/branchNaming');

const execPromise = util.promisify(exec);
const router = express.Router();

const WORKSPACES_ROOT = path.join(__dirname, '..', '.opnix', 'workspaces');

async function ensureWorkspacesDirectory() {
  await fs.mkdir(WORKSPACES_ROOT, { recursive: true });
}

async function isGitRepository() {
  try {
    await execPromise('git rev-parse --is-inside-work-tree');
    return true;
  } catch {
    return false;
  }
}

async function getCurrentBranch() {
  try {
    const { stdout } = await execPromise('git rev-parse --abbrev-ref HEAD');
    return stdout.trim();
  } catch {
    return null;
  }
}

async function branchExists(branchName) {
  try {
    await execPromise(`git rev-parse --verify ${branchName}`);
    return true;
  } catch {
    return false;
  }
}

async function getMergedBranches() {
  try {
    const { stdout } = await execPromise('git branch --merged');
    return stdout
      .split('\n')
      .map(line => line.trim().replace(/^\*\s*/, ''))
      .filter(name => name && name !== 'main' && name !== 'master');
  } catch {
    return [];
  }
}

async function createWorkspaceDirectory(branchName) {
  const workspacePath = path.join(WORKSPACES_ROOT, branchName);
  await fs.mkdir(workspacePath, { recursive: true });

  const readmePath = path.join(workspacePath, 'README.md');
  const readmeContent = `# Workspace: ${branchName}

Generated: ${new Date().toISOString()}

## Purpose
This workspace is automatically provisioned for branch \`${branchName}\`.

## Contents
- Specifications and planning documents
- Task breakdowns and acceptance criteria
- Development notes and context

## Usage
Add task-specific artifacts, notes, and documentation here during development.
`;

  await fs.writeFile(readmePath, readmeContent);
  return workspacePath;
}

router.post('/create', async (req, res) => {
  try {
    const { ticketId, title, type = 'feature' } = req.body;

    if (!ticketId || !title) {
      return res.status(400).json({
        error: 'ticketId and title are required',
        received: { ticketId, title }
      });
    }

    const isRepo = await isGitRepository();
    if (!isRepo) {
      return res.status(400).json({
        error: 'Not a git repository',
        hint: 'Initialize git repository first: git init'
      });
    }

    const branchName = deriveBranchName({ id: ticketId, title, type });

    const exists = await branchExists(branchName);
    if (exists) {
      return res.status(409).json({
        error: 'Branch already exists',
        branchName,
        hint: `Switch to it with: git checkout ${branchName}`
      });
    }

    const currentBranch = await getCurrentBranch();
    await execPromise(`git checkout -b ${branchName}`);

    await ensureWorkspacesDirectory();
    const workspacePath = await createWorkspaceDirectory(branchName);

    res.json({
      success: true,
      branchName,
      previousBranch: currentBranch,
      workspacePath: path.relative(process.cwd(), workspacePath),
      message: `Created branch ${branchName} with workspace`
    });
  } catch (error) {
    console.error('Failed to create branch:', error);
    res.status(500).json({
      error: 'Failed to create branch',
      message: error.message
    });
  }
});

router.get('/current', async (req, res) => {
  try {
    const isRepo = await isGitRepository();
    if (!isRepo) {
      return res.status(400).json({
        error: 'Not a git repository'
      });
    }

    const currentBranch = await getCurrentBranch();
    res.json({
      branch: currentBranch
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get current branch',
      message: error.message
    });
  }
});

router.get('/list', async (req, res) => {
  try {
    const isRepo = await isGitRepository();
    if (!isRepo) {
      return res.status(400).json({
        error: 'Not a git repository',
        branches: []
      });
    }

    const { stdout } = await execPromise('git branch -v');
    const branches = stdout
      .split('\n')
      .filter(Boolean)
      .map(line => {
        const isCurrent = line.startsWith('*');
        const cleaned = line.replace(/^\*?\s*/, '');
        const parts = cleaned.split(/\s+/);
        return {
          name: parts[0],
          commit: parts[1] || null,
          current: isCurrent
        };
      });

    res.json({ branches });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to list branches',
      message: error.message,
      branches: []
    });
  }
});

router.post('/cleanup', async (req, res) => {
  try {
    const { dryRun = true } = req.body;

    const isRepo = await isGitRepository();
    if (!isRepo) {
      return res.status(400).json({
        error: 'Not a git repository'
      });
    }

    const mergedBranches = await getMergedBranches();

    if (dryRun) {
      return res.json({
        dryRun: true,
        branches: mergedBranches,
        message: `${mergedBranches.length} merged branch(es) would be deleted`,
        hint: 'Set dryRun=false to actually delete'
      });
    }

    const deleted = [];
    const failed = [];

    for (const branch of mergedBranches) {
      try {
        await execPromise(`git branch -d ${branch}`);
        deleted.push(branch);
      } catch (error) {
        failed.push({ branch, error: error.message });
      }
    }

    res.json({
      success: true,
      deleted,
      failed,
      message: `Deleted ${deleted.length} merged branch(es)`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to cleanup branches',
      message: error.message
    });
  }
});

router.get('/workspace/:branchName', async (req, res) => {
  try {
    const { branchName } = req.params;
    const workspacePath = path.join(WORKSPACES_ROOT, branchName);

    try {
      await fs.access(workspacePath);
    } catch {
      return res.status(404).json({
        error: 'Workspace not found',
        branchName,
        hint: 'Create workspace with POST /api/branches/workspace/:branchName'
      });
    }

    const files = await fs.readdir(workspacePath);
    const relativePath = path.relative(process.cwd(), workspacePath);

    res.json({
      branchName,
      workspacePath: relativePath,
      files
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to get workspace',
      message: error.message
    });
  }
});

router.post('/workspace/:branchName', async (req, res) => {
  try {
    const { branchName } = req.params;

    await ensureWorkspacesDirectory();
    const workspacePath = await createWorkspaceDirectory(branchName);
    const relativePath = path.relative(process.cwd(), workspacePath);

    res.json({
      success: true,
      branchName,
      workspacePath: relativePath,
      message: `Created workspace for ${branchName}`
    });
  } catch (error) {
    res.status(500).json({
      error: 'Failed to create workspace',
      message: error.message
    });
  }
});

module.exports = router;