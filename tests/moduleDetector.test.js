const assert = require('assert');
const path = require('path');
const moduleDetector = require('../services/moduleDetector');

async function verifyRepoDetection() {
  const result = await moduleDetector.detectModules(path.join(__dirname, '..'));
  assert.ok(Array.isArray(result.modules) && result.modules.length > 0, 'repository modules should be detected');

  const backend = result.modules.find(module => module.id === 'backend');
  const agents = result.modules.find(module => module.id === 'agents');

  assert.ok(backend, 'backend module should be present');
  assert.ok(agents, 'agents module should be present');
  assert.ok(result.summary && typeof result.summary.moduleCount === 'number', 'summary should be populated');
}

async function verifyFixtureDetection() {
  const fixtureRoot = path.join(__dirname, 'fixtures', 'monorepo');
  const result = await moduleDetector.detectModules(fixtureRoot);

  const apiModule = result.modules.find(module => module.id === 'api');
  const uiModule = result.modules.find(module => module.id === 'ui');
  const aggregateModule = result.modules.find(module => module.id === 'packages');

  assert.ok(apiModule, 'api module should be discovered in composite directory');
  assert.ok(uiModule, 'ui module should be discovered in composite directory');
  assert.ok(!aggregateModule, 'composite directory container should not be treated as a standalone module');
  assert.ok(apiModule.externalDependencies.includes('express'), 'api module should capture express dependency');
  assert.ok(uiModule.externalDependencies.includes('vue'), 'ui module should capture vue dependency');
}

async function main() {
  await verifyRepoDetection();
  await verifyFixtureDetection();
  console.log('✓ module detector tests passed');
}

main().catch(error => {
  console.error('Module detector tests failed:', error);
  process.exit(1);
});
