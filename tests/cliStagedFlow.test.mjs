import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

import { createCliStagedFlow } from '../services/cliStagedFlow.js';

const TEMP_DIR = path.join(process.cwd(), 'test-output', 'cli-staged');

async function resetTempDir() {
  await fs.rm(TEMP_DIR, { recursive: true, force: true });
  await fs.mkdir(TEMP_DIR, { recursive: true });
}

test('CLI staged flow generates plan and task artifacts', async (t) => {
  await resetTempDir();

  const auditSnapshot = {
    project: { name: 'Opnix Test', type: 'Service', goal: 'Validate staged flow' },
    message: 'Audit complete',
    followUps: ['Review security posture', 'Schedule load testing'],
    featuresNeedingCriteria: [{ id: 'FEAT-9', title: 'Payment gateway hardening' }],
    modules: [
      { id: 'core-api', name: 'Core API', health: 45, coverage: 38 },
      { id: 'ui-shell', name: 'UI Shell', health: 82, coverage: 42 }
    ],
    exports: [
      { path: path.join(process.cwd(), 'spec', 'blueprints', 'spec.json'), relativePath: 'spec/blueprints/spec.json' }
    ],
    followUpTicketsCreated: [{ id: 501, title: 'Review security posture' }]
  };

  const auditManager = {
    async runInitialAudit() {
      return { ...auditSnapshot };
    }
  };

  const cliInterviewManager = {
    CLI_ARTIFACTS_DIR: TEMP_DIR
  };

  const ensureArtifactsDirectory = async () => {
    await fs.mkdir(TEMP_DIR, { recursive: true });
  };

  const readData = async () => ({
    tickets: [
      { id: 1, title: 'Review security posture', status: 'reported', priority: 'high', modules: ['core-api'] },
      { id: 2, title: 'Improve coverage for UI Shell', status: 'inProgress', priority: 'medium', modules: ['ui-shell'] },
      { id: 3, title: 'Legacy cleanup', status: 'finished', priority: 'low' }
    ],
    nextId: 4
  });

  const normaliseTicketStatus = (status, { fallback } = {}) => {
    if (!status) return fallback ?? null;
    const value = String(status).toLowerCase();
    if (value.startsWith('report')) return 'reported';
    if (value.startsWith('in')) return 'inProgress';
    if (value.startsWith('finish')) return 'finished';
    return fallback ?? value;
  };

  const stagedFlow = createCliStagedFlow({
    auditManager,
    cliInterviewManager,
    ensureArtifactsDirectory,
    readData,
    normaliseTicketStatus,
    statusConstants: {
      statusReported: 'reported',
      statusInProgress: 'inProgress',
      statusFinished: 'finished',
      priorityHigh: 'high',
      priorityMedium: 'medium',
      priorityLow: 'low'
    },
    rootDir: process.cwd()
  });

  t.after(async () => {
    await fs.rm(TEMP_DIR, { recursive: true, force: true });
  });

  const planResult = await stagedFlow.generatePlanStage();
  assert.equal(planResult.result, 'Delivery plan ready');
  assert.ok(Array.isArray(planResult.artifacts));
  assert.equal(planResult.artifacts.length, 1);
  const planArtifactPath = planResult.artifacts[0].path;
  const planExists = await fs.access(planArtifactPath).then(() => true).catch(() => false);
  assert.ok(planExists, 'Plan artifact should exist');
  const planContent = await fs.readFile(planArtifactPath, 'utf8');
  assert.match(planContent, /# Delivery Plan/);
  assert.match(planContent, /Review security posture/);

  const tasksResult = await stagedFlow.generateTasksStage();
  assert.equal(tasksResult.result, 'Task summary ready');
  assert.ok(Array.isArray(tasksResult.artifacts));
  assert.equal(tasksResult.artifacts.length, 1);
  const tasksArtifactPath = tasksResult.artifacts[0].path;
  const tasksExists = await fs.access(tasksArtifactPath).then(() => true).catch(() => false);
  assert.ok(tasksExists, 'Tasks artifact should exist');
  const tasksContent = await fs.readFile(tasksArtifactPath, 'utf8');
  assert.match(tasksContent, /Task Queue Summary/);
  assert.match(tasksContent, /High Priority Work/);
  assert.match(tasksContent, /Review security posture/);

  assert.ok(tasksResult.metadata);
  assert.equal(tasksResult.metadata.openTickets >= 2, true);
});
