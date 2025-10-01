import { configureMermaidTheme } from './diagramManager.js';
import { useAppStore } from './appStore.js';

const THEME_STORAGE_KEY = 'opnixTheme';
const THEME_STYLESHEETS = {
  mole: '/css/theme-mole.css',
  canyon: '/css/theme-canyon.css'
};
const THEME_LINK_ID = 'opnix-theme-link';
const themeLoadCache = new Map();

function isDomAvailable() {
  return typeof document !== 'undefined';
}

function ensureThemeLinkElement() {
  if (!isDomAvailable()) {
    return null;
  }

  let link = document.getElementById(THEME_LINK_ID);
  if (link) {
    if (!link.rel) {
      link.rel = 'stylesheet';
    }
    return link;
  }

  const head = document.head || document.getElementsByTagName('head')[0];
  if (!head) {
    throw new Error('Unable to locate <head> element to mount theme stylesheet');
  }

  link = document.createElement('link');
  link.id = THEME_LINK_ID;
  link.rel = 'stylesheet';
  link.type = 'text/css';
  link.setAttribute('data-theme-loader', 'opnix');
  head.appendChild(link);
  return link;
}

function loadThemeStylesheet(theme, { previousTheme } = {}) {
  if (!isDomAvailable()) {
    return Promise.resolve();
  }

  const href = THEME_STYLESHEETS[theme];
  if (!href) {
    return Promise.reject(new Error(`Unsupported theme "${theme}"`));
  }

  if (themeLoadCache.has(theme)) {
    return themeLoadCache.get(theme);
  }

  const link = ensureThemeLinkElement();
  const previousHref = link ? link.getAttribute('href') : '';
  const previousLoaded = link ? link.dataset.loaded : '';

  const promise = new Promise((resolve, reject) => {
    if (!link) {
      resolve();
      return;
    }

    const cleanup = () => {
      link.removeEventListener('load', handleLoad);
      link.removeEventListener('error', handleError);
    };

    const handleLoad = () => {
      cleanup();
      link.dataset.loaded = 'true';
      resolve();
    };

    const handleError = () => {
      cleanup();
      if (previousHref) {
        link.href = previousHref;
      }
      if (previousTheme) {
        link.dataset.theme = previousTheme;
      }
      link.dataset.loaded = previousLoaded || '';
      reject(new Error(`Failed to load stylesheet for theme "${theme}"`));
    };

    if (link.dataset.theme === theme && link.dataset.loaded === 'true') {
      resolve();
      return;
    }

    link.addEventListener('load', handleLoad, { once: true });
    link.addEventListener('error', handleError, { once: true });

    link.dataset.loaded = 'pending';
    link.dataset.theme = theme;

    if (link.href !== href) {
      link.href = href;
    }

    try {
      if (link.sheet && (link.sheet.cssRules || link.sheet.cssText !== undefined)) {
        cleanup();
        link.dataset.loaded = 'true';
        resolve();
      }
    } catch {
      // Accessing cssRules can throw while the stylesheet is loading; rely on load event.
    }
  }).finally(() => {
    themeLoadCache.delete(theme);
  });

  themeLoadCache.set(theme, promise);
  return promise;
}

function applyThemeAttributes(theme) {
  if (!isDomAvailable()) {
    return;
  }
  const root = document.documentElement;
  const body = document.body;
  if (root) root.setAttribute('data-theme', theme);
  if (body) body.setAttribute('data-theme', theme);
}

function persistTheme(theme) {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.setItem(THEME_STORAGE_KEY, theme);
  } catch {
    // ignore storage errors (private mode, quota, etc.)
  }
}

function clearStoredTheme() {
  if (typeof localStorage === 'undefined') {
    return;
  }
  try {
    localStorage.removeItem(THEME_STORAGE_KEY);
  } catch {
    // ignore storage errors
  }
}

function getStoredTheme() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const stored = localStorage.getItem(THEME_STORAGE_KEY);
    if (stored) {
      return stored;
    }
    return null;
  } catch {
    return null;
  }
}

function resolveStore(context, scope) {
  return context || scope || useAppStore();
}

function detectSystemTheme() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  const darkQuery = window.matchMedia('(prefers-color-scheme: dark)');
  if (darkQuery.matches) {
    return 'mole';
  }

  const lightQuery = window.matchMedia('(prefers-color-scheme: light)');
  if (lightQuery.matches) {
    return 'canyon';
  }

  return null;
}

function registerSystemThemeWatcher(store) {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return null;
  }

  const query = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = (event) => {
    if (!store || store.themeMode !== 'system') {
      return;
    }
    const nextTheme = event.matches ? 'mole' : 'canyon';
    return setThemeFlow.call(store, nextTheme, undefined, { persist: false, source: 'system-watch' });
  };

  if (typeof query.addEventListener === 'function') {
    query.addEventListener('change', handler);
  } else if (typeof query.addListener === 'function') {
    // Legacy browsers
    query.addListener(handler);
  }

  if (store.themeMediaCleanup) {
    store.themeMediaCleanup();
  }

  store.themeMediaCleanup = () => {
    if (typeof query.removeEventListener === 'function') {
      query.removeEventListener('change', handler);
    } else if (typeof query.removeListener === 'function') {
      query.removeListener(handler);
    }
    store.themeMediaCleanup = null;
  };

  return query;
}

export function setThemeFlow(theme, context, options = {}) {
  const store = resolveStore(context, this);
  if (!store) {
    return;
  }

  const { persist = true } = options;

  store.themeError = '';
  store.themeLoading = true;
  const previousTheme = store.currentTheme;

  return loadThemeStylesheet(theme, { previousTheme })
    .then(() => {
      store.currentTheme = theme;
      applyThemeAttributes(theme);
      if (persist) {
        persistTheme(theme);
        store.themeMode = 'manual';
        if (store.themeMediaCleanup) {
          store.themeMediaCleanup();
        }
      } else {
        clearStoredTheme();
        store.themeMode = 'system';
      }
      configureMermaidTheme(theme);
      if (store.cy) {
        store.cy.resize();
      }
    })
    .catch(error => {
      console.error('Theme load failed', error);
      store.themeError = error && error.message ? error.message : 'Failed to load theme stylesheet';
    })
    .finally(() => {
      store.themeLoading = false;
    });
}

export function bootstrapThemeFlow(config = {}, context) {
  const { fallback = 'mole', respectSystemPreference = true } = config;
  const store = resolveStore(context, this);
  if (!store) {
    return Promise.resolve();
  }

  const stored = getStoredTheme();

  if (stored) {
    return setThemeFlow.call(store, stored, undefined, { persist: true });
  }

  if (respectSystemPreference) {
    const detected = detectSystemTheme();
    store.themeMode = 'system';
    registerSystemThemeWatcher(store);
    if (detected) {
      return setThemeFlow.call(store, detected, undefined, { persist: false });
    }
  }

  return setThemeFlow.call(store, fallback, undefined, { persist: !respectSystemPreference });
}
