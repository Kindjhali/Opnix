import cytoscape from 'cytoscape';
import cytoscapeEdgehandles from 'cytoscape-edgehandles';

import { useAppStore, useAppStoreComputed } from './composables/appStore.js';

import {
    getCanvasProps,
    getTicketsProps,
    getFeaturesProps,
    getModulesProps,
    getRoadmapProps,
    getSpecsProps,
    getDiagramsProps,
    getApiProps,
    getStorybookProps,
    getDocsProps,
    getTechStackProps
} from './composables/tabProps.js';

import createDocsBloc from './blocs/docsBloc.js';
import createFeaturesBloc from './blocs/featuresBloc.js';
import createTicketsBloc from './blocs/ticketsBloc.js';
import createModulesBloc from './blocs/modulesBloc.js';
import createApiBloc from './blocs/apiBloc.js';
import createStorybookBloc from './blocs/storybookBloc.js';
import createThemeBloc from './blocs/themeBloc.js';
import createCliBloc from './blocs/cliBloc.js';
import createDataBloc from './blocs/dataBloc.js';
import createModalsBloc from './blocs/modalsBloc.js';
import createSpecBloc from './blocs/specBloc.js';
import createInterviewBloc from './blocs/interviewBloc.js';
import createDiagramsBloc from './blocs/diagramsBloc.js';
import createNavigationBloc from './blocs/navigationBloc.js';
import createFormattingBloc from './blocs/formattingBloc.js';
import createBootstrapBloc from './blocs/bootstrapBloc.js';
import createRoadmapBloc from './blocs/roadmapBloc.js';
import createRoadmapSupportBloc from './blocs/roadmapSupportBloc.js';
import createTechStackBloc from './blocs/techStackBloc.js';

cytoscape.use(cytoscapeEdgehandles);

const appStore = useAppStore();
const appStoreComputed = useAppStoreComputed();
const docsBloc = createDocsBloc();
const featuresBloc = createFeaturesBloc();
const ticketsBloc = createTicketsBloc();
const modulesBloc = createModulesBloc();
const apiBloc = createApiBloc();
const storybookBloc = createStorybookBloc();
const themeBloc = createThemeBloc();
const cliBloc = createCliBloc(appStore);

const agentCategoryIcons = {
    development: '⚙️',
    'data-ai': '🧠',
    infrastructure: '🏗️',
    security: '🛡️',
    'quality-testing': '🧪',
    specialization: '🎯',
    general: '🤖'
};

const dataBloc = createDataBloc(appStore, { agentIconMap: agentCategoryIcons });
const modalsBloc = createModalsBloc();
const specBloc = createSpecBloc();
const interviewBloc = createInterviewBloc();
const diagramsBloc = createDiagramsBloc();
const navigationBloc = createNavigationBloc();
const formattingBloc = createFormattingBloc();
const bootstrapBloc = createBootstrapBloc();
const roadmapBloc = createRoadmapBloc();
const roadmapSupportBloc = createRoadmapSupportBloc();
const techStackBloc = createTechStackBloc();

export default {
    data() {
        return appStore;
    },

    computed: {
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
            return appStoreComputed.ticketProgress.value;
        },
        canvasProps() {
            return getCanvasProps(this);
        },
        ticketsProps() {
            return getTicketsProps(this);
        },
        featuresProps() {
            return getFeaturesProps(this);
        },
        modulesProps() {
            return getModulesProps(this);
        },
        roadmapProps() {
            return getRoadmapProps(this);
        },
        specsProps() {
            return getSpecsProps(this);
        },
        diagramsProps() {
            return getDiagramsProps(this);
        },
        apiProps() {
            return getApiProps(this);
        },
        storybookProps() {
            return getStorybookProps(this);
        },
        docsProps() {
            return getDocsProps(this);
        },
        techStackProps() {
            return getTechStackProps(this);
        }
    },
    methods: {
        ...docsBloc,
        ...bootstrapBloc,
        ...featuresBloc,
        ...modulesBloc,
        ...apiBloc,
        ...storybookBloc,
        ...themeBloc,
        ...ticketsBloc,
        ...cliBloc,
        ...dataBloc,
        ...modalsBloc,
        ...specBloc,
        ...interviewBloc,
        ...diagramsBloc,
        ...navigationBloc,
        ...formattingBloc,
        ...roadmapSupportBloc,
        ...roadmapBloc,
        ...techStackBloc,

        // Bulk operations methods
        async refreshTickets() {
            await this.fetchTickets();
        },
        async refreshFeatures() {
            await this.fetchFeatures();
        },
        handleBulkExport(data) {
            // Handle bulk export for selected items
            const { type, items } = data;
            const exportData = {
                type,
                items,
                exportedAt: new Date().toISOString(),
                count: items.length
            };

            const dataStr = JSON.stringify(exportData, null, 2);
            const blob = new Blob([dataStr], { type: 'application/json' });
            const url = URL.createObjectURL(blob);

            const link = document.createElement('a');
            link.href = url;
            link.download = `${type}-bulk-export-${new Date().toISOString().split('T')[0]}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(url);

            console.log(`✓ Exported ${items.length} ${type}`);
        }

    },
    mounted() {
        this.bootstrapTheme({ fallback: 'mole' });
        this.bootstrap();
        this.cliSessionsRefreshHandle = setInterval(() => {
            if (this.activeTab === 'specs') {
                this.fetchCliSessions();
            }
        }, 20000);
        this.branchStatusRefreshHandle = setInterval(() => {
            this.refreshBranchStatus();
        }, 60000);
        this.contextStatusRefreshHandle = setInterval(() => {
            this.refreshContextStatus();
        }, 45000);
    },
    beforeUnmount() {
        if (this.cliSessionsRefreshHandle) {
            clearInterval(this.cliSessionsRefreshHandle);
            this.cliSessionsRefreshHandle = null;
        }
        if (this.branchStatusRefreshHandle) {
            clearInterval(this.branchStatusRefreshHandle);
            this.branchStatusRefreshHandle = null;
        }
        if (this.contextStatusRefreshHandle) {
            clearInterval(this.contextStatusRefreshHandle);
            this.contextStatusRefreshHandle = null;
        }
        if (this.roadmapRefreshHandle) {
            clearTimeout(this.roadmapRefreshHandle);
            this.roadmapRefreshHandle = null;
        }
    }
};
