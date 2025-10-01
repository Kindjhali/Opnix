import { strict as assert } from 'assert';
import { deriveBranchName, slugify, isValidBranchName, VALID_BRANCH_PREFIXES, PRIMARY_BRANCHES } from '../services/branchNaming.js';

console.log('Running branch management tests...\n');

function testSlugify() {
  console.log('Testing slugify function...');

  assert.equal(slugify('My Feature Title'), 'my-feature-title', 'Basic slugify');
  assert.equal(slugify('Feature: Add Authentication'), 'feature-add-authentication', 'Remove special chars');
  assert.equal(slugify('  Trim  Spaces  '), 'trim-spaces', 'Trim spaces');
  assert.equal(slugify(''), 'task', 'Empty string returns task');
  assert.equal(slugify(null), 'task', 'Null returns task');

  const longTitle = 'This is a very long feature title that exceeds the maximum length limit';
  const slugged = slugify(longTitle);
  assert.ok(slugged.length <= 32, `Long title truncated: ${slugged.length} <= 32`);
  assert.ok(!slugged.startsWith('-'), 'No leading dash');
  assert.ok(!slugged.endsWith('-'), 'No trailing dash');

  console.log('✓ slugify tests passed\n');
}

function testDeriveBranchName() {
  console.log('Testing deriveBranchName function...');

  const result1 = deriveBranchName({ id: 123, title: 'Add User Login', type: 'feature' });
  assert.equal(result1, 'feature/123-add-user-login', 'Standard branch name');

  const result2 = deriveBranchName({ id: 'BUG-456', title: 'Fix Memory Leak', type: 'bugfix' });
  assert.equal(result2, 'bugfix/bug-456-fix-memory-leak', 'Bug branch with ID prefix');

  const result3 = deriveBranchName({ id: 789, title: 'Update Documentation' });
  assert.equal(result3, 'feature/789-update-documentation', 'Default to feature type');

  const result4 = deriveBranchName({ title: 'No ID Provided' });
  assert.equal(result4, 'feature/task-no-id-provided', 'Handle missing ID');

  const result5 = deriveBranchName({ id: 'FEAT-001', title: 'Complex: Title! With @Special #Chars' });
  assert.ok(result5.includes('feat-001'), 'Sanitize ID');
  assert.ok(!result5.includes('@'), 'Remove special chars from title');
  assert.ok(!result5.includes('!'), 'Remove special chars from title');

  console.log('✓ deriveBranchName tests passed\n');
}

function testEdgeCases() {
  console.log('Testing edge cases...');

  const weirdChars = deriveBranchName({ id: '###', title: '!!!' });
  assert.ok(weirdChars.startsWith('feature/'), 'Handle all special chars');
  assert.ok(!weirdChars.includes('#'), 'No special chars in result');
  assert.ok(!weirdChars.includes('!'), 'No special chars in result');

  const spaces = deriveBranchName({ id: 100, title: '   Multiple    Spaces   ' });
  assert.ok(!spaces.includes('  '), 'No double spaces');
  assert.equal(spaces, 'feature/100-multiple-spaces', 'Collapse multiple spaces');

  const unicode = deriveBranchName({ id: 200, title: 'Emoji 😀 and Ümlaüt' });
  assert.ok(!unicode.includes('😀'), 'Remove emoji');
  assert.ok(!unicode.includes('ü'), 'Remove unicode');

  console.log('✓ Edge case tests passed\n');
}

function testBranchValidation() {
  console.log('Testing branch naming validation...');

  const validPrefixes = VALID_BRANCH_PREFIXES.join(', ');
  console.log(`Allowed prefixes: ${validPrefixes}`);
  console.log(`Primary branches: ${PRIMARY_BRANCHES.join(', ')}`);

  assert.equal(isValidBranchName('feature/123-add-login'), true, 'Valid feature branch');
  assert.equal(isValidBranchName('bugfix/bug-42-fix-crash'), true, 'Valid bugfix branch');
  assert.equal(isValidBranchName('main'), true, 'Main branch allowed');
  assert.equal(isValidBranchName('develop'), true, 'Develop branch allowed');
  assert.equal(isValidBranchName('HEAD'), true, 'Detached HEAD allowed');

  assert.equal(isValidBranchName('feature/no-ticket'), false, 'Requires ticket component');
  assert.equal(isValidBranchName('feature/task-no-id-provided'), false, 'Requires numeric ticket component');
  assert.equal(isValidBranchName('feature/123'), false, 'Requires slug component');
  assert.equal(isValidBranchName('task/123-add-login'), false, 'Disallowed prefix');
  assert.equal(isValidBranchName('feature/123_add_login'), false, 'Underscores not permitted');
  assert.equal(isValidBranchName('feature/123AddLogin'), false, 'CamelCase not permitted');

  console.log('✓ Branch naming validation passed\n');
}

try {
  testSlugify();
  testDeriveBranchName();
  testEdgeCases();
  testBranchValidation();

  console.log('All branch management tests passed! ✓');
  process.exit(0);
} catch (error) {
  console.error('Test failed:', error.message);
  console.error(error.stack);
  process.exit(1);
}
