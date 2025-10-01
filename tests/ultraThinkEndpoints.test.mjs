import assert from 'node:assert/strict';
import {
  ultraThinkTriggerRoute,
  ultraThinkModeRoute,
  contextStatusRoute,
  contextUpdateRoute
} from '../server.js';

function invokeRoute(handler, { method = 'GET', body = {}, query = {} } = {}) {
  return new Promise((resolve, reject) => {
    const req = {
      method: method.toUpperCase(),
      body,
      query,
      headers: {},
      get(name) {
        return this.headers[String(name).toLowerCase()] || undefined;
      }
    };

    const res = {
      statusCode: 200,
      headers: {},
      status(code) {
        this.statusCode = code;
        return this;
      },
      set(field, value) {
        this.headers[field.toLowerCase()] = value;
        return this;
      },
      json(payload) {
        resolve({ statusCode: this.statusCode || 200, payload });
      }
    };

    Promise.resolve(handler(req, res)).catch(reject);
  });
}

(async () => {
  // Ensure baseline mode for predictable assertions
  await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'api' } });

  const triggerManual = await invokeRoute(ultraThinkTriggerRoute, {
    method: 'post',
    body: { message: 'Run [[ ultrathink ]] analysis', mode: 'api' }
  });

  assert.equal(triggerManual.statusCode, 200, 'manual trigger should respond 200');
  assert.equal(triggerManual.payload.ultrathink, true, '[[ ultrathink ]] keyword should activate flag');
  assert.equal(triggerManual.payload.thinkingBudget, 31999, 'API mode should allow full thinking budget on manual trigger');

  const setDefaultMode = await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'default' } });
  assert.equal(setDefaultMode.payload.mode, 'default', 'mode should switch to default');

  const triggerDefault = await invokeRoute(ultraThinkTriggerRoute, {
    method: 'post',
    body: { message: 'standard request' }
  });
  assert(triggerDefault.payload.thinkingBudget >= 10000, 'default mode should grant baseline thinking budget');

  await invokeRoute(contextUpdateRoute, {
    method: 'post',
    body: {
      contextUsed: 90000,
      task: 'Installer Validation',
      filesEdited: 7,
      daicState: 'Implementation'
    }
  });

  const status = await invokeRoute(contextStatusRoute, { method: 'get' });
  assert.equal(status.statusCode, 200, 'context status should respond 200');
  assert.equal(status.payload.contextUsed, 90000, 'contextUsed should reflect update');
  assert.equal(status.payload.currentTask, 'Installer Validation', 'currentTask should persist');
  assert.equal(status.payload.daicState, 'Implementation', 'DAIC state should persist');
  assert.ok(typeof status.payload.visualBar === 'string' && status.payload.visualBar.length > 0, 'visual bar should be populated');

  // Reset shared state for subsequent tests / runtime
  await invokeRoute(contextUpdateRoute, {
    method: 'post',
    body: {
      contextUsed: 0,
      task: 'System Ready',
      filesEdited: 0,
      daicState: 'Discussion'
    }
  });
  await invokeRoute(ultraThinkModeRoute, { method: 'post', body: { mode: 'api' } });

  console.log('ultrathink endpoint tests passed');
process.exit(0);
})();
