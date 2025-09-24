#!/bin/bash

# OTKIT - Complete Installation Script
# This script creates ALL files needed for the operational toolkit

echo "🚀 Installing OTKit System..."

# Create package.json
cat > package.json << 'PACKAGEJSON'
{
  "name": "otkit",
  "version": "1.0.0",
  "description": "OTKit - Operational Toolkit",
  "main": "server.js",
  "scripts": {
    "start": "node server.js",
    "dev": "nodemon server.js",
    "claude:next": "curl http://localhost:7337/api/claude/next",
    "claude:export": "curl http://localhost:7337/api/export/markdown > tickets.md"
  },
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  },
  "devDependencies": {
    "nodemon": "^3.0.1"
  }
}
PACKAGEJSON

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Create public directory
mkdir -p public

# Create server.js
cat > server.js << 'SERVERJS'
// OTKIT - Express Backend for Operational Toolkit
const express = require('express');
const cors = require('cors');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 7337;
const DATA_FILE = path.join(__dirname, 'tickets.json');

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Initialize data file if it doesn't exist
async function initDataFile() {
    try {
        await fs.access(DATA_FILE);
    } catch {
        const initialData = {
            tickets: [
                {
                    id: 1,
                    title: "Example: Fix Authentication Bug",
                    description: "Users cannot login with @ symbol. Review auth validation logic and provide fix. Check /src/auth/validator.js line 45.",
                    priority: "high",
                    status: "reported",
                    created: new Date().toISOString(),
                    files: ["src/auth/validator.js"]
                }
            ],
            nextId: 2
        };
        await fs.writeFile(DATA_FILE, JSON.stringify(initialData, null, 2));
        console.log('✓ Created tickets.json with example ticket');
    }
}

// Helper functions
async function readData() {
    const data = await fs.readFile(DATA_FILE, 'utf8');
    return JSON.parse(data);
}

async function writeData(data) {
    await fs.writeFile(DATA_FILE, JSON.stringify(data, null, 2));
}

// Routes
app.get('/', (req, res) => {
    if (req.headers['user-agent'] && req.headers['user-agent'].includes('curl')) {
        res.type('text/plain').send(`
OTKIT v1.0

Commands:
  curl http://localhost:7337/api/claude/next      # Get next ticket
  curl http://localhost:7337/api/export/markdown   # Export all
  curl http://localhost:7337/api/tickets           # Get JSON

Claude CLI:
  claude "Read tickets.json and fix the highest priority issue"
        `);
    } else {
        res.sendFile(path.join(__dirname, 'public', 'index.html'));
    }
});

app.get('/api/health', async (req, res) => {
    try {
        const data = await readData();
        res.json({ 
            status: 'operational',
            tickets: data.tickets.length,
            claude_ready: true
        });
    } catch {
        res.json({ status: 'operational', claude_ready: true });
    }
});

app.get('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        res.json(data.tickets);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read tickets' });
    }
});

app.get('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const ticket = data.tickets.find(t => t.id === parseInt(req.params.id));
        if (!ticket) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        res.json(ticket);
    } catch (error) {
        res.status(500).json({ error: 'Failed to read ticket' });
    }
});

app.post('/api/tickets', async (req, res) => {
    try {
        const data = await readData();
        const validStatuses = ['reported', 'in_progress', 'finished'];
        const validPriorities = ['low', 'medium', 'high'];
        
        const newTicket = {
            id: data.nextId++,
            title: req.body.title || 'Untitled',
            description: req.body.description || '',
            priority: validPriorities.includes(req.body.priority) ? req.body.priority : 'medium',
            status: validStatuses.includes(req.body.status) ? req.body.status : 'reported',
            created: new Date().toISOString(),
            files: req.body.files || []
        };
        
        data.tickets.push(newTicket);
        await writeData(data);
        res.status(201).json(newTicket);
        console.log(`✓ Created ticket #${newTicket.id}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to create ticket' });
    }
});

app.put('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        data.tickets[index] = {
            ...data.tickets[index],
            ...req.body,
            id: data.tickets[index].id,
            created: data.tickets[index].created,
            updated: new Date().toISOString()
        };
        
        await writeData(data);
        res.json(data.tickets[index]);
        console.log(`✓ Updated ticket #${req.params.id}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to update ticket' });
    }
});

app.delete('/api/tickets/:id', async (req, res) => {
    try {
        const data = await readData();
        const index = data.tickets.findIndex(t => t.id === parseInt(req.params.id));
        
        if (index === -1) {
            return res.status(404).json({ error: 'Ticket not found' });
        }
        
        data.tickets.splice(index, 1);
        await writeData(data);
        res.status(204).send();
        console.log(`✓ Deleted ticket #${req.params.id}`);
    } catch (error) {
        res.status(500).json({ error: 'Failed to delete ticket' });
    }
});

app.get('/api/search', async (req, res) => {
    try {
        const { q, status, priority } = req.query;
        const data = await readData();
        let results = data.tickets;
        
        if (q) {
            const query = q.toLowerCase().trim();
            results = results.filter(t => 
                t.title.toLowerCase().includes(query) ||
                t.description.toLowerCase().includes(query) ||
                t.id.toString().includes(query)
            );
        }
        
        if (status) {
            results = results.filter(t => t.status === status);
        }
        
        if (priority) {
            results = results.filter(t => t.priority === priority);
        }
        
        res.json(results);
    } catch (error) {
        res.status(500).json({ error: 'Failed to search' });
    }
});

app.get('/api/stats', async (req, res) => {
    try {
        const data = await readData();
        res.json({
            total: data.tickets.length,
            reported: data.tickets.filter(t => t.status === 'reported').length,
            in_progress: data.tickets.filter(t => t.status === 'in_progress').length,
            finished: data.tickets.filter(t => t.status === 'finished').length
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get stats' });
    }
});

app.get('/api/export/markdown', async (req, res) => {
    try {
        const data = await readData();
        let markdown = '# Claude CLI Ticket Analysis\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;
        
        const statusGroups = {
            reported: data.tickets.filter(t => t.status === 'reported'),
            in_progress: data.tickets.filter(t => t.status === 'in_progress'),
            finished: data.tickets.filter(t => t.status === 'finished')
        };
        
        for (const [status, tickets] of Object.entries(statusGroups)) {
            if (tickets.length > 0) {
                markdown += `## ${status.toUpperCase().replace('_', ' ')}\n\n`;
                
                for (const ticket of tickets) {
                    markdown += `### Ticket #${ticket.id}: ${ticket.title}\n`;
                    markdown += `Priority: ${ticket.priority}\n`;
                    markdown += `Description: ${ticket.description}\n\n`;
                }
            }
        }
        
        res.type('text/plain').send(markdown);
    } catch (error) {
        res.status(500).json({ error: 'Failed to export' });
    }
});

app.get('/api/claude/next', async (req, res) => {
    try {
        const data = await readData();
        const reportedTickets = data.tickets
            .filter(t => t.status === 'reported')
            .sort((a, b) => {
                const priorityOrder = { high: 0, medium: 1, low: 2 };
                return priorityOrder[a.priority] - priorityOrder[b.priority];
            });
        
        if (reportedTickets.length === 0) {
            return res.json({ message: 'No reported tickets available' });
        }
        
        res.json({
            instruction: `Work on this ${reportedTickets[0].priority} priority issue`,
            ticket: reportedTickets[0]
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get next ticket' });
    }
});

app.get('/api/claude/batch', async (req, res) => {
    try {
        const data = await readData();
        const needsWork = data.tickets.filter(t => 
            t.status === 'reported' || t.status === 'in_progress'
        );
        res.json({
            count: needsWork.length,
            tickets: needsWork
        });
    } catch (error) {
        res.status(500).json({ error: 'Failed to get batch' });
    }
});

// Start server
async function start() {
    await initDataFile();
    app.listen(PORT, () => {
        console.log(`
╔══════════════════════════════════════════╗
║     CLAUDE TICKETS v2.0 - RUNNING         ║
╚══════════════════════════════════════════╝

🚀 Server: http://localhost:${PORT}
🤖 Claude: curl http://localhost:${PORT}/api/claude/next
📄 Export: curl http://localhost:${PORT}/api/export/markdown

Test Claude:
  claude "Read tickets.json and list all tickets"
        `);
    });
}

start();
module.exports = app;
SERVERJS

# Create index.html
cat > public/index.html << 'INDEXHTML'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>OTKIT</title>
    <script src="https://cdn.jsdelivr.net/npm/vue@3.3.4/dist/vue.global.js"></script>
    <link href="https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg-main: #E94560;
            --bg-dark: #0F3460;
            --bg-darker: #0A0F1C;
            --bg-card: #121A30;
            --text-primary: #C4D1E8;
            --text-bright: #FAEBD7;
            --text-muted: #7B8AA8;
            --accent-blue: #1FB6FF;
            --accent-cyan: #06B6D4;
            --success: #10B981;
            --warning: #F59E0B;
            --danger: #EF4444;
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        body {
            font-family: 'Share Tech Mono', monospace;
            background: linear-gradient(135deg, var(--bg-darker) 0%, var(--bg-dark) 50%, var(--bg-darker) 100%);
            color: var(--text-primary);
            min-height: 100vh;
            line-height: 1.6;
        }

        #app {
            max-width: 1400px;
            margin: 0 auto;
            padding: 2rem;
        }

        .header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 2rem;
            padding: 1.5rem;
            background: var(--bg-main);
            border: 2px solid var(--accent-blue);
            border-radius: 4px;
        }

        .header h1 {
            font-family: 'Orbitron', monospace;
            color: var(--text-bright);
            font-size: 2rem;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 3px;
        }

        .btn {
            background: var(--bg-main);
            color: var(--text-bright);
            border: 1px solid var(--accent-blue);
            padding: 0.75rem 1.5rem;
            border-radius: 4px;
            font-size: 0.9rem;
            cursor: pointer;
            font-weight: 600;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-family: 'Orbitron', monospace;
        }

        .btn:hover {
            transform: translateY(-2px);
            background: var(--accent-cyan);
            color: var(--bg-darker);
        }

        .claude-section {
            background: var(--bg-card);
            border: 2px solid var(--accent-cyan);
            border-radius: 4px;
            padding: 1.5rem;
            margin-bottom: 2rem;
        }

        .claude-section h3 {
            color: var(--accent-cyan);
            font-family: 'Orbitron', monospace;
            font-size: 1rem;
            margin-bottom: 1rem;
            text-transform: uppercase;
        }

        .command-box {
            background: var(--bg-dark);
            padding: 1rem;
            border-radius: 4px;
            border-left: 3px solid var(--accent-cyan);
            font-family: 'Share Tech Mono', monospace;
            font-size: 0.85rem;
            color: var(--accent-cyan);
            cursor: pointer;
            margin-bottom: 0.5rem;
        }

        .command-box:hover {
            transform: translateX(5px);
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin-bottom: 2rem;
        }

        .stat-card {
            background: var(--bg-card);
            padding: 1.5rem;
            border: 1px solid var(--bg-main);
            border-radius: 4px;
        }

        .stat-card h3 {
            color: var(--text-muted);
            font-size: 0.75rem;
            text-transform: uppercase;
            margin-bottom: 0.5rem;
            font-family: 'Orbitron', monospace;
        }

        .stat-card .number {
            font-size: 2rem;
            font-weight: bold;
            color: var(--text-bright);
            font-family: 'Orbitron', monospace;
        }

        .filters {
            display: flex;
            gap: 1rem;
            margin-bottom: 2rem;
            flex-wrap: wrap;
            padding: 1rem;
            background: var(--bg-card);
            border: 1px solid var(--bg-main);
            border-radius: 4px;
        }

        .search-box {
            flex: 1;
            min-width: 200px;
        }

        .search-box input {
            width: 100%;
            padding: 0.75rem;
            background: var(--bg-dark);
            border: 1px solid var(--accent-blue);
            border-radius: 4px;
            color: var(--text-bright);
            font-size: 0.9rem;
            font-family: 'Share Tech Mono', monospace;
        }

        .filter-btn {
            padding: 0.75rem 1rem;
            background: var(--bg-dark);
            border: 1px solid var(--text-muted);
            border-radius: 4px;
            color: var(--text-primary);
            cursor: pointer;
            font-family: 'Orbitron', monospace;
            font-size: 0.8rem;
            text-transform: uppercase;
        }

        .filter-btn.active {
            background: var(--bg-main);
            color: var(--text-bright);
            border-color: var(--accent-blue);
        }

        .tickets-container {
            display: grid;
            gap: 1rem;
        }

        .ticket-card {
            background: var(--bg-card);
            border: 1px solid var(--bg-main);
            border-radius: 4px;
            padding: 1.5rem;
        }

        .ticket-card:hover {
            transform: translateX(10px);
            border-color: var(--accent-blue);
        }

        .ticket-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 1rem;
        }

        .ticket-id {
            color: var(--accent-blue);
            font-size: 0.875rem;
            font-family: 'Orbitron', monospace;
        }

        .ticket-title {
            color: var(--text-bright);
            font-size: 1.25rem;
            font-weight: 700;
            margin: 0.5rem 0;
            font-family: 'Orbitron', monospace;
            text-transform: uppercase;
        }

        .ticket-description {
            color: var(--text-primary);
            margin-bottom: 1rem;
            line-height: 1.6;
            font-size: 0.9rem;
        }

        .ticket-meta {
            display: flex;
            gap: 1rem;
            flex-wrap: wrap;
        }

        .badge {
            padding: 0.25rem 0.75rem;
            border-radius: 4px;
            font-size: 0.7rem;
            font-weight: 600;
            text-transform: uppercase;
            font-family: 'Orbitron', monospace;
        }

        .priority-high { background: var(--danger); color: white; }
        .priority-medium { background: var(--warning); color: white; }
        .priority-low { background: var(--success); color: white; }
        .status-reported { background: var(--accent-blue); color: white; }
        .status-in_progress { background: var(--warning); color: white; }
        .status-finished { background: var(--success); color: white; }

        .modal {
            display: none;
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.9);
            z-index: 1000;
        }

        .modal.show {
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .modal-content {
            background: var(--bg-card);
            border-radius: 4px;
            padding: 2rem;
            width: 90%;
            max-width: 600px;
            border: 2px solid var(--bg-main);
        }

        .modal-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-bottom: 1.5rem;
        }

        .modal-header h2 {
            color: var(--text-bright);
            font-family: 'Orbitron', monospace;
            text-transform: uppercase;
        }

        .form-group {
            margin-bottom: 1.5rem;
        }

        .form-group label {
            display: block;
            color: var(--accent-blue);
            margin-bottom: 0.5rem;
            font-weight: 600;
            font-family: 'Orbitron', monospace;
            font-size: 0.8rem;
            text-transform: uppercase;
        }

        .form-group input,
        .form-group textarea,
        .form-group select {
            width: 100%;
            padding: 0.75rem;
            background: var(--bg-dark);
            border: 1px solid var(--text-muted);
            border-radius: 4px;
            color: var(--text-bright);
            font-size: 0.9rem;
            font-family: 'Share Tech Mono', monospace;
        }

        .form-group textarea {
            resize: vertical;
            min-height: 100px;
        }

        .modal-footer {
            display: flex;
            justify-content: flex-end;
            gap: 1rem;
            margin-top: 2rem;
        }

        .empty-state {
            text-align: center;
            padding: 4rem 2rem;
            color: var(--text-muted);
        }
    </style>
</head>
<body>
    <div id="app">
        <div class="header">
            <h1>OTKIT</h1>
            <button class="btn" @click="openModal()">+ NEW TICKET</button>
        </div>

        <div class="claude-section">
            <h3>🤖 CLAUDE CLI COMMANDS</h3>
            <div class="command-box" @click="copyCommand('claude &quot;Read tickets.json and fix the highest priority reported issue&quot;')">
                claude "Read tickets.json and fix the highest priority reported issue"
            </div>
            <div class="command-box" @click="copyCommand('curl http://localhost:7337/api/claude/next | claude &quot;Solve this ticket&quot;')">
                curl http://localhost:7337/api/claude/next | claude "Solve this ticket"
            </div>
            <div class="command-box" @click="copyCommand('curl http://localhost:7337/api/export/markdown | claude &quot;Analyze all tickets&quot;')">
                curl http://localhost:7337/api/export/markdown | claude "Analyze all tickets"
            </div>
        </div>

        <div class="stats">
            <div class="stat-card">
                <h3>Total</h3>
                <div class="number">{{ tickets.length }}</div>
            </div>
            <div class="stat-card">
                <h3>Reported</h3>
                <div class="number">{{ getCount('reported') }}</div>
            </div>
            <div class="stat-card">
                <h3>In Progress</h3>
                <div class="number">{{ getCount('in_progress') }}</div>
            </div>
            <div class="stat-card">
                <h3>Finished</h3>
                <div class="number">{{ getCount('finished') }}</div>
            </div>
        </div>

        <div class="filters">
            <div class="search-box">
                <input v-model="searchQuery" placeholder="Search tickets...">
            </div>
            <button class="filter-btn" :class="{ active: filterStatus === 'all' }" @click="filterStatus = 'all'">ALL</button>
            <button class="filter-btn" :class="{ active: filterStatus === 'reported' }" @click="filterStatus = 'reported'">REPORTED</button>
            <button class="filter-btn" :class="{ active: filterStatus === 'in_progress' }" @click="filterStatus = 'in_progress'">IN PROGRESS</button>
            <button class="filter-btn" :class="{ active: filterStatus === 'finished' }" @click="filterStatus = 'finished'">FINISHED</button>
        </div>

        <div class="tickets-container">
            <div class="ticket-card" v-for="ticket in filteredTickets" :key="ticket.id">
                <div class="ticket-header">
                    <div>
                        <div class="ticket-id">ID.{{ String(ticket.id).padStart(4, '0') }}</div>
                        <h3 class="ticket-title">{{ ticket.title }}</h3>
                    </div>
                    <div>
                        <button class="btn" style="padding: 0.5rem;" @click="openModal(ticket)">✏️</button>
                        <button class="btn" style="padding: 0.5rem; background: var(--danger);" @click="deleteTicket(ticket.id)">🗑️</button>
                    </div>
                </div>
                <p class="ticket-description">{{ ticket.description }}</p>
                <div class="ticket-meta">
                    <span class="badge" :class="'priority-' + ticket.priority">{{ ticket.priority }}</span>
                    <span class="badge" :class="'status-' + ticket.status">{{ ticket.status.replace('_', ' ') }}</span>
                </div>
            </div>
        </div>

        <div class="empty-state" v-if="filteredTickets.length === 0">
            <h3>No tickets found</h3>
            <p>Create a ticket for Claude to work on</p>
        </div>

        <div class="modal" :class="{ show: showModal }">
            <div class="modal-content">
                <div class="modal-header">
                    <h2>{{ editingTicket ? 'Edit' : 'New' }} Ticket</h2>
                    <button class="btn" @click="closeModal()">✕</button>
                </div>

                <div class="form-group">
                    <label>Title</label>
                    <input v-model="ticketForm.title" placeholder="Brief description...">
                </div>

                <div class="form-group">
                    <label>Description</label>
                    <textarea v-model="ticketForm.description" placeholder="Detailed description for Claude..."></textarea>
                </div>

                <div class="form-group">
                    <label>Priority</label>
                    <select v-model="ticketForm.priority">
                        <option value="low">Low</option>
                        <option value="medium">Medium</option>
                        <option value="high">High</option>
                    </select>
                </div>

                <div class="form-group">
                    <label>Status</label>
                    <select v-model="ticketForm.status">
                        <option value="reported">Reported</option>
                        <option value="in_progress">In Progress</option>
                        <option value="finished">Finished</option>
                    </select>
                </div>

                <div class="modal-footer">
                    <button class="btn" @click="closeModal()">Cancel</button>
                    <button class="btn" @click="saveTicket()">{{ editingTicket ? 'Update' : 'Create' }}</button>
                </div>
            </div>
        </div>
    </div>

    <script>
        const { createApp } = Vue;

        createApp({
            data() {
                return {
                    tickets: [],
                    showModal: false,
                    editingTicket: null,
                    searchQuery: '',
                    filterStatus: 'all',
                    ticketForm: {
                        title: '',
                        description: '',
                        priority: 'medium',
                        status: 'reported'
                    },
                    apiUrl: 'http://localhost:7337/api'
                }
            },
            computed: {
                filteredTickets() {
                    let filtered = this.tickets;
                    if (this.filterStatus !== 'all') {
                        filtered = filtered.filter(t => t.status === this.filterStatus);
                    }
                    if (this.searchQuery) {
                        const query = this.searchQuery.toLowerCase();
                        filtered = filtered.filter(t => 
                            t.title.toLowerCase().includes(query) ||
                            t.description.toLowerCase().includes(query)
                        );
                    }
                    return filtered.sort((a, b) => {
                        const priorityOrder = { high: 0, medium: 1, low: 2 };
                        if (priorityOrder[a.priority] !== priorityOrder[b.priority]) {
                            return priorityOrder[a.priority] - priorityOrder[b.priority];
                        }
                        return new Date(b.created) - new Date(a.created);
                    });
                }
            },
            methods: {
                copyCommand(command) {
                    const textarea = document.createElement('textarea');
                    textarea.innerHTML = command;
                    navigator.clipboard.writeText(textarea.value).then(() => {
                        alert('Command copied!');
                    });
                },
                getCount(status) {
                    return this.tickets.filter(t => t.status === status).length;
                },
                openModal(ticket = null) {
                    if (ticket) {
                        this.editingTicket = ticket;
                        this.ticketForm = { ...ticket };
                    } else {
                        this.editingTicket = null;
                        this.ticketForm = { title: '', description: '', priority: 'medium', status: 'reported' };
                    }
                    this.showModal = true;
                },
                closeModal() {
                    this.showModal = false;
                    this.editingTicket = null;
                },
                async saveTicket() {
                    if (!this.ticketForm.title) {
                        alert('Title required');
                        return;
                    }
                    try {
                        if (this.editingTicket) {
                            const res = await fetch(`${this.apiUrl}/tickets/${this.editingTicket.id}`, {
                                method: 'PUT',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(this.ticketForm)
                            });
                            if (res.ok) {
                                const updated = await res.json();
                                const index = this.tickets.findIndex(t => t.id === this.editingTicket.id);
                                if (index !== -1) this.tickets[index] = updated;
                            }
                        } else {
                            const res = await fetch(`${this.apiUrl}/tickets`, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify(this.ticketForm)
                            });
                            if (res.ok) {
                                const newTicket = await res.json();
                                this.tickets.push(newTicket);
                            }
                        }
                    } catch (error) {
                        console.error('Error:', error);
                    }
                    this.closeModal();
                },
                async deleteTicket(id) {
                    if (confirm('Delete ticket?')) {
                        try {
                            await fetch(`${this.apiUrl}/tickets/${id}`, { method: 'DELETE' });
                            this.tickets = this.tickets.filter(t => t.id !== id);
                        } catch (error) {
                            console.error('Error:', error);
                        }
                    }
                },
                async loadTickets() {
                    try {
                        const res = await fetch(`${this.apiUrl}/tickets`);
                        if (res.ok) this.tickets = await res.json();
                    } catch (error) {
                        console.error('Error loading tickets:', error);
                    }
                }
            },
            mounted() {
                this.loadTickets();
                setInterval(() => this.loadTickets(), 30000);
            }
        }).mount('#app');
    </script>
</body>
</html>
INDEXHTML

echo ""
echo "✅ Installation complete!"
echo ""
echo "📁 Created files:"
echo "  - package.json"
echo "  - server.js" 
echo "  - public/index.html"
echo ""
echo "🚀 To start the server:"
echo "  node server.js"
echo ""
echo "🌐 Then open:"
echo "  http://localhost:7337"
echo ""
echo "🤖 Test Claude CLI:"
echo "  claude \"Read tickets.json and list all tickets\""
echo ""
echo "📊 Or use the API:"
echo "  curl http://localhost:7337/api/claude/next"
echo ""
