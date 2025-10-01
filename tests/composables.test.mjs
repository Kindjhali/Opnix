/* eslint-env node */
import { test } from 'node:test';
import assert from 'node:assert';
// Mock Vue's reactive and ref for testing
const reactive = (obj) => obj;
const ref = (value) => ({ value });

// Mock global Vue functions for Node.js environment
globalThis.reactive = reactive;
globalThis.ref = ref;

test('appStore composable', async (t) => {
    // Mock fetch for testing
    globalThis.fetch = async (url) => {
        if (url.includes('/api/agents')) {
            return { ok: true, json: async () => [] };
        }
        if (url.includes('/api/tickets')) {
            return { ok: true, json: async () => [] };
        }
        if (url.includes('/api/features')) {
            return { ok: true, json: async () => [] };
        }
        return { ok: false };
    };

    const { useAppStore } = await import('../src/composables/appStore.js');

    await t.test('creates store with default state', () => {
        const store = useAppStore();

        assert.strictEqual(typeof store, 'object');
        assert.strictEqual(store.activeTab, 'canvas');
        assert.strictEqual(Array.isArray(store.agents), true);
        assert.strictEqual(Array.isArray(store.tickets), true);
        assert.strictEqual(Array.isArray(store.features), true);
        assert.strictEqual(store.theme, 'mole');
    });

    await t.test('store is singleton', () => {
        const store1 = useAppStore();
        const store2 = useAppStore();

        assert.strictEqual(store1, store2);
    });
});

test('ticketManager composable', async (t) => {
    // Mock API client (defined but not used in this test)
    // const mockApiClient = {
    //     updateTicket: async (id, data) => ({ ...mockStore.tickets.find(t => t.id === id), ...data }),
    //     deleteTicket: async (id) => ({ success: true })
    // };

    const { ticketStatusHelpers, ticketDateHelpers } = await import('../src/composables/ticketManager.js');

    await t.test('ticket status helpers work correctly', () => {
        assert.strictEqual(ticketStatusHelpers.isReported({ status: 'reported' }), true);
        assert.strictEqual(ticketStatusHelpers.isReported({ status: 'inProgress' }), false);

        assert.strictEqual(ticketStatusHelpers.isInProgress({ status: 'inProgress' }), true);
        assert.strictEqual(ticketStatusHelpers.isInProgress({ status: 'reported' }), false);

        assert.strictEqual(ticketStatusHelpers.isFinished({ status: 'finished' }), true);
        assert.strictEqual(ticketStatusHelpers.isFinished({ status: 'reported' }), false);
    });

    await t.test('ticket date helpers work correctly', () => {
        const now = new Date().toISOString();
        const ticket = { created: now, updated: now };

        const formatted = ticketDateHelpers.formatCreatedDate(ticket);
        assert.strictEqual(typeof formatted, 'string');
        assert.ok(formatted.length > 0);

        const timeAgo = ticketDateHelpers.timeAgo(ticket.created);
        assert.strictEqual(typeof timeAgo, 'string');
        assert.ok(timeAgo.includes('ago') || timeAgo.includes('just now'));
    });
});

test('terminalManager composable', async (t) => {
    const { contextHelpers, terminalHelpers } = await import('../src/composables/terminalManager.js');

    await t.test('context usage calculations work', () => {
        const percentage = contextHelpers.getContextPercentage.call({ store: { contextUsage: 50000, contextLimit: 100000 } });
        assert.strictEqual(percentage, 50);

        const color = contextHelpers.getContextColor.call({ store: { contextUsage: 95000, contextLimit: 100000 } });
        assert.strictEqual(color, 'danger');

        const normalColor = contextHelpers.getContextColor.call({ store: { contextUsage: 30000, contextLimit: 100000 } });
        assert.strictEqual(normalColor, 'info');
    });

    await t.test('terminal helpers format commands correctly', () => {
        const command = {
            command: 'ls -la',
            stdout: 'file1.txt\nfile2.txt',
            exitCode: 0,
            ranAt: new Date().toISOString()
        };

        const formatted = terminalHelpers.formatCommand(command);
        assert.strictEqual(typeof formatted, 'object');
        assert.ok(formatted.displayCommand);
        assert.ok(formatted.formattedTime);
    });
});

test('moduleManager composable', async (t) => {
    const { moduleHelpers } = await import('../src/composables/moduleManager.js');

    await t.test('module color helpers work correctly', () => {
        const highHealthModule = { health: 85 };
        const mediumHealthModule = { health: 65 };
        const lowHealthModule = { health: 35 };

        assert.strictEqual(moduleHelpers.getHealthColor(highHealthModule), 'success');
        assert.strictEqual(moduleHelpers.getHealthColor(mediumHealthModule), 'warning');
        assert.strictEqual(moduleHelpers.getHealthColor(lowHealthModule), 'danger');
    });

    await t.test('module analytics work correctly', () => {
        const module = { health: 85, coverage: 75, fileCount: 50, lineCount: 2500 };
        const analytics = moduleHelpers.getModuleAnalytics(module);

        assert.strictEqual(typeof analytics, 'object');
        assert.strictEqual(analytics.health, 85);
        assert.strictEqual(analytics.coverage, 75);
        assert.ok(analytics.averageFileSize > 0);
    });
});

test('modalManager composable', async (t) => {
    const mockStore = {
        showBugModal: false,
        showFeatureModal: false,
        showModuleModal: false,
        bugDraft: {},
        featureDraft: {},
        moduleDraft: {}
    };

    const { modalStateHelpers } = await import('../src/composables/modalManager.js');

    await t.test('modal state helpers work correctly', () => {
        assert.strictEqual(modalStateHelpers.isAnyModalOpen.call({ store: mockStore }), false);

        const storeWithModal = { ...mockStore, showBugModal: true };
        assert.strictEqual(modalStateHelpers.isAnyModalOpen.call({ store: storeWithModal }), true);

        const modalTypes = modalStateHelpers.getOpenModalTypes.call({ store: storeWithModal });
        assert.ok(modalTypes.includes('bug'));
    });
});

test('dataBootstrap composable', async (t) => {
    // Mock successful API responses
    globalThis.fetch = async (url) => {
        const responses = {
            '/api/agents': { ok: true, json: async () => [{ id: 'test-agent', name: 'Test Agent' }] },
            '/api/tickets': { ok: true, json: async () => [{ id: 1, title: 'Test Ticket' }] },
            '/api/features': { ok: true, json: async () => [{ id: 1, title: 'Test Feature' }] },
            '/api/exports': { ok: true, json: async () => [{ type: 'markdown', path: 'test.md' }] },
            '/api/stats': { ok: true, json: async () => ({ total: 1, open: 1 }) }
        };

        const response = responses[url] || { ok: false };
        return response;
    };

    const { bootstrapHelpers } = await import('../src/composables/dataBootstrap.js');

    await t.test('bootstrap helpers validate data correctly', () => {
        const validAgents = [{ id: 'agent1', name: 'Agent 1' }];
        const invalidAgents = [{ name: 'Missing ID' }];

        assert.strictEqual(bootstrapHelpers.validateAgents(validAgents), true);
        assert.strictEqual(bootstrapHelpers.validateAgents(invalidAgents), false);

        const validTickets = [{ id: 1, title: 'Ticket 1', status: 'reported' }];
        const invalidTickets = [{ id: 1 }]; // missing required fields

        assert.strictEqual(bootstrapHelpers.validateTickets(validTickets), true);
        assert.strictEqual(bootstrapHelpers.validateTickets(invalidTickets), false);
    });
});

test('markdownUtils composable', async (t) => {
    const { markdownHelpers } = await import('../src/composables/markdownUtils.js');

    await t.test('markdown strip functions work correctly', () => {
        const markdown = '# Title\n\nSome **bold** text with [link](url)';
        const stripped = markdownHelpers.stripMarkdown(markdown);

        assert.strictEqual(stripped.includes('#'), false);
        assert.strictEqual(stripped.includes('**'), false);
        assert.strictEqual(stripped.includes('['), false);
        assert.ok(stripped.includes('Title'));
        assert.ok(stripped.includes('bold'));
    });

    await t.test('download helpers format correctly', () => {
        const content = 'Test content';
        const filename = 'test.md';

        const downloadData = markdownHelpers.prepareDownload(content, filename);
        assert.strictEqual(typeof downloadData, 'object');
        assert.ok(downloadData.blob);
        assert.strictEqual(downloadData.filename, filename);
    });
});