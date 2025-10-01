const fs = require('fs').promises;
const path = require('path');
const { execSync } = require('child_process');
const { syncRoadmapState } = require('./roadmapState');

class BugWorkflowManager {
  constructor() {
    this.ticketsPath = path.join(__dirname, '..', 'data', 'tickets.json');
    this.workflowPath = path.join(__dirname, '..', 'data', 'bug-workflow-state.json');
  }

  async loadTickets() {
    try {
      const data = await fs.readFile(this.ticketsPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return { tickets: [], nextId: 1 };
    }
  }

  async saveTickets(ticketsData) {
    await fs.writeFile(this.ticketsPath, JSON.stringify(ticketsData, null, 2));
  }

  async loadWorkflowState() {
    try {
      const data = await fs.readFile(this.workflowPath, 'utf8');
      return JSON.parse(data);
    } catch {
      return {
        workflows: {},
        settings: {
          enforceStrictMode: true,
          requireSummaryMinLength: 10,
          autoCommit: false,
          ticketPrefix: "BUG-",
          allowedStatuses: ["reported", "in-progress", "completed", "paused"],
          gitIntegration: true
        },
        nextWorkflowId: 1
      };
    }
  }

  async saveWorkflowState(workflowState) {
    await fs.writeFile(this.workflowPath, JSON.stringify(workflowState, null, 2));
  }

  async startBugWork(ticketId, developer = 'unknown') {
    const ticketsData = await this.loadTickets();
    const workflowState = await this.loadWorkflowState();

    const ticket = ticketsData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status === 'in-progress') {
      throw new Error(`Ticket ${ticketId} is already in progress`);
    }

    if (ticket.status === 'completed') {
      throw new Error(`Ticket ${ticketId} is already completed`);
    }

    const workflowId = `workflow-${workflowState.nextWorkflowId}`;
    workflowState.nextWorkflowId++;

    const workflow = {
      id: workflowId,
      ticketId: ticketId,
      developer: developer,
      startedAt: new Date().toISOString(),
      status: 'in-progress',
      commits: [],
      summary: null,
      pauseReason: null
    };

    workflowState.workflows[workflowId] = workflow;
    ticket.status = 'in-progress';
    ticket.workflowId = workflowId;

    await this.saveTickets(ticketsData);
    await syncRoadmapState({ reason: 'bug-workflow:start', overrides: { tickets: ticketsData } });
    await this.saveWorkflowState(workflowState);

    return { ticket, workflow };
  }

  async completeBugWork(ticketId, summary, shouldCommit = false) {
    const ticketsData = await this.loadTickets();
    const workflowState = await this.loadWorkflowState();

    const ticket = ticketsData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'in-progress') {
      throw new Error(`Ticket ${ticketId} is not in progress`);
    }

    const workflow = workflowState.workflows[ticket.workflowId];
    if (!workflow) {
      throw new Error(`Workflow not found for ticket ${ticketId}`);
    }

    if (summary.length < workflowState.settings.requireSummaryMinLength) {
      throw new Error(`Summary must be at least ${workflowState.settings.requireSummaryMinLength} characters`);
    }

    workflow.completedAt = new Date().toISOString();
    workflow.status = 'completed';
    workflow.summary = summary;
    ticket.status = 'completed';

    let commitHash = null;
    if (shouldCommit && workflowState.settings.gitIntegration) {
      try {
        commitHash = this.createGitCommit(ticket, summary);
        workflow.commits.push({
          hash: commitHash,
          message: `Fix: ${ticket.title}\n\n${summary}\n\nCloses ticket #${ticketId}`,
          timestamp: new Date().toISOString()
        });
      } catch (error) {
        console.warn('Failed to create git commit:', error.message);
      }
    }

    await this.saveTickets(ticketsData);
    await syncRoadmapState({ reason: 'bug-workflow:complete', overrides: { tickets: ticketsData } });
    await this.saveWorkflowState(workflowState);

    return { ticket, workflow, commitHash };
  }

  async pauseBugWork(ticketId, reason) {
    const ticketsData = await this.loadTickets();
    const workflowState = await this.loadWorkflowState();

    const ticket = ticketsData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'in-progress') {
      throw new Error(`Ticket ${ticketId} is not in progress`);
    }

    const workflow = workflowState.workflows[ticket.workflowId];
    if (!workflow) {
      throw new Error(`Workflow not found for ticket ${ticketId}`);
    }

    workflow.status = 'paused';
    workflow.pauseReason = reason;
    workflow.pausedAt = new Date().toISOString();
    ticket.status = 'paused';

    await this.saveTickets(ticketsData);
    await syncRoadmapState({ reason: 'bug-workflow:pause', overrides: { tickets: ticketsData } });
    await this.saveWorkflowState(workflowState);

    return { ticket, workflow };
  }

  async resumeBugWork(ticketId) {
    const ticketsData = await this.loadTickets();
    const workflowState = await this.loadWorkflowState();

    const ticket = ticketsData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    if (ticket.status !== 'paused') {
      throw new Error(`Ticket ${ticketId} is not paused`);
    }

    const workflow = workflowState.workflows[ticket.workflowId];
    if (!workflow) {
      throw new Error(`Workflow not found for ticket ${ticketId}`);
    }

    workflow.status = 'in-progress';
    workflow.resumedAt = new Date().toISOString();
    workflow.pauseReason = null;
    ticket.status = 'in-progress';

    await this.saveTickets(ticketsData);
    await syncRoadmapState({ reason: 'bug-workflow:resume', overrides: { tickets: ticketsData } });
    await this.saveWorkflowState(workflowState);

    return { ticket, workflow };
  }

  createGitCommit(ticket, summary) {
    try {
      execSync('git add .', { stdio: 'pipe' });

      const commitMessage = `Fix: ${ticket.title}

${summary}

Closes ticket #${ticket.id}

🤖 Generated with Opnix Bug Workflow
Co-Authored-By: Opnix <noreply@opnix.com>`;

      execSync(`git commit -m "${commitMessage.replace(/"/g, '\\"')}"`, {
        stdio: 'pipe',
        encoding: 'utf8'
      });

      const commitHash = execSync('git rev-parse HEAD', {
        stdio: 'pipe',
        encoding: 'utf8'
      }).trim();

      return commitHash;
    } catch (error) {
      throw new Error(`Git commit failed: ${error.message}`);
    }
  }

  async getWorkflowStatus(ticketId) {
    const ticketsData = await this.loadTickets();
    const workflowState = await this.loadWorkflowState();

    const ticket = ticketsData.tickets.find(t => t.id === ticketId);
    if (!ticket) {
      throw new Error(`Ticket ${ticketId} not found`);
    }

    const workflow = ticket.workflowId ? workflowState.workflows[ticket.workflowId] : null;

    return { ticket, workflow };
  }

  async listActiveWorkflows() {
    const workflowState = await this.loadWorkflowState();
    const ticketsData = await this.loadTickets();

    const activeWorkflows = Object.values(workflowState.workflows)
      .filter(w => w.status === 'in-progress' || w.status === 'paused')
      .map(workflow => {
        const ticket = ticketsData.tickets.find(t => t.id === workflow.ticketId);
        return { workflow, ticket };
      });

    return activeWorkflows;
  }

  async validateWorkflow(ticketId) {
    const { ticket, workflow } = await this.getWorkflowStatus(ticketId);
    const issues = [];

    if (!ticket) {
      issues.push(`Ticket ${ticketId} not found`);
      return { valid: false, issues };
    }

    if (ticket.status === 'in-progress' && !workflow) {
      issues.push(`Ticket is marked in-progress but has no workflow`);
    }

    if (workflow && workflow.status !== ticket.status) {
      issues.push(`Workflow status (${workflow.status}) doesn't match ticket status (${ticket.status})`);
    }

    return { valid: issues.length === 0, issues, ticket, workflow };
  }
}

module.exports = BugWorkflowManager;
