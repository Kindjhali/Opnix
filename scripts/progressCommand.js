#!/usr/bin/env node

const { ProgressCLI } = require('../services/progressCLI');

async function runProgressCommand() {
  const args = process.argv.slice(2);
  const progressCLI = new ProgressCLI();

  if (args.length === 0) {
    // Display overall project progress
    console.log(await progressCLI.displayProjectProgress());
    return;
  }

  const command = args[0].toLowerCase();

  switch (command) {
    case 'summary':
    case 'overview':
      console.log(await progressCLI.displayProjectProgress());
      break;

    case 'ticket':
      if (args[1]) {
        console.log(await progressCLI.displayTicketDetails(args[1]));
      } else {
        console.log('Usage: node scripts/progressCommand.js ticket <ticket-id>');
      }
      break;

    case 'feature':
      if (args[1]) {
        console.log(await progressCLI.displayFeatureDetails(args[1]));
      } else {
        console.log('Usage: node scripts/progressCommand.js feature <feature-id>');
      }
      break;

    case 'help':
    case '--help':
    case '-h':
      console.log(`
Progress Command Usage:

  npm run progress                    - Show overall project progress
  npm run progress summary           - Show project progress summary
  npm run progress ticket <id>       - Show detailed ticket progress
  npm run progress feature <id>      - Show detailed feature progress
  npm run progress help              - Show this help message

Examples:

  npm run progress                    # Overall progress
  npm run progress ticket 1          # Ticket #1 details
  npm run progress feature 2         # Feature #2 details
      `);
      break;

    default:
      console.log(`Unknown command: ${command}`);
      console.log('Run "npm run progress help" for usage information.');
      process.exit(1);
  }
}

// Handle errors gracefully
runProgressCommand().catch(error => {
  console.error('Progress command failed:', error.message);
  process.exit(1);
});

module.exports = { runProgressCommand };