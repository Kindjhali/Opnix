import assert from 'node:assert/strict';
import { setThemeFlow, bootstrapThemeFlow } from '../src/composables/themeManager.js';

class LinkElement {
  constructor() {
    this.id = '';
    this.rel = '';
    this.type = '';
    this.dataset = {};
    this.listeners = {
      load: new Set(),
      error: new Set()
    };
    this._href = '';
  }

  addEventListener(type, handler) {
    if (this.listeners[type]) {
      this.listeners[type].add(handler);
    }
  }

  removeEventListener(type, handler) {
    if (this.listeners[type]) {
      this.listeners[type].delete(handler);
    }
  }

  setAttribute(name, value) {
    if (name === 'data-theme-loader') {
      this.dataset.themeLoader = value;
    }
  }

  getAttribute(name) {
    if (name === 'href') {
      return this._href;
    }
    return null;
  }

  set href(value) {
    this._href = value;
    queueMicrotask(() => {
      this.listeners.load.forEach(handler => handler());
    });
  }

  get href() {
    return this._href;
  }
}

const documentStub = (() => {
  const byId = new Map();
  const head = {
    appendChild(node) {
      if (node.id) {
        byId.set(node.id, node);
      }
      this.child = node;
    }
  };
  const stub = {
    head,
    documentElement: {
      setAttribute() {}
    },
    body: {
      setAttribute() {}
    },
    _byId: byId,
    getElementsByTagName(tag) {
      if (tag === 'head') {
        return [head];
      }
      return [];
    },
    getElementById(id) {
      return byId.get(id) || null;
    },
    createElement(tag) {
      if (tag !== 'link') {
        throw new Error(`Unsupported element requested: ${tag}`);
      }
      return new LinkElement();
    }
  };
  return stub;
})();

globalThis.document = documentStub;
const storage = new Map();
globalThis.localStorage = {
  setItem(key, value) {
    storage.set(String(key), String(value));
  },
  getItem(key) {
    return storage.has(String(key)) ? storage.get(String(key)) : null;
  },
  removeItem(key) {
    storage.delete(String(key));
  }
};

await (async () => {
  const store = {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'manual',
    themeMediaCleanup: null
  };

  const pending = setThemeFlow.call(store, 'canyon');
  assert.equal(store.themeLoading, true, 'theme loading flag should be true while swapping');
  await pending;
  const link = document.getElementById('opnix-theme-link');
  assert.ok(link, 'theme link should exist');
  assert.equal(store.currentTheme, 'canyon', 'store records the selected theme');
  assert.equal(link.href, '/css/theme-canyon.css', 'link points to canyon stylesheet');
  assert.equal(link.dataset.theme, 'canyon', 'link dataset tracks theme');
  assert.equal(link.dataset.loaded, 'true', 'link load completes');
  assert.equal(store.themeLoading, false, 'loading flag clears after success');
  assert.equal(store.themeError, '', 'no error after successful load');
  assert.equal(localStorage.getItem('opnixTheme'), 'canyon', 'theme persisted to storage');
})();

await (async () => {
  const store = {
    currentTheme: 'canyon',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'manual',
    themeMediaCleanup: null
  };

  await setThemeFlow.call(store, 'nebula');
  assert.equal(store.currentTheme, 'canyon', 'unsupported theme should not change current theme');
  assert.equal(store.themeLoading, false, 'loading flag resets after error');
  assert.match(store.themeError, /(Unsupported theme|Failed to load stylesheet)/i, 'store surfaces load error');
})();

await (async () => {
  const store = {
    currentTheme: 'canyon',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'manual',
    themeMediaCleanup: null
  };

  const start = performance.now();
  await setThemeFlow.call(store, 'mole');
  const duration = performance.now() - start;
  assert.ok(duration < 20, `theme swap should complete quickly (observed ${duration.toFixed(2)}ms)`);
})();

await (async () => {
  console.log('Testing comprehensive theme switching performance...');

  const store = {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'manual',
    themeMediaCleanup: null
  };

  // Test MOLE → CANYON performance
  const start1 = performance.now();
  await setThemeFlow.call(store, 'canyon');
  const duration1 = performance.now() - start1;
  assert.ok(duration1 < 100, `MOLE → CANYON switch should be under 100ms (observed ${duration1.toFixed(2)}ms)`);
  assert.equal(store.currentTheme, 'canyon', 'theme should switch to canyon');

  // Test CANYON → MOLE performance
  const start2 = performance.now();
  await setThemeFlow.call(store, 'mole');
  const duration2 = performance.now() - start2;
  assert.ok(duration2 < 100, `CANYON → MOLE switch should be under 100ms (observed ${duration2.toFixed(2)}ms)`);
  assert.equal(store.currentTheme, 'mole', 'theme should switch back to mole');

  // Test multiple rapid switches for performance degradation
  const switchTimes = [];
  for (let i = 0; i < 5; i++) {
    const targetTheme = i % 2 === 0 ? 'canyon' : 'mole';
    const startTime = performance.now();
    await setThemeFlow.call(store, targetTheme);
    const switchTime = performance.now() - startTime;
    switchTimes.push(switchTime);
    assert.ok(switchTime < 100, `Switch ${i + 1} should be under 100ms (observed ${switchTime.toFixed(2)}ms)`);
  }

  // Check for performance degradation (no switch should be more than 2x the first)
  const firstSwitchTime = switchTimes[0];
  const maxAllowedTime = Math.max(firstSwitchTime * 2, 50); // At least 50ms threshold
  for (let i = 1; i < switchTimes.length; i++) {
    assert.ok(switchTimes[i] < maxAllowedTime,
      `Switch ${i + 1} (${switchTimes[i].toFixed(2)}ms) should not be significantly slower than first switch (${firstSwitchTime.toFixed(2)}ms)`);
  }

  const avgTime = switchTimes.reduce((sum, time) => sum + time, 0) / switchTimes.length;
  console.log(`Average theme switch time: ${avgTime.toFixed(2)}ms`);

  assert.ok(avgTime < 50, `Average switch time should be under 50ms (observed ${avgTime.toFixed(2)}ms)`);
})();

await (async () => {
  console.log('Testing devtools/system theme synchronisation...');

  storage.clear();

  let changeListener = null;
  let removeCalled = false;

  const darkMediaQuery = {
    matches: true,
    addEventListener(type, handler) {
      if (type === 'change') {
        changeListener = handler;
      }
    },
    removeEventListener(type, handler) {
      if (type === 'change' && handler === changeListener) {
        removeCalled = true;
      }
    }
  };

  globalThis.window = {
    matchMedia(query) {
      if (query === '(prefers-color-scheme: dark)') {
        return darkMediaQuery;
      }
      return {
        matches: false,
        addEventListener() {},
        removeEventListener() {}
      };
    }
  };

  const store = {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'system',
    themeMediaCleanup: null
  };

  await bootstrapThemeFlow.call(store, { fallback: 'canyon' });

  assert.equal(store.currentTheme, 'mole', 'system preference applies dark theme initially');
  assert.equal(store.themeMode, 'system', 'store remains in system mode');
  assert.equal(storage.get('opnixTheme'), undefined, 'system-driven theme does not persist to storage');
  assert.ok(typeof store.themeMediaCleanup === 'function', 'system mode registers cleanup handler');

  darkMediaQuery.matches = false;
  await changeListener?.({ matches: false });
  assert.equal(store.currentTheme, 'canyon', 'system watcher flips theme when preference changes');
  assert.equal(store.themeMode, 'system', 'system mode persists after change');

  await setThemeFlow.call(store, 'mole', undefined, { persist: true });
  assert.equal(store.themeMode, 'manual', 'manual override switches theme mode');
  assert.equal(storage.get('opnixTheme'), 'mole', 'manual override persists theme');
  assert.equal(store.themeMediaCleanup, null, 'manual override clears media cleanup handler');
  assert.equal(removeCalled, true, 'manual override detaches system listener');

  darkMediaQuery.matches = true;
  await changeListener?.({ matches: true });
  assert.equal(store.currentTheme, 'mole', 'system events ignored after manual override');
})();

console.log('themeManager tests passed');
process.exit(0);
