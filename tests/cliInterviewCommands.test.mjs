import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

import cliInterviewManagerModule from '../services/cliInterviewManager.js';

const {
  CLI_SESSIONS_DIR,
  startSession,
  submitAnswer
} = cliInterviewManagerModule;

async function main() {
  const { session, question } = await startSession({
    category: 'spec',
    command: '/spec'
  });

  assert.ok(session.sessionId, 'Session ID should be defined');
  assert.ok(question && question.id, 'First question should be available');

  const submission = await submitAnswer({
    sessionId: session.sessionId,
    questionId: question.id,
    answer: 'Test answer from automated suite'
  });

  assert.equal(submission.session.responses.length, 1, 'Response should be recorded');
  if (submission.completed) {
    assert.ok(submission.summary, 'Completed session should return a summary');
    assert.ok(Array.isArray(submission.artifacts), 'Completed session should include artifacts array');
    for (const artifact of submission.artifacts) {
      const absolute = artifact.path;
      assert.ok(absolute && absolute.endsWith('.md'), 'Artifact should reference transcript markdown file');
      await unlink(absolute);
    }
  } else {
    assert.ok(submission.nextQuestion, 'Next question should be returned when session continues');
  }

  const sessionPath = path.join(CLI_SESSIONS_DIR, `${session.sessionId}.json`);
  await unlink(sessionPath);

  console.log('cli interview commands tests passed');
}

main().catch(error => {
  console.error(error);
  process.exitCode = 1;
});
