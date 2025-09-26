const path = require('path');
const fs = require('fs');
const fsp = fs.promises;

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.idea',
  '.vscode',
  '.cache',
  '.next',
  '.turbo',
  'dist',
  'build',
  'coverage',
  'logs',
  'tmp',
  'temp'
]);

const CODE_EXTENSIONS = new Set([
  '.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.json', '.vue', '.py'
]);

const NODE_BUILTINS = new Set(require('module').builtinModules);

const DIRECTORY_ALIASES = {
  public: { id: 'frontend', name: 'Frontend Interface', type: 'frontend' },
  src: { id: 'src', name: 'Application Source', type: 'code' },
  lib: { id: 'lib', name: 'Library Modules', type: 'code' },
  server: { id: 'server', name: 'Server Layer', type: 'backend' },
  agents: { id: 'agents', name: 'Agent Library', type: 'knowledge' },
  docs: { id: 'docs', name: 'Documentation', type: 'documentation' },
  data: { id: 'data', name: 'Workspace Data', type: 'storage' },
  spec: { id: 'spec', name: 'Spec Archive', type: 'artifacts' },
  exports: { id: 'legacy-exports', name: 'Legacy Exports', type: 'artifacts' },
  scripts: { id: 'scripts', name: 'Automation Scripts', type: 'automation' }
};

const COMPOSITE_DIRECTORIES = new Set([
  'packages',
  'apps',
  'services',
  'modules',
  'workspaces'
]);

const FRAMEWORK_HINTS = {
  frontend: ['react', 'vue', 'angular', 'svelte', 'next', 'nuxt'],
  backend: ['express', 'koa', 'fastify', 'nest', 'hapi'],
  database: ['mongoose', 'sequelize', 'prisma', 'pg', 'mysql'],
  docs: ['docusaurus', 'mkdocs', 'sphinx']
};

async function readJson(filePath) {
  try {
    const raw = await fsp.readFile(filePath, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function sanitizeId(name) {
  return name.replace(/[^a-zA-Z0-9-_]/g, '-').replace(/-+/g, '-').toLowerCase();
}

function normalizePath(targetPath) {
  return path.normalize(targetPath);
}

function inferCoverage(fileCount, testFileCount) {
  if (fileCount === 0) return 0;
  return Math.round((testFileCount / fileCount) * 100);
}

function computeHealth({ todoCount, externalCount, coverage }) {
  const coveragePenalty = coverage >= 50 ? 0 : (50 - coverage) * 0.5;
  const todoPenalty = todoCount * 5;
  const externalPenalty = Math.min(externalCount * 1.5, 20);
  const raw = 100 - coveragePenalty - todoPenalty - externalPenalty;
  return Math.max(20, Math.min(100, Math.round(raw)));
}

function classifyDirectory(entryName) {
  const alias = DIRECTORY_ALIASES[entryName];
  if (alias) {
    return {
      id: alias.id,
      name: alias.name,
      type: alias.type
    };
  }

  return {
    id: sanitizeId(entryName),
    name: entryName.replace(/[-_]/g, ' ').replace(/\b\w/g, c => c.toUpperCase()),
    type: 'code'
  };
}

function determineFrameworksForModule(moduleType, packageDeps) {
  const hints = FRAMEWORK_HINTS[moduleType];
  if (!hints) return [];
  return hints.filter(dep => packageDeps.has(dep));
}

function resolveImportTarget(fromFile, rawImport) {
  if (!rawImport.startsWith('.')) return null;

  const baseDir = path.dirname(fromFile);
  const directPath = path.resolve(baseDir, rawImport);
  const candidateFiles = [
    directPath,
    `${directPath}.js`,
    `${directPath}.ts`,
    `${directPath}.json`,
    `${directPath}.jsx`,
    `${directPath}.tsx`,
    path.join(directPath, 'index.js'),
    path.join(directPath, 'index.ts')
  ];

  for (const candidate of candidateFiles) {
    if (fs.existsSync(candidate)) {
      return normalizePath(candidate);
    }
  }

  return null;
}

function parseImports(source) {
  const localImports = new Set();
  const externalImports = new Set();

  const importRegex = /import\s+(?:[^;'"\n]+?\s+from\s+)?['"]([^'"]+)['"]/g;
  const requireRegex = /require\(\s*['"]([^'"]+)['"]\s*\)/g;
  const dynamicImportRegex = /import\(\s*['"]([^'"]+)['"]\s*\)/g;

  let match;
  while ((match = importRegex.exec(source)) !== null) {
    const target = match[1];
    if (target.startsWith('.')) localImports.add(target);
    else if (!NODE_BUILTINS.has(target)) externalImports.add(target.split('/')[0]);
  }

  while ((match = requireRegex.exec(source)) !== null) {
    const target = match[1];
    if (target.startsWith('.')) localImports.add(target);
    else if (!NODE_BUILTINS.has(target)) externalImports.add(target.split('/')[0]);
  }

  while ((match = dynamicImportRegex.exec(source)) !== null) {
    const target = match[1];
    if (target.startsWith('.')) localImports.add(target);
    else if (!NODE_BUILTINS.has(target)) externalImports.add(target.split('/')[0]);
  }

  return {
    local: Array.from(localImports),
    external: Array.from(externalImports)
  };
}

async function loadManualModules(rootDir) {
  const dataPath = path.join(rootDir, 'data', 'modules.json');
  const legacyPath = path.join(rootDir, 'modules.json');
  let manual = await readJson(dataPath);
  if (!manual) manual = await readJson(legacyPath);
  if (!manual) return [];
  const records = Array.isArray(manual) ? manual : Array.isArray(manual.modules) ? manual.modules : [];
  return records.map(entry => {
    if (!entry || typeof entry !== 'object') return null;
    const normalized = { ...entry };
    normalized.id = normalized.id || sanitizeId(normalized.name || 'custom-module');
    normalized.type = normalized.type || 'custom';
    normalized.dependencies = Array.isArray(normalized.dependencies) ? normalized.dependencies : [];
    normalized.externalDependencies = Array.isArray(normalized.externalDependencies) ? normalized.externalDependencies : [];
    normalized.frameworks = Array.isArray(normalized.frameworks) ? normalized.frameworks : [];
    normalized.rootPaths = [];
    if (normalized.path) {
      const absolute = path.isAbsolute(normalized.path)
        ? normalizePath(normalized.path)
        : normalizePath(path.join(rootDir, normalized.path));
      normalized.rootPaths.push(absolute);
    } else if (Array.isArray(normalized.rootPaths)) {
      normalized.rootPaths = normalized.rootPaths.map(p => normalizePath(path.isAbsolute(p) ? p : path.join(rootDir, p)));
    }
    normalized.source = 'manual';
    normalized.manual = true;
    return normalized;
  }).filter(Boolean);
}

async function loadManualLinks(rootDir) {
  const primaryPath = path.join(rootDir, 'data', 'module-links.json');
  const fallbackPath = path.join(rootDir, 'module-links.json');
  let links = await readJson(primaryPath);
  if (!links) links = await readJson(fallbackPath);
  if (!Array.isArray(links)) return [];
  return links.filter(link => link && link.source && link.target);
}

async function detectModules(rootDir) {
  const packageJson = await readJson(path.join(rootDir, 'package.json'));
  const packageDeps = new Set();
  if (packageJson) {
    const deps = Object.keys(packageJson.dependencies || {});
    const devDeps = Object.keys(packageJson.devDependencies || {});
    deps.concat(devDeps).forEach(dep => packageDeps.add(dep));
  }

  const modules = new Map();

  function ensureModule(definition) {
    if (!definition || !definition.id) return null;
    const id = definition.id;
    if (!modules.has(id)) {
      modules.set(id, {
        id,
        name: definition.name,
        type: definition.type || 'code',
        rootPaths: new Set(definition.rootPaths || []),
        dependencies: new Set(),
        externalDependencies: new Set(),
        fileCount: 0,
        lineCount: 0,
        todoCount: 0,
        testFileCount: 0,
        frameworks: new Set(determineFrameworksForModule(definition.type, packageDeps)),
        pathHints: new Set(definition.rootPaths || []),
        source: definition.source || 'auto'
      });
    } else if (definition.rootPaths) {
      const record = modules.get(id);
      definition.rootPaths.forEach(p => record.rootPaths.add(p));
      definition.rootPaths.forEach(p => record.pathHints.add(p));
    }
    const record = modules.get(id);
    if (definition.source) {
      record.source = definition.source;
    }
    if (definition.manual) {
      record.manual = true;
    }
    return record;
  }

  // Backend module (server.js or app.js)
  const backendCandidates = ['server.js', 'app.js', 'index.js'];
  for (const candidate of backendCandidates) {
    const abs = path.join(rootDir, candidate);
    if (fs.existsSync(abs) && fs.statSync(abs).isFile()) {
      ensureModule({
        id: 'backend',
        name: 'Backend API',
        type: 'backend',
        rootPaths: [normalizePath(abs)],
        source: 'auto'
      });
      break;
    }
  }

  const entries = await fsp.readdir(rootDir, { withFileTypes: true });

  async function registerCompositeModules(parentName, parentPath) {
    let children;
    try {
      children = await fsp.readdir(parentPath, { withFileTypes: true });
    } catch {
      return;
    }

    let hasLocalFiles = false;

    for (const child of children) {
      if (child.isFile()) {
        const ext = path.extname(child.name).toLowerCase();
        if (CODE_EXTENSIONS.has(ext)) {
          hasLocalFiles = true;
        }
        continue;
      }

      if (!child.isDirectory()) continue;
      if (child.name.startsWith('.')) continue;
      if (IGNORED_DIRECTORIES.has(child.name)) continue;

      const childRoot = normalizePath(path.join(parentPath, child.name));
      const classification = classifyDirectory(child.name);

      ensureModule({
        ...classification,
        rootPaths: [childRoot],
        source: 'directory'
      });

      if (COMPOSITE_DIRECTORIES.has(child.name.toLowerCase())) {
        await registerCompositeModules(child.name, childRoot);
      }
    }

    if (hasLocalFiles) {
      const classification = classifyDirectory(parentName);
      ensureModule({
        ...classification,
        type: classification.type === 'code' ? 'workspace' : classification.type,
        rootPaths: [normalizePath(parentPath)],
        source: 'directory'
      });
    }
  }

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const entryPath = path.join(rootDir, entry.name);
    const lowerName = entry.name.toLowerCase();

    if (COMPOSITE_DIRECTORIES.has(lowerName)) {
      await registerCompositeModules(entry.name, entryPath);
      continue;
    }

    const classification = classifyDirectory(entry.name);
    const moduleRoot = normalizePath(entryPath);

    ensureModule({
      ...classification,
      rootPaths: [moduleRoot],
      source: 'directory'
    });
  }

  // Merge manual modules (persisted custom modules)
  const manualModules = await loadManualModules(rootDir);
  for (const manual of manualModules) {
    if (!manual || !manual.id) continue;
    const rootPaths = [];
    if (manual.path) {
      const potentialPath = normalizePath(path.isAbsolute(manual.path)
        ? manual.path
        : path.join(rootDir, manual.path));
      rootPaths.push(potentialPath);
    }
    const record = ensureModule({
      id: manual.id,
      name: manual.name || manual.id,
      type: manual.type || 'custom',
      rootPaths,
      source: 'manual',
      manual: true
    });

    if (record) {
      (manual.dependencies || []).forEach(dep => record.dependencies.add(dep));
      (manual.externalDependencies || []).forEach(dep => record.externalDependencies.add(dep));
      if (Array.isArray(manual.frameworks)) {
        manual.frameworks.forEach(fw => record.frameworks.add(fw));
      }
      if (typeof manual.fileCount === 'number') record.fileCount = manual.fileCount;
      if (typeof manual.lineCount === 'number') record.lineCount = manual.lineCount;
      if (typeof manual.todoCount === 'number') record.todoCount = manual.todoCount;
      if (typeof manual.testFileCount === 'number') record.testFileCount = manual.testFileCount;
    }
  }

  const moduleList = Array.from(modules.values());
  const moduleRootOwner = new Map();
  moduleList.forEach(module => {
    module.rootPaths.forEach(rootPath => {
      moduleRootOwner.set(rootPath, module.id);
    });
  });

  function findModuleForPath(targetPath) {
    const normalized = normalizePath(targetPath);
    for (const module of moduleList) {
      for (const rootPath of module.rootPaths) {
        if (normalized === rootPath) return module;
        if (normalized.startsWith(rootPath + path.sep)) return module;
      }
    }
    return null;
  }

  async function walkFileSystem(startPath, currentModuleId, visitor) {
    const stats = await fsp.stat(startPath);

    if (stats.isDirectory()) {
      const normalized = normalizePath(startPath);
      const owner = moduleRootOwner.get(normalized);
      if (owner && owner !== currentModuleId) {
        return;
      }

      const baseName = path.basename(startPath);
      if (IGNORED_DIRECTORIES.has(baseName)) return;

      const children = await fsp.readdir(startPath);
      for (const child of children) {
        await walkFileSystem(path.join(startPath, child), currentModuleId, visitor);
      }
      return;
    }

    await visitor(startPath);
  }

  for (const module of moduleList) {
    const visited = new Set();
    for (const rootPath of module.rootPaths) {
      const stats = await fsp.stat(rootPath).catch(() => null);
      if (!stats) continue;
      if (stats.isDirectory()) {
        await walkFileSystem(rootPath, module.id, async filePath => {
          if (visited.has(filePath)) return;
          visited.add(filePath);

          const ext = path.extname(filePath).toLowerCase();
          if (!CODE_EXTENSIONS.has(ext)) return;

          let content;
          try {
            content = await fsp.readFile(filePath, 'utf8');
          } catch {
            return;
          }

          const lineCount = content.split(/\r?\n/).length;
          const todoMatches = content.match(/TODO|FIXME/gi);
          const todos = todoMatches ? todoMatches.length : 0;

          module.fileCount += 1;
          module.lineCount += lineCount;
          module.todoCount += todos;
          if (/test|spec|__tests__/i.test(filePath)) {
            module.testFileCount += 1;
          }

          const imports = parseImports(content);

          imports.local.forEach(localPath => {
            const resolved = resolveImportTarget(filePath, localPath);
            if (!resolved) return;
            const targetModule = findModuleForPath(resolved);
            if (targetModule && targetModule.id !== module.id) {
              module.dependencies.add(targetModule.id);
            }
          });

          imports.external.forEach(extDep => module.externalDependencies.add(extDep));
        });
      } else {
        if (!CODE_EXTENSIONS.has(path.extname(rootPath))) continue;

        let content;
        try {
          content = await fsp.readFile(rootPath, 'utf8');
        } catch {
          continue;
        }

        const lineCount = content.split(/\r?\n/).length;
        const todoMatches = content.match(/TODO|FIXME/gi);
        const todos = todoMatches ? todoMatches.length : 0;
        module.fileCount += 1;
        module.lineCount += lineCount;
        module.todoCount += todos;

        const imports = parseImports(content);
        imports.local.forEach(localPath => {
          const resolved = resolveImportTarget(rootPath, localPath);
          if (!resolved) return;
          const targetModule = findModuleForPath(resolved);
          if (targetModule && targetModule.id !== module.id) {
            module.dependencies.add(targetModule.id);
          }
        });
        imports.external.forEach(extDep => module.externalDependencies.add(extDep));
      }
    }
  }

  // Apply manual links after automated detection
  const manualLinks = await loadManualLinks(rootDir);
  for (const link of manualLinks) {
    const source = modules.get(link.source);
    if (!source) continue;
    if (link.target && link.target !== source.id) {
      const targetExists = modules.has(link.target);
      if (targetExists) {
        source.dependencies.add(link.target);
      }
    }
  }

  const edges = [];

  const resultModules = moduleList.map(module => {
    const coverage = inferCoverage(module.fileCount, module.testFileCount);
    const externalCount = module.externalDependencies.size;
    const health = computeHealth({
      todoCount: module.todoCount,
      externalCount,
      coverage
    });

    const dependencies = Array.from(module.dependencies);
    const externalDependencies = Array.from(module.externalDependencies);
    const pathHints = Array.from(module.pathHints)
      .map(hint => {
        const relative = path.relative(rootDir, hint);
        if (!relative || relative === '') {
          return path.basename(hint);
        }
        return relative;
      })
      .filter(Boolean);

    dependencies.forEach(target => {
      edges.push({
        id: `${module.id}->${target}`,
        source: module.id,
        target,
        type: 'internal'
      });
    });

    return {
      id: module.id,
      name: module.name,
      type: module.type,
      pathHints,
      dependencies,
      externalDependencies,
      fileCount: module.fileCount,
      lineCount: module.lineCount,
      todoCount: module.todoCount,
      coverage,
      health,
      frameworks: Array.from(module.frameworks),
      source: module.source || 'auto',
      manual: Boolean(module.manual)
    };
  });

  const filteredModules = resultModules.filter(module => {
    if (module.manual) return true;
    if (module.source === 'directory') {
      const hasRoot = Array.isArray(module.pathHints) && module.pathHints.length > 0;
      if (hasRoot) return true;
    }
    const hasCode = module.fileCount > 0 || module.lineCount > 0;
    const hasDeps = (module.dependencies || []).length > 0;
    const hasExternal = (module.externalDependencies || []).length > 0;
    return hasCode || hasDeps || hasExternal;
  });

  const validIds = new Set(filteredModules.map(module => module.id));
  const filteredEdges = edges.filter(edge => validIds.has(edge.source) && validIds.has(edge.target));

  const filteredSummary = {
    moduleCount: filteredModules.length,
    dependencyCount: filteredEdges.length,
    externalDependencyCount: filteredModules.reduce((total, module) => total + module.externalDependencies.length, 0),
    totalLines: filteredModules.reduce((total, module) => total + module.lineCount, 0)
  };

  return {
    modules: filteredModules,
    edges: filteredEdges,
    summary: filteredSummary
  };
}

module.exports = {
  detectModules
};
