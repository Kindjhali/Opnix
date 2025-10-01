const express = require('express');

const ULTRATHINK_MODES = new Set(['default', 'max', 'api']);

function createContextRoutes({ logger = console, contextLimit = 160000, initialState = {} } = {}) {
    const state = {
        contextUsed: typeof initialState.contextUsed === 'number' ? initialState.contextUsed : 0,
        currentTask: typeof initialState.currentTask === 'string' ? initialState.currentTask : 'System Ready',
        filesEdited: typeof initialState.filesEdited === 'number' ? initialState.filesEdited : 0,
        daicState: typeof initialState.daicState === 'string' ? initialState.daicState : 'Discussion',
        ultraThinkMode: typeof initialState.ultraThinkMode === 'string' ? initialState.ultraThinkMode : 'api',
        contextLimit: typeof contextLimit === 'number' && contextLimit > 0 ? contextLimit : 160000
    };

    const router = express.Router();

    function logError(scope, error) {
        if (logger && typeof logger.error === 'function') {
            logger.error(`[context:${scope}]`, error);
        } else {
            console.error(`[context:${scope}]`, error);
        }
    }

    function getContextTelemetry() {
        return {
            contextUsed: state.contextUsed,
            contextLimit: state.contextLimit,
            currentTask: state.currentTask,
            filesEdited: state.filesEdited,
            daicState: state.daicState,
            ultraThinkMode: state.ultraThinkMode
        };
    }

    function buildStatusPayload() {
        const ratio = state.contextLimit > 0 ? state.contextUsed / state.contextLimit : 0;
        const percentage = Math.min(100, Math.max(0, ratio * 100));
        const remaining = Math.max(0, state.contextLimit - state.contextUsed);

        const filledChars = Math.floor(percentage / 10);
        const emptyChars = 10 - filledChars;
        const visualBar = '█'.repeat(filledChars) + '░'.repeat(emptyChars);

        let colorClass = 'context-green';
        if (percentage >= 80) {
            colorClass = 'context-red';
        } else if (percentage >= 50) {
            colorClass = 'context-orange';
        }

        return {
            contextUsed: state.contextUsed,
            contextLimit: state.contextLimit,
            percentage: Math.round(percentage * 10) / 10,
            remaining,
            visualBar,
            colorClass,
            displayText: `${visualBar} ${percentage.toFixed(1)}% (${Math.round(state.contextUsed / 1000)}k/${Math.round(state.contextLimit / 1000)}k)`,
            currentTask: state.currentTask,
            filesEdited: state.filesEdited,
            daicState: state.daicState,
            warning: percentage >= 75 ? (percentage >= 90 ? 'CRITICAL: Wrap up immediately!' : 'WARNING: Start wrapping up') : null
        };
    }

    function ultraThinkTriggerRoute(req, res) {
        try {
            const { message, mode } = req.body || {};
            const hasUltraThink = typeof message === 'string' && message.includes('[[ ultrathink ]]');
            const activeMode = typeof mode === 'string' && ULTRATHINK_MODES.has(mode) ? mode : state.ultraThinkMode;

            let thinkingBudget = 0;
            switch (activeMode) {
                case 'default':
                    thinkingBudget = hasUltraThink ? 31999 : 10000;
                    break;
                case 'max':
                    thinkingBudget = 31999;
                    break;
                case 'api':
                    thinkingBudget = hasUltraThink ? 31999 : 0;
                    break;
                default:
                    thinkingBudget = hasUltraThink ? 31999 : 0;
                    break;
            }

            res.json({
                ultrathink: Boolean(hasUltraThink),
                thinkingBudget,
                mode: activeMode,
                message: hasUltraThink ? 'UltraThink activated - deep analysis enabled' : 'Normal processing'
            });
        } catch (error) {
            logError('trigger', error);
            res.status(500).json({ error: 'UltraThink trigger failed' });
        }
    }

    function contextStatusRoute(_req, res) {
        try {
            res.json(buildStatusPayload());
        } catch (error) {
            logError('status', error);
            res.status(500).json({ error: 'Context status failed' });
        }
    }

    function contextUpdateRoute(req, res) {
        try {
            const { contextUsed, task, filesEdited, daicState } = req.body || {};

            if (typeof contextUsed === 'number') {
                state.contextUsed = Math.max(0, contextUsed);
            }
            if (typeof task === 'string') {
                state.currentTask = task;
            }
            if (typeof filesEdited === 'number') {
                state.filesEdited = Math.max(0, filesEdited);
            }
            if (typeof daicState === 'string' && ['Discussion', 'Implementation'].includes(daicState)) {
                state.daicState = daicState;
            }

            res.json({
                success: true,
                contextUsed: state.contextUsed,
                currentTask: state.currentTask,
                filesEdited: state.filesEdited,
                daicState: state.daicState
            });
        } catch (error) {
            logError('update', error);
            res.status(500).json({ error: 'Context update failed' });
        }
    }

    function ultraThinkModeRoute(req, res) {
        try {
            const { mode } = req.body || {};
            if (typeof mode === 'string' && ULTRATHINK_MODES.has(mode)) {
                state.ultraThinkMode = mode;
                res.json({ success: true, mode: state.ultraThinkMode });
            } else {
                res.status(400).json({ error: 'Invalid mode. Use: default, max, or api' });
            }
        } catch (error) {
            logError('mode', error);
            res.status(500).json({ error: 'UltraThink mode change failed' });
        }
    }

    router.post('/api/ultrathink/trigger', ultraThinkTriggerRoute);
    router.get('/api/context/status', contextStatusRoute);
    router.post('/api/context/update', contextUpdateRoute);
    router.post('/api/ultrathink/mode', ultraThinkModeRoute);

    return {
        router,
        getContextTelemetry,
        ultraThinkTriggerRoute,
        contextStatusRoute,
        contextUpdateRoute,
        ultraThinkModeRoute
    };
}

module.exports = {
    createContextRoutes
};
