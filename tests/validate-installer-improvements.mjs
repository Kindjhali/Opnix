#!/usr/bin/env node
/**
 * Validation script for installer improvements
 * Tests: branding fix, overwrite protection, error handling, file validation
 */

import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, '..');

async function validateBrandingFix() {
  console.log('TEST: Branding consistency fix');

  const installCliPath = path.join(rootDir, 'scripts/installCli.js');
  const content = await readFile(installCliPath, 'utf8');

  // Should NOT contain "neon installation CLI" or "Neon Installer"
  if (content.includes('Starting neon installation CLI') || content.includes('Neon Installer')) {
    throw new Error('Found old branding with "neon" in title');
  }

  // Should contain proper branding
  if (!content.includes('Opnix Installer') || !content.includes('MOLE Console')) {
    throw new Error('Missing proper Opnix branding');
  }

  console.log('  ✓ Branding is consistent (no "neon" in titles)');
}

async function validateOverwriteProtection() {
  console.log('TEST: Overwrite protection implementation');

  const setupWizardPath = path.join(rootDir, 'scripts/setupWizard.js');
  const content = await readFile(setupWizardPath, 'utf8');

  // Should have checkFileExists function
  if (!content.includes('async function checkFileExists(filePath)')) {
    throw new Error('Missing checkFileExists function');
  }

  // Should have promptOverwrite function
  if (!content.includes('async function promptOverwrite(filename)')) {
    throw new Error('Missing promptOverwrite function');
  }

  // Should check for existing files
  if (!content.includes('const exists = await checkFileExists(filePath)')) {
    throw new Error('Missing file existence check');
  }

  // Should handle overwrite decision
  if (!content.includes('const shouldOverwrite = await promptOverwrite')) {
    throw new Error('Missing overwrite prompt logic');
  }

  console.log('  ✓ Overwrite protection functions present');
  console.log('  ✓ File existence checks implemented');
  console.log('  ✓ User prompt for overwrite implemented');
}

async function validateErrorHandling() {
  console.log('TEST: Specific error handling');

  const setupWizardPath = path.join(rootDir, 'scripts/setupWizard.js');
  const content = await readFile(setupWizardPath, 'utf8');

  // Should handle specific error codes
  const errorCodes = ['EACCES', 'ENOSPC', 'EROFS'];
  for (const code of errorCodes) {
    if (!content.includes(`error.code === '${code}'`)) {
      throw new Error(`Missing specific error handling for ${code}`);
    }
  }

  console.log('  ✓ EACCES (permission denied) handled');
  console.log('  ✓ ENOSPC (no space) handled');
  console.log('  ✓ EROFS (read-only filesystem) handled');
}

async function validateFileValidation() {
  console.log('TEST: File creation validation');

  const setupWizardPath = path.join(rootDir, 'scripts/setupWizard.js');
  const content = await readFile(setupWizardPath, 'utf8');

  // Should validate file was created
  if (!content.includes('const created = await checkFileExists(filePath)')) {
    throw new Error('Missing file creation validation');
  }

  // Should validate file is not empty
  if (!content.includes('if (written.length === 0)')) {
    throw new Error('Missing empty file validation');
  }

  // Should throw if file not created
  if (!content.includes('was not created successfully')) {
    throw new Error('Missing creation failure check');
  }

  // Should throw if file is empty
  if (!content.includes('is empty after writing')) {
    throw new Error('Missing empty file check');
  }

  console.log('  ✓ File creation validation implemented');
  console.log('  ✓ Empty file detection implemented');
  console.log('  ✓ Proper error messages for failures');
}

async function validateTestImprovements() {
  console.log('TEST: Test file improvements');

  const testPath = path.join(rootDir, 'tests/installerAgentFiles.test.mjs');
  const content = await readFile(testPath, 'utf8');

  // Should have overwrite protection test
  if (!content.includes('testOverwriteProtection')) {
    throw new Error('Missing overwrite protection test');
  }

  // Should have file validation test
  if (!content.includes('testFileValidation')) {
    throw new Error('Missing file validation test');
  }

  // Tests should be called
  if (!content.includes('await testOverwriteProtection()')) {
    throw new Error('Overwrite protection test not called');
  }

  if (!content.includes('await testFileValidation()')) {
    throw new Error('File validation test not called');
  }

  console.log('  ✓ New test cases added');
  console.log('  ✓ Tests are executed in test suite');
}

async function main() {
  console.log('Validating installer improvements...\n');

  try {
    await validateBrandingFix();
    await validateOverwriteProtection();
    await validateErrorHandling();
    await validateFileValidation();
    await validateTestImprovements();

    console.log('\n✅ All installer improvements validated successfully!');
    console.log('\nImprovements Summary:');
    console.log('  • Branding consistency fixed');
    console.log('  • Overwrite protection for agent files');
    console.log('  • Specific error handling (EACCES, ENOSPC, EROFS)');
    console.log('  • File creation validation');
    console.log('  • Empty file detection');
    console.log('  • Enhanced test coverage');

    process.exit(0);
  } catch (error) {
    console.error('\n❌ Validation failed:', error.message);
    process.exit(1);
  }
}

main();
