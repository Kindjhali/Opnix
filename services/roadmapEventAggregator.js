const EventEmitter = require('events');
const fs = require('fs');
const fsPromises = fs.promises;
const path = require('path');
const {
  roadmapStateManager,
  ensureRoadmapStateLoaded
} = require('./roadmapState');

const DEFAULT_BATCH_DELAY = 100;
const DATA_DIR = path.join(__dirname, '..', 'data');
const EVENTS_LOG_PATH = path.join(DATA_DIR, 'roadmap-events.log');
const MAX_LOG_ENTRIES = 200;

async function ensureDataDirectory() {
  await fsPromises.mkdir(DATA_DIR, { recursive: true });
}

async function readEventLogEntries() {
  try {
    const raw = await fsPromises.readFile(EVENTS_LOG_PATH, 'utf8');
    return raw.split('\n')
      .map(line => line.trim())
      .filter(Boolean)
      .map(line => {
        try {
          return JSON.parse(line);
        } catch (error) {
          console.warn('roadmapEventAggregator: failed to parse log line', error.message);
          return null;
        }
      })
      .filter(Boolean);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

async function writeEventLogEntries(entries) {
  await ensureDataDirectory();
  const trimmed = entries.slice(-MAX_LOG_ENTRIES);
  const serialised = trimmed.map(entry => JSON.stringify(entry)).join('\n');
  const payload = serialised ? `${serialised}\n` : '';
  await fsPromises.writeFile(EVENTS_LOG_PATH, payload, 'utf8');
}

async function appendEventLogEntry(entry) {
  try {
    const existing = await readEventLogEntries();
    existing.push(entry);
    await writeEventLogEntries(existing);
  } catch (error) {
    console.error('roadmapEventAggregator: failed to write event log', error);
  }
}

function extractReasonPrefixes(reasons = []) {
  const prefixes = new Set();
  reasons.forEach(reason => {
    if (typeof reason !== 'string') {
      return;
    }
    const segment = reason.split(':')[0];
    if (segment) {
      prefixes.add(segment);
    }
  });
  return Array.from(prefixes);
}

function normaliseGroups(reasons = []) {
  const groups = {
    tickets: [],
    features: [],
    modules: [],
    other: []
  };

  reasons.forEach(reason => {
    if (typeof reason !== 'string') {
      groups.other.push(reason);
      return;
    }

    if (reason.startsWith('ticket:')) {
      groups.tickets.push(reason);
    } else if (reason.startsWith('feature:')) {
      groups.features.push(reason);
    } else if (reason.startsWith('modules:') || reason.startsWith('module:')) {
      groups.modules.push(reason);
    } else {
      groups.other.push(reason);
    }
  });

  return groups;
}

class RoadmapEventAggregator extends EventEmitter {
  constructor({ manager, batchDelay = DEFAULT_BATCH_DELAY } = {}) {
    super();
    this.manager = manager;
    this.batchDelay = batchDelay;
    this.queue = [];
    this.timer = null;
    this.initialised = false;
  }

  initialize() {
    if (this.initialised) {
      return;
    }

    if (!this.manager || typeof this.manager.on !== 'function') {
      throw new Error('RoadmapEventAggregator requires a RoadmapStateManager instance');
    }

    this.manager.on('state:sync', payload => this.enqueue(payload));
    this.initialised = true;
  }

  enqueue(payload) {
    if (!payload) {
      return;
    }

    this.queue.push({ payload, receivedAt: Date.now() });

    if (this.timer) {
      return;
    }

    this.timer = setTimeout(() => {
      this.timer = null;
      this.flushQueue().catch(error => {
        console.error('roadmapEventAggregator: failed to process batch', error);
      });
    }, this.batchDelay);
  }

  async flushQueue() {
    if (!this.queue.length) {
      return;
    }

    const batch = this.queue.splice(0, this.queue.length);
    await ensureRoadmapStateLoaded();

    const dedup = new Map();
    const milestoneReasonSet = new Set();
    const changeById = new Map();
    batch.forEach(entry => {
      const payload = entry.payload || {};
      const reason = payload.reason || 'unknown';
      // keep the latest payload for a given reason
      dedup.set(reason, payload);
      if (Array.isArray(payload.changes)) {
        payload.changes.forEach(change => {
          if (!change || !change.id) {
            return;
          }
          changeById.set(change.id, change);
          milestoneReasonSet.add(`milestone:${change.id}`);
        });
      }
    });

    const rawReasons = Array.from(new Set([...dedup.keys(), ...milestoneReasonSet]));
    const groups = normaliseGroups(rawReasons);
    const dependencyOrder = ['tickets', 'features', 'modules'];
    const orderedReasons = [];
    const added = new Set();

    dependencyOrder.forEach(groupName => {
      (groups[groupName] || []).forEach(reason => {
        if (!added.has(reason)) {
          orderedReasons.push(reason);
          added.add(reason);
        }
      });
    });

    rawReasons.forEach(reason => {
      if (!added.has(reason)) {
        orderedReasons.push(reason);
        added.add(reason);
      }
    });

    const latest = batch[batch.length - 1]?.payload || {};

    const eventPayload = {
      reasons: orderedReasons,
      groups,
      summary: latest.summary || null,
      state: latest.state || null,
      changes: Array.from(changeById.values()),
      timestamp: latest.timestamp || new Date().toISOString()
    };

    await this.emitPayload(eventPayload, { emitScoped: true, persist: true });
  }

  async emitPayload(eventPayload, { emitScoped = true, persist = true } = {}) {
    if (!eventPayload) {
      return;
    }

    this.emit('roadmap:update', eventPayload);

    if (emitScoped) {
      const groups = eventPayload.groups || normaliseGroups(eventPayload.reasons || []);
      if (groups.tickets && groups.tickets.length) {
        this.emit('roadmap:tickets', { reasons: groups.tickets.slice(), summary: eventPayload.summary, state: eventPayload.state });
      }
      if (groups.features && groups.features.length) {
        this.emit('roadmap:features', { reasons: groups.features.slice(), summary: eventPayload.summary, state: eventPayload.state });
      }
      if (groups.modules && groups.modules.length) {
        this.emit('roadmap:modules', { reasons: groups.modules.slice(), summary: eventPayload.summary, state: eventPayload.state });
      }

      const prefixes = extractReasonPrefixes(eventPayload.reasons || []);
      prefixes.forEach(prefix => {
        this.emit(`roadmap:reason:${prefix}`, {
          reasons: (eventPayload.reasons || []).filter(reason => reason.startsWith(`${prefix}:`)),
          summary: eventPayload.summary || null,
          state: eventPayload.state || null,
          timestamp: eventPayload.timestamp || new Date().toISOString()
        });
      });
    }

    if (persist) {
      await appendEventLogEntry({
        timestamp: eventPayload.timestamp || new Date().toISOString(),
        reasons: eventPayload.reasons || [],
        groups: eventPayload.groups || normaliseGroups(eventPayload.reasons || []),
        summary: eventPayload.summary || null,
        state: eventPayload.state || null,
        changes: eventPayload.changes || []
      });
    }
  }

  async replayEvents({ limit, emitScoped = true } = {}) {
    const entries = await readEventLogEntries();
    const subset = typeof limit === 'number' && limit > 0 ? entries.slice(-limit) : entries;
    for (const entry of subset) {
      await this.emitPayload(entry, { emitScoped, persist: false });
    }
  }

  async getEventLogEntries() {
    return readEventLogEntries();
  }
}

const aggregator = new RoadmapEventAggregator({ manager: roadmapStateManager });
aggregator.initialize();

module.exports = aggregator;
module.exports.replayRoadmapEvents = options => aggregator.replayEvents(options);
module.exports.getRoadmapEventLog = () => aggregator.getEventLogEntries();
