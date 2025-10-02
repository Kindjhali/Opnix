#!/usr/bin/env node

/**
 * Opnix CLI Entry Point
 * Starts the Opnix server for project analysis and management
 */

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// MOLE Theme Colors
const MOLE = {
  pink: '\u001b[38;2;233;69;96m',      // #E94560
  cyan: '\u001b[38;2;6;182;212m',      // #06B6D4
  blue: '\u001b[38;2;31;182;255m',     // #1FB6FF
  orange: '\u001b[38;2;255;140;59m',   // #FF8C3B
  reset: '\u001b[0m'
};

// ASCII Logo with MOLE colors
const logo = `${MOLE.pink}
   ▄▄▄▄▄▄▄ ▄▄▄▄▄▄▄ ▄▄    ▄ ▄▄▄ ▄▄   ▄▄
  █       █       █  █  █ █   █  █ █  █
  █   ▄   █    ▄  █   █▄█ █   █  █▄█  █
  █  █ █  █   █▄█ █       █   █       █
  █  █▄█  █    ▄▄▄█  ▄    █   █       █
  █       █   █   █ █ █   █   █ ██▄██ █
  █▄▄▄▄▄▄▄█▄▄▄█   █▄█  █▄▄█▄▄▄█▄█   █▄█
${MOLE.reset}
  ${MOLE.cyan}Operational Toolkit${MOLE.reset} · ${MOLE.blue}Visual Canvas${MOLE.reset} · ${MOLE.orange}Audit Engine${MOLE.reset}
`;

console.log(logo);

// Determine the Opnix installation directory
const opnixRoot = path.join(__dirname, '..');

// Check if server.js exists
const serverPath = path.join(opnixRoot, 'server.js');
if (!fs.existsSync(serverPath)) {
  console.error('Error: Opnix server.js not found. Installation may be corrupted.');
  process.exit(1);
}

// Parse command line arguments
const args = process.argv.slice(2);

// Handle special commands
if (args.includes('--version') || args.includes('-v')) {
  const packageJson = require('../package.json');
  console.log(`Opnix v${packageJson.version}`);
  process.exit(0);
}

if (args.includes('--help') || args.includes('-h')) {
  console.log(`
Usage: opnix [options]

Options:
  --version, -v     Show Opnix version
  --help, -h        Show this help message
  --port <port>     Specify server port (default: 7337)
  --project <path>  Specify project path (default: current directory)

Commands:
  opnix             Start Opnix server
  opnix start       Start Opnix server
  opnix dev         Start in development mode
  opnix wizard      Run setup wizard

Examples:
  opnix                              # Start server in current directory
  opnix --port 8080                  # Start on custom port
  opnix --project /path/to/project   # Analyze specific project

For more information, visit: https://github.com/Kindjhali/Opnix
`);
  process.exit(0);
}

// Extract port and project path from args
let port = 7337;
let projectPath = process.cwd();

const portIndex = args.indexOf('--port');
if (portIndex !== -1 && args[portIndex + 1]) {
  port = parseInt(args[portIndex + 1], 10);
}

const projectIndex = args.indexOf('--project');
if (projectIndex !== -1 && args[projectIndex + 1]) {
  projectPath = path.resolve(args[projectIndex + 1]);
}

// Handle subcommands
const command = args[0];

let scriptPath = serverPath;
let scriptArgs = [];

switch (command) {
  case 'dev':
    scriptPath = path.join(opnixRoot, 'server.js');
    scriptArgs = ['--dev'];
    break;
  case 'wizard':
    scriptPath = path.join(opnixRoot, 'scripts/setupWizard.js');
    break;
  case 'start':
  default:
    scriptPath = serverPath;
    break;
}

// Set environment variables
process.env.PORT = port;
process.env.PROJECT_PATH = projectPath;

console.log(`\n🚀 Starting Opnix...`);
console.log(`📁 Project: ${projectPath}`);
console.log(`🌐 Server will run on: http://localhost:${port}\n`);

// Start the server
const child = spawn('node', [scriptPath, ...scriptArgs], {
  stdio: 'inherit',
  cwd: projectPath,  // Run in project directory so process.cwd() works correctly
  env: {
    ...process.env,
    PORT: port,
    PROJECT_PATH: projectPath,
    OPNIX_ROOT: opnixRoot  // Pass opnix installation directory via env
  }
});

child.on('error', (error) => {
  console.error('Failed to start Opnix:', error);
  process.exit(1);
});

child.on('exit', (code) => {
  process.exit(code);
});

// Handle graceful shutdown
process.on('SIGINT', () => {
  child.kill('SIGINT');
});

process.on('SIGTERM', () => {
  child.kill('SIGTERM');
});
