#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs').promises;

const API_BASE = 'http://localhost:7337/api';

function parseArgs() {
    const args = process.argv.slice(2);
    const command = args[0];
    const ticketId = args[1];

    return { command, ticketId, args: args.slice(2) };
}

function showUsage() {
    console.log(`
Bug Workflow CLI

Usage:
  node scripts/bugWorkflow.js <command> [args]

Commands:
  start <ticket-id> [developer]     Start working on a bug ticket
  complete <ticket-id> <summary>    Complete work and mark ticket as done
  pause <ticket-id> <reason>        Pause work with a reason
  resume <ticket-id>                Resume paused work
  status <ticket-id>                Show workflow status for ticket
  active                           List all active workflows
  validate <ticket-id>             Validate workflow state

Examples:
  node scripts/bugWorkflow.js start 1 john.doe
  node scripts/bugWorkflow.js complete 1 "Fixed authentication timeout by increasing session duration"
  node scripts/bugWorkflow.js pause 1 "Waiting for API documentation"
  node scripts/bugWorkflow.js resume 1
  node scripts/bugWorkflow.js status 1
  node scripts/bugWorkflow.js active

Bash aliases (add to ~/.bashrc or ~/.zshrc):
  alias bug-start='node /path/to/opnix/scripts/bugWorkflow.js start'
  alias bug-complete='node /path/to/opnix/scripts/bugWorkflow.js complete'
  alias bug-pause='node /path/to/opnix/scripts/bugWorkflow.js pause'
  alias bug-resume='node /path/to/opnix/scripts/bugWorkflow.js resume'
  alias bug-status='node /path/to/opnix/scripts/bugWorkflow.js status'
  alias bug-active='node /path/to/opnix/scripts/bugWorkflow.js active'
`);
}

async function executeCommand(method, url, data = null) {
    try {
        let curlCmd = `curl -s -X ${method} "${url}"`;

        if (data && method !== 'GET') {
            const jsonData = JSON.stringify(data).replace(/"/g, '\\"');
            curlCmd += ` -H "Content-Type: application/json" -d "${jsonData}"`;
        }

        const response = execSync(curlCmd, { encoding: 'utf8' });

        if (response.trim().startsWith('<!DOCTYPE') || response.trim().startsWith('<html')) {
            throw new Error('Received HTML instead of JSON - check if API endpoint exists');
        }

        return JSON.parse(response);
    } catch (error) {
        console.error(`API Error: ${error.message}`);
        console.error(`Response: ${error.stdout || 'No response'}`);
        return null;
    }
}

async function startBug(ticketId, developer = 'unknown') {
    console.log(`🚀 Starting work on ticket #${ticketId}...`);

    const result = await executeCommand('POST', `${API_BASE}/bug/start/${ticketId}`, {
        developer: developer
    });

    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`   Developer: ${result.workflow.developer}`);
        console.log(`   Started: ${new Date(result.workflow.startedAt).toLocaleString()}`);
        console.log(`   Status: ${result.ticket.status}`);
    } else {
        console.error(`❌ Failed to start work: ${result?.error || 'Unknown error'}`);
    }
}

async function completeBug(ticketId, summary) {
    if (!summary) {
        console.error('❌ Summary is required');
        return;
    }

    console.log(`🏁 Completing work on ticket #${ticketId}...`);

    const result = await executeCommand('POST', `${API_BASE}/bug/complete/${ticketId}`, {
        summary: summary,
        commit: true
    });

    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`   Summary: ${result.workflow.summary}`);
        console.log(`   Completed: ${new Date(result.workflow.completedAt).toLocaleString()}`);
        if (result.commitHash) {
            console.log(`   Git commit: ${result.commitHash.substring(0, 8)}`);
        }
    } else {
        console.error(`❌ Failed to complete work: ${result?.error || 'Unknown error'}`);
    }
}

async function pauseBug(ticketId, reason) {
    if (!reason) {
        console.error('❌ Pause reason is required');
        return;
    }

    console.log(`⏸️ Pausing work on ticket #${ticketId}...`);

    const result = await executeCommand('POST', `${API_BASE}/bug/pause/${ticketId}`, {
        reason: reason
    });

    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`   Reason: ${result.workflow.pauseReason}`);
        console.log(`   Paused: ${new Date(result.workflow.pausedAt).toLocaleString()}`);
    } else {
        console.error(`❌ Failed to pause work: ${result?.error || 'Unknown error'}`);
    }
}

async function resumeBug(ticketId) {
    console.log(`▶️ Resuming work on ticket #${ticketId}...`);

    const result = await executeCommand('POST', `${API_BASE}/bug/resume/${ticketId}`);

    if (result && result.success) {
        console.log(`✅ ${result.message}`);
        console.log(`   Status: ${result.ticket.status}`);
        console.log(`   Resumed: ${new Date(result.workflow.resumedAt).toLocaleString()}`);
    } else {
        console.error(`❌ Failed to resume work: ${result?.error || 'Unknown error'}`);
    }
}

async function showStatus(ticketId) {
    console.log(`📊 Status for ticket #${ticketId}:`);

    const result = await executeCommand('GET', `${API_BASE}/bug/status/${ticketId}`);

    if (result && result.ticket) {
        console.log(`   Title: ${result.ticket.title}`);
        console.log(`   Status: ${result.ticket.status}`);
        console.log(`   Priority: ${result.ticket.priority}`);

        if (result.workflow) {
            console.log(`   Developer: ${result.workflow.developer}`);
            console.log(`   Started: ${new Date(result.workflow.startedAt).toLocaleString()}`);

            if (result.workflow.status === 'paused') {
                console.log(`   Paused: ${new Date(result.workflow.pausedAt).toLocaleString()}`);
                console.log(`   Reason: ${result.workflow.pauseReason}`);
            }

            if (result.workflow.status === 'completed') {
                console.log(`   Completed: ${new Date(result.workflow.completedAt).toLocaleString()}`);
                console.log(`   Summary: ${result.workflow.summary}`);

                if (result.workflow.commits.length > 0) {
                    console.log(`   Commits: ${result.workflow.commits.length}`);
                    result.workflow.commits.forEach(commit => {
                        console.log(`     - ${commit.hash.substring(0, 8)} (${new Date(commit.timestamp).toLocaleString()})`);
                    });
                }
            }
        }
    } else {
        console.error(`❌ Failed to get status: ${result?.error || 'Unknown error'}`);
    }
}

async function showActive() {
    console.log(`📋 Active bug workflows:`);

    const result = await executeCommand('GET', `${API_BASE}/bug/active`);

    if (result && Array.isArray(result)) {
        if (result.length === 0) {
            console.log('   No active workflows');
        } else {
            result.forEach(({ workflow, ticket }) => {
                console.log(`   #${ticket.id}: ${ticket.title}`);
                console.log(`     Status: ${workflow.status}`);
                console.log(`     Developer: ${workflow.developer}`);
                console.log(`     Started: ${new Date(workflow.startedAt).toLocaleString()}`);

                if (workflow.status === 'paused') {
                    console.log(`     Paused: ${workflow.pauseReason}`);
                }
                console.log('');
            });
        }
    } else {
        console.error(`❌ Failed to get active workflows`);
    }
}

async function main() {
    const { command, ticketId, args } = parseArgs();

    if (!command) {
        showUsage();
        return;
    }

    switch (command) {
        case 'start':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            await startBug(parseInt(ticketId), args[0]);
            break;

        case 'complete':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            const summary = args.join(' ');
            await completeBug(parseInt(ticketId), summary);
            break;

        case 'pause':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            const reason = args.join(' ');
            await pauseBug(parseInt(ticketId), reason);
            break;

        case 'resume':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            await resumeBug(parseInt(ticketId));
            break;

        case 'status':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            await showStatus(parseInt(ticketId));
            break;

        case 'active':
            await showActive();
            break;

        case 'validate':
            if (!ticketId) {
                console.error('❌ Ticket ID is required');
                return;
            }
            const validation = await executeCommand('GET', `${API_BASE}/bug/validate/${ticketId}`);
            if (validation) {
                console.log(`Validation for ticket #${ticketId}:`);
                console.log(`Valid: ${validation.valid}`);
                if (validation.issues.length > 0) {
                    console.log('Issues:');
                    validation.issues.forEach(issue => console.log(`  - ${issue}`));
                }
            }
            break;

        default:
            console.error(`❌ Unknown command: ${command}`);
            showUsage();
            break;
    }
}

main().catch(console.error);