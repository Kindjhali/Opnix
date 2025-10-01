const path = require('path');
const fs = require('fs');
const { EventEmitter } = require('events');
const crypto = require('crypto');
const zlib = require('zlib');
const { promisify } = require('util');

const gzip = promisify(zlib.gzip);
const gunzip = promisify(zlib.gunzip);
const fsPromises = fs.promises;

const gitAutomationManager = require('./gitAutomationManager');
let gitAutomation = gitAutomationManager;

function toMilestoneMap(input) {
  if (!input) return {};
  if (Array.isArray(input)) {
    return input.reduce((acc, milestone) => {
      if (milestone && milestone.id) {
        acc[milestone.id] = milestone;
      }
      return acc;
    }, {});
  }
  if (typeof input === 'object' && input !== null) {
    return { ...input };
  }
  return {};
}

function toMilestoneArray(map) {
  if (!map || typeof map !== 'object') {
    return [];
  }
  return Object.values(map);
}

const DATA_DIR = path.join(__dirname, '..', 'data');
const ROADMAP_STATE_FILE = path.join(DATA_DIR, 'roadmap-state.json');
const ROADMAP_BACKUP_DIR = path.join(DATA_DIR, 'backups', 'roadmap');
const ROADMAP_HISTORY_LIMIT = 25;
const MAX_BACKUPS = 5;
const BACKUP_GZIP_THRESHOLD_MS = 24 * 60 * 60 * 1000;

const ROADMAP_STATUSES = ['pending', 'active', 'paused', 'blocked', 'completed'];
const ROADMAP_STATUS_SET = new Set(ROADMAP_STATUSES);
const ROADMAP_STATUS_TRANSITIONS = {
  pending: new Set(['pending', 'active', 'paused', 'blocked', 'completed']),
  active: new Set(['active', 'paused', 'blocked', 'completed']),
  paused: new Set(['paused', 'active', 'blocked', 'completed']),
  blocked: new Set(['blocked', 'active', 'paused', 'completed']),
  completed: new Set(['completed'])
};

const TICKETS_FILE = path.join(DATA_DIR, 'tickets.json');
const FEATURES_FILE = path.join(DATA_DIR, 'features.json');
const DETECTED_MODULES_FILE = path.join(DATA_DIR, 'modules-detected.json');
const MANUAL_MODULES_FILE = path.join(DATA_DIR, 'modules.json');

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function timestampSuffix(date = new Date()) {
  return date.toISOString().replace(/[:.]/g, '-');
}

class RoadmapStateManager extends EventEmitter {
  constructor() {
    super();
    this.statePath = ROADMAP_STATE_FILE;
    this.backupDir = ROADMAP_BACKUP_DIR;
    this.lockInfo = null;
    this.state = null;
    this.saveQueue = [];
    this.processing = false;
    this.debounceDelay = 1000;
    this.debounceTimer = null;
  }

  normaliseStatus(value, { allowNull = false } = {}) {
    if (value === undefined || value === null || value === '') {
      return allowNull ? null : 'pending';
    }
    const normalised = String(value).trim().toLowerCase();
    if (!ROADMAP_STATUS_SET.has(normalised)) {
      throw new Error(`Unknown roadmap status: ${value}`);
    }
    return normalised;
  }

  validateStatusTransition(previous, next) {
    const from = this.normaliseStatus(previous, { allowNull: true }) ?? 'pending';
    const to = this.normaliseStatus(next);
    const allowed = ROADMAP_STATUS_TRANSITIONS[from] || ROADMAP_STATUS_TRANSITIONS.pending;
    return allowed.has(to);
  }

  getDefaultState() {
    return {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      milestones: {},
      history: [],
      summary: {
        source: 'manual',
        ticketCount: 0,
        moduleCount: 0,
        featureCount: 0
      }
    };
  }

  async ensureDirectories() {
    await fsPromises.mkdir(DATA_DIR, { recursive: true });
    await fsPromises.mkdir(this.backupDir, { recursive: true });
  }

  async ensureStateFile() {
    await this.ensureDirectories();
    try {
      await fsPromises.access(this.statePath);
    } catch {
      const initial = `${JSON.stringify(this.getDefaultState(), null, 2)}\n`;
      await fsPromises.writeFile(this.statePath, initial, 'utf8');
    }
  }

  async acquireLock(retries = 5) {
    const lockPath = `${this.statePath}.lock`;
    const lockId = crypto.randomBytes(16).toString('hex');

    for (let attempt = 0; attempt < retries; attempt += 1) {
      try {
        const fd = await fsPromises.open(lockPath, 'wx');
        await fd.write(lockId);
        await fd.close();
        this.lockInfo = { path: lockPath, id: lockId };
        return;
      } catch (error) {
        if (error.code !== 'EEXIST') {
          throw error;
        }
        await sleep(100 * Math.pow(2, attempt));
      }
    }

    throw new Error('Failed to acquire roadmap state lock');
  }

  async releaseLock() {
    if (!this.lockInfo) return;
    try {
      const current = await fsPromises.readFile(this.lockInfo.path, 'utf8');
      if (current === this.lockInfo.id) {
        await fsPromises.unlink(this.lockInfo.path);
      }
    } catch {
      // lock already removed
    } finally {
      this.lockInfo = null;
    }
  }

  async load() {
    await this.ensureStateFile();
    try {
      const raw = await fsPromises.readFile(this.statePath, 'utf8');
      const parsed = JSON.parse(raw);
      this.state = this.normaliseState(parsed);
    } catch (error) {
      console.error('roadmapState: failed to load state, recreating defaults', error);
      this.state = this.getDefaultState();
      await this.performWrite(this.state, { createBackup: false });
    }
    return clone(this.state);
  }

  normaliseState(raw = {}) {
    const base = this.getDefaultState();
    const merged = {
      ...base,
      ...raw,
      summary: {
        ...base.summary,
        ...(raw.summary || {})
      },
      history: Array.isArray(raw.history) ? raw.history.slice(0, ROADMAP_HISTORY_LIMIT) : []
    };

    merged.milestones = toMilestoneMap(raw.milestones);
    Object.keys(merged.milestones).forEach(id => {
      const milestone = merged.milestones[id];
      if (!milestone) {
        return;
      }
      merged.milestones[id] = {
        ...milestone,
        status: this.normaliseStatus(milestone.status, { allowNull: true }) ?? 'pending'
      };
    });

    return merged;
  }

  formatForExternal(state) {
    const cloneState = clone(state);
    cloneState.milestonesMap = { ...cloneState.milestones };
    cloneState.milestones = toMilestoneArray(cloneState.milestones);
    return cloneState;
  }

  getState() {
    if (!this.state) {
      throw new Error('Roadmap state not initialised. Call load() first.');
    }
    return this.formatForExternal(this.state);
  }

  async readState() {
    if (!this.state) {
      await this.load();
    }
    return this.getState();
  }

  scheduleSave(stateFactory, options = {}) {
    return new Promise((resolve, reject) => {
      this.saveQueue.push({ stateFactory, options, resolve, reject });
      if (this.debounceTimer) {
        clearTimeout(this.debounceTimer);
      }
      this.debounceTimer = setTimeout(() => {
        this.debounceTimer = null;
        this.processQueue().catch(error => {
          console.error('roadmapState: failed processing queue', error);
        });
      }, this.debounceDelay);
    });
  }

  async processQueue() {
    if (this.processing) {
      return;
    }

    this.processing = true;
    while (this.saveQueue.length > 0) {
      const batch = this.saveQueue.splice(0, this.saveQueue.length);
      const last = batch[batch.length - 1];
      try {
        const nextState = await last.stateFactory();
        const written = await this.performWrite(nextState, last.options);
        batch.forEach(item => item.resolve(clone(written)));
      } catch (error) {
        batch.forEach(item => item.reject(error));
      }
    }
    this.processing = false;
  }

  async performWrite(state, { createBackup = true } = {}) {
    await this.ensureStateFile();
    const candidate = Array.isArray(state?.milestones) ? { ...state, milestones: toMilestoneMap(state.milestones) } : state;
    const nextState = this.normaliseState(candidate);
    nextState.lastUpdated = new Date().toISOString();

    await this.acquireLock();
    try {
      const serialised = `${JSON.stringify(nextState, null, 2)}\n`;
      let existing = null;
      if (createBackup) {
        try {
          existing = await fsPromises.readFile(this.statePath, 'utf8');
        } catch {
          existing = null;
        }
      }

      if (createBackup && existing && existing.trim()) {
        await this.createBackup(existing);
      }

      const tempPath = `${this.statePath}.tmp`;
      await fsPromises.writeFile(tempPath, serialised, 'utf8');
      await fsPromises.rename(tempPath, this.statePath);
      this.state = nextState;
      await this.cleanupBackups();
      return this.getState();
    } finally {
      await this.releaseLock();
    }
  }

  async createBackup(contents) {
    await this.ensureDirectories();
    const timestamp = timestampSuffix();
    const backupPath = path.join(this.backupDir, `roadmap-state-${timestamp}.json`);
    await fsPromises.writeFile(backupPath, `${contents}\n`, 'utf8');
  }

  async cleanupBackups() {
    let files;
    try {
      files = await fsPromises.readdir(this.backupDir);
    } catch {
      return;
    }

    const entries = await Promise.all(files.map(async filename => {
      const filePath = path.join(this.backupDir, filename);
      const stats = await fsPromises.stat(filePath);
      return { filename, filePath, stats };
    }));

    const sortable = entries.filter(entry => entry.stats.isFile());
    sortable.sort((a, b) => b.stats.mtimeMs - a.stats.mtimeMs);

    const toPrune = sortable.slice(MAX_BACKUPS);
    await Promise.all(toPrune.map(entry => fsPromises.unlink(entry.filePath).catch(() => {})));

    const now = Date.now();
    await Promise.all(sortable.map(async entry => {
      if (entry.filename.endsWith('.gz')) {
        return;
      }
      if ((now - entry.stats.mtimeMs) > BACKUP_GZIP_THRESHOLD_MS) {
        try {
          const raw = await fsPromises.readFile(entry.filePath);
          const gzipped = await gzip(raw);
          await fsPromises.writeFile(`${entry.filePath}.gz`, gzipped);
          await fsPromises.unlink(entry.filePath);
        } catch (error) {
          console.warn(`roadmapState: failed to gzip backup ${entry.filename}`, error.message);
        }
      }
    }));
  }

  async listBackups() {
    await this.ensureDirectories();
    const files = await fsPromises.readdir(this.backupDir);
    const entries = await Promise.all(files.map(async filename => {
      const filePath = path.join(this.backupDir, filename);
      const stats = await fsPromises.stat(filePath);
      return {
        filename,
        path: filePath,
        size: stats.size,
        mtime: stats.mtime
      };
    }));
    entries.sort((a, b) => b.mtime.getTime() - a.mtime.getTime());
    return entries;
  }

  async readBackup(filename) {
    const backups = await this.listBackups();
    const entry = backups.find(item => item.filename === filename);
    if (!entry) {
      throw new Error(`Unknown roadmap backup: ${filename}`);
    }

    const buffer = await fsPromises.readFile(entry.path);
    if (filename.endsWith('.gz')) {
      const uncompressed = await gunzip(buffer);
      return uncompressed.toString('utf8');
    }
    return buffer.toString('utf8');
  }

  async rollback(filename) {
    const raw = await this.readBackup(filename);
    const parsed = JSON.parse(raw);
    await this.performWrite(parsed, { createBackup: false });
    return this.getState();
  }

  async writeState(state, options = {}) {
    if (options?.immediate) {
      return this.performWrite(state, options);
    }
    return this.scheduleSave(async () => state, options);
  }

  async loadJson(filePath, fallback) {
    try {
      const raw = await fsPromises.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch (error) {
      if (error.code === 'ENOENT') {
        return fallback;
      }
      console.warn(`roadmapState: failed to read ${path.basename(filePath)} – using fallback`, error.message);
      return fallback;
    }
  }

  evaluateTicketStatusBreakdown(tickets) {
    return tickets.reduce((acc, ticket) => {
      const status = ticket?.status || 'unknown';
      acc[status] = (acc[status] || 0) + 1;
      return acc;
    }, {});
  }

  buildTicketsIndex(tickets) {
    const ticketsById = new Map();
    const ticketsByModule = new Map();

    tickets.forEach(ticket => {
      if (!ticket) return;
      ticketsById.set(ticket.id, ticket);
      ticketsById.set(String(ticket.id), ticket);
      if (Array.isArray(ticket.modules)) {
        ticket.modules.forEach(moduleId => {
          if (!moduleId) return;
          const bucket = ticketsByModule.get(moduleId) || [];
          bucket.push(ticket);
          ticketsByModule.set(moduleId, bucket);
        });
      }
    });

    return { ticketsById, ticketsByModule };
  }

  buildFeaturesIndex(features) {
    const featuresById = new Map();

    features.forEach(feature => {
      if (!feature || feature.id === undefined || feature.id === null) return;
      featuresById.set(feature.id, feature);
      featuresById.set(String(feature.id), feature);
    });

    return { featuresById };
  }

  buildModulesIndex(modules) {
    const modulesById = new Map();

    modules.forEach(module => {
      if (!module || module.id === undefined || module.id === null) return;
      modulesById.set(module.id, module);
      modulesById.set(String(module.id), module);
      if (module.path) {
        modulesById.set(module.path, module);
      }
    });

    return { modulesById };
  }

  buildDependencyGraph(milestones = {}) {
    const dependentsById = new Map();
    const milestonesById = {};

    Object.entries(milestones || {}).forEach(([rawId, milestone]) => {
      if (!milestone) {
        return;
      }

      const canonicalId = String(milestone.id ?? rawId);
      const keys = new Set([rawId, canonicalId]);
      keys.forEach(key => {
        if (key !== undefined && key !== null) {
          milestonesById[String(key)] = milestone;
        }
      });

      const dependencies = Array.isArray(milestone.dependencies) ? milestone.dependencies : [];
      dependencies
        .filter(Boolean)
        .map(value => String(value))
        .forEach(depId => {
          if (!dependentsById.has(depId)) {
            dependentsById.set(depId, new Set());
          }
          dependentsById.get(depId).add(canonicalId);
        });
    });

    return { milestonesById, dependentsById };
  }

  buildDependencySummary(milestone, context = {}) {
    const dependencies = Array.isArray(milestone?.dependencies)
      ? milestone.dependencies.filter(Boolean).map(value => String(value))
      : [];

    if (!dependencies.length) {
      return {
        total: 0,
        satisfied: 0,
        blocked: 0,
        pending: 0,
        missing: 0,
        gatingProgress: 100,
        status: 'clear',
        details: []
      };
    }

    const milestonesById = context?.milestonesById || {};
    const details = dependencies.map(depId => {
      const dependency = milestonesById[depId] || milestonesById[String(depId)];
      if (!dependency) {
        return {
          id: depId,
          title: '',
          status: 'missing',
          progress: 0,
          blocked: false,
          completed: false,
          missing: true
        };
      }

      const status = this.normaliseStatus(dependency.status, { allowNull: true }) ?? 'pending';
      const progress = typeof dependency.progress === 'number'
        ? Math.max(0, Math.min(100, dependency.progress))
        : 0;
      const blocked = status === 'blocked' || status === 'paused';
      const completed = status === 'completed' || progress >= 100;

      return {
        id: String(dependency.id ?? depId),
        title: dependency.title || dependency.name || '',
        status,
        progress,
        blocked,
        completed,
        missing: false
      };
    });

    let gatingProgress = 100;
    let blockedCount = 0;
    let satisfied = 0;
    let pending = 0;
    let missing = 0;

    details.forEach(detail => {
      const detailProgress = Number.isFinite(detail.progress) ? detail.progress : 0;
      gatingProgress = Math.min(gatingProgress, detailProgress);

      if (detail.missing) {
        missing += 1;
        pending += 1;
        gatingProgress = Math.min(gatingProgress, 0);
        return;
      }

      if (detail.blocked) {
        blockedCount += 1;
        gatingProgress = Math.min(gatingProgress, detailProgress);
        return;
      }

      if (detail.completed) {
        satisfied += 1;
        return;
      }

      pending += 1;
    });

    const status = blockedCount > 0
      ? 'blocked'
      : pending > 0
        ? 'pending'
        : 'clear';

    return {
      total: dependencies.length,
      satisfied,
      blocked: blockedCount,
      pending,
      missing,
      gatingProgress: dependencies.length ? Math.max(0, Math.min(100, gatingProgress)) : 100,
      status,
      details
    };
  }

  isTicketCompleted(ticket) {
    if (!ticket) return false;
    const status = String(ticket.status || '').toLowerCase();
    if (status.includes('blocked') || status.includes('paused')) return 'blocked';
    return status === 'finished' || status === 'completed' || status === 'resolved';
  }

  isFeatureCompleted(feature) {
    if (!feature) return false;
    const status = String(feature.status || '').toLowerCase();
    if (status.includes('blocked') || status.includes('paused')) return 'blocked';
    return ['deployed', 'released', 'completed', 'done', 'shipped', 'delivered'].some(keyword => status.includes(keyword));
  }

  isModuleHealthy(module) {
    if (!module) return false;
    const status = String(module.status || module.healthStatus || '').toLowerCase();
    const health = Number(module.health);
    if (status.includes('blocked') || status.includes('degraded')) return 'blocked';
    if (Number.isFinite(health) && health >= 80) return true;
    return ['healthy', 'stable', 'ready', 'completed', 'deployed'].some(keyword => status.includes(keyword));
  }

  calculateProgress(milestone, context = {}) {
    const weights = { ticket: 1, feature: 3, module: 5 };
    let totalWeight = 0;
    let completedWeight = 0;

    const ticketsById = context.ticketsById instanceof Map ? context.ticketsById : new Map();
    const ticketsByModule = context.ticketsByModule instanceof Map ? context.ticketsByModule : new Map();
    const featuresById = context.featuresById instanceof Map ? context.featuresById : new Map();
    const modulesById = context.modulesById instanceof Map ? context.modulesById : new Map();

    const add = (weight, result) => {
      totalWeight += weight;
      if (result === true) {
        completedWeight += weight;
      }
    };

    const ticketIds = Array.isArray(milestone.linkedTickets) ? milestone.linkedTickets : [];
    ticketIds.forEach(id => {
      const ticket = ticketsById.get(id) || ticketsById.get(Number(id));
      add(weights.ticket, this.isTicketCompleted(ticket));
    });

    if (!ticketIds.length && milestone.linkedModule) {
      const moduleTickets = ticketsByModule.get(milestone.linkedModule) || [];
      moduleTickets.forEach(ticket => add(weights.ticket, this.isTicketCompleted(ticket)));
    }

    const featureIds = Array.isArray(milestone.linkedFeatures) ? milestone.linkedFeatures : [];
    featureIds.forEach(id => {
      const feature = featuresById.get(id) || featuresById.get(Number(id));
      add(weights.feature, this.isFeatureCompleted(feature));
    });

    const moduleIds = Array.isArray(milestone.linkedModules) ? milestone.linkedModules : [];
    moduleIds.forEach(id => {
      const module = modulesById.get(id) || modulesById.get(String(id));
      add(weights.module, this.isModuleHealthy(module));
    });

    if (!moduleIds.length && milestone.linkedModule) {
      const module = modulesById.get(milestone.linkedModule) || modulesById.get(String(milestone.linkedModule));
      add(weights.module, this.isModuleHealthy(module));
    }

    let progress;
    if (totalWeight === 0) {
      progress = typeof milestone.progress === 'number' ? milestone.progress : 0;
    } else {
      progress = Math.round((completedWeight / totalWeight) * 100);
    }

    const status = String(milestone.status || '').toLowerCase();
    if (status.includes('blocked') || status.includes('paused')) {
      progress = 0;
    }

    const dependencySummary = this.buildDependencySummary(milestone, context);
    if (dependencySummary.total) {
      progress = Math.min(progress, dependencySummary.gatingProgress);
      if (dependencySummary.status === 'blocked') {
        progress = 0;
      }
    }

    const normalisedProgress = Math.max(0, Math.min(100, Number.isFinite(progress) ? progress : 0));

    return { progress: normalisedProgress, dependencySummary };
  }

  normaliseMilestoneProgress(milestone, context) {
    if (!milestone) return milestone;
    const { progress, dependencySummary } = this.calculateProgress(milestone, context);
    let status = this.normaliseStatus(milestone.status, { allowNull: true }) ?? 'pending';

    if (dependencySummary.status === 'blocked' && status !== 'completed') {
      status = 'blocked';
    }

    return {
      ...milestone,
      status,
      progress,
      dependencySummary
    };
  }

  pruneHistory(history) {
    if (!Array.isArray(history)) {
      return [];
    }
    return history.slice(0, ROADMAP_HISTORY_LIMIT);
  }

  prepareMilestoneUpdates(previous, updates = {}) {
    const next = { ...previous };
    const sanitized = { ...updates };

    if (Object.prototype.hasOwnProperty.call(sanitized, 'progress')) {
      const raw = Number(sanitized.progress);
      if (Number.isFinite(raw)) {
        sanitized.progress = Math.max(0, Math.min(100, Math.round(raw)));
      } else {
        delete sanitized.progress;
      }
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'dependencies')) {
      const dependencies = Array.isArray(sanitized.dependencies)
        ? sanitized.dependencies.filter(Boolean).map(value => String(value))
        : [];
      sanitized.dependencies = Array.from(new Set(dependencies));
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'linkedTickets')) {
      sanitized.linkedTickets = Array.isArray(sanitized.linkedTickets)
        ? sanitized.linkedTickets.filter(Boolean)
        : previous.linkedTickets || [];
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'linkedFeatures')) {
      sanitized.linkedFeatures = Array.isArray(sanitized.linkedFeatures)
        ? sanitized.linkedFeatures.filter(Boolean)
        : previous.linkedFeatures || [];
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'linkedModules')) {
      sanitized.linkedModules = Array.isArray(sanitized.linkedModules)
        ? sanitized.linkedModules.filter(Boolean)
        : previous.linkedModules || [];
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'status')) {
      sanitized.status = this.normaliseStatus(sanitized.status);
    }

    const result = { ...next, ...sanitized };

    if (Object.prototype.hasOwnProperty.call(result, 'status')) {
      result.status = this.normaliseStatus(result.status);
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'name') && !Object.prototype.hasOwnProperty.call(sanitized, 'title')) {
      result.title = sanitized.name;
    }

    if (Object.prototype.hasOwnProperty.call(sanitized, 'title') && !Object.prototype.hasOwnProperty.call(sanitized, 'name')) {
      result.name = sanitized.title;
    }

    return result;
  }

  diffMilestone(previous, next, changedFields) {
    const diff = {
      id: String(next.id || previous.id),
      title: next.title || next.name || previous.title || previous.name || '',
      updatedFields: changedFields,
      updatedAt: new Date().toISOString()
    };

    if (changedFields.includes('progress')) {
      diff.progress = {
        from: previous?.progress ?? null,
        to: next?.progress ?? null
      };
    }

    if (changedFields.includes('status')) {
      diff.status = {
        from: previous?.status ?? null,
        to: next?.status ?? null
      };
    }

    if (changedFields.includes('dependencies')) {
      diff.dependencies = {
        from: Array.isArray(previous?.dependencies) ? previous.dependencies.slice() : [],
        to: Array.isArray(next?.dependencies) ? next.dependencies.slice() : []
      };
    }

    if (changedFields.includes('dependencySummary')) {
      diff.dependencySummary = {
        from: previous?.dependencySummary ?? null,
        to: next?.dependencySummary ?? null
      };
    }

    if (changedFields.includes('completionSummary')) {
      diff.completionSummary = {
        from: previous?.completionSummary ?? null,
        to: next?.completionSummary ?? null
      };
    }

    if (changedFields.includes('completedAt')) {
      diff.completedAt = {
        from: previous?.completedAt ?? null,
        to: next?.completedAt ?? null
      };
    }

    return diff;
  }

  computeChangedFields(previous, next, requested = []) {
    const fields = new Set(Array.isArray(requested) ? requested : []);
    const tracked = ['progress', 'status', 'dependencies', 'dependencySummary', 'completionSummary', 'completedAt'];

    tracked.forEach(field => {
      const before = previous ? JSON.stringify(previous[field]) : undefined;
      const after = next ? JSON.stringify(next[field]) : undefined;
      if (before !== after) {
        fields.add(field);
      }
    });

    return Array.from(fields);
  }

  applyDependencyCascade(rootId, milestones, context, dependentsMap, previousMilestones = {}) {
    if (!rootId || !dependentsMap || !dependentsMap.size) {
      return [];
    }

    const rootKey = String(rootId);
    const initial = dependentsMap.get(rootKey);
    if (!initial || !initial.size) {
      return [];
    }

    const queue = Array.from(initial).map(value => String(value));
    const visited = new Set();
    const cascaded = [];

    while (queue.length) {
      const depKey = String(queue.shift());
      if (depKey === rootKey) {
        continue;
      }
      if (visited.has(depKey)) {
        continue;
      }
      visited.add(depKey);

      const current = milestones[depKey] || milestones[String(depKey)];
      if (!current) {
        continue;
      }

      const previous = previousMilestones?.[depKey] || previousMilestones?.[String(depKey)] || null;
      const recalculated = this.normaliseMilestoneProgress(current, context);
      const changedFields = this.computeChangedFields(previous ?? current, recalculated, []);

      const canonicalId = String(recalculated.id ?? depKey);
      milestones[depKey] = recalculated;
      milestones[canonicalId] = recalculated;
      context.milestonesById[depKey] = recalculated;
      context.milestonesById[canonicalId] = recalculated;

      if (!changedFields.length) {
        continue;
      }

      const diff = this.diffMilestone(previous ?? current, recalculated, changedFields);
      diff.cascade = true;
      cascaded.push(diff);

      const downstream = dependentsMap.get(canonicalId) || dependentsMap.get(depKey);
      if (downstream) {
        downstream.forEach(childId => {
          queue.push(String(childId));
        });
      }
    }

    return cascaded;
  }

  async loadDomainEntities(overrides = {}) {
    const ticketsPayload = Object.prototype.hasOwnProperty.call(overrides, 'tickets')
      ? overrides.tickets
      : await this.loadJson(TICKETS_FILE, { tickets: [], nextId: 1 });
    const tickets = Array.isArray(ticketsPayload?.tickets)
      ? ticketsPayload.tickets
      : Array.isArray(ticketsPayload)
        ? ticketsPayload
        : [];

    const featuresPayload = Object.prototype.hasOwnProperty.call(overrides, 'features')
      ? overrides.features
      : await this.loadJson(FEATURES_FILE, { features: [], nextId: 1 });
    const features = Array.isArray(featuresPayload?.features)
      ? featuresPayload.features
      : Array.isArray(featuresPayload)
        ? featuresPayload
        : [];

    const detectedModulesPayload = Object.prototype.hasOwnProperty.call(overrides, 'detectedModules')
      ? overrides.detectedModules
      : await this.loadJson(DETECTED_MODULES_FILE, []);
    const manualModulesPayload = Object.prototype.hasOwnProperty.call(overrides, 'manualModules')
      ? overrides.manualModules
      : await this.loadJson(MANUAL_MODULES_FILE, []);

    const detectedModules = Array.isArray(detectedModulesPayload?.modules)
      ? detectedModulesPayload.modules
      : Array.isArray(detectedModulesPayload)
        ? detectedModulesPayload
        : [];
    const manualModules = Array.isArray(manualModulesPayload?.modules)
      ? manualModulesPayload.modules
      : Array.isArray(manualModulesPayload)
        ? manualModulesPayload
        : [];

    const modules = [...detectedModules, ...manualModules];

    const { ticketsById, ticketsByModule } = this.buildTicketsIndex(tickets);
    const { featuresById } = this.buildFeaturesIndex(features);
    const { modulesById } = this.buildModulesIndex(modules);

    return {
      tickets,
      features,
      modules,
      ticketsById,
      ticketsByModule,
      featuresById,
      modulesById
    };
  }

  async updateMilestone(id, updates = {}, options = {}) {
    if (id === undefined || id === null) {
      throw new Error('Milestone id is required');
    }

    const payload = typeof updates === 'object' && updates !== null ? { ...updates } : {};

    if (Object.prototype.hasOwnProperty.call(payload, 'field')) {
      const fieldKey = payload.field;
      if (fieldKey) {
        payload[fieldKey] = payload.value;
      }
      delete payload.field;
      delete payload.value;
    }

    const updateKeys = Object.keys(payload);
    if (!updateKeys.length) {
      throw new Error('No updates provided for milestone');
    }

    await this.ensureStateFile();
    if (!this.state) {
      await this.load();
    }

    // Find the milestone by searching through the milestones object
    let key = null;
    for (const [milestoneKey, milestone] of Object.entries(this.state.milestones)) {
      if (milestone.id === id || milestone.id === String(id)) {
        key = milestoneKey;
        break;
      }
    }

    if (!key) {
      throw new Error(`Unknown milestone: ${id}`);
    }

    const original = this.state.milestones[key];
    const updatedMilestone = this.prepareMilestoneUpdates(original, payload);
    updatedMilestone.id = updatedMilestone.id ?? original.id ?? key;
    updatedMilestone.updatedAt = new Date().toISOString();

    if (options.actor) {
      updatedMilestone.lastEditedBy = options.actor;
    }

    const requestedFields = updateKeys.filter(field => {
      if (field === 'status') {
        const beforeStatus = this.normaliseStatus(original?.status, { allowNull: true }) ?? 'pending';
        const requestedStatus = this.normaliseStatus(updatedMilestone.status, { allowNull: true }) ?? 'pending';
        return beforeStatus !== requestedStatus;
      }
      const before = original?.[field];
      const after = updatedMilestone?.[field];
      return JSON.stringify(before) !== JSON.stringify(after);
    });

    const domain = await this.loadDomainEntities(options?.overrides || {});
    const nextMilestones = {
      ...this.state.milestones,
      [key]: updatedMilestone
    };

    const { milestonesById, dependentsById } = this.buildDependencyGraph(nextMilestones);
    const context = {
      ticketsById: domain.ticketsById,
      ticketsByModule: domain.ticketsByModule,
      featuresById: domain.featuresById,
      modulesById: domain.modulesById,
      milestonesById
    };

    const normalisedMilestone = this.normaliseMilestoneProgress(updatedMilestone, context);
    const canonicalKey = String(normalisedMilestone.id ?? key);
    nextMilestones[key] = normalisedMilestone;
    nextMilestones[canonicalKey] = normalisedMilestone;
    milestonesById[key] = normalisedMilestone;
    milestonesById[canonicalKey] = normalisedMilestone;
    context.milestonesById[key] = normalisedMilestone;
    context.milestonesById[canonicalKey] = normalisedMilestone;

    const previousStatus = this.normaliseStatus(original?.status, { allowNull: true }) ?? 'pending';
    const nextStatus = this.normaliseStatus(normalisedMilestone.status, { allowNull: true }) ?? 'pending';
    const statusChanged = previousStatus !== nextStatus;
    if (statusChanged && !this.validateStatusTransition(previousStatus, nextStatus)) {
      throw new Error(`Invalid roadmap status transition: ${previousStatus} -> ${nextStatus}`);
    }

    const completingMilestone = statusChanged && nextStatus === 'completed';
    if (completingMilestone) {
      if (!normalisedMilestone.completedAt) {
        normalisedMilestone.completedAt = new Date().toISOString();
      }
      const currentSummary = typeof normalisedMilestone.completionSummary === 'string'
        ? normalisedMilestone.completionSummary.trim()
        : '';
      if ((!currentSummary || currentSummary.length < 20) && gitAutomation?.generateMilestoneCompletionSummary) {
        normalisedMilestone.completionSummary = gitAutomation.generateMilestoneCompletionSummary(normalisedMilestone, {
          dependencySummary: normalisedMilestone.dependencySummary
        });
      }
    }

    const finalChangedFields = this.computeChangedFields(original, normalisedMilestone, requestedFields);

    const cascadedDiffs = this.applyDependencyCascade(canonicalKey, nextMilestones, context, dependentsById, this.state.milestones);

    if (!finalChangedFields.length && !cascadedDiffs.length) {
      return this.getState();
    }

    const reasonFields = finalChangedFields.length ? finalChangedFields : requestedFields;
    const reason = options.reason || `roadmap:manual-edit:${reasonFields.join('+') || 'noop'}`;
    const actor = options.actor || null;
    const timestamp = new Date().toISOString();

    const change = finalChangedFields.length ? this.diffMilestone(original, normalisedMilestone, finalChangedFields) : null;
    if (change) {
      change.actor = actor;
    }

    cascadedDiffs.forEach(diff => {
      diff.actor = actor;
      diff.reason = diff.reason || 'roadmap:dependency-cascade';
    });

    const summary = {
      source: reason,
      ticketCount: domain.tickets.length,
      moduleCount: domain.modules.length,
      featureCount: domain.features.length,
      generatedAt: timestamp
    };

    const historyEntry = {
      reason,
      timestamp,
      actor,
      summary,
      changes: [
        ...(change ? [change] : []),
        ...cascadedDiffs
      ]
    };

    const nextState = {
      ...this.state,
      milestones: nextMilestones,
      summary: {
        ...this.state.summary,
        ...summary
      },
      history: this.pruneHistory([historyEntry, ...(this.state.history || [])])
    };

    const persisted = await this.writeState(nextState, { immediate: true, createBackup: true });

    let gitAutomationResult = null;
    const allowGitAutomation = completingMilestone && options?.skipGit !== true && String(reason || '').startsWith('roadmap:manual');
    if (allowGitAutomation && gitAutomation?.autoCommitMilestone) {
      try {
        gitAutomationResult = await gitAutomation.autoCommitMilestone(normalisedMilestone, {
          dependencySummary: normalisedMilestone.dependencySummary,
          reason,
          actor
        });
        if (gitAutomationResult && gitAutomationResult.success) {
          console.log(`✓ Git auto-commit created for milestone ${normalisedMilestone.id}`);
        } else if (gitAutomationResult && gitAutomationResult.reason) {
          console.warn(`⚠ Git auto-commit skipped for milestone ${normalisedMilestone.id}: ${gitAutomationResult.reason}`);
        }
      } catch (gitError) {
        console.error('roadmapState: git automation failed', gitError);
      }
    }

    this.emit('state:sync', {
      reason,
      summary: persisted.summary,
      state: persisted,
      changes: historyEntry.changes,
      timestamp,
      actor
    });

    return {
      state: persisted,
      change,
      cascadedChanges: cascadedDiffs,
      changedFields: finalChangedFields,
      reason,
      timestamp,
      gitAutomationResult,
      statusTransition: statusChanged ? { from: previousStatus, to: nextStatus } : null
    };
  }

  async sync({ reason = 'sync', overrides = {} } = {}) {
    await this.ensureStateFile();

    const domain = await this.loadDomainEntities(overrides);
    const { tickets, features, modules, ticketsById, ticketsByModule, featuresById, modulesById } = domain;

    const state = await this.readState();

    const milestoneChanges = new Map();

    const { milestonesById: initialMilestonesMap } = this.buildDependencyGraph(state.milestones || {});
    const context = {
      ticketsById,
      ticketsByModule,
      featuresById,
      modulesById,
      milestonesById: { ...initialMilestonesMap }
    };

    const milestoneEntries = Object.entries(state.milestones || {}).map(([id, milestone]) => {
      const updated = this.normaliseMilestoneProgress(milestone, context);
      context.milestonesById[id] = updated;
      context.milestonesById[String(id)] = updated;
      return [id, updated];
    });

    const milestones = Object.fromEntries(milestoneEntries);

    milestoneEntries.forEach(([id, milestone]) => {
      const previous = state.milestones?.[id];
      const progressBefore = previous?.progress ?? null;
      const progressAfter = milestone.progress ?? null;
      const statusBefore = previous?.status ?? null;
      const statusAfter = milestone.status ?? null;
      const dependencyBefore = previous?.dependencySummary ?? null;
      const dependencyAfter = milestone.dependencySummary ?? null;

      const progressChanged = progressBefore !== progressAfter;
      const statusChanged = statusBefore !== statusAfter;
      const dependencyChanged = JSON.stringify(dependencyBefore) !== JSON.stringify(dependencyAfter);

      if (progressChanged || statusChanged || dependencyChanged) {
        const record = {
          id,
          title: milestone.title || previous?.title || '',
          progress: { from: progressBefore, to: progressAfter },
          status: { from: statusBefore, to: statusAfter },
          dependencies: Array.isArray(milestone.dependencies) ? milestone.dependencies.slice() : [],
          updatedAt: new Date().toISOString()
        };

        if (dependencyChanged) {
          record.dependencySummary = {
            from: dependencyBefore,
            to: dependencyAfter
          };
        }

        milestoneChanges.set(id, record);
      }
    });

    Object.keys(state.milestones || {}).forEach(id => {
      if (!(id in milestones)) {
        const previous = state.milestones[id];
        milestoneChanges.set(id, {
          id,
          title: previous?.title || '',
          removed: true,
          progress: { from: previous?.progress ?? null, to: null },
          status: { from: previous?.status ?? null, to: null },
          dependencies: Array.isArray(previous?.dependencies) ? previous.dependencies.slice() : [],
          dependencySummary: {
            from: previous?.dependencySummary ?? null,
            to: null
          },
          updatedAt: new Date().toISOString()
        });
      }
    });

    const changes = Array.from(milestoneChanges.values());

    const summary = {
      source: reason,
      ticketCount: tickets.length,
      moduleCount: modules.length,
      featureCount: features.length,
      statusBreakdown: this.evaluateTicketStatusBreakdown(tickets)
    };

    const historyEntry = {
      reason,
      timestamp: new Date().toISOString(),
      summary,
      changes
    };

    const nextState = {
      ...state,
      milestones,
      summary,
      history: [historyEntry, ...state.history].slice(0, ROADMAP_HISTORY_LIMIT)
    };

    const updated = await this.writeState(nextState, { createBackup: true, immediate: true });
    this.emit('state:sync', {
      reason,
      summary,
      state: updated,
      changes,
      timestamp: historyEntry.timestamp
    });
    return updated;
  }
}

const manager = new RoadmapStateManager();

async function ensureRoadmapStateFile() {
  await manager.ensureStateFile();
}

async function readRoadmapState() {
  return manager.readState();
}

async function writeRoadmapState(state, options) {
  return manager.writeState(state, options);
}

async function syncRoadmapState(options) {
  return manager.sync(options);
}

async function listRoadmapVersions() {
  const backups = await manager.listBackups();
  return backups.map(entry => ({
    filename: entry.filename,
    size: entry.size,
    modifiedAt: entry.mtime
  }));
}

async function rollbackRoadmapState(filename) {
  return manager.rollback(filename);
}

async function updateRoadmapMilestone(id, updates, options) {
  return manager.updateMilestone(id, updates, options);
}

async function ensureRoadmapStateLoaded() {
  if (!manager.state) {
    await manager.load();
  }
}

function setGitAutomationManager(managerInstance) {
  gitAutomation = managerInstance || gitAutomationManager;
}

module.exports = {
  ensureRoadmapStateFile,
  ensureRoadmapStateLoaded,
  readRoadmapState,
  writeRoadmapState,
  syncRoadmapState,
  listRoadmapVersions,
  rollbackRoadmapState,
  updateRoadmapMilestone,
  setGitAutomationManager,
  roadmapStateManager: manager
};
