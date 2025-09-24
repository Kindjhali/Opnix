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
  exports: { id: 'exports', name: 'Generated Exports', type: 'artifacts' },
  scripts: { id: 'scripts', name: 'Automation Scripts', type: 'automation' }
};

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
  } catch (error) {
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

  const importRegex = /import\s+(?:[^;'"\n]+?\s+from\s+)?['\"]([^'\"]+)['\"]/g;
  const requireRegex = /require\(\s*['\"]([^'\"]+)['\"]\s*\)/g;
  const dynamicImportRegex = /import\(\s*['\"]([^'\"]+)['\"]\s*\)/g;

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
  const manualPath = path.join(rootDir, 'modules.json');
  const manual = await readJson(manualPath);
  if (!manual) return [];
  if (Array.isArray(manual)) return manual;
  if (Array.isArray(manual.modules)) return manual.modules;
  return [];
}

async function loadManualLinks(rootDir) {
  const linksPath = path.join(rootDir, 'module-links.json');
  const links = await readJson(linksPath);
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
        pathHints: new Set(definition.rootPaths || [])
      });
    } else if (definition.rootPaths) {
      const record = modules.get(id);
      definition.rootPaths.forEach(p => record.rootPaths.add(p));
      definition.rootPaths.forEach(p => record.pathHints.add(p));
    }
    return modules.get(id);
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
        rootPaths: [normalizePath(abs)]
      });
      break;
    }
  }

  const entries = await fsp.readdir(rootDir, { withFileTypes: true });

  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    if (IGNORED_DIRECTORIES.has(entry.name)) continue;
    if (entry.name.startsWith('.')) continue;

    const classification = classifyDirectory(entry.name);
    const moduleRoot = normalizePath(path.join(rootDir, entry.name));

    ensureModule({
      ...classification,
      rootPaths: [moduleRoot]
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
      rootPaths
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

  async function walkFileSystem(startPath, visitor) {
    const stats = await fsp.stat(startPath);

    if (stats.isDirectory()) {
      const baseName = path.basename(startPath);
      if (IGNORED_DIRECTORIES.has(baseName)) return;

      const children = await fsp.readdir(startPath);
      for (const child of children) {
        await walkFileSystem(path.join(startPath, child), visitor);
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
        await walkFileSystem(rootPath, async filePath => {
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

  const summary = {
    moduleCount: moduleList.length,
    dependencyCount: 0,
    externalDependencyCount: 0,
    totalLines: 0
  };

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

    summary.dependencyCount += dependencies.length;
    summary.externalDependencyCount += externalDependencies.length;
    summary.totalLines += module.lineCount;

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
      frameworks: Array.from(module.frameworks)
    };
  });

  return {
    modules: resultModules,
    edges,
    summary
  };
}

module.exports = {
  detectModules
};
