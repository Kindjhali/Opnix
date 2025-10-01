import assert from 'node:assert/strict';
import { setThemeFlow } from '../src/composables/themeManager.js';

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
  }
};

await (async () => {
  const store = {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    cy: null
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
    cy: null
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
    cy: null
  };

  const start = performance.now();
  await setThemeFlow.call(store, 'mole');
  const duration = performance.now() - start;
  assert.ok(duration < 20, `theme swap should complete quickly (observed ${duration.toFixed(2)}ms)`);
})();

console.log('themeManager tests passed');
