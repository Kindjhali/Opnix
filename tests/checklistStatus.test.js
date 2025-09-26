const assert = require('assert');
const { validateChecklistStatusChange } = require('../server');

function shouldRequireHook() {
  const result = validateChecklistStatusChange('pending', 'inProgress', null);
  assert.strictEqual(result.ok, false, 'hook should be required for pending -> inProgress');
}

function shouldAllowWithHook() {
  const result = validateChecklistStatusChange('pending', 'inProgress', 'startChecklist');
  assert.strictEqual(result.ok, true, 'correct hook should allow status change');
}

function shouldRejectUnsupportedStatus() {
  const result = validateChecklistStatusChange('pending', 'unknown', 'hook');
  assert.strictEqual(result.ok, false, 'unsupported status should be rejected');
}

function main() {
  shouldRequireHook();
  shouldAllowWithHook();
  shouldRejectUnsupportedStatus();
  console.log('✓ checklist status validation tests passed');
}

main();
