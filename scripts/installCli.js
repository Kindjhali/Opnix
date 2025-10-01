#!/usr/bin/env node
/**
 * Opnix Installer CLI
 * Provides a themed installation experience with automated dependency setup and decision-tree handoff.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');
const checkpointManager = require('../services/checkpointManager');
const gracefulFailureHandler = require('../services/gracefulFailureHandler');
const taskLogger = require('../services/taskLogger');

const ROOT = path.join(__dirname, '..');
const NODE_MODULES_DIR = path.join(ROOT, 'node_modules');
const SPEC_DIR = path.join(ROOT, 'spec');
const SPEC_SUBDIRS = ['blueprints', 'docs', 'revision', 'audits', 'canvas', 'diagrams', 'roadmaps'];
const DATA_DIR = path.join(ROOT, 'data');
const DATA_FILES = [
    'tickets.json',
    'features.json',
    'module-links.json',
    'modules.json',
    'checklists.json',
    'terminal-history.json',
    'setup-state.json'
];
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const OPNIX_DIR = path.join(ROOT, '.opnix');
const OPNIX_RUNTIME_DIR = path.join(OPNIX_DIR, 'runtime');
const OPNIX_SCAFFOLD_DIR = path.join(OPNIX_DIR, 'scaffold');
const RUNTIME_BUNDLE_ARCHIVE = path.join(OPNIX_RUNTIME_DIR, 'bundle.tar.gz');

const FORCE_NON_INTERACTIVE = /^(1|true|yes)$/i.test((process.env.OPNIX_INSTALL_NON_INTERACTIVE || '').trim());
const DEFAULT_WIZARD_MODE = (() => {
    const value = (process.env.OPNIX_INSTALL_MODE || '').trim().toLowerCase();
    return value === 'new' || value === 'existing' ? value : null;
})();

const ANSI = {
    reset: '\u001b[0m',
    bold: '\u001b[1m',
    dim: '\u001b[2m'
};

const palette = {
    background: [10, 15, 28],      // --bg-darkest from MOLE
    panel: [30, 38, 81],            // --bg-card from MOLE
    textBright: [250, 235, 215],    // --text-light from MOLE
    textMuted: [123, 138, 168],     // --text-muted from MOLE
    accentPink: [233, 69, 96],      // --text-primary from MOLE (#E94560)
    accentCyan: [6, 182, 212],      // --info from MOLE (#06B6D4)
    accentBlue: [31, 182, 255],     // --accent-2 from MOLE (#1FB6FF)
    accentOrange: [255, 140, 59],   // --accent-1 from MOLE (#FF8C3B)
    success: [16, 185, 129],        // --success from MOLE
    warning: [245, 158, 11],        // --warning from MOLE
    danger: [239, 68, 68]           // --danger from MOLE
};

function colour(value, type) {
    return `\u001b[${type === 'bg' ? 48 : 38};2;${value[0]};${value[1]};${value[2]}m`;
}

function style(text, { fg, bg, bold = false, dim = false } = {}) {
    const codes = [];
    if (bold) codes.push(ANSI.bold);
    if (dim) codes.push(ANSI.dim);
    if (fg) codes.push(colour(fg, 'fg'));
    if (bg) codes.push(colour(bg, 'bg'));
    return `${codes.join('')}${text}${ANSI.reset}`;
}

const theme = {
    heading: text => style(text, { fg: palette.accentCyan, bold: true }),
    accent: text => style(text, { fg: palette.accentBlue, bold: true }),
    logo: text => style(text, { fg: palette.accentPink, bold: true }),
    bright: text => style(text, { fg: palette.textBright }),
    muted: text => style(text, { fg: palette.textMuted }),
    border: text => style(text, { fg: palette.accentPink }),
    badge: (char, accent = palette.accentCyan) => style(` ${char} `, { fg: palette.background, bg: accent, bold: true }),
    code: text => style(` ${text} `, { fg: palette.accentCyan, bg: palette.background, bold: true }),
    section: text => style(text.toUpperCase(), { fg: palette.accentPink, bold: true }),
    step: (index, label, detail) => {
        const marker = theme.badge(String(index), palette.accentPink);
        const labelText = theme.bright(label);
        const detailText = detail ? `${theme.muted(' -> ')}${theme.code(detail)}` : '';
        return `${marker} ${labelText}${detailText}`;
    },
    question: text => `${theme.badge('?')} ${theme.bright(text)} `,
    info: message => `${theme.badge('›')} ${message}`,
    success: message => `${theme.badge('✓', palette.success)} ${message}`,
    warn: message => `${theme.badge('!', palette.warning)} ${message}`,
    error: message => `${theme.badge('✖', palette.danger)} ${message}`
};

function padCenter(text, width) {
    if (text.length >= width) return text;
    const totalPadding = width - text.length;
    const left = Math.floor(totalPadding / 2);
    const right = totalPadding - left;
    return `${' '.repeat(left)}${text}${' '.repeat(right)}`;
}

function logInfo(...parts) {
    console.log(theme.info(parts.join('')));
}

function logSuccess(...parts) {
    console.log(theme.success(parts.join('')));
}

function logWarn(...parts) {
    console.log(theme.warn(parts.join('')));
}

function logError(...parts) {
    console.error(theme.error(parts.join('')));
}

function banner() {
    const logo = [
        '   ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄    ▄ ▄▄▄ ▄▄   ▄▄',
        '  █       █       █  █  █ █   █  █ █  █',
        '  █   ▄   █    ▄  █   █▄█ █   █  █▄█  █',
        '  █  █ █  █   █▄█ █       █   █       █',
        '  █  █▄█  █    ▄▄▄█  ▄    █   █       █',
        '  █       █   █   █ █ █   █   █ ██▄██ █',
        '  █▄▄▄▄▄▄▄█▄▄▄█   █▄█  █▄▄█▄▄▄█▄█   █▄█'
    ];

    console.log('');
    logo.forEach(line => {
        console.log(theme.neon(line));
    });
    console.log('');
    console.log(theme.muted(padCenter('Operational Toolkit · Visual Canvas · Audit Engine', 50)));
    console.log(theme.accent(padCenter('MOLE Console · JetBrains Mono', 50)));
    console.log('');
}

async function fileExists(target) {
    try {
        await fs.access(target);
        return true;
    } catch {
        return false;
    }
}

function prompt(question, fallback) {
    if (!process.stdin.isTTY || FORCE_NON_INTERACTIVE) {
        return Promise.resolve(fallback);
    }
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            const normalized = answer.trim();
            resolve(normalized === '' ? fallback : normalized);
        });
    });
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, { stdio: 'inherit', ...options });
        child.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
        });
    });
}

function invokeRoute(handler, { method = 'GET', body = {}, query = {} } = {}) {
    return new Promise((resolve, reject) => {
        const req = {
            method: method.toUpperCase(),
            body,
            query,
            headers: {},
            get(name) {
                return this.headers[String(name).toLowerCase()] || undefined;
            }
        };

        const res = {
            statusCode: 200,
            headers: {},
            status(code) {
                this.statusCode = code;
                return this;
            },
            set(field, value) {
                this.headers[field.toLowerCase()] = value;
                return this;
            },
            json(payload) {
                resolve({ statusCode: this.statusCode || 200, payload });
            }
        };

        Promise.resolve(handler(req, res)).catch(reject);
    });
}

async function ensurePackageJson() {
    if (!(await fileExists(PACKAGE_JSON))) {
        throw new Error('package.json not found. Run this script from the Opnix workspace root.');
    }
}

async function ensureDependencies() {
    const exists = await fileExists(NODE_MODULES_DIR);
    if (exists) {
        logInfo(theme.muted('Dependencies already installed. Skipping npm install.'));
        return;
    }

    const answer = await prompt(theme.question('Install npm dependencies now? [Y/n]'), 'y');
    if (/^n/i.test(answer)) {
        logWarn(
            theme.muted('Skipping install per request. Remember to run '),
            theme.code('npm install'),
            theme.muted(' before starting the server.')
        );
        return;
    }

    logInfo(theme.muted('Installing dependencies '), theme.code('npm install'), theme.muted('...'));
    await runCommand('npm', ['install'], { cwd: ROOT });
    logSuccess(theme.bright('Dependencies installed.'));
}

async function ensureSpecDirs() {
    if (!(await fileExists(SPEC_DIR))) {
        await fs.mkdir(SPEC_DIR, { recursive: true });
        logSuccess('Created ', theme.code('spec/'), theme.muted(' directory.'));
    }
    await Promise.all(
        SPEC_SUBDIRS.map(async folder => {
            const target = path.join(SPEC_DIR, folder);
            if (!(await fileExists(target))) {
                await fs.mkdir(target, { recursive: true });
                logSuccess('Prepared ', theme.code(`spec/${folder}/`), theme.muted(' directory.'));
            }
        })
    );
}

async function ensureDataDir() {
    if (!(await fileExists(DATA_DIR))) {
        await fs.mkdir(DATA_DIR, { recursive: true });
        logSuccess('Created ', theme.code('data/'), theme.muted(' directory.'));
    }

    for (const filename of DATA_FILES) {
        const legacyPath = path.join(ROOT, filename);
        const targetPath = path.join(DATA_DIR, filename);
        const legacyExists = await fileExists(legacyPath);
        const targetExists = await fileExists(targetPath);
        if (legacyExists && !targetExists) {
            await fs.rename(legacyPath, targetPath);
            logSuccess('Moved ', theme.code(filename), theme.muted(' -> '), theme.code('data/'));
        }
    }
}

async function ensureOpnixDirs() {
    if (!(await fileExists(OPNIX_DIR))) {
        await fs.mkdir(OPNIX_DIR, { recursive: true });
        logSuccess('Created hidden ', theme.code('.opnix/'), theme.muted(' workspace.'));
    }
    if (!(await fileExists(OPNIX_RUNTIME_DIR))) {
        await fs.mkdir(OPNIX_RUNTIME_DIR, { recursive: true });
        logSuccess('Prepared ', theme.code('.opnix/runtime/'), theme.muted(' directory.'));
    }
    if (!(await fileExists(OPNIX_SCAFFOLD_DIR))) {
        await fs.mkdir(OPNIX_SCAFFOLD_DIR, { recursive: true });
        logSuccess('Prepared ', theme.code('.opnix/scaffold/'), theme.muted(' directory.'));
    }
}

async function detectPriorInstall() {
    const opnixExists = await fileExists(OPNIX_DIR);
    if (!opnixExists) {
        return false;
    }

    const [manifestExists, runtimeIndexExists, setupStateExists] = await Promise.all([
        fileExists(path.join(OPNIX_SCAFFOLD_DIR, 'manifest.json')),
        fileExists(path.join(OPNIX_RUNTIME_DIR, 'index.json')),
        fileExists(path.join(DATA_DIR, 'setup-state.json'))
    ]);

    return manifestExists || runtimeIndexExists || setupStateExists;
}

async function ensureRuntimeBundleUnpacked() {
    const archiveExists = await fileExists(RUNTIME_BUNDLE_ARCHIVE);
    if (!archiveExists) {
        return false;
    }

    const indexExists = await fileExists(path.join(OPNIX_RUNTIME_DIR, 'index.json'));
    if (indexExists) {
        return false;
    }

    try {
        await runCommand('tar', ['-xzf', RUNTIME_BUNDLE_ARCHIVE, '-C', OPNIX_DIR], { cwd: ROOT });
        await fs.unlink(RUNTIME_BUNDLE_ARCHIVE).catch(() => {});
        logSuccess('Unpacked runtime bundle into ', theme.code('.opnix/'), theme.muted(' and removed archive.'));
        return true;
    } catch (error) {
        logWarn('Unable to automatically unpack runtime bundle. Continuing with live generation. ', theme.muted(error.message || ''));
    }

    return false;
}

async function verifyUltraThinkIntegration() {
    logInfo(theme.muted('Validating UltraThink + context monitoring endpoints...'));

    try {
        const server = require('../server');
        const {
            ultraThinkTriggerRoute,
            ultraThinkModeRoute,
            contextStatusRoute,
            contextUpdateRoute
        } = server;

        if (!ultraThinkTriggerRoute || !ultraThinkModeRoute || !contextStatusRoute || !contextUpdateRoute) {
            throw new Error('Server exports missing UltraThink/context handlers');
        }

        // Ensure baseline mode
        await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'api' } });

        const triggerCheck = await invokeRoute(ultraThinkTriggerRoute, {
            method: 'post',
            body: { message: 'Installer [[ ultrathink ]] verification', mode: 'api' }
        });

        const { payload: triggerPayload } = triggerCheck;
        if (!triggerPayload.ultrathink || triggerPayload.thinkingBudget < 31999) {
            throw new Error('UltraThink trigger did not allocate expected thinking budget');
        }

        const modeChange = await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'default' } });
        if (modeChange.payload?.mode !== 'default') {
            throw new Error('Failed to switch UltraThink mode to default');
        }

        const defaultTrigger = await invokeRoute(ultraThinkTriggerRoute, {
            method: 'post',
            body: { message: 'Routine check' }
        });

        if ((defaultTrigger.payload?.thinkingBudget || 0) < 10000) {
            throw new Error('Default UltraThink mode did not provide baseline thinking budget');
        }

        await invokeRoute(contextUpdateRoute, {
            method: 'post',
            body: {
                contextUsed: 80000,
                task: 'Installer Verification',
                filesEdited: 3,
                daicState: 'Implementation'
            }
        });

        const status = await invokeRoute(contextStatusRoute, { method: 'get' });
        const statusPayload = status.payload || {};
        if (statusPayload.contextUsed !== 80000 || statusPayload.currentTask !== 'Installer Verification') {
            throw new Error('Context status endpoint did not reflect updated values');
        }
        if (typeof statusPayload.visualBar !== 'string' || statusPayload.visualBar.length === 0) {
            throw new Error('Context status endpoint did not provide visual bar output');
        }

        // Reset state for future operations
        await invokeRoute(contextUpdateRoute, {
            method: 'post',
            body: {
                contextUsed: 0,
                task: 'System Ready',
                filesEdited: 0,
                daicState: 'Discussion'
            }
        });
        await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'api' } });

        logSuccess('UltraThink + context endpoints validated.');
    } catch (error) {
        logError('UltraThink/context endpoint validation failed: ', theme.muted(error.message));
        throw error;
    }
}

async function installTerminalStatusBar() {
    try {
        logInfo(theme.muted('Installing terminal context status bar...'));
        const { installStatusBar } = require('./terminalStatusBar');
        const success = await installStatusBar();
        if (success) {
            logSuccess('Terminal status bar installed. Context monitoring active in your shell.');
        } else {
            logWarn('Terminal status bar installation had issues. Check output above.');
        }
    } catch (error) {
        logError('Failed to install terminal status bar: ', theme.muted(error.message));
    }
}

async function offerWizard({ isReinstall = false, forcedMode = null } = {}) {
    if ((process.env.OPNIX_INSTALL_SKIP_WIZARD || '').trim() === '1') {
        logInfo(
            theme.muted('Skipping setup wizard per configuration flag. '),
            theme.muted('Run '),
            theme.code('npm run setup:wizard'),
            theme.muted(' when you are ready.')
        );
        return;
    }

    let inferredMode = forcedMode || DEFAULT_WIZARD_MODE;
    const nonInteractive = FORCE_NON_INTERACTIVE || !process.stdin.isTTY || isReinstall;

    if (isReinstall) {
        inferredMode = 'existing';
        logInfo(theme.muted('Detected existing .opnix/ workspace. Refreshing audit via setup wizard.'));
    } else if (!nonInteractive) {
        const defaultChoice = 'y';
        const answer = await prompt(theme.question('Run the setup decision tree now? [Y/n]'), defaultChoice);
        if (/^n/i.test(answer)) {
            logInfo(
                theme.muted('Skipping wizard. You can run it later with '),
                theme.code('npm run setup:wizard')
            );
            return;
        }
    } else {
        logInfo(theme.muted('Non-interactive install; running setup wizard automatically.'));
    }

    const wizardArgs = ['scripts/setupWizard.js'];
    if (inferredMode) {
        wizardArgs.push('--mode', inferredMode);
    }
    if (nonInteractive) {
        wizardArgs.push('--non-interactive');
    }

    logInfo(theme.muted('Launching setup wizard...'));
    await runCommand('node', wizardArgs, { cwd: ROOT });
}

function printNextSteps() {
    console.log('');
    console.log(theme.section('Next actions'));
    const steps = [
        { label: 'Start the server', detail: 'npm start' },
        { label: 'Open the console', detail: 'http://localhost:7337' },
        { label: 'Test terminal status bar', detail: 'npm run terminal:status' },
        { label: 'Inspect data store', detail: 'ls data/' },
        { label: 'Explore spec artefacts', detail: 'ls spec/' },
        { label: 'Re-run wizard anytime', detail: 'npm run setup:wizard' }
    ];
    steps.forEach((step, index) => {
        console.log(theme.step(index + 1, step.label, step.detail));
    });
    console.log('');
}

async function main() {
    const installSessionId = `install-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    let installTaskId = null;

    try {
        // Initialize recovery system and task logging for installation
        await checkpointManager.initialize();
        await taskLogger.initialize();

        await ensurePackageJson();
        const priorInstall = await detectPriorInstall();

        // Start installation task logging
        installTaskId = await taskLogger.startTask(
            'Opnix Installation',
            'Complete installation of Opnix operational toolkit',
            'installer',
            {
                installationType: priorInstall ? 'reinstall' : 'fresh-install',
                nodeVersion: process.version,
                platform: process.platform
            }
        );

        banner();

        // Create initial checkpoint
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'initialization',
            timestamp: new Date().toISOString()
        }, {
            type: 'install-start',
            description: 'Installation process started',
            critical: true,
            context: { phase: 'init' }
        });

        await taskLogger.addTaskNote(installTaskId, 'Package.json validated', 'milestone');

        // Checkpoint after package.json check
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'package-validated',
            priorInstall,
            timestamp: new Date().toISOString()
        }, {
            type: 'install-progress',
            description: 'Package.json validated',
            context: { phase: 'package-validated', priorInstall }
        });

        await ensureOpnixDirs();
        await ensureRuntimeBundleUnpacked();

        // Checkpoint after directory setup
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'directories-setup',
            timestamp: new Date().toISOString()
        }, {
            type: 'install-progress',
            description: 'Directories and runtime bundle setup complete',
            context: { phase: 'directories-setup' }
        });

        logInfo(theme.muted('Checking workspace dependencies...'));
        await ensureDependencies();

        await taskLogger.addTaskNote(installTaskId, 'Dependencies installed successfully', 'progress');

        // Checkpoint after dependencies
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'dependencies-installed',
            timestamp: new Date().toISOString()
        }, {
            type: 'install-progress',
            description: 'Dependencies installed',
            context: { phase: 'dependencies-installed' }
        });

        await ensureDataDir();
        await ensureSpecDirs();
        await verifyUltraThinkIntegration();
        await installTerminalStatusBar();

        // Checkpoint before wizard
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'pre-wizard',
            timestamp: new Date().toISOString()
        }, {
            type: 'install-progress',
            description: 'Core installation complete, launching wizard',
            context: { phase: 'pre-wizard' }
        });

        await offerWizard({ isReinstall: priorInstall });
        printNextSteps();

        await taskLogger.updateTaskMetrics(installTaskId, {
            linesChanged: 0,
            filesModified: ['package.json', '.opnix/', 'data/', 'spec/'],
            complexity: 'high',
            installationType: priorInstall ? 'reinstall' : 'fresh-install'
        });

        // Final checkpoint
        await checkpointManager.createCheckpoint(installSessionId, {
            phase: 'completed',
            priorInstall,
            completedAt: new Date().toISOString()
        }, {
            type: 'install-complete',
            description: 'Installation completed successfully',
            critical: true,
            context: { phase: 'completed', priorInstall }
        });

        // Complete installation task logging
        await taskLogger.completeTask(
            installTaskId,
            `Opnix installation completed successfully. ${priorInstall ? 'Reinstallation' : 'Fresh installation'} finished with all components initialized.`,
            'success'
        );

        logSuccess(
            theme.bright('Opnix installation complete. '),
            theme.muted('Enjoy the visual canvas.')
        );

    } catch (error) {
        // Handle installation failure with recovery and task logging
        try {
            await gracefulFailureHandler.handleSessionFailure(installSessionId, error, {
                sessionType: 'installation',
                phase: 'main',
                operation: 'opnix-install'
            });

            // Complete task with failure outcome if task was started
            if (installTaskId) {
                await taskLogger.completeTask(
                    installTaskId,
                    `Installation failed: ${error.message}. Recovery system activated.`,
                    'failure'
                );
            }
        } catch (recoveryError) {
            logError(
                theme.bright('Recovery handling failed: '),
                theme.muted(recoveryError.message)
            );
        }

        logError(
            theme.bright('Installation failed: '),
            theme.muted(error.message)
        );
        process.exitCode = 1;
    }
}

main();
