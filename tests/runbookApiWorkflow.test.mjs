import assert from 'node:assert/strict';
import { access, unlink } from 'node:fs/promises';
import path from 'node:path';

import { app, ensureExportStructure } from '../server.js';
import { invokeRoute } from './helpers/invokeRoute.mjs';

(async () => {
  await ensureExportStructure();

  const start = await invokeRoute(app, {
    method: 'POST',
    path: '/api/runbooks/interview/start'
  });

  assert.equal(start.statusCode, 200, 'runbook interview start should return 200');
  assert(start.body && start.body.sessionId, 'runbook interview should return a sessionId');
  assert(start.body.question && start.body.question.id, 'runbook interview should return first question');

  const { sessionId, question } = start.body;
  const answerPayload = await invokeRoute(app, {
    method: 'POST',
    path: '/api/runbooks/interview/answer',
    body: {
      sessionId,
      questionId: question.id,
      answer: 'Automated answer from runbook API workflow test'
    }
  });

  assert.equal(answerPayload.statusCode, 200, 'runbook answer endpoint should return 200');
  assert(Array.isArray(answerPayload.body.responses), 'runbook answer endpoint should return responses array');
  assert(answerPayload.body.responses.length >= 1, 'runbook responses should capture submitted answer');

  const generate = await invokeRoute(app, {
    method: 'POST',
    path: '/api/runbooks/generate',
    body: { sessionId }
  });

  assert.equal(generate.statusCode, 200, 'runbook generation should return 200');
  assert.equal(generate.body.success, true, 'runbook generation should succeed');
  const runbook = generate.body.runbook;
  assert(runbook && runbook.filename, 'runbook payload should include filename');
  assert(runbook.content && runbook.content.includes('Operational Runbook'), 'runbook content should include header text');
  assert(runbook.workspacePath, 'runbook response should include workspace path');

  const runbookAbsolute = path.join(process.cwd(), runbook.workspacePath);
  await access(runbookAbsolute);
  await unlink(runbookAbsolute);

  const sessionFile = path.join(process.cwd(), 'data', 'cli-sessions', `${sessionId}.json`);
  await unlink(sessionFile).catch(() => {});

  console.log('runbook API workflow tests passed');
})();
