# Testing TODO - End-to-End Verification Needed

## TTY (Teletypewriter) Explanation

**TTY** stands for "Teletypewriter" - in modern computing, it refers to a terminal session that supports interactive input/output. When you run commands in a real terminal window (like Terminal.app, gnome-terminal, etc.), you have a TTY. When scripts run in automated environments (CI/CD, background processes, or through some remote execution), they often don't have a TTY.

**TTY Detection in Code:**
```javascript
process.stdin.isTTY  // true if interactive terminal, false if automated/piped
```

## Installer Agent Files - Full E2E Testing Required

### Current Implementation Status
- ✅ **Code Complete**: All functions implemented with real file operations
- ✅ **Logic Tested**: Unit tests cover template generation, framework detection, etc.
- ✅ **Non-Interactive Verified**: Correctly skips in automated environments
- ❌ **Interactive Flow Unverified**: Cannot test TTY prompt in current environment

### E2E Tests Needed

#### 1. Playwright Testing for Interactive Installer
```javascript
// tests/e2e/installer-agent-files.spec.js
test('setupWizard prompts for agent files in interactive mode', async ({ page }) => {
  // Spawn setupWizard in real terminal
  // Verify prompt appears: "Generate agent guidance files? [Y/n]:"
  // Test "Y" response generates 3 files
  // Test "n" response skips generation
  // Verify file contents match project structure
});
```

#### 2. Real TTY Terminal Testing
**Manual Test Steps:**
1. Open actual terminal (with TTY)
2. Run: `node scripts/setupWizard.js --mode=new`
3. Verify prompt appears: "Generate AI agent guidance files (CLAUDE.md, AGENTS.md, GEMINI.md) tailored to your project?"
4. Answer "Y" and verify 3 files created in project root
5. Check file contents contain:
   - Correct project name from package.json
   - Detected frameworks (Vue.js, Express, etc.)
   - Module count and architecture description
   - camelCase convention enforcement note

#### 3. File Generation Verification
**Expected Files Created:**
- `CLAUDE.md` - Claude-specific guidelines
- `AGENTS.md` - Multi-agent coordination protocols  
- `GEMINI.md` - Gemini-specific guidelines

**Content Validation:**
```bash
# After running installer with "Y" response
test -f CLAUDE.md && echo "✓ CLAUDE.md created"
test -f AGENTS.md && echo "✓ AGENTS.md created" 
test -f GEMINI.md && echo "✓ GEMINI.md created"

# Verify content contains project-specific data
grep "opnix" CLAUDE.md && echo "✓ Project name found"
grep "Vue.js" CLAUDE.md && echo "✓ Framework detected"
grep "camelCase" CLAUDE.md && echo "✓ Conventions included"
```

#### 4. Edge Case Testing
- Test with malformed package.json
- Test with missing dependencies section
- Test with empty modules array
- Test file write permission errors
- Test interrupting prompt (Ctrl+C)

### Implementation Files to Test
- `scripts/setupWizard.js:394` - `promptForAgentFiles()`
- `scripts/setupWizard.js:437` - `generateAgentFiles()`
- `scripts/setupWizard.js:546` - `renderClaudeTemplate()`
- `scripts/setupWizard.js:610` - `renderAgentsTemplate()`
- `scripts/setupWizard.js:719` - `renderGeminiTemplate()`

### Success Criteria
✅ **Complete when:**
1. Interactive prompt displays correctly in real terminal
2. "Y" response creates 3 files with correct content
3. "n" response skips without creating files
4. Generated files contain project-specific data
5. All edge cases handled gracefully
6. Playwright E2E tests pass

### Why This Matters
Agent files are critical for AI assistant onboarding. They must contain accurate, project-specific information to be useful. Half-working or empty files are worse than no files at all.

## TTY Testing Environment Setup

### REQUIRED: Install TTY Testing Dependencies

**For PTY Testing:**
```bash
# Install node-pty for programmatic TTY simulation
pnpm add --save-dev node-pty

# Install expect for automated TTY interaction
# Ubuntu/Debian:
sudo apt-get install expect

# macOS:
brew install expect

# Windows (via WSL or Git Bash):
# Use Docker option instead
```

**For Playwright TTY Integration:**
```bash
# Install playwright with TTY support
pnpm add --save-dev @playwright/test
pnpm add --save-dev playwright

# Initialize playwright
npx playwright install
```

### Option 1: Local Development
```bash
# In actual terminal with TTY
cd /path/to/opnix
node scripts/setupWizard.js --mode=new
# Follow prompts interactively
```

### Option 2: Automated TTY Testing with Expect
```bash
# Create expect script for automated testing
cat > test-installer-tty.exp << 'EOF'
#!/usr/bin/expect -f
set timeout 30
spawn node scripts/setupWizard.js --mode=new
expect "Generate agent guidance files? \[Y/n\]:"
send "Y\r"
expect "Decision tree complete."
exit
EOF

chmod +x test-installer-tty.exp
./test-installer-tty.exp
```

### Option 3: Playwright with PTY
```javascript
import pty from 'node-pty';

test('interactive installer with real TTY', async () => {
  const terminal = pty.spawn('node', ['scripts/setupWizard.js', '--mode=new'], {
    name: 'xterm-color',
    cols: 80,
    rows: 30,
    cwd: process.cwd(),
  });
  
  // Listen for prompt and respond
  terminal.onData((data) => {
    if (data.includes('Generate agent guidance files?')) {
      terminal.write('Y\r');
    }
  });
  
  // Verify files created after completion
});
```

### Option 4: Direct System Testing
```bash
# Just run it directly on the system
cd /path/to/opnix
node scripts/setupWizard.js --mode=new
# No containers, no virtualization, just real testing
```

### Option 5: Manual TTY with Script Recording
```bash
# Record the session for later verification
script -c "node scripts/setupWizard.js --mode=new" installer-test.log

# Review the recorded session
cat installer-test.log
```

## Current Test Coverage
✅ Logic validation: `tests/installerAgentFiles.test.mjs`
❌ E2E interactive flow: **NEEDS IMPLEMENTATION**
❌ Real file generation: **NEEDS VERIFICATION**