const fs = require('fs').promises;
const path = require('path');

const DEFAULT_GATES = {
  version: 1,
  approvals: {
    'pre-implementation-discussion': {
      id: 'pre-implementation-discussion',
      label: 'Pre-Implementation Discussion',
      description: 'Document architecture, risks, and review notes before implementation begins.',
      status: 'pending',
      approvedBy: null,
      approvedRole: null,
      notes: null,
      updatedAt: null
    }
  },
  commands: {
    '/branch': ['pre-implementation-discussion'],
    '/plan': ['pre-implementation-discussion'],
    '/tasks': ['pre-implementation-discussion']
  },
  tools: {
    'git-branch-create': ['pre-implementation-discussion'],
    'implementation-chain': ['pre-implementation-discussion']
  }
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function normaliseRequirementList(list) {
  if (!Array.isArray(list)) {
    return [];
  }
  return list
    .map(value => (typeof value === 'string' ? value.trim() : null))
    .filter(Boolean)
    .map(value => value.toLowerCase());
}

class ApprovalGatesManager {
  constructor({ dataFile, defaults = DEFAULT_GATES, logger = console } = {}) {
    if (!dataFile) {
      throw new Error('ApprovalGatesManager requires a dataFile path');
    }
    this.dataFile = dataFile;
    this.defaults = clone(defaults);
    this.logger = logger || console;
    this.cache = null;
    this.loadingPromise = null;
  }

  async ensureLoaded() {
    if (this.cache) {
      return this.cache;
    }
    if (this.loadingPromise) {
      return this.loadingPromise;
    }
    this.loadingPromise = this.loadGates();
    try {
      const gates = await this.loadingPromise;
      this.cache = gates;
      return gates;
    } finally {
      this.loadingPromise = null;
    }
  }

  async loadGates() {
    try {
      const raw = await fs.readFile(this.dataFile, 'utf8');
      const parsed = JSON.parse(raw);
      return this.mergeWithDefaults(parsed);
    } catch (error) {
      if (error.code === 'ENOENT') {
        const defaults = this.mergeWithDefaults(clone(this.defaults));
        await this.saveGates(defaults);
        return defaults;
      }
      throw error;
    }
  }

  mergeWithDefaults(gates) {
    const merged = clone(this.defaults);

    if (gates && typeof gates === 'object') {
      if (gates.version) {
        merged.version = gates.version;
      }

      if (gates.approvals && typeof gates.approvals === 'object') {
        Object.entries(gates.approvals).forEach(([key, value]) => {
          merged.approvals[key] = {
            ...merged.approvals[key],
            ...value,
            id: key
          };
        });
      }

      if (gates.commands && typeof gates.commands === 'object') {
        merged.commands = { ...merged.commands };
        Object.entries(gates.commands).forEach(([command, requirements]) => {
          merged.commands[command] = normaliseRequirementList(requirements);
        });
      }

      if (gates.tools && typeof gates.tools === 'object') {
        merged.tools = { ...merged.tools };
        Object.entries(gates.tools).forEach(([tool, requirements]) => {
          merged.tools[tool] = normaliseRequirementList(requirements);
        });
      }
    }

    // Ensure defaults exist even if overwritten with empty structures
    Object.entries(this.defaults.approvals).forEach(([key, value]) => {
      if (!merged.approvals[key]) {
        merged.approvals[key] = clone(value);
      }
    });

    Object.entries(this.defaults.commands).forEach(([command, requirements]) => {
      if (!merged.commands[command]) {
        merged.commands[command] = normaliseRequirementList(requirements);
      }
    });

    Object.entries(this.defaults.tools).forEach(([tool, requirements]) => {
      if (!merged.tools[tool]) {
        merged.tools[tool] = normaliseRequirementList(requirements);
      }
    });

    return merged;
  }

  async saveGates(gates) {
    this.cache = gates;
    await fs.mkdir(path.dirname(this.dataFile), { recursive: true });
    await fs.writeFile(this.dataFile, JSON.stringify(gates, null, 2));
    return gates;
  }

  async getApprovals() {
    const gates = await this.ensureLoaded();
    return gates.approvals;
  }

  async getApproval(gateId) {
    const approvals = await this.getApprovals();
    return approvals[gateId] || null;
  }

  async getCommandRequirements(command) {
    const gates = await this.ensureLoaded();
    return normaliseRequirementList(gates.commands?.[command] || []);
  }

  async getToolRequirements(toolId) {
    const gates = await this.ensureLoaded();
    return normaliseRequirementList(gates.tools?.[toolId] || []);
  }

  async checkRequirements(requirements = []) {
    const approvals = await this.getApprovals();
    const normalised = normaliseRequirementList(requirements);
    const missing = [];

    normalised.forEach(gateId => {
      const approval = approvals[gateId];
      if (!approval || approval.status !== 'approved') {
        missing.push({
          id: gateId,
          label: approval?.label || gateId,
          description: approval?.description || '',
          status: approval?.status || 'pending'
        });
      }
    });

    return {
      passed: missing.length === 0,
      missing
    };
  }

  async requireRequirements(requirements = []) {
    const status = await this.checkRequirements(requirements);
    if (status.passed) {
      return status;
    }
    const details = status.missing
      .map(entry => `${entry.label} (${entry.status})`)
      .join(', ');
    throw new Error(`Approval gate(s) pending: ${details}`);
  }

  async checkCommand(command) {
    const requirements = await this.getCommandRequirements(command);
    if (!requirements.length) {
      return { passed: true, missing: [] };
    }
    return this.checkRequirements(requirements);
  }

  async checkTool(toolId) {
    const requirements = await this.getToolRequirements(toolId);
    if (!requirements.length) {
      return { passed: true, missing: [] };
    }
    return this.checkRequirements(requirements);
  }

  async requireToolAccess(toolId) {
    const requirements = await this.getToolRequirements(toolId);
    if (!requirements.length) {
      return { passed: true, missing: [] };
    }
    return this.requireRequirements(requirements);
  }

  async approveGate(gateId, { approvedBy, role = null, notes = null } = {}) {
    const gates = await this.ensureLoaded();
    if (!gates.approvals[gateId]) {
      gates.approvals[gateId] = clone(this.defaults.approvals[gateId] || {
        id: gateId,
        label: gateId,
        description: ''
      });
    }

    gates.approvals[gateId] = {
      ...gates.approvals[gateId],
      status: 'approved',
      approvedBy: approvedBy || 'unknown',
      approvedRole: role || null,
      notes: notes || null,
      updatedAt: new Date().toISOString()
    };

    await this.saveGates(gates);
    return gates.approvals[gateId];
  }

  async resetGate(gateId, { notes = null } = {}) {
    const gates = await this.ensureLoaded();
    if (!gates.approvals[gateId]) {
      gates.approvals[gateId] = clone(this.defaults.approvals[gateId] || {
        id: gateId,
        label: gateId,
        description: ''
      });
    }

    gates.approvals[gateId] = {
      ...gates.approvals[gateId],
      status: 'pending',
      approvedBy: null,
      approvedRole: null,
      notes: notes || null,
      updatedAt: new Date().toISOString()
    };

    await this.saveGates(gates);
    return gates.approvals[gateId];
  }

  async getState() {
    return this.ensureLoaded();
  }
}

module.exports = ApprovalGatesManager;

