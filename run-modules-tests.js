#!/usr/bin/env node
const { spawnSync } = require('node:child_process');

const tests = [
  'tests/moduleDetector.test.js',
  'tests/featuresStatus.test.js',
  'tests/checklistStatus.test.js',
  'tests/specScaffold.test.mjs',
  'tests/interviewAdaptive.test.mjs',
  'tests/apiSmoke.test.mjs',
  'tests/integrationFlow.test.mjs',
  'tests/ticketsMigration.test.mjs',
  'tests/terminalRunner.test.mjs',
  'tests/markdownManager.test.mjs',
  'tests/ultraThinkEndpoints.test.mjs',
  'tests/cliInterviewCommands.test.mjs',
  'tests/runbookApiWorkflow.test.mjs',
  'tests/runbookGenerator.test.mjs',
  'tests/auditManager.test.mjs',
  'tests/roadmapStatusTransitions.test.mjs',
  'tests/roadmapDependencyCascade.test.mjs',
  'tests/roadmapGitAutomation.test.mjs',
  'tests/questionContext.test.mjs',
  'tests/cliStagedFlow.test.mjs',
  'tests/cliExtraCommands.test.mjs',
  'tests/agentHandoffManager.test.mjs',
  'tests/cliPlanChaining.test.mjs',
  'tests/planTaskChainer.test.mjs',
  'tests/implementationChainer.test.mjs',
  'tests/approvalGatesManager.test.mjs',
  'tests/sessionStateManager.test.mjs',
  'tests/cliBranchHandler.test.mjs',
  'tests/statusDashboardManager.test.mjs',
  'tests/appStore.test.mjs',
  'tests/uiComponentsSmoke.test.mjs',
  'tests/themeManager.test.mjs',
  'tests/themeComponentsRender.test.mjs'
];

for (const testPath of tests) {
  const result = spawnSync('node', [testPath], { stdio: 'inherit' });
  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}
