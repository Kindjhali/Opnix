const fs = require('fs').promises;
const path = require('path');

// ANSI color codes for CLI output
const colors = {
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
  white: '\x1b[37m',
  gray: '\x1b[90m',
  bold: '\x1b[1m',
  reset: '\x1b[0m',
  dim: '\x1b[2m'
};

// Progress symbols for CLI
const symbols = {
  completed: '✓',
  pending: '○',
  active: '◐',
  blocked: '⚠',
  error: '✗',
  arrow: '→',
  bullet: '•',
  progress: '█',
  empty: '░'
};

class ProgressCLI {
  constructor() {
    this.dataDir = path.join(__dirname, '..', 'data');
  }

  // Load ticket data for CLI progress display
  async loadTickets() {
    try {
      const ticketsFile = path.join(this.dataDir, 'tickets.json');
      const data = await fs.readFile(ticketsFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return { tickets: [] };
    }
  }

  // Load features data for CLI progress display
  async loadFeatures() {
    try {
      const featuresFile = path.join(this.dataDir, 'features.json');
      const data = await fs.readFile(featuresFile, 'utf8');
      return JSON.parse(data);
    } catch {
      return { features: [] };
    }
  }

  // Display progress bar in CLI
  displayProgressBar(completed, total, width = 30, showPercentage = true) {
    if (total === 0) return `${colors.gray}No items${colors.reset}`;

    const percentage = Math.round((completed / total) * 100);
    const filledWidth = Math.round((completed / total) * width);
    const emptyWidth = width - filledWidth;

    const filled = colors.green + symbols.progress.repeat(filledWidth) + colors.reset;
    const empty = colors.gray + symbols.empty.repeat(emptyWidth) + colors.reset;

    let progressColor;
    if (percentage >= 80) progressColor = colors.green;
    else if (percentage >= 50) progressColor = colors.yellow;
    else progressColor = colors.red;

    const percentageText = showPercentage ? ` ${progressColor}${percentage}%${colors.reset}` : '';
    const countText = ` ${colors.dim}(${completed}/${total})${colors.reset}`;

    return `[${filled}${empty}]${percentageText}${countText}`;
  }

  // Display step completion checkmarks for a ticket
  displayTicketChecklist(ticket) {
    if (!ticket.checklist || ticket.checklist.length === 0) {
      return '';
    }

    const lines = [];
    lines.push(`${colors.bold}${colors.cyan}Checklist:${colors.reset}`);

    ticket.checklist.forEach((item, index) => {
      const symbol = item.completed ?
        `${colors.green}${symbols.completed}${colors.reset}` :
        `${colors.gray}${symbols.pending}${colors.reset}`;

      const text = item.completed ?
        `${colors.dim}${item.text || `Step ${index + 1}`}${colors.reset}` :
        `${colors.white}${item.text || `Step ${index + 1}`}${colors.reset}`;

      lines.push(`  ${symbol} ${text}`);
    });

    const completed = ticket.checklist.filter(item => item.completed).length;
    const total = ticket.checklist.length;
    lines.push(`  ${this.displayProgressBar(completed, total, 20)}`);

    return lines.join('\n');
  }

  // Display ticket progress with workflow steps
  displayTicketProgress(ticket) {
    const lines = [];

    // Workflow progress
    const workflowSteps = [
      { id: 'reported', title: 'Reported', status: 'completed' },
      { id: 'analysis', title: 'Analysis', status: ticket.status === 'reported' ? 'pending' : 'completed' },
      { id: 'implementation', title: 'Implementation', status: ticket.status === 'inProgress' ? 'active' : ticket.status === 'finished' ? 'completed' : 'pending' },
      { id: 'testing', title: 'Testing', status: ticket.status === 'finished' ? 'completed' : 'pending' },
      { id: 'completion', title: 'Completion', status: ticket.status === 'finished' ? 'completed' : 'pending' }
    ];

    lines.push(`${colors.bold}${colors.blue}Ticket #${ticket.id} Progress:${colors.reset}`);

    workflowSteps.forEach(step => {
      let symbol, color;

      switch (step.status) {
        case 'completed':
          symbol = symbols.completed;
          color = colors.green;
          break;
        case 'active':
          symbol = symbols.active;
          color = colors.yellow;
          break;
        case 'pending':
          symbol = symbols.pending;
          color = colors.gray;
          break;
        default:
          symbol = symbols.pending;
          color = colors.gray;
      }

      lines.push(`  ${color}${symbol}${colors.reset} ${step.title}`);
    });

    // Add checklist if present
    const checklistDisplay = this.displayTicketChecklist(ticket);
    if (checklistDisplay) {
      lines.push('');
      lines.push(checklistDisplay);
    }

    return lines.join('\n');
  }

  // Display feature progress with completion steps
  displayFeatureProgress(feature) {
    const lines = [];

    const statusSteps = [
      { id: 'proposed', title: 'Proposed', status: 'completed' },
      { id: 'approved', title: 'Approved', status: ['proposed'].includes(feature.status) ? 'pending' : 'completed' },
      { id: 'development', title: 'In Development', status: feature.status === 'inDevelopment' ? 'active' : ['deployed', 'testing'].includes(feature.status) ? 'completed' : 'pending' },
      { id: 'testing', title: 'Testing', status: feature.status === 'testing' ? 'active' : feature.status === 'deployed' ? 'completed' : 'pending' },
      { id: 'deployed', title: 'Deployed', status: feature.status === 'deployed' ? 'completed' : 'pending' }
    ];

    lines.push(`${colors.bold}${colors.blue}Feature: ${feature.title}${colors.reset}`);

    statusSteps.forEach(step => {
      let symbol, color;

      switch (step.status) {
        case 'completed':
          symbol = symbols.completed;
          color = colors.green;
          break;
        case 'active':
          symbol = symbols.active;
          color = colors.yellow;
          break;
        case 'pending':
          symbol = symbols.pending;
          color = colors.gray;
          break;
        default:
          symbol = symbols.pending;
          color = colors.gray;
      }

      lines.push(`  ${color}${symbol}${colors.reset} ${step.title}`);
    });

    // Add acceptance criteria checklist if present
    if (feature.acceptanceCriteria && feature.acceptanceCriteria.length > 0) {
      lines.push('');
      lines.push(`${colors.bold}${colors.cyan}Acceptance Criteria:${colors.reset}`);

      feature.acceptanceCriteria.forEach((criteria, index) => {
        const symbol = criteria.completed ?
          `${colors.green}${symbols.completed}${colors.reset}` :
          `${colors.gray}${symbols.pending}${colors.reset}`;

        const text = criteria.completed ?
          `${colors.dim}${criteria.text || `Criteria ${index + 1}`}${colors.reset}` :
          `${colors.white}${criteria.text || `Criteria ${index + 1}`}${colors.reset}`;

        lines.push(`  ${symbol} ${text}`);
      });

      const completed = feature.acceptanceCriteria.filter(criteria => criteria.completed).length;
      const total = feature.acceptanceCriteria.length;
      lines.push(`  ${this.displayProgressBar(completed, total, 20)}`);
    }

    return lines.join('\n');
  }

  // Display overall project progress summary
  async displayProjectProgress() {
    const ticketsData = await this.loadTickets();
    const featuresData = await this.loadFeatures();

    const tickets = ticketsData.tickets || [];
    const features = featuresData.features || [];

    const lines = [];
    lines.push(`${colors.bold}${colors.white}PROJECT PROGRESS SUMMARY${colors.reset}`);
    lines.push('');

    // Tickets summary
    const completedTickets = tickets.filter(t => t.status === 'finished').length;
    const inProgressTickets = tickets.filter(t => t.status === 'inProgress').length;
    const totalTickets = tickets.length;

    lines.push(`${colors.bold}Tickets:${colors.reset}`);
    lines.push(`  ${this.displayProgressBar(completedTickets, totalTickets)}`);
    lines.push(`  ${colors.green}${symbols.completed} Completed: ${completedTickets}${colors.reset}`);
    lines.push(`  ${colors.yellow}${symbols.active} In Progress: ${inProgressTickets}${colors.reset}`);
    lines.push(`  ${colors.gray}${symbols.pending} Pending: ${totalTickets - completedTickets - inProgressTickets}${colors.reset}`);
    lines.push('');

    // Features summary
    const completedFeatures = features.filter(f => f.status === 'deployed').length;
    const inProgressFeatures = features.filter(f => ['inDevelopment', 'testing'].includes(f.status)).length;
    const totalFeatures = features.length;

    lines.push(`${colors.bold}Features:${colors.reset}`);
    lines.push(`  ${this.displayProgressBar(completedFeatures, totalFeatures)}`);
    lines.push(`  ${colors.green}${symbols.completed} Deployed: ${completedFeatures}${colors.reset}`);
    lines.push(`  ${colors.yellow}${symbols.active} In Progress: ${inProgressFeatures}${colors.reset}`);
    lines.push(`  ${colors.gray}${symbols.pending} Pending: ${totalFeatures - completedFeatures - inProgressFeatures}${colors.reset}`);

    return lines.join('\n');
  }

  // Display specific ticket details with progress
  async displayTicketDetails(ticketId) {
    const ticketsData = await this.loadTickets();
    const tickets = ticketsData.tickets || [];
    const ticket = tickets.find(t => t.id === parseInt(ticketId));

    if (!ticket) {
      return `${colors.red}${symbols.error} Ticket #${ticketId} not found${colors.reset}`;
    }

    const lines = [];
    lines.push(`${colors.bold}${colors.white}TICKET #${ticket.id}${colors.reset}`);
    lines.push(`${colors.bold}Title:${colors.reset} ${ticket.title}`);
    lines.push(`${colors.bold}Status:${colors.reset} ${this.getStatusDisplay(ticket.status)}`);
    lines.push(`${colors.bold}Priority:${colors.reset} ${this.getPriorityDisplay(ticket.priority)}`);
    lines.push('');
    lines.push(this.displayTicketProgress(ticket));

    return lines.join('\n');
  }

  // Display specific feature details with progress
  async displayFeatureDetails(featureId) {
    const featuresData = await this.loadFeatures();
    const features = featuresData.features || [];
    const feature = features.find(f => f.id === parseInt(featureId));

    if (!feature) {
      return `${colors.red}${symbols.error} Feature #${featureId} not found${colors.reset}`;
    }

    const lines = [];
    lines.push(`${colors.bold}${colors.white}FEATURE #${feature.id}${colors.reset}`);
    lines.push(`${colors.bold}Title:${colors.reset} ${feature.title}`);
    lines.push(`${colors.bold}Status:${colors.reset} ${this.getStatusDisplay(feature.status)}`);
    lines.push(`${colors.bold}Priority:${colors.reset} ${this.getPriorityDisplay(feature.priority)}`);
    lines.push('');
    lines.push(this.displayFeatureProgress(feature));

    return lines.join('\n');
  }

  // Helper method to get colored status display
  getStatusDisplay(status) {
    const statusColors = {
      'reported': colors.gray,
      'inProgress': colors.yellow,
      'finished': colors.green,
      'proposed': colors.gray,
      'approved': colors.blue,
      'inDevelopment': colors.yellow,
      'testing': colors.cyan,
      'deployed': colors.green
    };

    const color = statusColors[status] || colors.white;
    return `${color}${status}${colors.reset}`;
  }

  // Helper method to get colored priority display
  getPriorityDisplay(priority) {
    const priorityColors = {
      'high': colors.red,
      'medium': colors.yellow,
      'low': colors.green
    };

    const color = priorityColors[priority] || colors.white;
    return `${color}${priority}${colors.reset}`;
  }

  // Format progress report for CLI output
  formatProgressReport() {
    const report = {
      displayProjectProgress: this.displayProjectProgress.bind(this),
      displayTicketDetails: this.displayTicketDetails.bind(this),
      displayFeatureDetails: this.displayFeatureDetails.bind(this),
      displayTicketProgress: this.displayTicketProgress.bind(this),
      displayFeatureProgress: this.displayFeatureProgress.bind(this)
    };

    return report;
  }
}

module.exports = { ProgressCLI, colors, symbols };