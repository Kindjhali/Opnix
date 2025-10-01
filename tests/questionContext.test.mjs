import assert from 'node:assert/strict';
import { unlink } from 'node:fs/promises';
import path from 'node:path';

import interviewLoaderModule from '../services/interviewLoader.js';
const { getSectionsByContext, getQuestionsByContext } = interviewLoaderModule;
import cliInterviewManager from '../services/cliInterviewManager.js';

const {
  CLI_SESSIONS_DIR,
  startSession
} = cliInterviewManager;

async function cleanupSession(sessionId) {
  if (!sessionId) return;
  const sessionPath = path.join(CLI_SESSIONS_DIR, `${sessionId}.json`);
  await unlink(sessionPath).catch(() => {});
}

async function main() {
  const projectSections = await getSectionsByContext('project');
  assert.ok(projectSections.length > 0, 'project context should return sections');
  assert.ok(projectSections.some(section => section.sectionId === 'foundation'), 'foundation should be tagged as project');
  projectSections.forEach(section => {
    assert.equal(section.context, 'project');
    (section.questions || []).forEach(question => {
      assert.equal(question.context, 'project');
    });
  });

  const moduleSections = await getSectionsByContext('module');
  assert.ok(moduleSections.length > 0, 'module context should return sections');
  assert.ok(moduleSections.some(section => section.sectionId === 'modules-governance'), 'modules-governance should be tagged as module');
  moduleSections.forEach(section => {
    assert.equal(section.context, 'module');
    (section.questions || []).forEach(question => {
      assert.equal(question.context, 'module');
    });
  });

  const moduleQuestions = await getQuestionsByContext('module');
  assert.ok(moduleQuestions.length > 0, 'module context should surface flattened questions');
  moduleQuestions.forEach(question => {
    assert.equal(question.context, 'module');
    assert.ok(question.sectionId, 'question should include sectionId');
  });

  const moduleSession = await startSession({ category: 'module', command: '/new-module' });
  assert.equal(moduleSession.question.context, 'module', 'module CLI session should surface module context questions');
  await cleanupSession(moduleSession.session.sessionId);

  const specSession = await startSession({ category: 'spec', command: '/spec' });
  assert.equal(specSession.question.context, 'project', 'spec CLI session should surface project context questions');
  await cleanupSession(specSession.session.sessionId);

  console.log('question context tests passed');
  process.exit(0);
}

main().catch(error => {
  console.error(error);
  process.exit(1);
});
