import assert from 'node:assert/strict';
import {
  deriveAutoModulesFromAnswers,
  deriveAutoFeaturesFromAnswers,
  summarizeAutoModules,
  hasMeaningfulAnswers
} from '../src/spec-scaffold.mjs';

(function testModuleDerivation() {
  const answers = {
    'preferred-framework': 'React',
    'primary-language': 'TypeScript',
    'data-sources': 'Postgres\nRedis',
    'integration-providers': '- Stripe\n- Twilio'
  };

  const modules = deriveAutoModulesFromAnswers(answers);
  assert.equal(modules.length, 5, 'expected auto modules for frontend, backend, two data stores, and integration gateway');

  const ids = modules.map(module => module.id);
  assert(ids.includes('react-frontend'), 'react frontend module missing');
  assert(ids.includes('typescript-service'), 'typescript service module missing');
  assert(ids.includes('postgres-data'), 'postgres data module missing');
  assert(ids.includes('redis-data'), 'redis data module missing');
  assert(ids.includes('integration-gateway'), 'integration gateway module missing');

  const integrationModule = modules.find(module => module.id === 'integration-gateway');
  assert.deepEqual(integrationModule.externalDependencies.sort(), ['stripe', 'twilio'], 'integration gateway should carry provider dependencies');

  const summary = summarizeAutoModules(modules);
  assert.deepEqual(summary, {
    moduleCount: 5,
    dependencyCount: 0,
    externalDependencyCount: 3,
    totalLines: 0
  });
})();

(function testFeatureDerivation() {
  const answers = {
    'scope-inclusions': 'User onboarding\nAdmin reporting',
    'project-purpose': 'Accelerate onboarding workflows'
  };
  const features = deriveAutoFeaturesFromAnswers(answers);
  assert.equal(features.length, 2, 'expected features for each scope inclusion');
  assert.equal(features[0].id, 'auto-feature-1');
  assert.equal(features[0].title, 'User onboarding');
  assert.equal(features[0].description, 'Accelerate onboarding workflows');
})();

(function testHasMeaningfulAnswers() {
  assert.equal(hasMeaningfulAnswers({}), false, 'empty answers should not be meaningful');
  assert.equal(hasMeaningfulAnswers({ 'project-name': '   ' }), false, 'whitespace-only answers should not count');
  assert.equal(hasMeaningfulAnswers({ 'project-name': 'Atlas Revamp' }), true, 'non-empty answers should count');
})();

console.log('specScaffold tests passed');
process.exit(0);
