import { test } from 'node:test';
import assert from 'node:assert/strict';
import { useAppStore, resetAppStore } from '../src/composables/appStore.js';

test('app store resets to defaults and executes cleanup', () => {
  const store = useAppStore();
  let cleanupCalled = false;
  store.themeMediaCleanup = () => {
    cleanupCalled = true;
  };
  store.currentTheme = 'canyon';
  store.themeMode = 'manual';
  store.themeLoading = true;
  store.themeError = 'boom';

  resetAppStore();

  assert.equal(cleanupCalled, true, 'themeMediaCleanup should run during reset');

  const fresh = useAppStore();
  assert.equal(fresh.currentTheme, 'mole');
  assert.equal(fresh.themeMode, 'system');
  assert.equal(fresh.themeLoading, false);
  assert.equal(fresh.themeError, '');

  // ensure reset can be called repeatedly without throwing
  resetAppStore();
  const again = useAppStore();
  assert.equal(again.themeMode, 'system');
  assert.equal(again.currentTheme, 'mole');
});
