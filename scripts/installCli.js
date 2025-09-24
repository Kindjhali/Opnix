#!/usr/bin/env node
/**
 * OTKit Neon Installer CLI
 * Provides a themed installation experience with automated dependency setup and decision-tree handoff.
 */

const fs = require('fs').promises;
const path = require('path');
const { spawn } = require('child_process');
const readline = require('readline');

const ROOT = path.join(__dirname, '..');
const NODE_MODULES_DIR = path.join(ROOT, 'node_modules');
const EXPORTS_DIR = path.join(ROOT, 'exports');
const PACKAGE_JSON = path.join(ROOT, 'package.json');

const ANSI = {
    reset: '\u001b[0m',
    bold: '\u001b[1m',
    dim: '\u001b[2m'
};

function rgb(r, g, b) {
    return `\u001b[38;2;${r};${g};${b}m`;
}

const theme = {
    pink: text => `${rgb(233, 69, 96)}${text}${ANSI.reset}`,
    cyan: text => `${rgb(6, 182, 212)}${text}${ANSI.reset}`,
    orange: text => `${rgb(255, 140, 59)}${text}${ANSI.reset}`,
    blue: text => `${rgb(31, 182, 255)}${text}${ANSI.reset}`,
    header: text => `${ANSI.bold}${rgb(26, 33, 62)}${text}${ANSI.reset}`,
    glow: text => `${ANSI.bold}${rgb(248, 248, 255)}${text}${ANSI.reset}`,
    dim: text => `${ANSI.dim}${text}${ANSI.reset}`
};

function banner() {
    const lines = [
        '╔══════════════════════════════════════════════╗',
        '║            OTKit Neon Installation            ║',
        '╠══════════════════════════════════════════════╣',
        '║  Visual Ops Toolkit · Audit · Storytelling    ║',
        '╚══════════════════════════════════════════════╝'
    ];
    console.log(theme.pink(lines[0]));
    console.log(theme.cyan(lines[1]));
    console.log(theme.pink(lines[2]));
    console.log(theme.orange(lines[3]));
    console.log(theme.pink(lines[4]));
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
    if (!process.stdin.isTTY) {
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

async function ensurePackageJson() {
    if (!(await fileExists(PACKAGE_JSON))) {
        throw new Error('package.json not found. Run this script from the Opnix workspace root.');
    }
}

async function ensureDependencies() {
    const exists = await fileExists(NODE_MODULES_DIR);
    if (exists) {
        console.log(theme.dim('› Dependencies already installed. Skipping npm install.'));
        return;
    }

    const answer = await prompt(theme.cyan('Install npm dependencies now? [Y/n] '), 'y');
    if (/^n/i.test(answer)) {
        console.log(theme.orange('⚠️  Skipping install per request. Remember to run `npm install` before starting the server.'));
        return;
    }

    console.log(theme.blue('› Installing dependencies (npm install)...'));
    await runCommand('npm', ['install'], { cwd: ROOT });
    console.log(theme.cyan('✓ Dependencies installed.'));
}

async function ensureExportsDir() {
    if (!(await fileExists(EXPORTS_DIR))) {
        await fs.mkdir(EXPORTS_DIR, { recursive: true });
        console.log(theme.cyan('✓ Created exports/ directory.'));
    }
}

async function offerWizard() {
    const defaultChoice = 'y';
    const answer = await prompt(theme.cyan('Run the setup decision tree now? [Y/n] '), defaultChoice);
    if (/^n/i.test(answer)) {
        console.log(theme.dim('› Skipping wizard. You can run it later with `npm run setup:wizard`')); 
        return;
    }

    console.log(theme.blue('› Launching setup wizard...'));
    await runCommand('npm', ['run', 'setup:wizard'], { cwd: ROOT });
}

function printNextSteps() {
    console.log('');
    console.log(theme.pink('Next actions:'));
    console.log(theme.glow('  1. ') + theme.cyan('Start the server: ') + theme.dim('npm start'));
    console.log(theme.glow('  2. ') + theme.cyan('Open the neon console: ') + theme.dim('http://localhost:7337'));
    console.log(theme.glow('  3. ') + theme.cyan('Explore exports: ') + theme.dim('ls exports/'));
    console.log(theme.glow('  4. ') + theme.cyan('Re-run wizard anytime: ') + theme.dim('npm run setup:wizard'));
    console.log('');
}

async function main() {
    try {
        banner();
        await ensurePackageJson();
        console.log(theme.orange('Checking workspace telemetry...'));
        await ensureDependencies();
        await ensureExportsDir();
        await offerWizard();
        printNextSteps();
        console.log(theme.cyan('✨ OTKit installation complete. Enjoy the neon canvas.'));
    } catch (error) {
        console.error(theme.pink('✖ Installation failed:'), error.message);
        process.exitCode = 1;
    }
}

main();
