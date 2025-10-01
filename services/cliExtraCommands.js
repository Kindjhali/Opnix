const path = require('path');
const fs = require('fs').promises;

const DEFAULT_CONSTITUTION_DOCS = [
  { key: 'agents', label: 'Agent Constitution', relativePath: 'AGENTS.md' },
  { key: 'claude', label: 'Claude Guidance', relativePath: 'CLAUDE.md' },
  { key: 'gemini', label: 'Gemini Guidance', relativePath: 'GEMINI.md' },
  { key: 'organizer', label: 'Agent Organizer', relativePath: path.join('agents', 'agent-organizer.md') },
  { key: 'install', label: 'Install Decision Tree', relativePath: path.join('docs', 'install-decision-tree.md') }
];

const DEFAULT_SPEC_SECTIONS = ['modules', 'features', 'tickets', 'canvas', 'tech'];

function parseList(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  return String(value)
    .split(',')
    .map(item => item.trim().toLowerCase())
    .filter(Boolean);
}

function parseCommandArgs(command) {
  const tokens = command.trim().split(/\s+/).slice(1);
  const options = {};
  const flags = [];

  tokens.forEach(token => {
    if (!token) return;
    const eqIndex = token.indexOf('=');
    if (eqIndex > 0) {
      const key = token.slice(0, eqIndex).toLowerCase();
      const value = token.slice(eqIndex + 1);
      if (options[key]) {
        options[key] = `${options[key]},${value}`;
      } else {
        options[key] = value;
      }
    } else {
      flags.push(token.toLowerCase());
    }
  });

  return { options, flags };
}

function buildExcerpt(content, { maxLines = 20, full = false } = {}) {
  if (full) {
    return content;
  }
  const lines = content.split(/\r?\n/);
  const head = lines.slice(0, maxLines);
  if (lines.length > maxLines) {
    head.push(`… (${lines.length - maxLines} more lines in source file)`);
  }
  return head.join('\n');
}

function normaliseSectionSelection(includeSet, excludeSet) {
  if (!includeSet || includeSet.size === 0) {
    return new Set(DEFAULT_SPEC_SECTIONS.filter(section => !excludeSet.has(section)));
  }
  const filtered = new Set();
  includeSet.forEach(section => {
    if (!excludeSet.has(section)) {
      filtered.add(section);
    }
  });
  if (filtered.size === 0) {
    DEFAULT_SPEC_SECTIONS.forEach(section => {
      if (!excludeSet.has(section)) filtered.add(section);
    });
  }
  return filtered;
}

function filterByTerms(collection, terms, pickers) {
  if (!Array.isArray(collection) || collection.length === 0 || !terms || terms.length === 0) {
    return collection;
  }
  const lowerTerms = terms.map(term => term.toLowerCase());
  const getters = Array.isArray(pickers) && pickers.length > 0
    ? pickers
    : [item => item?.name, item => item?.id];
  return collection.filter(item => {
    return getters.some(getter => {
      const value = getter(item);
      if (!value) return false;
      const lowerValue = String(value).toLowerCase();
      return lowerTerms.some(term => lowerValue.includes(term));
    });
  });
}

function filterTickets(tickets, terms, statuses) {
  if (!Array.isArray(tickets) || tickets.length === 0) return tickets || [];
  let result = tickets;
  if (terms && terms.length > 0) {
    const lowerTerms = terms.map(term => term.toLowerCase());
    result = result.filter(ticket => {
      const haystack = [ticket.title, ticket.summary, ticket.description]
        .filter(Boolean)
        .map(value => String(value).toLowerCase())
        .join(' ');
      return lowerTerms.some(term => haystack.includes(term));
    });
  }
  if (statuses && statuses.length > 0) {
    const statusSet = new Set(statuses.map(status => status.toLowerCase()));
    result = result.filter(ticket => statusSet.has(String(ticket.status || '').toLowerCase()));
  }
  return result;
}

function normaliseKeys(collection) {
  if (!collection) return [];
  if (collection instanceof Set) {
    return Array.from(collection.values()).map(item => String(item).toLowerCase()).filter(Boolean);
  }
  if (Array.isArray(collection)) {
    return collection.map(item => String(item).toLowerCase()).filter(Boolean);
  }
  return [String(collection).toLowerCase()];
}

function normaliseFilterTerms(value) {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value.map(item => String(item).toLowerCase()).filter(Boolean);
  }
  return parseList(value);
}

function createCliExtraCommands({
  rootDir,
  cliArtifactsDir,
  ensureCliArtifactsDirectory,
  moduleDetector,
  readData,
  readFeaturesFile,
  loadPackageJson,
  ensureExportStructure,
  EXPORT_SUBDIRS,
  deriveTechStack,
  inferProjectType,
  inferPrimaryLanguage,
  specGenerator,
  fsImpl = fs,
  constitutionDocs = DEFAULT_CONSTITUTION_DOCS,
  specSections = DEFAULT_SPEC_SECTIONS
}) {
  if (!rootDir) {
    throw new Error('createCliExtraCommands requires rootDir');
  }
  if (!cliArtifactsDir) {
    throw new Error('createCliExtraCommands requires cliArtifactsDir');
  }
  if (!moduleDetector || typeof moduleDetector.detectModules !== 'function') {
    throw new Error('createCliExtraCommands requires moduleDetector.detectModules');
  }
  if (typeof readData !== 'function' || typeof readFeaturesFile !== 'function') {
    throw new Error('createCliExtraCommands requires readData and readFeaturesFile functions');
  }
  if (typeof loadPackageJson !== 'function') {
    throw new Error('createCliExtraCommands requires loadPackageJson function');
  }
  if (typeof ensureExportStructure !== 'function') {
    throw new Error('createCliExtraCommands requires ensureExportStructure function');
  }
  if (!EXPORT_SUBDIRS || !EXPORT_SUBDIRS.blueprints) {
    throw new Error('createCliExtraCommands requires EXPORT_SUBDIRS.blueprints');
  }
  if (typeof deriveTechStack !== 'function') {
    throw new Error('createCliExtraCommands requires deriveTechStack function');
  }
  if (typeof inferProjectType !== 'function' || typeof inferPrimaryLanguage !== 'function') {
    throw new Error('createCliExtraCommands requires inferProjectType and inferPrimaryLanguage functions');
  }
  if (!specGenerator || typeof specGenerator.generateSpecFile !== 'function') {
    throw new Error('createCliExtraCommands requires specGenerator.generateSpecFile');
  }

  const fileReader = fsImpl.readFile.bind(fsImpl);

  async function writeCliDigest(prefix, title, sections) {
    if (typeof ensureCliArtifactsDirectory === 'function') {
      await ensureCliArtifactsDirectory();
    }
    await fsImpl.mkdir(cliArtifactsDir, { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const filename = `${prefix}-${timestamp}.md`;
    const filePath = path.join(cliArtifactsDir, filename);
    const lines = [`# ${title}`, '', `Generated: ${new Date().toISOString()}`, ''];

    sections.forEach(section => {
      if (!section) return;
      const heading = section.heading || 'Section';
      const bodyLines = Array.isArray(section.body)
        ? section.body
        : String(section.body || '').split(/\r?\n/);
      lines.push(`## ${heading}`);
      lines.push(...bodyLines, '');
    });

    await fsImpl.writeFile(filePath, lines.join('\n'));
    return {
      type: prefix,
      path: filePath,
      filename,
      relativePath: path.relative(rootDir, filePath)
    };
  }

  async function generateGovernanceDigest({ docKeys = [], excerptLines = 20, full = false } = {}) {
    const selections = new Set(normaliseKeys(docKeys));
    const includeAll = selections.size === 0;
    const parsedLines = Number.isFinite(Number(excerptLines)) && Number(excerptLines) > 0
      ? Math.floor(Number(excerptLines))
      : 20;

    const sections = [];
    const docMessages = [];
    const missingDocs = [];

    for (const doc of constitutionDocs) {
      const docKey = String(doc.key).toLowerCase();
      if (!includeAll && !selections.has(docKey)) {
        continue;
      }
      const absolutePath = path.join(rootDir, doc.relativePath);
      try {
        const raw = await fileReader(absolutePath, 'utf8');
        const excerpt = buildExcerpt(raw, { maxLines: parsedLines, full });
        sections.push({
          heading: doc.label,
          body: [`Source: ${path.relative(rootDir, absolutePath)}`, '', excerpt]
        });
        docMessages.push(`• ${doc.label} (${path.relative(rootDir, absolutePath)})`);
      } catch (error) {
        const detail = error.code === 'ENOENT' ? 'missing' : error.message;
        missingDocs.push(`${doc.label} — ${detail}`);
      }
    }

    if (sections.length === 0) {
      return {
        success: false,
        artifact: null,
        messages: ['No governance documents matched the requested selection.'],
        includedDocs: [],
        missingDocs,
        excerptLines: full ? 'full' : parsedLines
      };
    }

    const artifact = await writeCliDigest('cli-constitution', 'Governance Constitution Digest', sections);

    const messages = [
      'Governance constitution digest prepared.',
      ...docMessages,
      `Digest saved to ${artifact.relativePath}`
    ];

    if (missingDocs.length) {
      messages.push('', 'Missing documents:', ...missingDocs);
    }

    return {
      success: true,
      artifact,
      messages,
      includedDocs: sections.map(section => section.heading),
      missingDocs,
      excerptLines: full ? 'full' : parsedLines
    };
  }

  async function handleConstitutionCommand(command) {
    const { options, flags } = parseCommandArgs(command);
    const docSelections = parseList(options.doc || options.docs);
    flags.forEach(flag => {
      if (constitutionDocs.some(doc => doc.key === flag)) {
        docSelections.push(flag);
      }
    });

    const excerptLines = Number.parseInt(options.lines ?? options.excerpt ?? '20', 10);
    const full = String(options.full || options.complete || '').toLowerCase() === 'true';

    const result = await generateGovernanceDigest({
      docKeys: docSelections,
      excerptLines,
      full
    });

    if (!result.success) {
      return {
        result: 'No governance documents found',
        messages: result.messages,
        artifacts: [],
        metadata: {
          requestedDocs: docSelections,
          missingDocs: result.missingDocs,
          excerptLines: result.excerptLines
        }
      };
    }

    return {
      result: 'Governance digest ready',
      messages: result.messages,
      artifacts: [result.artifact],
      metadata: {
        includedDocs: result.includedDocs,
        missingDocs: result.missingDocs,
        excerptLines: result.excerptLines
      }
    };
  }

  async function buildSpecPayload({
    modulesResult,
    features,
    tickets,
    packageJson,
    techStack,
    includeSections,
    moduleFilters,
    featureFilters,
    ticketFilters,
    ticketStatuses
  }) {
    const include = includeSections || new Set(specSections);

    let modules = modulesResult.modules || [];
    if (moduleFilters && moduleFilters.length) {
      modules = filterByTerms(modules, moduleFilters, [module => module.name, module => module.id, module => module.path]);
    }
    if (!include.has('modules')) {
      modules = [];
    }

    let featureList = Array.isArray(features) ? [...features] : [];
    if (featureFilters && featureFilters.length) {
      featureList = filterByTerms(featureList, featureFilters, [feature => feature.id, feature => feature.title, feature => feature.moduleId]);
    }
    if (!include.has('features')) {
      featureList = [];
    }

    let ticketList = Array.isArray(tickets) ? [...tickets] : [];
    if (ticketFilters?.length || ticketStatuses?.length) {
      ticketList = filterTickets(ticketList, ticketFilters, ticketStatuses);
    }
    if (!include.has('tickets')) {
      ticketList = [];
    }

    const canvasSummary = include.has('canvas')
      ? { edges: modulesResult.edges || [], summary: modulesResult.summary || {} }
      : { edges: [], summary: {} };

    const frameworks = Array.isArray(techStack.frameworks) ? techStack.frameworks : [];

    return {
      generatedAt: new Date().toISOString(),
      questionAnswers: {},
      project: {
        name: packageJson?.name || 'Opnix Project',
        type: inferProjectType({ modules: modulesResult.modules, techStack }),
        goal: packageJson?.description || 'Scoped specification export'
      },
      technical: {
        language: inferPrimaryLanguage(packageJson),
        framework: frameworks[0] || null,
        stack: frameworks,
        architecture: {
          dataStores: null,
          integrations: null,
          testingStrategy: null,
          observability: null
        }
      },
      modules,
      canvas: canvasSummary,
      features: featureList,
      tickets: ticketList,
      techStack: include.has('tech') ? techStack : null,
      insights: include.has('tech') ? { techStack } : {}
    };
  }

  function resolveSpecFormat(rawFormat) {
    const normalised = String(rawFormat || '').trim().toLowerCase();
    if (!normalised) return 'github-spec-kit';
    if (['github', 'kit', 'spec-kit', 'github-spec-kit'].includes(normalised)) return 'github-spec-kit';
    if (['md', 'markdown'].includes(normalised)) return 'markdown';
    if (['json'].includes(normalised)) return 'json';
    return 'github-spec-kit';
  }

  async function generateScopedSpecExport({
    includeSections,
    excludeSections,
    moduleFilters,
    featureFilters,
    ticketFilters,
    ticketStatuses,
    format
  } = {}) {
    await ensureExportStructure();

    const includeSetInput = new Set(normaliseKeys(includeSections));
    const excludeSet = new Set(normaliseKeys(excludeSections));
    const includeSet = normaliseSectionSelection(includeSetInput, excludeSet);

    const moduleTerms = normaliseFilterTerms(moduleFilters);
    const featureTerms = normaliseFilterTerms(featureFilters);
    const ticketTerms = normaliseFilterTerms(ticketFilters);
    const statusTerms = normaliseFilterTerms(ticketStatuses);

    const resolvedFormat = resolveSpecFormat(format);

    const [modulesResult, ticketData, featureData, packageJson] = await Promise.all([
      moduleDetector.detectModules(rootDir),
      readData(),
      readFeaturesFile(),
      loadPackageJson()
    ]);

    const tickets = Array.isArray(ticketData?.tickets) ? ticketData.tickets : [];
    const features = Array.isArray(featureData) ? featureData : [];
    const techStack = deriveTechStack(packageJson || {}, modulesResult.modules);

    const specPayload = await buildSpecPayload({
      modulesResult,
      features,
      tickets,
      packageJson,
      techStack,
      includeSections: includeSet,
      moduleFilters: moduleTerms,
      featureFilters: featureTerms,
      ticketFilters: ticketTerms,
      ticketStatuses: statusTerms
    });

    const specMeta = await specGenerator.generateSpecFile({
      spec: specPayload,
      format: resolvedFormat,
      exportsDir: EXPORT_SUBDIRS.blueprints
    });

    const artifact = {
      type: 'scoped-spec',
      path: specMeta.path,
      filename: specMeta.filename,
      format: specMeta.format,
      relativePath: path.relative(rootDir, specMeta.path),
      exportsPath: path.relative(EXPORT_SUBDIRS.blueprints, specMeta.path)
    };

    const summaryLines = [
      `Sections included: ${Array.from(includeSet).join(', ')}`,
      `Modules: ${specPayload.modules.length} | Features: ${specPayload.features.length} | Tickets: ${specPayload.tickets.length}`
    ];

    if (moduleTerms.length || featureTerms.length || ticketTerms.length || statusTerms.length) {
      summaryLines.push('Filters applied:');
      if (moduleTerms.length) summaryLines.push(`- Modules: ${moduleTerms.join(', ')}`);
      if (featureTerms.length) summaryLines.push(`- Features: ${featureTerms.join(', ')}`);
      if (ticketTerms.length) summaryLines.push(`- Tickets: ${ticketTerms.join(', ')}`);
      if (statusTerms.length) summaryLines.push(`- Status: ${statusTerms.join(', ')}`);
    }

    const messages = [
      `Scoped specification generated (${artifact.filename}).`,
      `Saved to ${artifact.relativePath}.`,
      ...summaryLines
    ];

    return {
      success: true,
      artifact,
      messages,
      metadata: {
        format: specMeta.format,
        includedSections: Array.from(includeSet),
        moduleCount: specPayload.modules.length,
        featureCount: specPayload.features.length,
        ticketCount: specPayload.tickets.length
      },
      spec: specPayload
    };
  }

  async function handleSpecifyCommand(command) {
    const { options, flags } = parseCommandArgs(command);
    const includeSections = new Set();
    const excludeSections = new Set(parseList(options.exclude));

    const includeTokens = [...parseList(options.include), ...flags];
    includeTokens.forEach(token => {
      if (specSections.includes(token)) {
        includeSections.add(token);
      }
    });

    const moduleFilters = parseList(options.module || options.modules);
    const featureFilters = parseList(options.feature || options.features);
    const ticketFilters = parseList(options.ticket || options.tickets || options.issue || options.issues);
    const ticketStatuses = parseList(options.status || options.statuses);

    const format = resolveSpecFormat(options.format);

    const result = await generateScopedSpecExport({
      includeSections,
      excludeSections,
      moduleFilters,
      featureFilters,
      ticketFilters,
      ticketStatuses,
      format
    });

    return {
      result: 'Scoped specification ready',
      messages: result.messages,
      artifacts: [result.artifact],
      metadata: result.metadata
    };
  }

  return {
    handleConstitutionCommand,
    handleSpecifyCommand,
    generateGovernanceDigest,
    generateScopedSpecExport
  };
}

module.exports = {
  createCliExtraCommands
};
