import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';
import os from 'node:os';

import SessionManager from '../services/sessionManager.js';

test('session manager persists auto-save state snapshots', async () => {
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), 'session-state-test-'));
  try {
    const manager = new SessionManager();
    manager.sessionDataDir = path.join(tempRoot, 'sessions');
    manager.sessionStateDir = path.join(tempRoot, 'session-state');
    manager.userPreferencesFile = path.join(tempRoot, 'user-preferences.json');
    manager.activeSessionsFile = path.join(tempRoot, 'active-sessions.json');
    manager.sessionHistoryFile = path.join(tempRoot, 'session-history.json');
    manager.contextHistoryFile = path.join(tempRoot, 'context-history.json');
    await manager.initializeDirectories();

    const session = await manager.createSession('spec', { title: 'Onboarding' }, { totalSteps: 3 });
    const sessionId = session.id;

    const autoSaveResult = await manager.updateSessionContext(sessionId, {
      formData: {
        'spec-form': {
          data: { name: 'Opnix', audience: 'frontend' },
          timestamp: new Date().toISOString()
        }
      },
      selectedItems: ['module-a'],
      filters: { status: 'draft' }
    });

    assert.ok(autoSaveResult.autoSave);
    assert.equal(autoSaveResult.autoSave.forms['spec-form'].data.name, 'Opnix');
    assert.equal(autoSaveResult.context.formData['spec-form'].data.name, 'Opnix');

    const statePath = path.join(tempRoot, 'session-state', `${sessionId}.json`);
    const stateRaw = await fs.readFile(statePath, 'utf8');
    const persistedState = JSON.parse(stateRaw);
    assert.equal(persistedState.sessionId, sessionId);
    assert.equal(persistedState.forms['spec-form'].data.audience, 'frontend');
    assert.deepEqual(persistedState.context.selectedItems, ['module-a']);

    const stateSnapshot = await manager.readSessionState(sessionId);
    assert.equal(stateSnapshot.forms['spec-form'].data.name, 'Opnix');

    const loadedSession = await manager.loadSession(sessionId);
    assert.ok(loadedSession.autoSave);
    assert.equal(loadedSession.autoSave.forms['spec-form'].data.name, 'Opnix');

    const history = await manager.readContextHistory();
    assert.ok(Array.isArray(history.history));
    assert.ok(history.history.length >= 1);
    assert.equal(history.history[0].sessionId, sessionId);
    assert.deepEqual(history.history[0].forms, ['spec-form']);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
});
