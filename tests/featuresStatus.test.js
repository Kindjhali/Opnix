const assert = require('assert');
const { validateFeatureStatusChange, normaliseAcceptanceCriteria } = require('../server');

function shouldRejectWithoutCriteria() {
  const criteria = normaliseAcceptanceCriteria([]);
  const validation = validateFeatureStatusChange('proposed', 'approved', criteria);
  assert.strictEqual(validation.ok, false, 'status change should be rejected without acceptance criteria');
}

function shouldAllowWithCriteria() {
  const criteria = normaliseAcceptanceCriteria(['Define user journey', 'Outline success metrics']);
  const validation = validateFeatureStatusChange('proposed', 'approved', criteria);
  assert.strictEqual(validation.ok, true, 'status change should be allowed when criteria are defined');
}

function shouldRejectUnsupportedStatus() {
  const criteria = normaliseAcceptanceCriteria(['Valid criteria']);
  const validation = validateFeatureStatusChange('proposed', 'invalid-status', criteria);
  assert.strictEqual(validation.ok, false, 'unsupported status must be rejected');
}

function main() {
  shouldRejectWithoutCriteria();
  shouldAllowWithCriteria();
  shouldRejectUnsupportedStatus();
  console.log('✓ feature status validation tests passed');
  process.exit(0);
}

main();
