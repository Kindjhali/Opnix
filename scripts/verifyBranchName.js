#!/usr/bin/env node

const { execSync } = require('child_process');

const {
  isValidBranchName,
  VALID_BRANCH_PREFIXES,
  PRIMARY_BRANCHES
} = require('../services/branchNaming');

function getCurrentBranch() {
  try {
    return execSync('git rev-parse --abbrev-ref HEAD', { encoding: 'utf8' }).trim();
  } catch (error) {
    console.warn('[verify-branch-name] Unable to determine current branch:', error.message || error);
    return 'HEAD';
  }
}

function main() {
  const branch = getCurrentBranch();

  if (isValidBranchName(branch)) {
    process.exit(0);
  }

  const allowedPrefixes = VALID_BRANCH_PREFIXES.join(', ');
  const allowedPrimary = PRIMARY_BRANCHES.join(', ');
  console.error(`\n❌ Branch "${branch}" does not match the required naming convention.`);
  console.error('Expected format: <type>/<ticket-id>-<slug>');
  console.error(`Allowed prefixes: ${allowedPrefixes}`);
  console.error(`Primary branches: ${allowedPrimary}`);
  console.error('Example: feature/1234-add-login-flow');
  console.error('Rename the branch before committing.');
  process.exit(1);
}

main();
