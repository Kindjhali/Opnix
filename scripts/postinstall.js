#!/usr/bin/env node
/**
 * Opnix Postinstall Script
 * Automatically runs after npm/pnpm install to set up the entire Opnix environment
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const ROOT = path.join(__dirname, '..');

// Skip postinstall for global installations
// Check if this is a global install by looking for npm's global marker
const isGlobalInstall = process.env.npm_config_global === 'true' ||
                        // Also check if required files exist (they won't in global install due to .npmignore)
                        !fs.existsSync(path.join(ROOT, 'data')) ||
                        !fs.existsSync(path.join(ROOT, 'docs'));

if (isGlobalInstall) {
    console.log('[Opnix] Skipping postinstall for global installation');
    console.log('[Opnix] To use Opnix, run "opnix" in your project directory');
    process.exit(0);
}

function runCommand(command, args, options = {}) {
    return new Promise((resolve, reject) => {
        console.log(`[Opnix] Running: ${command} ${args.join(' ')}`);
        const child = spawn(command, args, {
            stdio: 'inherit',
            cwd: ROOT,
            ...options
        });

        child.on('close', code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${command} ${args.join(' ')} exited with code ${code}`));
            }
        });
    });
}

async function main() {
    try {
        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║   Opnix - Automated Installation Setup    ║');
        console.log('╚════════════════════════════════════════════╝\n');

        // Step 1: Run the installer CLI (ensures all dirs and structure)
        console.log('[Opnix] Step 1/3: Setting up directories and structure...');
        await runCommand('node', ['scripts/installCli.js'], {
            env: {
                ...process.env,
                OPNIX_INSTALL_NON_INTERACTIVE: '1',
                OPNIX_INSTALL_SKIP_WIZARD: '1'
            }
        });

        // Step 2: Build the production bundle
        console.log('\n[Opnix] Step 2/3: Building production bundle...');
        await runCommand('pnpm', ['build']);

        // Step 3: Run setup wizard if interactive
        if (process.stdin.isTTY && !process.env.CI) {
            console.log('\n[Opnix] Step 3/3: Running setup wizard...');
            await runCommand('node', ['scripts/setupWizard.js'], {
                env: {
                    ...process.env,
                    OPNIX_INSTALL_NON_INTERACTIVE: '0'
                }
            });
        } else {
            console.log('\n[Opnix] Step 3/3: Skipping wizard (non-interactive environment)');
            await runCommand('node', ['scripts/setupWizard.js'], {
                env: {
                    ...process.env,
                    OPNIX_INSTALL_NON_INTERACTIVE: '1'
                }
            });
        }

        console.log('\n╔════════════════════════════════════════════╗');
        console.log('║     Opnix Installation Complete! 🚀       ║');
        console.log('╚════════════════════════════════════════════╝\n');
        console.log('Next steps:');
        console.log('  1. pnpm start          # Start the Opnix server');
        console.log('  2. Open http://localhost:7337');
        console.log('\nFor help: pnpm run --help\n');

    } catch (error) {
        console.error('\n[Opnix] Installation failed:', error.message);
        console.error('\nYou can manually complete setup with:');
        console.error('  pnpm run setup:install');
        console.error('  pnpm build');
        console.error('  pnpm start\n');
        process.exit(1);
    }
}

// Only run if this is the main module (not required)
if (require.main === module) {
    main();
}
