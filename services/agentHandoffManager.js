const path = require('path');
const fs = require('fs').promises;
const crypto = require('crypto');

const DEFAULT_DATA_DIR = path.join(__dirname, '..', 'data');
const VALID_STATUSES = new Set(['open', 'inReview', 'completed', 'closed']);

function normaliseArray(values) {
  if (!values) return [];
  if (Array.isArray(values)) return values;
  return [values];
}

function normaliseStatus(status) {
  if (!status) return 'open';
  const value = String(status).trim();
  const lower = value.toLowerCase();
  if (VALID_STATUSES.has(lower)) {
    return lower;
  }
  if (VALID_STATUSES.has(value)) {
    return value;
  }
  return 'open';
}

function createAgentHandoffManager({ dataDir = DEFAULT_DATA_DIR, filePath } = {}) {
  const storeFile = filePath || path.join(dataDir, 'agent-handoffs.json');

  async function ensureStore() {
    await fs.mkdir(path.dirname(storeFile), { recursive: true });
    try {
      await fs.access(storeFile);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const initial = { version: 1, handoffs: [] };
        await fs.writeFile(storeFile, JSON.stringify(initial, null, 2));
      } else {
        throw error;
      }
    }
  }

  async function readStore() {
    await ensureStore();
    try {
      const raw = await fs.readFile(storeFile, 'utf8');
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) {
        return { version: 1, handoffs: parsed };
      }
      if (parsed && Array.isArray(parsed.handoffs)) {
        return parsed;
      }
      return { version: 1, handoffs: [] };
    } catch (error) {
      if (error.code === 'ENOENT') {
        return { version: 1, handoffs: [] };
      }
      throw error;
    }
  }

  async function writeStore(store) {
    const payload = {
      version: store.version || 1,
      handoffs: Array.isArray(store.handoffs) ? store.handoffs : []
    };
    await fs.writeFile(storeFile, JSON.stringify(payload, null, 2));
    return payload;
  }

  function normaliseHandoffPayload(input) {
    if (!input) {
      throw new Error('Handoff payload is required');
    }
    const summary = input.summary && String(input.summary).trim();
    const originAgent = input.originAgent && String(input.originAgent).trim();
    const targetAgent = input.targetAgent && String(input.targetAgent).trim();

    if (!summary) {
      throw new Error('Handoff summary is required');
    }
    if (!originAgent) {
      throw new Error('originAgent is required');
    }
    if (!targetAgent) {
      throw new Error('targetAgent is required');
    }

    const artefacts = normaliseArray(input.artefacts).map(item => {
      if (typeof item === 'string') {
        return { type: 'link', value: item };
      }
      if (item && typeof item === 'object') {
        return {
          type: item.type || 'link',
          value: item.value || item.path || '',
          description: item.description || item.summary || null
        };
      }
      return null;
    }).filter(Boolean);

    const requirements = normaliseArray(input.requirements).map(item => {
      if (typeof item === 'string') {
        return { requirement: item, status: 'pending' };
      }
      if (item && typeof item === 'object') {
        return {
          requirement: item.requirement || item.text || '',
          status: item.status ? String(item.status) : 'pending'
        };
      }
      return null;
    }).filter(Boolean);

    const notes = normaliseArray(input.notes).map(note => {
      if (typeof note === 'string') {
        return { author: originAgent, note, recordedAt: new Date().toISOString() };
      }
      if (note && typeof note === 'object') {
        return {
          author: note.author || originAgent,
          note: note.note || note.text || '',
          recordedAt: note.recordedAt || new Date().toISOString()
        };
      }
      return null;
    }).filter(item => item && item.note);

    return {
      summary,
      originAgent,
      targetAgent,
      context: input.context || input.description || null,
      artefacts,
      requirements,
      notes,
      status: normaliseStatus(input.status),
      priority: input.priority || 'normal',
      handoffType: input.handoffType || input.type || 'general',
      tags: normaliseArray(input.tags).map(tag => String(tag).toLowerCase())
    };
  }

  async function listHandoffs({ limit } = {}) {
    const store = await readStore();
    const sorted = [...store.handoffs].sort((a, b) => {
      const aDate = Date.parse(a.createdAt) || 0;
      const bDate = Date.parse(b.createdAt) || 0;
      return bDate - aDate;
    });
    if (limit && Number.isFinite(Number(limit))) {
      return sorted.slice(0, Number(limit));
    }
    return sorted;
  }

  async function createHandoff(payload) {
    const base = normaliseHandoffPayload(payload);
    const store = await readStore();
    const timestamp = new Date().toISOString();
    const handoff = {
      id: payload.id || crypto.randomUUID(),
      createdAt: timestamp,
      updatedAt: timestamp,
      owner: payload.owner || base.originAgent,
      ...base
    };

    store.handoffs.push(handoff);
    await writeStore(store);
    return handoff;
  }

  async function getHandoff(id) {
    if (!id) return null;
    const store = await readStore();
    return store.handoffs.find(item => item.id === id) || null;
  }

  function normaliseNotes(existingNotes, updates) {
    const notes = Array.isArray(existingNotes) ? [...existingNotes] : [];
    if (!updates) return notes;
    const appendNotes = normaliseArray(updates).map(note => {
      if (typeof note === 'string') {
        return { note, recordedAt: new Date().toISOString() };
      }
      if (note && typeof note === 'object') {
        return {
          note: note.note || note.text || '',
          author: note.author || note.owner || null,
          recordedAt: note.recordedAt || new Date().toISOString()
        };
      }
      return null;
    }).filter(item => item && item.note);
    return [...notes, ...appendNotes];
  }

  async function updateHandoff(id, updates) {
    if (!id) {
      throw new Error('Handoff id is required');
    }
    if (!updates || typeof updates !== 'object') {
      throw new Error('Update payload is required');
    }
    const store = await readStore();
    const index = store.handoffs.findIndex(item => item.id === id);
    if (index === -1) {
      throw new Error(`Handoff ${id} not found`);
    }

    const current = store.handoffs[index];
    const next = {
      ...current,
      updatedAt: new Date().toISOString()
    };

    if (updates.summary) {
      next.summary = String(updates.summary).trim();
    }
    if (updates.context !== undefined) {
      next.context = updates.context;
    }
    if (updates.status) {
      next.status = normaliseStatus(updates.status);
    }
    if (updates.priority) {
      next.priority = updates.priority;
    }
    if (updates.requirements) {
      next.requirements = normaliseArray(updates.requirements).map(item => {
        if (typeof item === 'string') {
          return { requirement: item, status: 'pending' };
        }
        if (item && typeof item === 'object') {
          return {
            requirement: item.requirement || item.text || '',
            status: item.status ? String(item.status) : 'pending'
          };
        }
        return null;
      }).filter(Boolean);
    }
    if (updates.artefacts) {
      next.artefacts = normaliseArray(updates.artefacts).map(item => {
        if (typeof item === 'string') {
          return { type: 'link', value: item };
        }
        if (item && typeof item === 'object') {
          return {
            type: item.type || 'link',
            value: item.value || item.path || '',
            description: item.description || item.summary || null
          };
        }
        return null;
      }).filter(Boolean);
    }
    if (updates.tags) {
      next.tags = normaliseArray(updates.tags).map(tag => String(tag).toLowerCase());
    }
    if (updates.notes) {
      next.notes = normaliseNotes(next.notes, updates.notes);
    }

    store.handoffs[index] = next;
    await writeStore(store);
    return next;
  }

  async function clearAll() {
    await writeStore({ version: 1, handoffs: [] });
  }

  return {
    listHandoffs,
    createHandoff,
    updateHandoff,
    getHandoff,
    clearAll,
    ensureStore
  };
}

const defaultManager = createAgentHandoffManager();

module.exports = defaultManager;
module.exports.createAgentHandoffManager = createAgentHandoffManager;
