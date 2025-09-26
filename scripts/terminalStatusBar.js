#!/usr/bin/env node
/**
 * Opnix Terminal Status Bar Integration
 * Installs context monitoring into user's shell configuration
 */

const fs = require('fs').promises;
const path = require('path');
const os = require('os');
const { spawn } = require('child_process');

const HOME_DIR = os.homedir();
const OPNIX_DIR = path.join(process.cwd(), '.opnix');
const STATUS_SCRIPT = path.join(OPNIX_DIR, 'opnix-status.sh');

// Shell configuration files
const SHELL_CONFIGS = {
    bash: ['.bashrc', '.bash_profile', '.profile'],
    zsh: ['.zshrc', '.zprofile'],
    fish: ['config/fish/config.fish']
};

// ANSI color codes for terminal output
const COLORS = {
    cyan: '\x1b[36m',
    orange: '\x1b[33m',
    red: '\x1b[31m',
    green: '\x1b[32m',
    reset: '\x1b[0m',
    bold: '\x1b[1m'
};

async function fileExists(filePath) {
    try {
        await fs.access(filePath);
        return true;
    } catch {
        return false;
    }
}

function detectShell() {
    const shell = process.env.SHELL || '/bin/bash';
    const shellName = path.basename(shell);

    if (shellName.includes('zsh')) return 'zsh';
    if (shellName.includes('fish')) return 'fish';
    return 'bash'; // default
}

async function findShellConfig(shell) {
    const configs = SHELL_CONFIGS[shell] || SHELL_CONFIGS.bash;

    for (const config of configs) {
        const configPath = path.join(HOME_DIR, config);
        if (await fileExists(configPath)) {
            return configPath;
        }
    }

    // Create default config if none exists
    const defaultConfig = path.join(HOME_DIR, configs[0]);
    await fs.writeFile(defaultConfig, '# Shell configuration\n', { flag: 'a' });
    return defaultConfig;
}

async function createStatusScript() {
    const statusScriptContent = `#!/bin/bash
# Opnix Terminal Status Bar - Enhanced with Backgrounds and Gradients
# Fetches context status from local Opnix server
# Only shows when using Claude CLI or Codex CLI

OPNIX_STATUS_URL="http://localhost:7337/api/context/status"
OPNIX_PID_FILE="${OPNIX_DIR}/server.pid"

# Check if we're in a Claude CLI or Codex CLI context
# Look for environment variables or process names that indicate CLI usage
if [ -z "$CLAUDE_CLI_SESSION" ] && [ -z "$CODEX_CLI_SESSION" ] && [ -z "$ANTHROPIC_CLI_SESSION" ]; then
    # Check if parent process or command history suggests CLI usage
    PARENT_CMD=$(ps -o comm= -p $PPID 2>/dev/null)
    CMDLINE=$(ps -o args= -p $PPID 2>/dev/null)

    # Exit silently if not in a CLI context
    if [[ ! "$PARENT_CMD" =~ (claude|codex|anthropic) ]] && [[ ! "$CMDLINE" =~ (claude|codex|anthropic) ]]; then
        exit 0
    fi
fi`.replace('${OPNIX_DIR}', OPNIX_DIR) + `

# Check if Opnix server is running
if [ ! -f "$OPNIX_PID_FILE" ] || ! kill -0 "$(cat "$OPNIX_PID_FILE" 2>/dev/null)" 2>/dev/null; then
    # Offline status bar with background
    OFFLINE_BAR=""
    for ((i=0; i<20; i++)); do
        BG_COLOR="\\x1b[100m"  # Dark gray background
        FG_COLOR="\\x1b[90m"   # Gray text
        OFFLINE_BAR+="\${BG_COLOR}\${FG_COLOR}░\\x1b[0m"
    done
    TEXT_COLOR="\\x1b[2;37m"  # Dim white
    STATUS_BG="\\x1b[100m"    # Dark background
    STATUS_FG="\\x1b[91m"     # Red text
    echo -e "$OFFLINE_BAR \\${TEXT_COLOR}0.0%\\x1b[0m \${STATUS_BG}\${STATUS_FG} OFFLINE \\x1b[0m"
    exit 0
fi

# Fetch status from API with timeout
STATUS_RESPONSE=$(curl -s --connect-timeout 1 --max-time 2 "$OPNIX_STATUS_URL" 2>/dev/null)

if [ $? -eq 0 ] && [ -n "$STATUS_RESPONSE" ]; then
    # Parse JSON response (basic extraction)
    PERCENTAGE=$(echo "$STATUS_RESPONSE" | grep -o '"percentage":[0-9.]*' | cut -d':' -f2 | cut -d',' -f1)
    CONTEXT_USED=$(echo "$STATUS_RESPONSE" | grep -o '"contextUsed":[0-9]*' | cut -d':' -f2)
    CONTEXT_LIMIT=$(echo "$STATUS_RESPONSE" | grep -o '"contextLimit":[0-9]*' | cut -d':' -f2)
    CURRENT_TASK=$(echo "$STATUS_RESPONSE" | grep -o '"currentTask":"[^"]*"' | cut -d'"' -f4)
    FILES_EDITED=$(echo "$STATUS_RESPONSE" | grep -o '"filesEdited":[0-9]*' | cut -d':' -f2)
    DAIC_STATE=$(echo "$STATUS_RESPONSE" | grep -o '"daicState":"[^"]*"' | cut -d'"' -f4)

    if [ -n "$PERCENTAGE" ]; then
        # Calculate visual bar (20 segments for smoother gradients)
        FILLED_BARS=$(echo "$PERCENTAGE / 5" | bc -l | cut -d'.' -f1)
        if [ -z "$FILLED_BARS" ] || [ "$FILLED_BARS" -lt 0 ]; then FILLED_BARS=0; fi
        if [ "$FILLED_BARS" -gt 20 ]; then FILLED_BARS=20; fi

        # Create gradient progress bar with backgrounds
        VISUAL_BAR=""
        RESET="\\x1b[0m"

        # Generate gradient bar with background colors and transitions
        for ((i=0; i<20; i++)); do
            if [ $i -lt $FILLED_BARS ]; then
                # Filled segments with gradient colors and backgrounds
                if [ $i -lt 10 ]; then
                    # Green to cyan gradient (0-50%)
                    BG_COLOR="\\x1b[42m"  # Green background
                    FG_COLOR="\\x1b[97m"  # White text
                    VISUAL_BAR+="\${BG_COLOR}\${FG_COLOR}█\${RESET}"
                elif [ $i -lt 15 ]; then
                    # Cyan to yellow gradient (50-75%)
                    BG_COLOR="\\x1b[46m"  # Cyan background
                    FG_COLOR="\\x1b[30m"  # Black text
                    VISUAL_BAR+="\${BG_COLOR}\${FG_COLOR}█\${RESET}"
                elif [ $i -lt 18 ]; then
                    # Yellow to orange gradient (75-90%)
                    BG_COLOR="\\x1b[43m"  # Yellow background
                    FG_COLOR="\\x1b[30m"  # Black text
                    VISUAL_BAR+="\${BG_COLOR}\${FG_COLOR}█\${RESET}"
                else
                    # Red danger zone (90-100%)
                    BG_COLOR="\\x1b[41m"  # Red background
                    FG_COLOR="\\x1b[97m"  # White text
                    VISUAL_BAR+="\${BG_COLOR}\${FG_COLOR}█\${RESET}"
                fi
            else
                # Empty segments with dark background
                BG_COLOR="\\x1b[100m"  # Dark gray background
                FG_COLOR="\\x1b[90m"   # Gray text
                VISUAL_BAR+="\${BG_COLOR}\${FG_COLOR}░\${RESET}"
            fi
        done

        # Color coding for text based on percentage
        if (( $(echo "$PERCENTAGE >= 90" | bc -l) )); then
            TEXT_COLOR="\\x1b[1;91m"  # Bold bright red
        elif (( $(echo "$PERCENTAGE >= 75" | bc -l) )); then
            TEXT_COLOR="\\x1b[1;93m"  # Bold bright yellow
        elif (( $(echo "$PERCENTAGE >= 50" | bc -l) )); then
            TEXT_COLOR="\\x1b[1;96m"  # Bold bright cyan
        else
            TEXT_COLOR="\\x1b[1;92m"  # Bold bright green
        fi

        # Format context numbers with background
        CONTEXT_BG="\\x1b[100m"  # Dark background
        CONTEXT_FG="\\x1b[97m"   # White text
        CONTEXT_DISPLAY="\${CONTEXT_BG}\${CONTEXT_FG} $((CONTEXT_USED/1000))k/$((CONTEXT_LIMIT/1000))k \${RESET}"

        # Build enhanced status line with backgrounds and gradients
        STATUS_LINE="$VISUAL_BAR \${TEXT_COLOR}$PERCENTAGE%\${RESET} $CONTEXT_DISPLAY"

        if [ -n "$CURRENT_TASK" ] && [ "$CURRENT_TASK" != "null" ]; then
            STATUS_LINE="$STATUS_LINE | Task: $CURRENT_TASK"
        fi

        if [ -n "$FILES_EDITED" ] && [ "$FILES_EDITED" != "0" ]; then
            STATUS_LINE="$STATUS_LINE | Files: $FILES_EDITED"
        fi

        if [ -n "$DAIC_STATE" ] && [ "$DAIC_STATE" != "null" ]; then
            STATUS_LINE="$STATUS_LINE | DAIC: $DAIC_STATE"
        fi

        # Add warning with enhanced styling
        if (( $(echo "$PERCENTAGE >= 90" | bc -l) )); then
            WARNING_BG="\\x1b[41m"   # Red background
            WARNING_FG="\\x1b[1;97m" # Bold white text
            STATUS_LINE="$STATUS_LINE | \${WARNING_BG}\${WARNING_FG} ⚠️  CONTEXT LIMIT APPROACHING \\x1b[0m"
        fi

        echo -e "$STATUS_LINE"
    else
        # Connected but no data - create neutral bar
        NEUTRAL_BAR=""
        for ((i=0; i<20; i++)); do
            if [ $i -lt 1 ]; then
                BG_COLOR="\\x1b[46m"  # Cyan background
                FG_COLOR="\\x1b[97m"  # White text
                NEUTRAL_BAR+="\${BG_COLOR}\${FG_COLOR}█\\x1b[0m"
            else
                BG_COLOR="\\x1b[100m"  # Dark gray background
                FG_COLOR="\\x1b[90m"   # Gray text
                NEUTRAL_BAR+="\${BG_COLOR}\${FG_COLOR}░\\x1b[0m"
            fi
        done
        TEXT_COLOR="\\x1b[1;96m"  # Bold cyan
        STATUS_BG="\\x1b[46m"     # Cyan background
        STATUS_FG="\\x1b[30m"     # Black text
        echo -e "$NEUTRAL_BAR \${TEXT_COLOR}0.0%\\x1b[0m \${STATUS_BG}\${STATUS_FG} CONNECTED \\x1b[0m"
    fi
else
    # API Error - create error bar
    ERROR_BAR=""
    for ((i=0; i<20; i++)); do
        if [ $((i % 4)) -eq 0 ]; then
            BG_COLOR="\\x1b[41m"  # Red background
            FG_COLOR="\\x1b[97m"  # White text
            ERROR_BAR+="\${BG_COLOR}\${FG_COLOR}!\\x1b[0m"
        else
            BG_COLOR="\\x1b[100m"  # Dark gray background
            FG_COLOR="\\x1b[90m"   # Gray text
            ERROR_BAR+="\${BG_COLOR}\${FG_COLOR}░\\x1b[0m"
        fi
    done
    TEXT_COLOR="\\x1b[1;91m"  # Bold red
    STATUS_BG="\\x1b[41m"     # Red background
    STATUS_FG="\\x1b[97m"     # White text
    echo -e "$ERROR_BAR \${TEXT_COLOR}ERR%\\x1b[0m \${STATUS_BG}\${STATUS_FG} API ERROR \\x1b[0m"
fi
`;

    await fs.writeFile(STATUS_SCRIPT, statusScriptContent, { mode: 0o755 });
    return STATUS_SCRIPT;
}

async function updateShellConfig(configPath, shell) {
    const configContent = await fs.readFile(configPath, 'utf8').catch(() => '');

    // Check if already installed
    if (configContent.includes('# Opnix Context Status Bar')) {
        console.log('Opnix status bar already installed in shell configuration');
        return false;
    }

    let statusBarConfig = '';

    if (shell === 'fish') {
        statusBarConfig = `
# Opnix Context Status Bar
function opnix_status_bar
    if test -f "${STATUS_SCRIPT}"
        bash "${STATUS_SCRIPT}"
    end
end

# Create claude/codex CLI wrappers for fish
function claude
    set -x CLAUDE_CLI_SESSION 1
    command claude $argv
    set -e CLAUDE_CLI_SESSION
end

function codex
    set -x CODEX_CLI_SESSION 1
    command codex $argv
    set -e CODEX_CLI_SESSION
end

function anthropic
    set -x ANTHROPIC_CLI_SESSION 1
    command anthropic $argv
    set -e ANTHROPIC_CLI_SESSION
end
`;
    } else {
        // bash/zsh
        statusBarConfig = `
# Opnix Context Status Bar
opnix_status_bar() {
    if [ -f "${STATUS_SCRIPT}" ]; then
        bash "${STATUS_SCRIPT}"
    fi
}

# Create claude/codex CLI wrappers that enable status bar
claude_with_status() {
    export CLAUDE_CLI_SESSION=1
    command claude "$@"
    unset CLAUDE_CLI_SESSION
}

codex_with_status() {
    export CODEX_CLI_SESSION=1
    command codex "$@"
    unset CODEX_CLI_SESSION
}

# Create aliases for CLI tools
alias claude='claude_with_status'
alias codex='codex_with_status'

# For direct anthropic CLI usage
anthropic_with_status() {
    export ANTHROPIC_CLI_SESSION=1
    command anthropic "$@"
    unset ANTHROPIC_CLI_SESSION
}
alias anthropic='anthropic_with_status'
`;
    }

    const updatedContent = configContent + statusBarConfig;
    await fs.writeFile(configPath, updatedContent);
    return true;
}

async function createServerPidFile() {
    // Create a simple way to track server status
    const pidContent = `# This file tracks if Opnix server should be running
# Created during installation
`;
    const pidFile = path.join(OPNIX_DIR, 'server.pid');
    await fs.writeFile(pidFile, pidContent);
    return pidFile;
}

async function installStatusBar() {
    console.log('🔧 Installing Opnix terminal status bar...');

    try {
        // Ensure .opnix directory exists
        await fs.mkdir(OPNIX_DIR, { recursive: true });

        // Create status script
        const scriptPath = await createStatusScript();
        console.log(`✅ Created status script: ${scriptPath}`);

        // Detect shell and config
        const shell = detectShell();
        const configPath = await findShellConfig(shell);
        console.log(`🐚 Detected shell: ${shell} (config: ${configPath})`);

        // Update shell configuration
        const wasUpdated = await updateShellConfig(configPath, shell);
        if (wasUpdated) {
            console.log(`✅ Added status bar to ${configPath}`);
            console.log(`${COLORS.cyan}${COLORS.bold}ℹ️  Restart your terminal or run 'source ${configPath}' to activate${COLORS.reset}`);
        }

        // Create server tracking
        await createServerPidFile();

        return true;
    } catch (error) {
        console.error('❌ Failed to install terminal status bar:', error.message);
        return false;
    }
}

async function uninstallStatusBar() {
    console.log('🗑️  Uninstalling Opnix terminal status bar...');

    try {
        const shell = detectShell();
        const configPath = await findShellConfig(shell);

        // Remove from shell config
        const configContent = await fs.readFile(configPath, 'utf8').catch(() => '');
        const lines = configContent.split('\n');
        const filteredLines = [];
        let skipBlock = false;

        for (const line of lines) {
            if (line.includes('# Opnix Context Status Bar')) {
                skipBlock = true;
                continue;
            }
            if (skipBlock && line.trim() === '') {
                skipBlock = false;
                continue;
            }
            if (!skipBlock) {
                filteredLines.push(line);
            }
        }

        await fs.writeFile(configPath, filteredLines.join('\n'));

        // Remove status script
        await fs.unlink(STATUS_SCRIPT).catch(() => {});

        console.log('✅ Terminal status bar uninstalled');
        console.log(`${COLORS.cyan}ℹ️  Restart your terminal to complete removal${COLORS.reset}`);

        return true;
    } catch (error) {
        console.error('❌ Failed to uninstall terminal status bar:', error.message);
        return false;
    }
}

// CLI interface
if (require.main === module) {
    const command = process.argv[2];

    switch (command) {
        case 'install':
            installStatusBar();
            break;
        case 'uninstall':
            uninstallStatusBar();
            break;
        case 'status':
            // Test the status bar
            spawn('bash', [STATUS_SCRIPT], { stdio: 'inherit' });
            break;
        default:
            console.log('Usage: node terminalStatusBar.js [install|uninstall|status]');
            process.exit(1);
    }
}

module.exports = { installStatusBar, uninstallStatusBar };