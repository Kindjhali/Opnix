import { test, expect } from '@playwright/test'
import { exec } from 'child_process'
import fs from 'fs'
import path from 'path'
import { promisify } from 'util'

const execAsync = promisify(exec)
const AGENT_FILES = ['CLAUDE.md', 'AGENTS.md', 'GEMINI.md']

test.describe('Installer Agent Files E2E Tests', () => {
  test.beforeEach(async () => {
    // Clean up any existing agent files
    for (const file of AGENT_FILES) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
  })

  test.afterEach(async () => {
    // Clean up created files
    for (const file of AGENT_FILES) {
      if (fs.existsSync(file)) {
        fs.unlinkSync(file)
      }
    }
  })

  test('should prompt for agent files generation and create files when user answers Y', async () => {
    // Create expect script for this specific test
    const expectScript = `#!/usr/bin/expect -f
set timeout 60
spawn node scripts/setupWizard.js --mode=new
expect "*Generate agent guidance files*"
send "Y\\r"
expect {
  "*Agent files generated successfully*" {
    puts "SUCCESS: Files created"
    exit 0
  }
  timeout {
    puts "ERROR: Timeout"
    exit 1
  }
}
expect eof`

    fs.writeFileSync('test_temp.exp', expectScript)
    fs.chmodSync('test_temp.exp', 0o755)

    try {
      const { stdout, stderr } = await execAsync('./test_temp.exp', { timeout: 120000 })

      // Verify files were created
      for (const file of AGENT_FILES) {
        expect(fs.existsSync(file), `${file} should exist`).toBe(true)
        expect(fs.statSync(file).size, `${file} should not be empty`).toBeGreaterThan(0)
      }
    } finally {
      // Clean up temp script
      if (fs.existsSync('test_temp.exp')) {
        fs.unlinkSync('test_temp.exp')
      }
    }
  })

  test('should validate CLAUDE.md content structure and data', async () => {
    // First create the files using expect
    const expectScript = `#!/usr/bin/expect -f
set timeout 60
spawn node scripts/setupWizard.js --mode=new
expect "*Generate agent guidance files*"
send "Y\\r"
expect "*Agent files generated successfully*"
expect eof`

    fs.writeFileSync('test_temp.exp', expectScript)
    fs.chmodSync('test_temp.exp', 0o755)

    try {
      await execAsync('./test_temp.exp', { timeout: 120000 })

      // Validate CLAUDE.md content
      const claudeContent = fs.readFileSync('CLAUDE.md', 'utf8')

      // Check for required project data
      expect(claudeContent).toContain('opnix')
      expect(claudeContent).toContain('Vue.js')
      expect(claudeContent).toContain('Express')
      expect(claudeContent).toContain('camelCase')
      expect(claudeContent).toContain('15 detected modules')
      expect(claudeContent).toContain('Frontend-focused application')

      // Check structure
      expect(claudeContent).toContain('# CLAUDE.md')
      expect(claudeContent).toContain('## Project Overview')
      expect(claudeContent).toContain('## Technology Stack')
      expect(claudeContent).toContain('## Code Conventions')
    } finally {
      if (fs.existsSync('test_temp.exp')) {
        fs.unlinkSync('test_temp.exp')
      }
    }
  })

  test('should validate AGENTS.md content structure and data', async () => {
    // Create the files using expect
    const expectScript = `#!/usr/bin/expect -f
set timeout 60
spawn node scripts/setupWizard.js --mode=new
expect "*Generate agent guidance files*"
send "Y\\r"
expect "*Agent files generated successfully*"
expect eof`

    fs.writeFileSync('test_temp.exp', expectScript)
    fs.chmodSync('test_temp.exp', 0o755)

    try {
      await execAsync('./test_temp.exp', { timeout: 120000 })

      // Validate AGENTS.md content
      const agentsContent = fs.readFileSync('AGENTS.md', 'utf8')

      // Check for required project data
      expect(agentsContent).toContain('opnix')
      expect(agentsContent).toContain('15')
      expect(agentsContent).toContain('Frontend-focused application')
      expect(agentsContent).toContain('camelCase')

      // Check structure
      expect(agentsContent).toContain('# AGENTS.md')
      expect(agentsContent).toContain('## Agent Roles & Responsibilities')
      expect(agentsContent).toContain('## Coordination Protocols')
      expect(agentsContent).toContain('## Quality Gates')
    } finally {
      if (fs.existsSync('test_temp.exp')) {
        fs.unlinkSync('test_temp.exp')
      }
    }
  })

  test('should validate GEMINI.md content structure and data', async () => {
    // Create the files using expect
    const expectScript = `#!/usr/bin/expect -f
set timeout 60
spawn node scripts/setupWizard.js --mode=new
expect "*Generate agent guidance files*"
send "Y\\r"
expect "*Agent files generated successfully*"
expect eof`

    fs.writeFileSync('test_temp.exp', expectScript)
    fs.chmodSync('test_temp.exp', 0o755)

    try {
      await execAsync('./test_temp.exp', { timeout: 120000 })

      // Validate GEMINI.md content
      const geminiContent = fs.readFileSync('GEMINI.md', 'utf8')

      // Check for required project data
      expect(geminiContent).toContain('opnix')
      expect(geminiContent).toContain('15')
      expect(geminiContent).toContain('Frontend-focused application')
      expect(geminiContent).toContain('camelCase')
      expect(geminiContent).toContain('Vue.js')
      expect(geminiContent).toContain('Express')

      // Check structure
      expect(geminiContent).toContain('# GEMINI.md')
      expect(geminiContent).toContain('## Project Profile')
      expect(geminiContent).toContain('## Technology Landscape')
      expect(geminiContent).toContain('## Opnix System Integration')
    } finally {
      if (fs.existsSync('test_temp.exp')) {
        fs.unlinkSync('test_temp.exp')
      }
    }
  })

  test('should handle non-interactive mode correctly (skip agent files)', async () => {
    // Test the setupWizard to see if it skips agent files in non-interactive mode
    // This test checks the existing logic by examining if the prompt is skipped

    try {
      // Run with redirected stdin to simulate non-interactive
      const { stdout, stderr } = await execAsync('echo "" | node scripts/setupWizard.js --mode=new', {
        timeout: 120000,
        env: { ...process.env, CI: 'true' }
      })

      // In non-interactive mode or when no input is given, files should not be created
      for (const file of AGENT_FILES) {
        expect(fs.existsSync(file), `${file} should not exist when no input provided`).toBe(false)
      }
    } catch (error) {
      // This is expected behavior in non-interactive mode
      // Verify files still weren't created
      for (const file of AGENT_FILES) {
        expect(fs.existsSync(file), `${file} should not exist in non-interactive mode`).toBe(false)
      }
    }
  })
})