import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import planTaskChainerModule from '../services/planTaskChainer.js';

const { createPlanTaskChainer } = planTaskChainerModule;

async function readJson(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  return JSON.parse(raw);
}

async function writeJson(filePath, data) {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2));
}

test('planTaskChainer derives tasks, persists tickets, and writes scaffold file', async t => {
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), 'opnix-plan-chain-'));
  t.after(async () => {
    await fs.rm(tmpDir, { recursive: true, force: true });
  });

  const dataFile = path.join(tmpDir, 'tickets.json');
  const scaffoldRoot = path.join(tmpDir, '.opnix', 'scaffold');

  const baselineData = {
    tickets: [
      {
        id: 5,
        title: 'Improve health of ModuleA',
        description: 'Existing ticket recorded before chaining.',
        priority: 'medium',
        status: 'reported',
        tags: ['AUDIT'],
        source: 'audit-follow-up',
        created: new Date().toISOString()
      }
    ],
    nextId: 6
  };
  await writeJson(dataFile, baselineData);

  const readData = async () => readJson(dataFile);
  const writeData = async payload => {
    await writeJson(dataFile, payload);
    return payload;
  };

  const planTaskChainer = createPlanTaskChainer({
    readData,
    writeData,
    scaffoldRoot,
    rootDir: tmpDir,
    statusConstants: {
      statusReported: 'reported',
      statusInProgress: 'inProgress',
      statusFinished: 'finished',
      priorityLow: 'low',
      priorityMedium: 'medium',
      priorityHigh: 'high'
    },
    logger: { error: () => {} }
  });

  const planResult = {
    artifacts: [
      {
        path: path.join(tmpDir, 'spec', 'cli-plan-test.md'),
        relativePath: 'spec/cli-plan-test.md'
      }
    ],
    metadata: {
      followUps: [
        'Improve health of ModuleA',
        'Define acceptance criteria for feature "Gamma"'
      ],
      followUpTickets: [
        { id: 5, title: 'Improve health of ModuleA' }
      ],
      projectName: 'Opnix Test'
    }
  };

  const result = await planTaskChainer.chainPlanToTasks({
    planResult,
    sessionId: 'session-123',
    planArtifactRelativePath: 'spec/cli-plan-test.md'
  });

  assert(result, 'chainer should return a result object');
  assert.equal(result.tasks.length, 2, 'both follow-up entries should appear in task list');
  assert.equal(result.createdTickets.length, 1, 'one new ticket should be created for the missing follow-up');
  assert(result.scaffold, 'scaffold metadata should be returned');
  assert(result.scaffold.relativePath.endsWith('.json'), 'scaffold should reference a JSON file');

  const persisted = await readData();
  assert.equal(persisted.tickets.length, 2, 'ticket store should contain the new plan-derived task');
  const newTicket = persisted.tickets.find(ticket => ticket.title.includes('Define acceptance criteria'));
  assert(newTicket, 'new follow-up ticket should exist in data store');
  assert.equal(newTicket.source, 'plan-chain', 'new ticket should use plan-chain source');

  const scaffoldPayload = await readJson(result.scaffold.path);
  assert.equal(scaffoldPayload.totalTasks, 2, 'scaffold file should capture task count');
  assert.equal(scaffoldPayload.planArtifact, 'spec/cli-plan-test.md', 'scaffold should reference plan artifact path');
  assert(scaffoldPayload.tasks.some(task => task.ticketId === newTicket.id), 'scaffold should reference the new ticket');
});
