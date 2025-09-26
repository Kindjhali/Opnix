<template>
  <div class="app-container">
    <header class="header">
        <div class="theme-switcher">
            <button class="theme-btn" :class="{active: currentTheme === 'mole'}" @click="setTheme('mole')">
                MOLE
            </button>
            <button class="theme-btn" :class="{active: currentTheme === 'canyon'}" @click="setTheme('canyon')">
                CANYON
            </button>
        </div>
        <h1>OTKIT</h1>
        <p class="subtitle">OPERATIONAL TOOLKIT // v1.0</p>
    </header>
    
    <div class="container">
        <!-- Claude CLI Command Bar -->
        <div class="claude-cli-bar">
            <div class="claude-command">
                <span style="color: var(--accent-cyan);">claude$</span>
                <input
                    type="text"
                    v-model="claudeCommand"
                    @keyup.enter="executeClaudeCommand"
                    placeholder="setup audit | analyze modules | detect dependencies | fix issue #123 | generate docs (auto --ultrathink)"
                >
                <button class="btn" @click="executeClaudeCommand">EXECUTE</button>
            </div>
        </div>
    
        <!-- Agents Bar -->
        <div class="agents-bar">
            <h3 style="color: var(--text-bright); margin-bottom: 1rem;">🤖 Active Agents</h3>
            <div class="agents-grid">
                <div v-for="agent in agents" :key="agent.id"
                     :class="['agent-card', { active: agent.status === 'active' }]"
                     @click="activateAgent(agent)">
                    <div class="agent-icon">{{ agent.icon }}</div>
                    <div class="agent-name">{{ agent.name }}</div>
                    <div class="agent-status">{{ agent.status }}</div>
                    <div style="margin-top: 0.5rem; font-size: 0.7rem;">
                        Tasks: {{ agent.taskCount }}
                    </div>
                </div>
            </div>
    
            <!-- Task Queue -->
            <div class="task-queue" v-if="taskQueue.length > 0">
                <h4 style="color: var(--accent-orange); margin-bottom: 0.5rem;">Task Queue</h4>
                <div v-for="task in taskQueue" :key="task.id" class="task-item">
                    <span>{{ task.agent }} → {{ task.description }}</span>
                    <span :class="['task-status', task.status]">{{ task.status }}</span>
                </div>
            </div>
        </div>
    
        <!-- Status Overview -->
        <div class="status-overview" v-if="stats">
            <div class="card status-card">
                <div class="status-header">
                    <div>
                        <h3 style="color: var(--accent-cyan);">Ticket Pulse</h3>
                        <p style="color: var(--text-muted); font-size: 0.8rem;">Live view of open vs closed work</p>
                    </div>
                    <div class="status-counts">
                        <div class="status-metric">
                            <div class="status-value">{{ ticketProgress.open }}</div>
                            <div class="status-label">Open</div>
                        </div>
                        <div class="status-metric">
                            <div class="status-value">{{ ticketProgress.closed }}</div>
                            <div class="status-label">Closed</div>
                        </div>
                        <div class="status-metric">
                            <div class="status-value">{{ ticketProgress.total }}</div>
                            <div class="status-label">Total</div>
                        </div>
                    </div>
                </div>
                <div class="status-bar" aria-label="Open vs closed work balance">
                    <div class="status-bar-open" :style="{ width: ticketProgress.openPct + '%' }"></div>
                    <div class="status-bar-closed" :style="{ width: ticketProgress.closedPct + '%' }"></div>
                </div>
                <div class="status-legend">
                    <span class="status-chip open">Open {{ ticketProgress.openPct }}%</span>
                    <span class="status-chip closed">Closed {{ ticketProgress.closedPct }}%</span>
                    <span class="status-chip reported">Reported {{ ticketProgress.reported }}</span>
                    <span class="status-chip progress">In Progress {{ ticketProgress.inProgress }}</span>
                    <span class="status-chip finished">Finished {{ ticketProgress.finished }}</span>
                </div>
                <div class="status-footnote" v-if="latestAudit">
                    {{ latestAudit.message }}
                    <ul class="status-followups" v-if="latestAudit.followUps && latestAudit.followUps.length">
                        <li v-for="(item, idx) in latestAudit.followUps.slice(0, 3)" :key="idx">{{ item }}</li>
                    </ul>
                </div>
            </div>
        </div>
    
        <!-- Main Tabs -->
        <div class="tabs">
            <div class="tab" :class="{active: activeTab === 'canvas'}" @click="setTab('canvas')">
                🕸️ CANVAS
            </div>
            <div class="tab" :class="{active: activeTab === 'bugs'}" @click="setTab('bugs')">
                🐛 BUGS
            </div>
            <div class="tab" :class="{active: activeTab === 'features'}" @click="setTab('features')">
                ✨ FEATURES
            </div>
            <div class="tab" :class="{active: activeTab === 'modules'}" @click="setTab('modules')">
                📦 MODULES
            </div>
            <div class="tab" :class="{active: activeTab === 'specs'}" @click="setTab('specs')">
                📋 SPECS
            </div>
            <div class="tab" :class="{active: activeTab === 'diagrams'}" @click="setTab('diagrams')">
                📊 DIAGRAMS
            </div>
            <div class="tab" :class="{active: activeTab === 'api'}" @click="setTab('api')">
                🔌 API
            </div>
            <div class="tab" :class="{active: activeTab === 'docs'}" @click="setTab('docs')">
                📚 DOCS
            </div>
        </div>
    
        <!-- Canvas Tab -->
        <div class="tab-content" :class="{active: activeTab === 'canvas'}">
            <div class="controls">
                <button class="btn" @click="layoutCanvas('breadthfirst')">📊 Tree</button>
                <button class="btn" @click="layoutCanvas('circle')">⭕ Circle</button>
                <button class="btn" @click="layoutCanvas('cose')">🌐 Force</button>
                <button class="btn secondary" @click="detectModules()">🔍 Detect</button>
                <button class="btn feature" @click="analyzeCanvas()">📈 Analyze</button>
                <button class="btn doc" @click="exportCanvas()">💾 Export</button>
            </div>
            <div id="canvas-container"></div>
        </div>
    
        <!-- Bugs Tab (FROM ORIGINAL) -->
        <div class="tab-content" :class="{active: activeTab === 'bugs'}">
            <div class="controls">
                <button class="btn danger" @click="showBugModal = true">+ New Bug</button>
                <button class="btn secondary" @click="analyzeWithPythonAgent()">🐍 Python Analysis</button>
                <select v-model="bugFilter.priority">
                    <option value="">All Priorities</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
                <select v-model="bugFilter.status">
                    <option value="">All Status</option>
                    <option v-for="option in ticketStatusOptions" :key="option.value" :value="option.value">
                        {{ option.label }}
                    </option>
                </select>
                <button class="btn secondary" @click="exportBugs()">Export JSON</button>
            </div>
    
            <div class="grid">
                <div v-for="ticket in filteredBugs" :key="ticket.id"
                     :class="['card', {'high-priority': ticket.priority === 'high'}]">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span class="badge" :class="ticket.priority">{{ ticket.priority }}</span>
                        <span style="color: var(--text-muted); font-size: 0.8rem;">#{{ ticket.id }}</span>
                    </div>
                    <h3 style="color: var(--text-bright); margin-bottom: 0.5rem;">{{ ticket.title }}</h3>
                    <p style="margin-bottom: 1rem;">{{ ticket.description }}</p>
                    <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-bottom: 1rem;">
                        <span v-for="tag in ticket.modules" :key="tag" class="module-tag">{{ tag }}</span>
                    </div>
                    <div v-if="ticket.completionSummary" class="completion-summary">
                        <strong>Completion Summary</strong>
                        <p>{{ ticket.completionSummary }}</p>
                    </div>
                    <div class="ticket-status-row">
                        <div class="ticket-status-control">
                            <span class="badge" :class="ticket.status">{{ statusLabel(ticket.status) }}</span>
                            <select class="status-select" :value="ticket.status" @change="onTicketStatusChange(ticket, $event)">
                                <option v-for="option in ticketStatusOptions" :key="option.value" :value="option.value">
                                    {{ option.label }}
                                </option>
                            </select>
                        </div>
                        <span class="ticket-date">
                            {{ formatDate(ticket.created) }}
                        </span>
                    </div>
                </div>
            </div>
        </div>
    
        <!-- Features Tab (FROM ORIGINAL) -->
        <div class="tab-content" :class="{active: activeTab === 'features'}">
            <div class="controls">
                <button class="btn feature" @click="showFeatureModal = true">+ New Feature</button>
                <select v-model="featureFilter.module">
                    <option value="">All Modules</option>
                    <option v-for="module in modules" :key="module.id" :value="module.id">
                        {{ module.name }}
                    </option>
                </select>
                <select v-model="featureFilter.status">
                    <option value="">All Status</option>
                    <option value="proposed">Proposed</option>
                    <option value="approved">Approved</option>
                    <option value="in-development">In Development</option>
                    <option value="testing">Testing</option>
                    <option value="deployed">Deployed</option>
                </select>
                <button class="btn secondary" @click="generateFeatureReport()">Generate Report</button>
            </div>
    
            <div class="tag-cloud">
                <div v-for="module in modules" :key="module.id"
                     class="tag" :class="{selected: selectedModules.includes(module.id)}"
                     @click="toggleModule(module.id)">
                    {{ module.name }} ({{ getModuleFeatureCount(module.id) }})
                </div>
            </div>
    
            <div class="grid">
                <div v-for="feature in filteredFeatures" :key="feature.id" class="card">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 1rem;">
                        <span class="badge feature">FEATURE</span>
                        <span style="color: var(--text-muted);">#F-{{ feature.id }}</span>
                    </div>
                    <h3 style="color: var(--feature); margin-bottom: 0.5rem;">{{ feature.title }}</h3>
                    <p style="margin-bottom: 1rem;">{{ feature.description }}</p>
                    <div style="margin-bottom: 1rem;">
                        <strong style="color: var(--accent-orange);">Module:</strong>
                        {{ getModuleName(feature.moduleId) }}
                    </div>
                    <div style="margin-bottom: 1rem;" v-if="feature.acceptanceCriteria">
                        <strong style="color: var(--accent-orange);">Acceptance Criteria:</strong>
                        <ul style="margin-left: 1.5rem; margin-top: 0.5rem;">
                            <li v-for="(criteria, index) in feature.acceptanceCriteria" :key="index">
                                {{ criteria }}
                            </li>
                        </ul>
                    </div>
                    <div style="display: flex; justify-content: space-between;">
                        <span class="badge" :style="{background: getFeatureStatusColor(feature.status)}">
                            {{ feature.status }}
                        </span>
                        <div style="text-align: right;">
                            <div style="color: var(--text-muted); font-size: 0.8rem;">
                                Priority: {{ feature.priority }}
                            </div>
                            <div style="color: var(--text-muted); font-size: 0.8rem;">
                                Votes: {{ feature.votes }}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    
        <!-- Modules Tab -->
        <div class="tab-content" :class="{active: activeTab === 'modules'}">
            <div class="controls">
                <button class="btn" @click="showAddModuleModal = true">+ Add Module</button>
                <button class="btn secondary" @click="detectModules()">🔍 Auto-Detect</button>
                <button class="btn doc" @click="analyzeModuleDependencies()">📊 Analyze Dependencies</button>
            </div>
    
            <div class="card" v-if="moduleSummary.moduleCount" style="margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 2rem; align-items: center;">
                <div>
                    <h3 style="color: var(--accent-cyan); margin-bottom: 0.5rem;">Detection Summary</h3>
                    <div style="color: var(--text-muted); font-size: 0.9rem;">Based on live filesystem scan</div>
                </div>
                <div style="display: flex; gap: 1.5rem; flex-wrap: wrap;">
                    <div>
                        <div style="font-size: 1.8rem; color: var(--accent-blue); font-weight: bold;">{{ moduleSummary.moduleCount }}</div>
                        <div style="text-transform: uppercase; font-size: 0.75rem; color: var(--text-muted);">Modules</div>
                    </div>
                    <div>
                        <div style="font-size: 1.8rem; color: var(--accent-orange); font-weight: bold;">{{ moduleSummary.dependencyCount }}</div>
                        <div style="text-transform: uppercase; font-size: 0.75rem; color: var(--text-muted);">Links</div>
                    </div>
                    <div>
                        <div style="font-size: 1.8rem; color: var(--accent-cyan); font-weight: bold;">{{ moduleSummary.externalDependencyCount }}</div>
                        <div style="text-transform: uppercase; font-size: 0.75rem; color: var(--text-muted);">External</div>
                    </div>
                    <div>
                        <div style="font-size: 1.8rem; color: var(--accent-pink); font-weight: bold;">{{ moduleSummary.totalLines }}</div>
                        <div style="text-transform: uppercase; font-size: 0.75rem; color: var(--text-muted);">Lines</div>
                    </div>
                </div>
            </div>
    
            <div class="grid">
                <div v-for="module in modules" :key="module.id" class="module-card">
                    <div class="module-header">
                        <div class="module-name">{{ module.name }}</div>
                        <div class="module-health" :style="{background: getHealthColor(module.health)}"></div>
                    </div>
    
                    <div class="module-stats">
                        <div class="stat-item">
                            <div class="stat-value">{{ getModuleBugCount(module.id) }}</div>
                            <div class="stat-label">Bugs</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">{{ getModuleFeatureCount(module.id) }}</div>
                            <div class="stat-label">Features</div>
                        </div>
                        <div class="stat-item">
                            <div class="stat-value">{{ module.health }}%</div>
                            <div class="stat-label">Health</div>
                        </div>
                    </div>
    
                    <div class="module-dependencies">
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            Dependencies ({{ (module.dependencies || []).length }}):
                        </div>
                        <div>
                            <span v-for="dep in module.dependencies || []" :key="dep" class="dependency-item">
                                {{ dep }}
                            </span>
                        </div>
                    </div>
    
                    <div class="module-dependencies" v-if="module.externalDependencies && module.externalDependencies.length">
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            External Packages ({{ module.externalDependencies.length }}):
                        </div>
                        <div>
                            <span v-for="pkg in module.externalDependencies" :key="module.id + pkg" class="dependency-item" style="color: var(--accent-orange);">
                                {{ pkg }}
                            </span>
                        </div>
                    </div>
    
                    <div class="module-dependencies" v-if="module.pathHints && module.pathHints.length">
                        <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 0.5rem;">
                            Paths:
                        </div>
                        <div>
                            <span v-for="hint in module.pathHints" :key="module.id + hint" class="dependency-item" style="color: var(--accent-blue);">
                                {{ hint }}
                            </span>
                        </div>
                    </div>
    
                    <div style="margin-top: 1rem;">
                        <button class="btn" style="width: 100%; padding: 0.5rem;"
                                @click="analyzeModule(module)">
                            Analyze Module
                        </button>
                    </div>
                </div>
            </div>
        </div>
    
        <!-- Specs Tab -->
        <div class="tab-content" :class="{active: activeTab === 'specs'}">
            <div class="spec-builder">
                <h2 style="color: var(--text-bright); margin-bottom: 1.5rem;">
                    Intelligent Spec Builder
                </h2>
    
                <div style="margin-bottom: 2rem;">
                    <span style="color: var(--accent-cyan);">Phase: </span>
                    <span style="color: var(--accent-orange); font-weight: bold;">{{ currentPhase }}</span>
                </div>
    
                <div v-for="(question, index) in currentQuestions" :key="question.id" class="question-card">
                    <div class="interview-section-header" v-if="question.isSectionFirst">
                        <h3>{{ question.sectionTitle }}</h3>
                        <p v-if="question.sectionDescription" class="interview-section-description">{{ question.sectionDescription }}</p>
                    </div>
                    <div class="question-label">{{ question.prompt }}</div>
                    <input v-if="question.type === 'text'"
                           v-model="question.answer"
                           @change="processAnswer(question)"
                           :placeholder="question.placeholder">
                    <textarea v-else-if="question.type === 'textarea'"
                             v-model="question.answer"
                             @change="processAnswer(question)"
                             rows="4"
                             :placeholder="question.placeholder"></textarea>
                    <select v-else-if="question.type === 'select'"
                            v-model="question.answer"
                            @change="processAnswer(question)">
                        <option value="">Choose...</option>
                        <option v-for="opt in (question.options || [])" :key="opt" :value="opt">{{ opt }}</option>
                    </select>
                    <div class="question-help" v-if="question.help">{{ question.help }}</div>
                </div>
    
                <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-top: 1rem;">
                    <div style="display: flex; flex-direction: column; gap: 0.4rem;">
                        <label style="font-size: 0.8rem; color: var(--text-muted);">Export Format</label>
                        <select v-model="specExportFormat" style="min-width: 180px;">
                            <option value="json">JSON</option>
                            <option value="markdown">Markdown</option>
                            <option value="github">GitHub Spec Kit</option>
                        </select>
                    </div>
                    <button class="btn feature" @click="generateSpec()">
                        Generate & Save Spec
                    </button>
                    <div v-if="latestSpecMeta" style="color: var(--accent-cyan); font-size: 0.85rem;">
                        Saved as {{ latestSpecMeta.filename }}
                    </div>
                </div>
    
                <div v-if="generatedSpec" style="margin-top: 2rem;">
                    <h3 style="color: var(--text-bright); margin-bottom: 1rem;">Generated Spec:</h3>
                    <pre class="api-spec">{{ generatedSpec }}</pre>
                </div>
            </div>
        </div>
    
        <!-- Diagrams Tab -->
        <div class="tab-content" :class="{active: activeTab === 'diagrams'}">
            <div class="controls">
                <button class="btn" @click="generateDiagram('architecture')">🏗️ Architecture</button>
                <button class="btn" @click="generateDiagram('flow')">🔄 Flow</button>
                <button class="btn" @click="generateDiagram('sequence')">📋 Sequence</button>
                <button class="btn" @click="generateDiagram('entity')">🗂️ Entity</button>
                <button class="btn secondary" @click="generateFromModules()">📦 From Modules</button>
            </div>
    
            <div class="mermaid-container">
                <div id="mermaid-output"></div>
            </div>
    
            <textarea v-model="mermaidCode"
                     style="width: 100%; min-height: 200px; margin-top: 1rem;"
                     placeholder="Mermaid code..."></textarea>
            <button class="btn" @click="renderMermaid()">Render Diagram</button>
        </div>
    
        <!-- API Tab -->
        <div class="tab-content" :class="{active: activeTab === 'api'}">
            <div class="controls">
                <button class="btn" @click="generateAPISpec()">🔄 Generate API Spec</button>
                <select v-model="apiFormat">
                    <option value="openapi">OpenAPI 3.0</option>
                    <option value="custom">Custom Lightweight</option>
                    <option value="json">JSON Schema</option>
                </select>
                <button class="btn secondary" @click="exportAPISpec()">📥 Export</button>
                <button class="btn feature" @click="testAPI()">🧪 Test Endpoints</button>
            </div>
    
            <div class="api-spec">{{ apiSpecContent }}</div>
        </div>
    
        <!-- Docs Tab -->
        <div class="tab-content" :class="{active: activeTab === 'docs'}">
            <div class="controls">
                <button class="btn doc" @click="generateDocs()">📖 Generate Documentation</button>
                <button class="btn secondary" @click="exportDocs()">📥 Export Markdown</button>
                <select v-model="docType">
                    <option value="overview">Project Overview</option>
                    <option value="modules">Module Documentation</option>
                    <option value="api">API Documentation</option>
                    <option value="features">Feature Specifications</option>
                </select>
            </div>
    
            <div class="card">
                <h2 style="color: var(--doc); margin-bottom: 1rem;">{{ docTitle }}</h2>
                <div v-html="generatedDocs"></div>
            </div>
        </div>
    </div>
    
    <!-- Bug Modal -->
    <div class="modal" :class="{active: showBugModal}">
        <div class="modal-content" style="position: relative;">
            <button class="close-modal" @click="showBugModal = false">×</button>
            <h2 style="color: var(--danger); margin-bottom: 1rem;">Report New Bug</h2>
    
            <div class="form-group">
                <label>Title</label>
                <input v-model="newBug.title" type="text" placeholder="Bug title...">
            </div>
    
            <div class="form-group">
                <label>Description</label>
                <textarea v-model="newBug.description" rows="4" placeholder="Describe the bug..."></textarea>
            </div>
    
            <div class="form-group">
                <label>Priority</label>
                <select v-model="newBug.priority">
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
    
            <div class="form-group">
                <label>Modules (select multiple)</label>
                <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
                    <label v-for="module in modules" :key="module.id" style="display: flex; align-items: center;">
                        <input type="checkbox" :value="module.id" v-model="newBug.modules" style="margin-right: 0.5rem; width: auto;">
                        {{ module.name }}
                    </label>
                </div>
            </div>
    
            <div class="form-group">
                <label>Tags (comma separated)</label>
                <input v-model="newBug.tagsText" type="text" placeholder="BUG, AUTH, BACKEND">
            </div>
    
            <button class="btn danger" @click="addBug()">Submit Bug</button>
        </div>
    </div>
    
    <!-- Ticket Completion Modal -->
    <div class="modal" :class="{active: showTicketCompletionModal}">
        <div class="modal-content" style="position: relative;">
            <button class="close-modal" @click="cancelTicketCompletion">×</button>
            <h2 style="color: var(--success); margin-bottom: 1rem;">Wrap Up Ticket</h2>
            <p style="margin-bottom: 1rem; color: var(--text-muted);">
                Provide a concise summary of what changed, how it was validated, and any follow-up actions before closing this ticket.
            </p>
            <div class="form-group">
                <label>Summary of Work Completed</label>
                <textarea v-model="ticketCompletionSummary" rows="5" placeholder="Describe the fix, validation steps, and remaining follow-ups..."></textarea>
            </div>
            <p v-if="ticketCompletionError" class="form-error">{{ ticketCompletionError }}</p>
            <div class="modal-actions">
                <button class="btn secondary" @click="cancelTicketCompletion">Cancel</button>
                <button class="btn success" @click="confirmTicketCompletion">Mark as Finished</button>
            </div>
        </div>
    </div>
    
    <!-- Feature Modal -->
    <div class="modal" :class="{active: showFeatureModal}">
        <div class="modal-content" style="position: relative;">
            <button class="close-modal" @click="showFeatureModal = false">×</button>
            <h2 style="color: var(--feature); margin-bottom: 1rem;">Propose New Feature</h2>
    
            <div class="form-group">
                <label>Title</label>
                <input v-model="newFeature.title" type="text" placeholder="Feature title...">
            </div>
    
            <div class="form-group">
                <label>Description</label>
                <textarea v-model="newFeature.description" rows="4" placeholder="Describe the feature..."></textarea>
            </div>
    
            <div class="form-group">
                <label>Module</label>
                <select v-model="newFeature.moduleId">
                    <option v-for="module in modules" :key="module.id" :value="module.id">
                        {{ module.name }}
                    </option>
                </select>
            </div>
    
            <div class="form-group">
                <label>Priority</label>
                <select v-model="newFeature.priority">
                    <option value="critical">Critical</option>
                    <option value="high">High</option>
                    <option value="medium">Medium</option>
                    <option value="low">Low</option>
                </select>
            </div>
    
            <div class="form-group">
                <label>Acceptance Criteria (one per line)</label>
                <textarea v-model="newFeature.criteriaText" rows="4"
                          placeholder="- User can do X&#10;- System validates Y&#10;- Data is saved to Z"></textarea>
            </div>
    
            <button class="btn feature" @click="addFeature()">Submit Feature</button>
        </div>
    </div>
    
    <!-- Add Module Modal -->
    <div class="modal" :class="{active: showAddModuleModal}">
        <div class="modal-content" style="position: relative;">
            <button class="close-modal" @click="showAddModuleModal = false">×</button>
            <h2 style="color: var(--accent-orange); margin-bottom: 1rem;">Add New Module</h2>
    
            <div class="form-group">
                <label>Module Name</label>
                <input v-model="newModule.name" placeholder="Authentication">
            </div>
    
            <div class="form-group">
                <label>Module ID</label>
                <input v-model="newModule.id" placeholder="auth">
            </div>
    
            <div class="form-group">
                <label>Relative Path</label>
                <input v-model="newModule.path" placeholder="src/auth">
            </div>
    
            <div class="form-group">
                <label>Dependencies (comma-separated)</label>
                <input v-model="newModule.depsString" placeholder="database, crypto, utils">
            </div>
    
            <div class="form-group">
                <label>Module Type</label>
                <select v-model="newModule.type">
                    <option value="custom">Custom</option>
                    <option value="frontend">Frontend</option>
                    <option value="backend">Backend</option>
                    <option value="service">Service</option>
                    <option value="documentation">Documentation</option>
                </select>
            </div>
    
            <button class="btn" @click="addModule()">Add Module</button>
        </div>
    </div>
  </div>
</template>

<script>
import appOptions from "./appOptions.js";

export default appOptions;
</script>
