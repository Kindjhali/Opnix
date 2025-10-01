const path = require('path');
const fs = require('fs');
const fsPromises = fs.promises;
const moduleDetector = require('./moduleDetector');

const STALE_THRESHOLD_SECONDS = 6 * 60 * 60; // 6 hours
const DEPENDENCY_CATEGORY_RULES = [
  { key: 'frontend', label: 'Frontend', keywords: ['react', 'vue', 'svelte', 'angular', 'next', 'nuxt', 'tailwind', 'vite', 'chakra', 'mui', 'emotion', 'storybook'] },
  { key: 'backend', label: 'Backend', keywords: ['express', 'fastify', 'koa', 'nest', 'django', 'flask', 'fastapi', 'spring', 'nestjs', 'apollo-server', 'hapi', 'laravel'] },
  { key: 'api', label: 'API & Clients', keywords: ['axios', 'graphql', 'openapi', 'swagger', 'superagent', 'got', 'ky'] },
  { key: 'data', label: 'Data & Storage', keywords: ['mongoose', 'prisma', 'sequelize', 'typeorm', 'knex', 'redis', 'pg', 'mysql', 'sqlite', 'drizzle'] },
  { key: 'testing', label: 'Testing', keywords: ['jest', 'vitest', 'mocha', 'chai', 'cypress', 'playwright', 'testing-library', 'ava'] },
  { key: 'build', label: 'Build & Tooling', keywords: ['babel', 'webpack', 'rollup', 'gulp', 'parcel', 'esbuild', 'swc'] },
  { key: 'devops', label: 'DevOps & Deploy', keywords: ['docker', 'kubernetes', 'serverless', 'terraform', 'aws', 'azure', 'gcp'] },
  { key: 'security', label: 'Security & Auth', keywords: ['helmet', 'jsonwebtoken', 'passport', 'auth0', 'owasp'] }
];

const ROOT_DIR = path.join(__dirname, '..');
const DATA_DIR = path.join(ROOT_DIR, 'data');
const CLI_SESSIONS_DIR = path.join(DATA_DIR, 'cli-sessions');
const TECH_STACK_FILE = path.join(DATA_DIR, 'tech-stack.json');
const EXPORTS_DIR = path.join(ROOT_DIR, 'spec');
const STACK_EXPORT_DIR = path.join(EXPORTS_DIR, 'docs');
const PACKAGE_JSON_PATH = path.join(ROOT_DIR, 'package.json');
const DETECTED_MODULES_PATH = path.join(DATA_DIR, 'modules-detected.json');
const MANUAL_MODULES_PATH = path.join(DATA_DIR, 'modules.json');

function sortAlpha(list) {
  return [...list].sort((a, b) => a.localeCompare(b));
}

async function ensureDirectory(dirPath) {
  await fsPromises.mkdir(dirPath, { recursive: true });
}

async function readJson(filePath, fallback = null) {
  try {
    const raw = await fsPromises.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch (error) {
    if (error.code === 'ENOENT') {
      return fallback;
    }
    throw error;
  }
}

function buildDependencyList(deps = {}) {
  return Object.entries(deps)
    .map(([name, version]) => ({ name, version }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function normaliseDependencyName(value) {
  return String(value || '').toLowerCase();
}

function initialiseCategoryBuckets() {
  const map = {};
  DEPENDENCY_CATEGORY_RULES.forEach(rule => {
    map[rule.key] = { label: rule.label, items: [] };
  });
  map.other = { label: 'Other', items: [] };
  return map;
}

function resolveCategoryKey(name) {
  const normalised = normaliseDependencyName(name);
  for (const rule of DEPENDENCY_CATEGORY_RULES) {
    if (rule.keywords.some(keyword => normalised.includes(keyword))) {
      return rule.key;
    }
  }
  return 'other';
}

function categoriseDependencyCollections({ dependencies, devDependencies, modules }) {
  const buckets = initialiseCategoryBuckets();
  const assign = (name, version, source) => {
    if (!name) return;
    const key = resolveCategoryKey(name);
    buckets[key].items.push({ name, version, source });
  };

  dependencies.forEach(dep => assign(dep.name, dep.version, 'runtime'));
  devDependencies.forEach(dep => assign(dep.name, dep.version, 'dev'));
  modules.forEach(module => {
    (module.frameworks || []).forEach(framework => assign(framework, null, `module:${module.id}`));
  });

  Object.values(buckets).forEach(bucket => {
    bucket.items.sort((a, b) => a.name.localeCompare(b.name));
  });

  return buckets;
}

function buildCacheInfo(generatedAt) {
  const base = {
    generatedAt,
    ageSeconds: null,
    staleThresholdSeconds: STALE_THRESHOLD_SECONDS,
    isStale: false
  };
  const timestamp = Date.parse(generatedAt || '');
  if (!Number.isFinite(timestamp)) {
    return base;
  }
  const ageSeconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000));
  return {
    ...base,
    ageSeconds,
    refreshedAt: new Date().toISOString(),
    isStale: ageSeconds > STALE_THRESHOLD_SECONDS
  };
}

function attachCacheInfo(summary) {
  if (!summary) {
    return null;
  }
  const cacheInfo = buildCacheInfo(summary.generatedAt);
  summary.cacheInfo = cacheInfo;
  summary.isStale = cacheInfo.isStale;
  summary.ageSeconds = cacheInfo.ageSeconds;
  return summary;
}

function mergeModules(detectedModules = [], manualModules = []) {
  const modules = new Map();

  detectedModules.forEach(module => {
    if (!module || !module.id) return;
    modules.set(String(module.id), {
      ...module,
      source: module.source || 'auto',
      manual: Boolean(module.manual)
    });
  });

  manualModules.forEach(module => {
    if (!module || !module.id) return;
    const id = String(module.id);
    const existing = modules.get(id) || {};
    modules.set(id, {
      ...existing,
      ...module,
      id,
      source: module.source || existing.source || 'manual',
      manual: true
    });
  });

  return Array.from(modules.values());
}

function summariseModules(modules = []) {
  const summary = {
    total: modules.length,
    detectedCount: modules.filter(module => module.manual !== true).length,
    manualCount: modules.filter(module => module.manual === true).length,
    byType: {},
    externalDependencyCount: 0
  };

  const moduleDetails = modules.map(module => {
    const type = module.type || 'code';
    summary.byType[type] = (summary.byType[type] || 0) + 1;

    const externalDependencies = Array.isArray(module.externalDependencies)
      ? sortAlpha(module.externalDependencies)
      : [];
    summary.externalDependencyCount += externalDependencies.length;

    const frameworks = Array.isArray(module.frameworks)
      ? sortAlpha(module.frameworks)
      : [];

    return {
      id: module.id,
      name: module.name,
      type,
      source: module.source || (module.manual ? 'manual' : 'auto'),
      manual: Boolean(module.manual),
      health: module.health || null,
      coverage: module.coverage || null,
      dependencies: Array.isArray(module.dependencies) ? sortAlpha(module.dependencies) : [],
      externalDependencies,
      frameworks,
      pathHints: Array.isArray(module.pathHints) ? module.pathHints : []
    };
  });

  return {
    ...summary,
    details: moduleDetails
  };
}

async function loadPackageJson() {
  return readJson(PACKAGE_JSON_PATH, {});
}

async function loadDetectedModulesSnapshot() {
  const snapshot = await readJson(DETECTED_MODULES_PATH, null);
  if (snapshot && Array.isArray(snapshot.modules)) {
    return snapshot.modules;
  }
  return null;
}

async function loadManualModulesSnapshot() {
  const snapshot = await readJson(MANUAL_MODULES_PATH, null);
  if (!snapshot) return [];
  if (Array.isArray(snapshot)) return snapshot;
  if (Array.isArray(snapshot.modules)) return snapshot.modules;
  return [];
}

async function loadModules() {
  let detectedModules = await loadDetectedModulesSnapshot();
  if (!detectedModules) {
    try {
      const result = await moduleDetector.detectModules(ROOT_DIR);
      detectedModules = Array.isArray(result.modules) ? result.modules : [];
    } catch (error) {
      console.warn('techStackManager: module detection failed, continuing with empty list', error.message);
      detectedModules = [];
    }
  }

  const manualModules = await loadManualModulesSnapshot();
  return mergeModules(detectedModules, manualModules);
}

async function loadCliSessions() {
  try {
    const entries = await fsPromises.readdir(CLI_SESSIONS_DIR);
    const sessions = [];
    for (const entry of entries) {
      if (!entry.endsWith('.json')) continue;
      const filePath = path.join(CLI_SESSIONS_DIR, entry);
      try {
        const raw = await fsPromises.readFile(filePath, 'utf8');
        const session = JSON.parse(raw);
        sessions.push(session);
      } catch (error) {
        console.warn('techStackManager: failed to parse CLI session', entry, error.message);
      }
    }
    return sessions;
  } catch (error) {
    if (error.code === 'ENOENT') {
      return [];
    }
    throw error;
  }
}

function buildCliInsights(sessions = []) {
  const contexts = {
    project: new Map(),
    module: new Map()
  };

  sessions.forEach(session => {
    if (!session || !Array.isArray(session.questions)) return;
    const questionMap = new Map();
    session.questions.forEach(question => {
      if (question && question.id) {
        questionMap.set(question.id, question);
      }
    });

    const responses = Array.isArray(session.responses) ? session.responses : [];
    responses.forEach(response => {
      if (!response || !response.questionId) return;
      const question = questionMap.get(response.questionId);
      if (!question) return;
      const contextKey = String(question.context || 'project').toLowerCase();
      if (!Object.prototype.hasOwnProperty.call(contexts, contextKey)) return;

      const record = contexts[contextKey];
      const existing = record.get(question.id);
      const recordedAt = response.recordedAt || session.updatedAt || session.createdAt || new Date().toISOString();
      if (existing && new Date(existing.recordedAt || 0) > new Date(recordedAt)) {
        return;
      }

      record.set(question.id, {
        questionId: question.id,
        sectionId: question.sectionId || null,
        prompt: question.prompt,
        answer: response.answer,
        recordedAt,
        sessionId: session.sessionId || null
      });
    });
  });

  const formatBucket = bucket => Array.from(bucket.values()).sort((a, b) => (b.recordedAt || '').localeCompare(a.recordedAt || ''));

  return {
    project: formatBucket(contexts.project),
    module: formatBucket(contexts.module),
    sessionsAnalyzed: sessions.length
  };
}

function buildFrameworkList({ dependencies, devDependencies, modules }) {
  const frameworks = new Set();
  dependencies.forEach(dep => frameworks.add(dep.name.toLowerCase()));
  devDependencies.forEach(dep => frameworks.add(dep.name.toLowerCase()));
  modules.forEach(module => {
    (module.frameworks || []).forEach(framework => frameworks.add(String(framework).toLowerCase()));
  });

  return sortAlpha(Array.from(frameworks));
}

function buildSummary({ packageJson, modules, cliInsights }) {
  const dependencies = buildDependencyList(packageJson.dependencies);
  const devDependencies = buildDependencyList(packageJson.devDependencies);
  const moduleSummary = summariseModules(modules);
  const frameworks = buildFrameworkList({ dependencies, devDependencies, modules });
  const dependencyCategories = categoriseDependencyCollections({ dependencies, devDependencies, modules });

  return attachCacheInfo({
    generatedAt: new Date().toISOString(),
    package: {
      name: packageJson.name || 'unregistered-project',
      version: packageJson.version || '0.0.0',
      packageManager: packageJson.packageManager || 'npm'
    },
    dependencies: {
      total: dependencies.length,
      items: dependencies
    },
    devDependencies: {
      total: devDependencies.length,
      items: devDependencies
    },
    frameworks,
    moduleSummary,
    dependencyCategories,
    cliInsights
  });
}

function formatMarkdownList(items, fallback = '_None declared._') {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }
  return items.map(item => `- ${item}`).join('\n');
}

function formatDependencyMarkdown(items = [], fallback = '_None declared._') {
  if (!Array.isArray(items) || items.length === 0) {
    return fallback;
  }
  return items.map(item => `- ${item.name} 9 ${item.version || 'latest'}`).join('\n');
}

function buildMarkdown(summary) {
  const { package: pkg, dependencies, devDependencies, frameworks, moduleSummary, cliInsights, dependencyCategories } = summary;
  const lines = [];

  lines.push(`# Tech Stack Summary`);
  lines.push('');
  lines.push(`Generated at: ${summary.generatedAt}`);
  lines.push('');
  lines.push(`## Package`);
  lines.push(`- Name: ${pkg.name}`);
  lines.push(`- Version: ${pkg.version}`);
  lines.push(`- Package Manager: ${pkg.packageManager}`);
  lines.push('');
  lines.push('## Frameworks');
  lines.push(formatMarkdownList(frameworks));
  lines.push('');
  lines.push('## Dependencies');
  lines.push(formatDependencyMarkdown(dependencies.items));
  lines.push('');
  lines.push('## Dev Dependencies');
  lines.push(formatDependencyMarkdown(devDependencies.items));
  lines.push('');
  lines.push('## Modules');
  lines.push('');
  lines.push('## Categorised Dependencies');
  Object.entries(dependencyCategories || {}).forEach(([key, bucket]) => {
    const heading = bucket.label || key;
    const entries = Array.isArray(bucket.items) ? bucket.items : [];
    lines.push(`### ${heading}`);
    if (!entries.length) {
      lines.push('_No packages recorded._');
    } else {
      entries.forEach(entry => {
        const version = entry.version ? ` @ ${entry.version}` : '';
        const source = entry.source ? ` [${entry.source}]` : '';
        lines.push(`- ${entry.name}${version}${source}`);
      });
    }
    lines.push('');
  });
  lines.push(`- Total: ${moduleSummary.total}`);
  lines.push(`- Detected: ${moduleSummary.detectedCount}`);
  lines.push(`- Manual: ${moduleSummary.manualCount}`);
  lines.push(`- External Dependencies: ${moduleSummary.externalDependencyCount}`);
  lines.push('');
  Object.entries(moduleSummary.byType || {}).forEach(([type, count]) => {
    lines.push(`- ${type}: ${count}`);
  });
  lines.push('');
  moduleSummary.details.forEach(module => {
    lines.push(`### ${module.name} (${module.id})`);
    lines.push(`- Type: ${module.type}`);
    lines.push(`- Source: ${module.manual ? 'manual' : module.source}`);
    if (module.health !== null && module.health !== undefined) {
      lines.push(`- Health: ${module.health}%`);
    }
    if (module.coverage !== null && module.coverage !== undefined) {
      lines.push(`- Coverage: ${module.coverage}%`);
    }
    lines.push(`- Frameworks: ${module.frameworks.length ? module.frameworks.join(', ') : 'none'}`);
    lines.push(`- Dependencies: ${module.dependencies.length ? module.dependencies.join(', ') : 'none'}`);
    lines.push(`- External Dependencies: ${module.externalDependencies.length ? module.externalDependencies.join(', ') : 'none'}`);
    lines.push('');
  });

  lines.push('## CLI Insights — Project Context');
  if (cliInsights.project.length === 0) {
    lines.push('_No project-level responses captured yet._');
  } else {
    cliInsights.project.forEach(entry => {
      lines.push(`- **${entry.prompt}**`);
      lines.push(`  - Answer: ${entry.answer}`);
      lines.push(`  - Recorded At: ${entry.recordedAt}`);
      if (entry.sessionId) {
        lines.push(`  - Session: ${entry.sessionId}`);
      }
    });
  }
  lines.push('');
  lines.push('## CLI Insights — Module Context');
  if (cliInsights.module.length === 0) {
    lines.push('_No module-level responses captured yet._');
  } else {
    cliInsights.module.forEach(entry => {
      lines.push(`- **${entry.prompt}**`);
      lines.push(`  - Answer: ${entry.answer}`);
      lines.push(`  - Recorded At: ${entry.recordedAt}`);
      if (entry.sessionId) {
        lines.push(`  - Session: ${entry.sessionId}`);
      }
    });
  }

  return lines.join('\n');
}

async function writeTechStackSummary(summary) {
  await ensureDirectory(DATA_DIR);
  await fsPromises.writeFile(TECH_STACK_FILE, JSON.stringify(summary, null, 2));
  return summary;
}

async function readCachedSummary() {
  return readJson(TECH_STACK_FILE, null);
}

async function computeSummary() {
  const [packageJson, modules, sessions] = await Promise.all([
    loadPackageJson(),
    loadModules(),
    loadCliSessions()
  ]);

  const cliInsights = buildCliInsights(sessions);
  return buildSummary({ packageJson, modules, cliInsights });
}

async function getTechStackSummary({ refresh = false } = {}) {
  if (!refresh) {
    const cached = await readCachedSummary();
    if (cached) {
      return attachCacheInfo(cached);
    }
  }

  const summary = await computeSummary();
  await writeTechStackSummary(summary);
  return attachCacheInfo(summary);
}

async function refreshTechStackSummary() {
  return getTechStackSummary({ refresh: true });
}

async function exportTechStackMarkdown() {
  const summary = await refreshTechStackSummary();
  await ensureDirectory(STACK_EXPORT_DIR);
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `tech-stack-${timestamp}.md`;
  const filePath = path.join(STACK_EXPORT_DIR, filename);
  await fsPromises.writeFile(filePath, buildMarkdown(summary));
  return {
    success: true,
    export: {
      filename,
      path: filePath,
      relativePath: path.relative(EXPORTS_DIR, filePath)
    }
  };
}

async function recordCliSessionImpact() {
  try {
    await refreshTechStackSummary();
  } catch (error) {
    console.warn('techStackManager: failed to refresh summary after CLI session', error.message);
  }
}

module.exports = {
  getTechStackSummary,
  refreshTechStackSummary,
  exportTechStackMarkdown,
  recordCliSessionImpact
};
