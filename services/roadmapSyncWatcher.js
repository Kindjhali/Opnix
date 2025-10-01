const path = require('path');
const chokidar = require('chokidar');
const { syncRoadmapState } = require('./roadmapState');

const DATA_DIR = path.join(__dirname, '..', 'data');

const WATCH_TARGETS = {
  tickets: path.join(DATA_DIR, 'tickets.json'),
  features: path.join(DATA_DIR, 'features.json'),
  manualModules: path.join(DATA_DIR, 'modules.json'),
  detectedModules: path.join(DATA_DIR, 'modules-detected.json')
};

const DEFAULT_DEBOUNCE_MS = 250;

let watcher = null;
let debounceTimer = null;
let pendingReasons = new Set();
let debounceDelay = DEFAULT_DEBOUNCE_MS;

function resolveReason(filePath) {
  const entry = Object.entries(WATCH_TARGETS).find(([, targetPath]) => targetPath === filePath);
  if (entry) {
    return entry[0];
  }
  return `unknown:${path.basename(filePath)}`;
}

function scheduleSync(reason) {
  pendingReasons.add(reason);
  if (debounceTimer) {
    return;
  }

  debounceTimer = setTimeout(async () => {
    debounceTimer = null;
    const reasons = Array.from(pendingReasons);
    pendingReasons = new Set();
    try {
      const reasonLabel = reasons.length ? reasons.join('+') : 'watcher';
      await syncRoadmapState({ reason: `watcher:${reasonLabel}` });
    } catch (error) {
      console.error('roadmapSyncWatcher: failed to sync roadmap state', error);
    }
  }, debounceDelay);
}

function startRoadmapSyncWatchers(options = {}) {
  if (watcher) {
    return watcher;
  }

  debounceDelay = Number.isFinite(options.debounceMs) ? options.debounceMs : DEFAULT_DEBOUNCE_MS;

  watcher = chokidar.watch(Object.values(WATCH_TARGETS), {
    persistent: true,
    ignoreInitial: true,
    awaitWriteFinish: {
      stabilityThreshold: 300,
      pollInterval: 100
    }
  });

  watcher.on('add', filePath => scheduleSync(resolveReason(filePath)));
  watcher.on('change', filePath => scheduleSync(resolveReason(filePath)));
  watcher.on('unlink', filePath => scheduleSync(`${resolveReason(filePath)}:removed`));
  watcher.on('error', error => {
    console.error('roadmapSyncWatcher: watcher error', error);
  });

  return watcher;
}

async function stopRoadmapSyncWatchers() {
  if (!watcher) {
    return;
  }
  try {
    await watcher.close();
  } catch (error) {
    console.error('roadmapSyncWatcher: failed to stop watcher', error);
  }
  watcher = null;
  pendingReasons = new Set();
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
}

function isRoadmapSyncWatcherActive() {
  return Boolean(watcher);
}

module.exports = {
  startRoadmapSyncWatchers,
  stopRoadmapSyncWatchers,
  isRoadmapSyncWatcherActive
};
