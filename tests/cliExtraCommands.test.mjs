import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import fs from 'node:fs/promises';

import { createCliExtraCommands } from '../services/cliExtraCommands.js';
import specGenerator from '../services/specGenerator.js';

const TEMP_ROOT = path.join(process.cwd(), 'test-output', 'cli-extra');
const ARTIFACTS_DIR = path.join(TEMP_ROOT, 'cli-artifacts');
const BLUEPRINTS_DIR = path.join(TEMP_ROOT, 'spec', 'blueprints');

async function setupTempRoot() {
  await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  await Promise.all([
    fs.mkdir(TEMP_ROOT, { recursive: true }),
    fs.mkdir(path.join(TEMP_ROOT, 'agents'), { recursive: true }),
    fs.mkdir(path.join(TEMP_ROOT, 'docs'), { recursive: true })
  ]);

  const docEntries = [
    ['AGENTS.md', '# Agents\n- Development Agent'],
    ['CLAUDE.md', '# Claude Guidance\n- Follow DAIC'],
    ['GEMINI.md', '# Gemini Guidance\n- Provide concise answers'],
    [path.join('agents', 'agent-organizer.md'), '# Agent Organizer\nRoles:'],
    [path.join('docs', 'install-decision-tree.md'), '# Install Decision Tree\nStep 1']
  ];

  await Promise.all(docEntries.map(async ([relativePath, content]) => {
    const absolutePath = path.join(TEMP_ROOT, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }));
}

function createHandlers({ modulesResult } = {}) {
  const detector = {
    async detectModules() {
      return modulesResult || {
        modules: [
          { id: 'core-ui', name: 'Core UI', type: 'frontend', frameworks: ['vue'], path: 'src/modules/core-ui' }
        ],
        edges: [],
        summary: { dependencyCount: 0, totalModules: 1 }
      };
    }
  };

  const readData = async () => ({
    tickets: [
      { id: 1, title: 'Enable dark mode', status: 'reported', priority: 'high' },
      { id: 2, title: 'Increase coverage', status: 'inProgress', priority: 'medium' }
    ],
    nextId: 3
  });

  const readFeaturesFile = async () => ([
    { id: 'FEAT-1', title: 'Authentication', description: 'Sign-in flow', moduleId: 'core-ui' },
    { id: 'FEAT-2', title: 'Settings Panel', description: 'User preferences', moduleId: 'core-ui' }
  ]);

  const loadPackageJson = async () => ({
    name: 'opnix-temp',
    description: 'Temporary specification test',
    dependencies: { vue: '^3.5.0', express: '^5.1.0' },
    devDependencies: { vitest: '^1.0.0' },
    packageManager: 'pnpm@10.13.1'
  });

  const ensureExportStructure = async () => {
    await fs.mkdir(BLUEPRINTS_DIR, { recursive: true });
  };

  const deriveTechStack = (pkg = {}) => ({
    dependencies: Object.keys(pkg.dependencies || {}),
    devDependencies: Object.keys(pkg.devDependencies || {}),
    frameworks: ['vue'],
    packageManager: pkg.packageManager || null
  });

  const inferProjectType = () => 'Web Application';
  const inferPrimaryLanguage = () => 'JavaScript';

  return createCliExtraCommands({
    rootDir: TEMP_ROOT,
    cliArtifactsDir: ARTIFACTS_DIR,
    ensureCliArtifactsDirectory: async () => { await fs.mkdir(ARTIFACTS_DIR, { recursive: true }); },
    moduleDetector: detector,
    readData,
    readFeaturesFile,
    loadPackageJson,
    ensureExportStructure,
    EXPORT_SUBDIRS: { blueprints: BLUEPRINTS_DIR },
    deriveTechStack,
    inferProjectType,
    inferPrimaryLanguage,
    specGenerator
  });
}

test('CLI extra commands prepare constitution digest and scoped spec export', async (t) => {
  await setupTempRoot();
  const handlers = createHandlers();

  t.after(async () => {
    await fs.rm(TEMP_ROOT, { recursive: true, force: true });
  });

  const constitutionResult = await handlers.handleConstitutionCommand('/constitution');
  assert.equal(constitutionResult.result, 'Governance digest ready');
  assert.ok(Array.isArray(constitutionResult.artifacts));
  assert.equal(constitutionResult.artifacts.length, 1);
  const digestArtifact = constitutionResult.artifacts[0];
  const digestExists = await fs.access(digestArtifact.path).then(() => true).catch(() => false);
  assert.ok(digestExists, 'Constitution digest should be written to disk');
  const digestContent = await fs.readFile(digestArtifact.path, 'utf8');
  assert.match(digestContent, /# Governance Constitution Digest/);
  assert.match(digestContent, /Agent Constitution/);

  const specResult = await handlers.handleSpecifyCommand('/specify modules format=json');
  assert.equal(specResult.result, 'Scoped specification ready');
  assert.ok(Array.isArray(specResult.artifacts));
  assert.equal(specResult.artifacts.length, 1);
  const specArtifact = specResult.artifacts[0];
  const specExists = await fs.access(specArtifact.path).then(() => true).catch(() => false);
  assert.ok(specExists, 'Scoped specification export should exist');
  const specContent = await fs.readFile(specArtifact.path, 'utf8');
  const parsedSpec = JSON.parse(specContent);
  assert.equal(Array.isArray(parsedSpec.modules), true);
  assert.equal(parsedSpec.modules.length, 1);
  assert.equal(parsedSpec.features.length, 0, 'Feature list should be empty when only modules section requested');
  assert.equal(specResult.metadata.format, 'json');
  assert.ok(specResult.messages.some(line => line.includes('Sections included')));

  const fullSpecResult = await handlers.handleSpecifyCommand('/specify format=json');
  const fullSpecContent = await fs.readFile(fullSpecResult.artifacts[0].path, 'utf8');
  const fullSpec = JSON.parse(fullSpecContent);
  assert.equal(fullSpec.features.length, 2, 'Features should be present when no section filters are provided');
  assert.equal(fullSpec.tickets.length, 2, 'Tickets should be present by default');
});
