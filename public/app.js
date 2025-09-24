const { createApp } = Vue;

if (window.cytoscape && window.cytoscapeEdgehandles) {
    window.cytoscape.use(window.cytoscapeEdgehandles);
}

mermaid.initialize({
    startOnLoad: false,
    theme: 'dark',
    themeVariables: {
        primaryColor: '#1FB6FF',
        primaryTextColor: '#FAEBD7',
        primaryBorderColor: '#06B6D4',
        lineColor: '#06B6D4',
        secondaryColor: '#E94560',
        tertiaryColor: '#8B5CF6'
    }
});

const agentCategoryIcons = {
    development: '⚙️',
    'data-ai': '🧠',
    infrastructure: '🏗️',
    security: '🛡️',
    'quality-testing': '🧪',
    specialization: '🎯',
    general: '🤖'
};

const INTERVIEW_BLUEPRINT_URL = '/data/interview-sections.json';

function normalizeTagInput(raw) {
    if (!raw) return [];
    return raw
        .split(/[\n,]/)
        .map(token => token.trim())
        .filter(Boolean)
        .map(token => token.replace(/\s+/g, '_').toUpperCase());
}

createApp({
    data() {
        return {
            currentTheme: 'mole',
            activeTab: 'canvas',
            claudeCommand: '',
            claudeLastResponse: '',
            cy: null,
            edgeHandles: null,
            moduleEdges: [],
            moduleSummary: {
                moduleCount: 0,
                dependencyCount: 0,
                externalDependencyCount: 0,
                totalLines: 0
            },
            stats: null,
            agents: [],
            taskQueue: [],
            tickets: [],
            features: [],
            modules: [],
            exportsList: [],
            latestAudit: null,
            loading: {
                tickets: false,
                features: false,
                modules: false,
                agents: false,
                exports: false,
                stats: false
            },
            bugFilter: { priority: '', status: '' },
            featureFilter: { module: '', status: '' },
            selectedModules: [],
            ticketStatusOptions: [
                { value: 'reported', label: 'Reported' },
                { value: 'in_progress', label: 'In Progress' },
                { value: 'finished', label: 'Finished' }
            ],
            showTicketCompletionModal: false,
            ticketBeingUpdated: null,
            ticketStatusElement: null,
            ticketCompletionSummary: '',
            ticketCompletionError: '',
            showBugModal: false,
            showFeatureModal: false,
            showAddModuleModal: false,
            newBug: { title: '', description: '', priority: 'medium', modules: [], tagsText: '' },
            newFeature: { title: '', description: '', moduleId: '', priority: 'medium', criteriaText: '' },
            newModule: { name: '', id: '', path: '', depsString: '', type: 'custom' },
            interviewBlueprint: null,
            baseSectionOrder: [],
            typeSectionMap: {},
            frameworkSectionMap: {},
            languageFrameworks: {},
            currentSectionOrder: [],
            activeSectionIndex: 0,
            completedSections: [],
            currentQuestions: [],
            currentPhase: 'initial',
            questionAnswers: {},
            generatedSpec: '',
            latestSpecMeta: null,
            latestSpecPayload: null,
            specExportFormat: 'json',
            apiFormat: 'openapi',
            apiSpecContent: '',
            apiSpecPayload: null,
            docType: 'overview',
            docTitle: 'Project Overview',
            generatedDocs: '<p class="loading">Select documentation type and click generate...</p>',
            mermaidCode: ''
        };
    },
    computed: {
        filteredBugs() {
            return this.tickets
                .filter(ticket => {
                    if (this.bugFilter.priority && ticket.priority !== this.bugFilter.priority) return false;
                    if (this.bugFilter.status && ticket.status !== this.bugFilter.status) return false;
                    return true;
                })
                .sort((a, b) => new Date(a.created) - new Date(b.created));
        },
        filteredFeatures() {
            return this.features
                .filter(feature => {
                    if (this.featureFilter.module && feature.moduleId !== this.featureFilter.module) return false;
                    if (this.featureFilter.status && feature.status !== this.featureFilter.status) return false;
                    if (this.selectedModules.length > 0 && !this.selectedModules.includes(feature.moduleId)) return false;
                    return true;
                });
        },
        availableTags() {
            const tags = new Set();
            this.tickets.forEach(ticket => {
                (ticket.tags || []).forEach(tag => tags.add(tag));
            });
            return Array.from(tags).sort();
        },
        moduleLookup() {
            return this.modules.reduce((map, module) => {
                map[module.id] = module;
                return map;
            }, {});
        },
        ticketProgress() {
            const reported = this.stats?.reported || 0;
            const inProgress = this.stats?.in_progress || 0;
            const finished = this.stats?.finished || 0;
            const open = this.stats?.open !== undefined ? this.stats.open : reported + inProgress;
            const closed = this.stats?.closed !== undefined ? this.stats.closed : finished;
            const total = open + closed;
            const openPct = total ? Math.round((open / total) * 100) : 0;
            const closedPct = total ? 100 - openPct : 0;
            return { reported, inProgress, finished, open, closed, total, openPct, closedPct };
        }
    },
    methods: {
        async bootstrap() {
            await this.loadInterviewBlueprint();
            this.initializeInterview();
            await Promise.all([
                this.fetchAgents(),
                this.fetchTickets(),
                this.fetchFeatures(),
                this.fetchModulesGraph(),
                this.fetchExports(),
                this.fetchStats()
            ]);
            if (this.activeTab === 'canvas') {
                this.$nextTick(() => this.ensureCanvas());
            }
        },
        async loadInterviewBlueprint() {
            if (this.interviewBlueprint) return;
            try {
                const response = await fetch(INTERVIEW_BLUEPRINT_URL, { cache: 'no-cache' });
                const blueprint = await response.json();
                this.interviewBlueprint = blueprint.sections || {};
                this.baseSectionOrder = blueprint.baseOrder || Object.keys(this.interviewBlueprint);
                this.typeSectionMap = blueprint.typeOrder || {};
                this.frameworkSectionMap = blueprint.frameworkSectionMap || {};
                this.languageFrameworks = blueprint.languageFrameworks || {};
            } catch (error) {
                console.error('Interview blueprint load error', error);
                this.interviewBlueprint = {};
                this.baseSectionOrder = [];
                this.typeSectionMap = {};
                this.frameworkSectionMap = {};
                this.languageFrameworks = {};
            }
        },
        initializeInterview() {
            if (!this.interviewBlueprint || this.baseSectionOrder.length === 0) {
                this.currentQuestions = [];
                this.currentSectionOrder = [];
                this.currentPhase = 'initial';
                return;
            }
            this.questionAnswers = {};
            this.completedSections = [];
            this.currentSectionOrder = [...this.baseSectionOrder];
            this.activeSectionIndex = 0;
            this.currentQuestions = [];
            const firstSectionId = this.currentSectionOrder[0];
            if (firstSectionId) {
                this.enqueueSection(firstSectionId);
                this.currentPhase = this.getSectionTitle(firstSectionId);
            }
        },
        getSection(sectionId) {
            if (!sectionId || !this.interviewBlueprint) return null;
            return this.interviewBlueprint[sectionId] || null;
        },
        getSectionTitle(sectionId) {
            const section = this.getSection(sectionId);
            return section ? section.title : 'Interview';
        },
        cloneSectionQuestions(sectionId) {
            const section = this.getSection(sectionId);
            if (!section || !Array.isArray(section.questions)) return [];
            return section.questions.map((question, index) => ({
                ...question,
                answer: this.questionAnswers[question.id] || '',
                sectionId,
                sectionTitle: section.title,
                sectionDescription: section.description || '',
                isSectionFirst: index === 0
            }));
        },
        enqueueSection(sectionId) {
            if (!sectionId) return;
            if (this.currentQuestions.some(q => q.sectionId === sectionId)) return;
            const clones = this.cloneSectionQuestions(sectionId);
            if (clones.length) {
                this.currentQuestions.push(...clones);
            }
        },
        extendSectionsForProjectType(projectType) {
            if (!projectType) return;
            const additions = this.typeSectionMap[projectType] || [];
            additions.forEach(sectionId => {
                if (!this.currentSectionOrder.includes(sectionId)) {
                    this.currentSectionOrder.push(sectionId);
                }
            });
        },
        extendSectionsForFramework(framework) {
            if (!framework) return;
            const match = Object.keys(this.frameworkSectionMap).find(key => key.toLowerCase() === String(framework).toLowerCase());
            if (!match) return;
            const additions = this.frameworkSectionMap[match] || [];
            additions.forEach(sectionId => {
                if (!this.currentSectionOrder.includes(sectionId)) {
                    this.currentSectionOrder.push(sectionId);
                }
            });
        },
        updateFrameworkOptions(language) {
            if (!language) return;
            const match = Object.keys(this.languageFrameworks).find(key => key.toLowerCase() === String(language).toLowerCase());
            const options = match ? this.languageFrameworks[match] : ['None/Custom'];
            const frameworkQuestion = this.currentQuestions.find(q => q.id === 'preferred-framework');
            if (frameworkQuestion) {
                frameworkQuestion.options = options;
                if (!options.includes(frameworkQuestion.answer)) {
                    frameworkQuestion.answer = '';
                    this.questionAnswers['preferred-framework'] = '';
                }
            }
        },
        advanceSectionIfComplete(sectionId) {
            if (!sectionId || this.completedSections.includes(sectionId)) return;
            const section = this.getSection(sectionId);
            if (!section) return;
            const isComplete = section.questions.every(question => {
                if (question.required === false) return true;
                const value = this.questionAnswers[question.id];
                if (value === undefined || value === null) return false;
                return String(value).trim().length > 0;
            });
            if (!isComplete) return;
            this.completedSections.push(sectionId);
            if (this.activeSectionIndex < this.currentSectionOrder.length - 1) {
                this.activeSectionIndex += 1;
                const nextSectionId = this.currentSectionOrder[this.activeSectionIndex];
                this.enqueueSection(nextSectionId);
                this.currentPhase = this.getSectionTitle(nextSectionId);
            } else {
                this.currentPhase = 'Complete';
            }
        },
        async fetchAgents() {
            try {
                this.loading.agents = true;
                const response = await fetch('/api/agents');
                const payload = await response.json();
                const decorated = (payload.agents || []).map(agent => ({
                    id: agent.id,
                    name: agent.name,
                    category: agent.category,
                    path: agent.path,
                    icon: agentCategoryIcons[agent.category] || agentCategoryIcons.general,
                    status: 'idle',
                    taskCount: 0
                }));
                this.agents = decorated;
            } catch (error) {
                console.error('Agent load error', error);
            } finally {
                this.loading.agents = false;
            }
        },
        async fetchTickets() {
            try {
                this.loading.tickets = true;
                const response = await fetch('/api/tickets');
                const tickets = await response.json();
                this.tickets = Array.isArray(tickets) ? tickets : [];
            } catch (error) {
                console.error('Ticket load error', error);
            } finally {
                this.loading.tickets = false;
            }
        },
        async fetchFeatures() {
            try {
                this.loading.features = true;
                const response = await fetch('/api/features');
                const features = await response.json();
                this.features = Array.isArray(features) ? features : [];
            } catch (error) {
                console.error('Feature load error', error);
            } finally {
                this.loading.features = false;
            }
        },
        async fetchModulesGraph() {
            try {
                this.loading.modules = true;
                const response = await fetch('/api/modules/graph');
                const payload = await response.json();
                this.modules = payload.modules || [];
                this.moduleEdges = (payload.edges || []).filter(edge => {
                    return this.modules.some(module => module.id === edge.source) &&
                        this.modules.some(module => module.id === edge.target);
                });
                this.moduleSummary = payload.summary || this.moduleSummary;
                this.ensureCanvas();
            } catch (error) {
                console.error('Module graph error', error);
            } finally {
                this.loading.modules = false;
            }
        },
        async fetchExports() {
            try {
                this.loading.exports = true;
                const response = await fetch('/api/exports');
                const payload = await response.json();
                this.exportsList = payload.files || [];
            } catch (error) {
                console.error('Exports load error', error);
            } finally {
                this.loading.exports = false;
            }
        },
        async fetchStats() {
            try {
                this.loading.stats = true;
                const response = await fetch('/api/stats');
                const payload = await response.json();
                this.stats = payload;
            } catch (error) {
                console.error('Stats load error', error);
            } finally {
                this.loading.stats = false;
            }
        },
        setTheme(theme) {
            this.currentTheme = theme;
            document.documentElement.className = `${theme}-theme`;
            localStorage.setItem('opnix_theme', theme);
        },
        setTab(tab) {
            this.activeTab = tab;
            if (tab === 'canvas') {
                this.$nextTick(() => this.ensureCanvas());
            }
        },
        async executeClaudeCommand() {
            const raw = this.claudeCommand.trim();
            if (!raw) return;
            const command = /--ultrathink/i.test(raw) ? raw : `${raw} --ultrathink`;
            this.addTask('Claude CLI', command, 'processing');
            try {
                const response = await fetch('/api/claude/execute', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ command })
                });
                const payload = await response.json();
                this.claudeLastResponse = payload.result || 'Command executed';
                this.addTask('Claude CLI', this.claudeLastResponse, 'complete');
                if (payload.audit) {
                    this.latestAudit = payload.audit;
                    console.group('Opnix Audit');
                    console.table(payload.audit.project || {});
                    console.table(payload.audit.ticketStats || {});
                    console.groupEnd();
                    this.addTask('Audit', 'Initial audit artefacts generated', 'complete');
                    await Promise.all([
                        this.fetchModulesGraph(),
                        this.fetchExports(),
                        this.fetchStats()
                    ]);
                }
            } catch (error) {
                console.error('Claude command failed', error);
                this.addTask('Claude CLI', 'Execution failed', 'complete');
            }
            this.claudeCommand = '';
        },
        activateAgent(agent) {
            this.agents = this.agents.map(existing => ({
                ...existing,
                status: existing.id === agent.id ? 'active' : 'idle',
                taskCount: existing.id === agent.id ? existing.taskCount + 1 : existing.taskCount
            }));
            fetch('/api/agents/activate', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ agentId: agent.id })
            }).catch(error => console.error('Agent activation error', error));
            this.addTask(agent.name, 'Agent activated', 'complete');
        },
        addTask(agentName, description, status = 'pending') {
            const task = {
                id: Date.now() + Math.random(),
                agent: agentName,
                description,
                status
            };
            this.taskQueue.unshift(task);
            if (this.taskQueue.length > 5) {
                this.taskQueue.pop();
            }
            if (status !== 'complete') {
                setTimeout(() => {
                    task.status = 'complete';
                }, 2000);
            }
        },
        ensureCanvas() {
            const container = document.getElementById('canvas-container');
            if (!container) return;
            if (!this.cy) {
                this.cy = cytoscape({
                    container,
                    elements: [],
                    boxSelectionEnabled: true,
                    style: [
                        {
                            selector: 'node',
                            style: {
                                'background-color': ele => this.getHealthColor(ele.data('health') || 60),
                                'label': 'data(label)',
                                'color': '#FAEBD7',
                                'text-valign': 'center',
                                'text-halign': 'center',
                                'text-wrap': 'wrap',
                                'font-family': 'JetBrains Mono',
                                'font-size': '12px',
                                'width': '140px',
                                'height': '90px',
                                'border-width': 2,
                                'border-color': '#06B6D4',
                                'padding': '10px'
                            }
                        },
                        {
                            selector: 'edge',
                            style: {
                                'curve-style': 'bezier',
                                'target-arrow-shape': 'triangle',
                                'line-color': '#E94560',
                                'target-arrow-color': '#E94560',
                                'width': 2
                            }
                        },
                        {
                            selector: 'node:selected',
                            style: {
                                'background-color': '#FF8C3B',
                                'border-color': '#E94560',
                                'border-width': 4
                            }
                        }
                    ],
                    layout: {
                        name: 'cose',
                        animate: true,
                        animationDuration: 800,
                        nodeRepulsion: 4000,
                        idealEdgeLength: 120
                    },
                    wheelSensitivity: 0.2
                });

                if (this.cy.edgehandles) {
                    this.edgeHandles = this.cy.edgehandles({
                        hoverDelay: 150,
                        handleSize: 10,
                        handleColor: '#FF8C3B',
                        edgeType: (sourceNode, targetNode) => sourceNode.id() === targetNode.id() ? null : 'flat',
                        noEdgeEventsInDraw: true
                    });

                    this.cy.on('ehcomplete', async (event, source, target, addedEdge) => {
                        if (source.id() === target.id()) {
                            addedEdge.remove();
                            return;
                        }
                        await this.persistModuleLink(source.id(), target.id(), addedEdge);
                    });
                }

                this.cy.on('tap', 'node', evt => {
                    const node = evt.target;
                    const module = this.modules.find(item => item.id === node.id());
                    if (module) this.analyzeModule(module);
                });
            }
            this.refreshCanvas();
        },
        refreshCanvas() {
            if (!this.cy) return;
            const elements = [];
            this.modules.forEach(module => {
                const labelLines = [module.name];
                if (typeof module.health === 'number') {
                    labelLines.push(`💚 ${module.health}% health`);
                }
                if (module.pathHints && module.pathHints.length > 0) {
                    labelLines.push(module.pathHints[0]);
                }
                elements.push({
                    data: {
                        id: module.id,
                        label: labelLines.join('\n'),
                        health: module.health || 60,
                        coverage: module.coverage || 0
                    }
                });
            });
            this.moduleEdges.forEach(edge => {
                const edgeId = edge.id || `${edge.source}->${edge.target}`;
                elements.push({
                    data: {
                        id: edgeId,
                        source: edge.source,
                        target: edge.target
                    }
                });
            });
            this.cy.elements().remove();
            this.cy.add(elements);
            this.cy.layout({ name: 'cose', animate: true, animationDuration: 700, nodeRepulsion: 4500, idealEdgeLength: 140 }).run();
        },
        layoutCanvas(type) {
            if (!this.cy) return;
            const layouts = {
                breadthfirst: { name: 'breadthfirst', directed: true, padding: 10, spacingFactor: 1.3 },
                circle: { name: 'circle', radius: 280 },
                cose: { name: 'cose', nodeRepulsion: 4000, idealEdgeLength: 140 }
            };
            const config = layouts[type];
            if (config) {
                this.cy.layout(config).run();
            }
        },
        async detectModules() {
            this.addTask('Backend Architect', 'Scanning project structure', 'processing');
            try {
                const response = await fetch('/api/modules/detect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({}) });
                const payload = await response.json();
                this.modules = payload.modules || [];
                this.moduleEdges = (payload.edges || []).filter(edge => this.modules.some(m => m.id === edge.source) && this.modules.some(m => m.id === edge.target));
                this.moduleSummary = payload.summary || this.moduleSummary;
                this.refreshCanvas();
            } catch (error) {
                console.error('Detect modules failed', error);
            }
        },
        async persistModuleLink(source, target, provisionalEdge) {
            try {
                const response = await fetch('/api/modules/links', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ source, target })
                });
                if (response.status === 201) {
                    this.addTask('Canvas', `Linked ${source} → ${target}`, 'complete');
                    await this.detectModules();
                } else if (response.status === 200) {
                    this.addTask('Canvas', `Link ${source} → ${target} already exists`, 'complete');
                } else {
                    console.error('Failed to persist link', await response.text());
                }
            } catch (error) {
                console.error('Persist link error', error);
            } finally {
                if (provisionalEdge && !provisionalEdge.destroyed()) {
                    provisionalEdge.remove();
                }
            }
        },
        analyzeCanvas() {
            const summary = {
                modules: this.modules.length,
                dependencies: this.moduleEdges.length,
                externalDependencies: this.modules.reduce((sum, module) => sum + (module.externalDependencies ? module.externalDependencies.length : 0), 0)
            };
            console.table(summary);
            this.addTask('Backend Architect', 'Canvas metrics computed', 'complete');
        },
        async exportCanvas() {
            if (!this.cy) return;
            try {
                const png = this.cy.png({ full: true });
                const response = await fetch('/api/canvas/export', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ format: 'png', data: png })
                });
                const payload = await response.json();
                if (payload.success) {
                    this.addTask('Canvas Export', `Saved ${payload.filename}`, 'complete');
                    await this.fetchExports();
                }
            } catch (error) {
                console.error('Canvas export failed', error);
            }
        },
        async addBug() {
            if (!this.newBug.title.trim()) return;
            try {
                const tags = normalizeTagInput(this.newBug.tagsText);
                const response = await fetch('/api/tickets', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: this.newBug.title,
                        description: this.newBug.description,
                        priority: this.newBug.priority,
                        status: 'reported',
                        modules: this.newBug.modules,
                        tags
                    })
                });
                const payload = await response.json();
                this.tickets.push(payload);
                this.showBugModal = false;
                this.newBug = { title: '', description: '', priority: 'medium', modules: [], tagsText: '' };
                this.addTask('Bug Tracker', `Ticket #${payload.id} recorded`, 'complete');
            } catch (error) {
                console.error('Create bug failed', error);
            }
        },
        async addFeature() {
            if (!this.newFeature.title.trim()) return;
            try {
                const criteria = this.newFeature.criteriaText
                    .split('\n')
                    .map(line => line.trim().replace(/^[-*]\s*/, ''))
                    .filter(Boolean);
                const response = await fetch('/api/features', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        title: this.newFeature.title,
                        description: this.newFeature.description,
                        moduleId: this.newFeature.moduleId,
                        priority: this.newFeature.priority,
                        acceptanceCriteria: criteria
                    })
                });
                const payload = await response.json();
                this.features.push(payload);
                this.showFeatureModal = false;
                this.newFeature = { title: '', description: '', moduleId: '', priority: 'medium', criteriaText: '' };
                this.addTask('Feature Manager', `Feature ${payload.title} created`, 'complete');
            } catch (error) {
                console.error('Create feature failed', error);
            }
        },
        async addModule() {
            if (!this.newModule.name.trim()) return;
            try {
                const dependencies = this.newModule.depsString
                    .split(',')
                    .map(dep => dep.trim())
                    .filter(Boolean);
                const response = await fetch('/api/modules', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        id: this.newModule.id || undefined,
                        name: this.newModule.name,
                        path: this.newModule.path || undefined,
                        dependencies,
                        type: this.newModule.type
                    })
                });
                await response.json();
                this.showAddModuleModal = false;
                this.newModule = { name: '', id: '', path: '', depsString: '', type: 'custom' };
                await this.fetchModulesGraph();
                this.addTask('Module Manager', 'Module catalog updated', 'complete');
            } catch (error) {
                console.error('Add module failed', error);
            }
        },
        analyzeModule(module) {
            const relatedFeatures = this.features.filter(feature => feature.moduleId === module.id);
            const relatedTickets = this.tickets.filter(ticket => (ticket.modules || []).includes(module.id));
            console.table({
                module: module.name,
                features: relatedFeatures.length,
                tickets: relatedTickets.length,
                coverage: module.coverage
            });
            this.addTask('AI Engineer', `Analyzed ${module.name}`, 'complete');
        },
        analyzeModuleDependencies() {
            const dependencyMap = this.moduleEdges.reduce((acc, edge) => {
                acc[edge.source] = acc[edge.source] || [];
                acc[edge.source].push(edge.target);
                return acc;
            }, {});
            console.table(dependencyMap);
            this.addTask('Backend Architect', 'Dependency map calculated', 'complete');
        },
        getModuleBugCount(moduleId) {
            return this.tickets.filter(ticket => (ticket.modules || []).includes(moduleId)).length;
        },
        getModuleFeatureCount(moduleId) {
            return this.features.filter(feature => feature.moduleId === moduleId).length;
        },
        getModuleName(moduleId) {
            const module = this.moduleLookup[moduleId];
            return module ? module.name : 'Unknown';
        },
        getHealthColor(health) {
            if (health >= 80) return '#10B981';
            if (health >= 60) return '#F59E0B';
            return '#EF4444';
        },
        getFeatureStatusColor(status) {
            const colors = {
                proposed: '#8B5CF6',
                approved: '#06B6D4',
                'in-development': '#F59E0B',
                testing: '#EC4899',
                deployed: '#10B981'
            };
            return colors[status] || '#7B8AA8';
        },
        toggleModule(moduleId) {
            const index = this.selectedModules.indexOf(moduleId);
            if (index > -1) {
                this.selectedModules.splice(index, 1);
            } else {
                this.selectedModules.push(moduleId);
            }
        },
        formatDate(dateString) {
            try {
                return new Date(dateString).toLocaleDateString();
            } catch {
                return dateString;
            }
        },
        statusLabel(value) {
            const map = {
                reported: 'Reported',
                in_progress: 'In Progress',
                finished: 'Finished'
            };
            if (map[value]) return map[value];
            return value
                .replace(/_/g, ' ')
                .replace(/\b\w/g, char => char.toUpperCase());
        },
        async onTicketStatusChange(ticket, event) {
            const nextStatus = event.target.value;
            if (!nextStatus || nextStatus === ticket.status) {
                event.target.value = ticket.status;
                return;
            }

            if (nextStatus === 'finished') {
                this.ticketBeingUpdated = ticket;
                this.ticketStatusElement = event.target;
                this.ticketCompletionSummary = ticket.completionSummary || '';
                this.ticketCompletionError = '';
                this.showTicketCompletionModal = true;
                return;
            }

            try {
                await this.persistTicketUpdate(ticket, { status: nextStatus }, event.target);
            } catch {
                // Error handled inside persistTicketUpdate
            }
        },
        async persistTicketUpdate(ticket, payload, selectEl) {
            try {
                const response = await fetch(`/api/tickets/${ticket.id}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(payload)
                });

                if (!response.ok) {
                    throw new Error(`Ticket update failed with status ${response.status}`);
                }

                const updated = await response.json();
                const index = this.tickets.findIndex(item => item.id === updated.id);
                if (index !== -1) {
                    this.tickets.splice(index, 1, updated);
                }
                await this.fetchStats();
                this.addTask('Bug Tracker', `Ticket #${updated.id} updated`, 'complete');
                return updated;
            } catch (error) {
                console.error('Persist ticket update failed', error);
                if (selectEl) {
                    selectEl.value = ticket.status;
                }
                throw error;
            }
        },
        cancelTicketCompletion() {
            if (this.ticketStatusElement && this.ticketBeingUpdated) {
                this.ticketStatusElement.value = this.ticketBeingUpdated.status;
            }
            this.showTicketCompletionModal = false;
            this.ticketBeingUpdated = null;
            this.ticketStatusElement = null;
            this.ticketCompletionSummary = '';
            this.ticketCompletionError = '';
        },
        async confirmTicketCompletion() {
            if (!this.ticketBeingUpdated) {
                this.showTicketCompletionModal = false;
                return;
            }

            if (!this.ticketCompletionSummary || !this.ticketCompletionSummary.trim()) {
                this.ticketCompletionError = 'Completion summary is required.';
                return;
            }

            try {
                await this.persistTicketUpdate(this.ticketBeingUpdated, {
                    status: 'finished',
                    completionSummary: this.ticketCompletionSummary.trim()
                }, this.ticketStatusElement);
                this.showTicketCompletionModal = false;
                this.ticketCompletionSummary = '';
                this.ticketCompletionError = '';
                this.ticketBeingUpdated = null;
                this.ticketStatusElement = null;
            } catch (error) {
                this.ticketCompletionError = 'Unable to update ticket. Check console for details.';
            }
        },
        async exportBugs() {
            try {
                const response = await fetch('/api/export/markdown');
                const content = await response.text();
                const blob = new Blob([content], { type: 'text/markdown' });
                const link = document.createElement('a');
                link.href = URL.createObjectURL(blob);
                link.download = 'opnix-tickets.md';
                link.click();
                URL.revokeObjectURL(link.href);
            } catch (error) {
                console.error('Export bugs failed', error);
            }
        },
        generateAPISpec() {
            const endpoints = [
                { path: '/api/health', method: 'GET' },
                { path: '/api/tickets', method: 'GET' },
                { path: '/api/tickets', method: 'POST' },
                { path: '/api/tickets/:id', method: 'PUT' },
                { path: '/api/tickets/:id', method: 'DELETE' },
                { path: '/api/features', method: 'GET' },
                { path: '/api/features', method: 'POST' },
                { path: '/api/modules', method: 'GET' },
                { path: '/api/modules/detect', method: 'POST' },
                { path: '/api/modules/graph', method: 'GET' },
                { path: '/api/modules/links', method: 'POST' },
                { path: '/api/modules/links', method: 'DELETE' },
                { path: '/api/canvas/export', method: 'POST' },
                { path: '/api/specs/generate', method: 'POST' },
                { path: '/api/exports', method: 'GET' },
                { path: '/api/exports/:filename', method: 'GET' }
            ];

            const specBuilders = {
                openapi: () => ({
                    openapi: '3.0.0',
                    info: { title: 'Opnix API', version: '1.0.0' },
                    paths: endpoints.reduce((acc, endpoint) => {
                        const pathKey = endpoint.path;
                        acc[pathKey] = acc[pathKey] || {};
                        acc[pathKey][endpoint.method.toLowerCase()] = {
                            summary: `${endpoint.method} ${endpoint.path}`,
                            responses: { '200': { description: 'Success' } }
                        };
                        return acc;
                    }, {})
                }),
                custom: () => ({
                    api: 'Opnix/v1.0',
                    baseUrl: '/api',
                    endpoints
                }),
                json: () => ({
                    $schema: 'http://json-schema.org/draft-07/schema#',
                    endpoints
                })
            };

            const builder = specBuilders[this.apiFormat] || specBuilders.openapi;
            this.apiSpecPayload = builder();
            this.apiSpecContent = JSON.stringify(this.apiSpecPayload, null, 2);
            this.addTask('API Generator', 'API spec generated', 'complete');
        },
        async exportAPISpec() {
            if (!this.apiSpecPayload) {
                this.generateAPISpec();
            }
            try {
                const response = await fetch('/api/specs/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spec: this.apiSpecPayload, format: 'json' })
                });
                const payload = await response.json();
                if (payload.success) {
                    this.addTask('API Generator', `Spec saved as ${payload.filename}`, 'complete');
                    await this.fetchExports();
                }
            } catch (error) {
                console.error('Export API spec failed', error);
            }
        },
        async testAPI() {
            const healthResponse = await fetch('/api/health').then(res => res.ok).catch(() => false);
            const ticketsResponse = await fetch('/api/tickets').then(res => res.ok).catch(() => false);
            console.table({ healthResponse, ticketsResponse });
            this.addTask('API Tester', 'Smoke tests executed', 'complete');
        },
        generateDocs() {
            const moduleSummaryMarkup = this.modules.map(module => {
                const deps = module.dependencies && module.dependencies.length ? module.dependencies.join(', ') : 'None';
                const externals = module.externalDependencies && module.externalDependencies.length ? module.externalDependencies.join(', ') : 'None';
                return `
                    <h4>${module.name}</h4>
                    <p>Health: ${module.health || 'n/a'}%</p>
                    <p>Coverage: ${module.coverage || 0}%</p>
                    <p>Dependencies: ${deps}</p>
                    <p>External: ${externals}</p>
                `;
            }).join('');

            const templates = {
                overview: `<h3>Opnix Statistics</h3>
                    <ul>
                        <li>Total Tickets: ${this.tickets.length}</li>
                        <li>Total Features: ${this.features.length}</li>
                        <li>Modules Discovered: ${this.modules.length}</li>
                        <li>Dependencies: ${this.moduleEdges.length}</li>
                    </ul>`,
                modules: `<h3>Module Documentation</h3>${moduleSummaryMarkup}`,
                api: `<h3>API Documentation</h3>
                    <pre>${this.apiSpecContent || 'Generate API spec first'}</pre>`,
                features: `<h3>Feature Specifications</h3>
                    ${this.features.map(feature => `
                        <h4>${feature.title}</h4>
                        <p>${feature.description}</p>
                        <p><strong>Status:</strong> ${feature.status || 'proposed'}</p>
                        <p><strong>Module:</strong> ${this.getModuleName(feature.moduleId)}</p>
                    `).join('')}`
            };

            this.generatedDocs = templates[this.docType];
            this.docTitle = this.docType.charAt(0).toUpperCase() + this.docType.slice(1) + ' Documentation';
            this.addTask('Documentation Expert', 'Documentation generated', 'complete');
        },
        exportDocs() {
            const text = this.generatedDocs.replace(/<[^>]+>/g, '');
            const blob = new Blob([text], { type: 'text/markdown' });
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = 'opnix-docs.md';
            link.click();
            URL.revokeObjectURL(link.href);
        },
        generateFromModules() {
            let diagram = 'graph TD\n';
            this.modules.forEach(module => {
                diagram += `    ${module.id.replace(/[^a-zA-Z0-9_]/g, '_')}[${module.name}]\n`;
            });
            diagram += '\n';
            this.moduleEdges.forEach(edge => {
                diagram += `    ${edge.source.replace(/[^a-zA-Z0-9_]/g, '_')} --> ${edge.target.replace(/[^a-zA-Z0-9_]/g, '_')}\n`;
            });
            this.mermaidCode = diagram;
            this.renderMermaid();
        },
        renderMermaid() {
            const element = document.getElementById('mermaid-output');
            if (!element) return;
            element.innerHTML = '';
            element.removeAttribute('data-processed');
            mermaid.render(`mermaid-${Date.now()}`, this.mermaidCode)
                .then(result => {
                    element.innerHTML = result.svg;
                })
                .catch(error => {
                    element.innerHTML = `<p style="color: var(--danger);">${error.message}</p>`;
                });
        },
        processAnswer(question) {
            if (!question || !question.id) return;
            this.questionAnswers[question.id] = question.answer;

            if (question.id === 'project-type' && question.answer) {
                this.extendSectionsForProjectType(question.answer);
            }

            if (question.id === 'primary-language' && question.answer) {
                this.updateFrameworkOptions(question.answer);
            }

            if (question.id === 'preferred-framework' && question.answer) {
                this.extendSectionsForFramework(question.answer);
            }

            this.advanceSectionIfComplete(question.sectionId);
        },
        collectAnswers() {
            const answers = {};
            Object.entries(this.questionAnswers).forEach(([key, value]) => {
                if (value !== undefined && value !== null && String(value).trim().length > 0) {
                    answers[key] = value;
                }
            });
            return answers;
        },
        buildSpecPayload() {
            const answers = this.collectAnswers();
            return {
                generatedAt: new Date().toISOString(),
                questionAnswers: answers,
                project: {
                    name: answers['project-name'] || 'Untitled Project',
                    type: answers['project-type'] || 'Unknown',
                    goal: answers['project-purpose'] || answers['value-proposition'] || ''
                },
                technical: {
                    language: answers['primary-language'] || null,
                    framework: answers['preferred-framework'] || null,
                    stack: answers['supporting-libraries'] || null,
                    architecture: {
                        current: answers['current-architecture'] || null,
                        target: answers['target-architecture-vision'] || null,
                        dataStores: answers['data-sources'] || null,
                        integrations: answers['integration-providers'] || answers['integration-consumers'] || null,
                        testingStrategy: answers['testing-strategy'] || null,
                        observability: answers['observability-tooling'] || null
                    }
                },
                modules: this.modules,
                canvas: {
                    edges: this.moduleEdges,
                    summary: this.moduleSummary
                },
                features: this.features,
                tickets: this.tickets
            };
        },
        async generateSpec() {
            const spec = this.buildSpecPayload();
            this.latestSpecPayload = spec;
            this.generatedSpec = JSON.stringify(spec, null, 2);
            try {
                const format = this.specExportFormat === 'github' ? 'github-spec-kit' : this.specExportFormat;
                const response = await fetch('/api/specs/generate', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ spec, format })
                });
                const payload = await response.json();
                if (payload.success) {
                    this.latestSpecMeta = payload;
                    this.addTask('Spec Builder', `Spec saved as ${payload.filename}`, 'complete');
                    await this.fetchExports();
                }
            } catch (error) {
                console.error('Generate spec failed', error);
            }
        }
    },
    mounted() {
        const savedTheme = localStorage.getItem('opnix_theme') || 'mole';
        this.setTheme(savedTheme);
        this.bootstrap();
    }
}).mount('#app');
