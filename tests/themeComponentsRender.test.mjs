import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readFile } from 'node:fs/promises';
import { parse, compileScript, compileTemplate } from '@vue/compiler-sfc';
import { setThemeFlow } from '../src/composables/themeManager.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function ensureThemeEnvironment() {
  const byId = new Map();
  const head = {
    appendChild(node) {
      if (node.id) {
        byId.set(node.id, node);
      }
      this.child = node;
    }
  };

  const documentStub = {
    __isThemeStub: true,
    head,
    documentElement: { setAttribute() {} },
    body: { setAttribute() {} },
    getElementById(id) {
      return byId.get(id) || null;
    },
    getElementsByTagName(tag) {
      if (tag === 'head') {
        return [head];
      }
      return [];
    },
    createElement(tag) {
      if (tag !== 'link') {
        throw new Error(`Unsupported element requested: ${tag}`);
      }
      return {
        id: '',
        rel: '',
        type: '',
        dataset: {},
        _href: '',
        listeners: { load: new Set(), error: new Set() },
        addEventListener(type, handler) {
          if (this.listeners[type]) {
            this.listeners[type].add(handler);
          }
        },
        removeEventListener(type, handler) {
          if (this.listeners[type]) {
            this.listeners[type].delete(handler);
          }
        },
        setAttribute(name, value) {
          if (name === 'data-theme-loader') {
            this.dataset.themeLoader = value;
          }
        },
        getAttribute(name) {
          if (name === 'href') {
            return this._href;
          }
          return null;
        },
        set href(value) {
          this._href = value;
          queueMicrotask(() => {
            this.dataset.loaded = 'true';
            this.listeners.load.forEach(handler => handler());
          });
        },
        get href() {
          return this._href;
        }
      };
    }
  };

  globalThis.document = documentStub;

  if (!globalThis.localStorage) {
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
  }
}

async function compileVueComponent(relativePath) {
  const filename = path.join(__dirname, '..', relativePath);
  const source = await readFile(filename, 'utf8');
  const { descriptor } = parse(source, { filename });
  const id = `theme-test-${Math.random().toString(36).slice(2)}`;

  if (descriptor.script || descriptor.scriptSetup) {
    compileScript(descriptor, { id });
  }

  if (descriptor.template && descriptor.template.content) {
    const result = compileTemplate({ id, filename, source: descriptor.template.content });
    assert.equal(result.errors.length, 0, `${relativePath} template should compile without errors`);
  }
}

const componentPaths = [
  'src/components/SpecsTab.vue',
  'src/components/FeaturesTab.vue',
  'src/components/ModulesCanvas.vue',
  'src/components/TerminalPanel.vue',
  'src/components/DocsViewer.vue',
  'src/components/DiagramsTab.vue',
  'src/components/ApiTab.vue'
];

ensureThemeEnvironment();

async function switchTheme(targetTheme) {
  const store = {
    currentTheme: 'mole',
    themeLoading: false,
    themeError: '',
    cy: null,
    themeMode: 'manual',
    themeMediaCleanup: null
  };
  await setThemeFlow.call(store, targetTheme);
  return store.currentTheme;
}

await test('theme components compile for MOLE and CANYON', async (t) => {
  await t.test('theme switch to MOLE compiles without error', async () => {
    const theme = await switchTheme('mole');
    assert.equal(theme, 'mole');
  });

  for (const componentPath of componentPaths) {
    await t.test(`${componentPath} compiles`, async () => {
      await compileVueComponent(componentPath);
    });
  }

  await t.test('theme switch to CANYON compiles without error', async () => {
    const theme = await switchTheme('canyon');
    assert.equal(theme, 'canyon');
  });

  for (const componentPath of componentPaths) {
    await t.test(`${componentPath} compiles under CANYON`, async () => {
      await compileVueComponent(componentPath);
    });
  }
});
