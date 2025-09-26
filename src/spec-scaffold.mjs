const DATA_SOURCE_KEYWORDS = [
  { match: /postgres|postgre?s/i, id: 'postgres-data', name: 'Postgres Data Store' },
  { match: /redis/i, id: 'redis-data', name: 'Redis Cache' },
  { match: /mongo/i, id: 'mongodb-data', name: 'MongoDB Cluster' },
  { match: /s3|object storage/i, id: 's3-storage', name: 'Object Storage' }
];

function normaliseList(input = '') {
  if (!input) return [];
  return input
    .split(/\r?\n|,/)
    .map(line => line.replace(/^[-*]\s*/, '').trim())
    .filter(Boolean);
}

export function deriveAutoModulesFromAnswers(answers = {}) {
  const modules = [];
  const framework = String(answers['preferred-framework'] || '').toLowerCase();
  const language = String(answers['primary-language'] || '').toLowerCase();
  const dataSources = normaliseList(answers['data-sources']);
  const providers = normaliseList(answers['integration-providers']);

  if (framework.includes('react')) {
    modules.push({
      id: 'react-frontend',
      name: 'React Frontend',
      type: 'frontend',
      pathHints: ['src/components', 'src/views'],
      dependencies: [],
      externalDependencies: ['react'],
      source: 'auto'
    });
  }

  if (language.includes('typescript')) {
    modules.push({
      id: 'typescript-service',
      name: 'Typescript Service',
      type: 'service',
      pathHints: ['src/server', 'services'],
      dependencies: [],
      externalDependencies: [],
      source: 'auto'
    });
  }

  DATA_SOURCE_KEYWORDS.forEach(keyword => {
    const match = dataSources.find(entry => keyword.match.test(entry));
    if (match) {
      modules.push({
        id: keyword.id,
        name: keyword.name,
        type: 'data',
        pathHints: ['data', 'db', 'persistence'],
        dependencies: [],
        externalDependencies: [],
        notes: match,
        source: 'auto'
      });
    }
  });

  if (providers.length) {
    const externalDependencies = providers.map(provider => provider.toLowerCase());
    modules.push({
      id: 'integration-gateway',
      name: 'Integration Gateway',
      type: 'service',
      pathHints: ['src/integrations', 'src/adapters'],
      dependencies: [],
      externalDependencies,
      notes: 'Aggregates third-party APIs declared during interview',
      source: 'auto'
    });
  }

  return modules;
}

export function deriveAutoFeaturesFromAnswers(answers = {}) {
  const inclusions = normaliseList(answers['scope-inclusions']);
  const purpose = answers['project-purpose'] || '';
  return inclusions.map((title, index) => ({
    id: `auto-feature-${index + 1}`,
    title,
    description: purpose,
    status: 'proposed',
    source: 'auto'
  }));
}

export function summarizeAutoModules(modules = []) {
  return modules.reduce((summary, module) => {
    summary.moduleCount += 1;
    summary.dependencyCount += Array.isArray(module.dependencies) ? module.dependencies.length : 0;
    summary.externalDependencyCount += Array.isArray(module.externalDependencies) ? module.externalDependencies.length : 0;
    summary.totalLines += module.lineCount || 0;
    return summary;
  }, {
    moduleCount: 0,
    dependencyCount: 0,
    externalDependencyCount: 0,
    totalLines: 0
  });
}

export function hasMeaningfulAnswers(answers = {}) {
  return Object.values(answers).some(value => {
    if (value === null || value === undefined) return false;
    const text = String(value).trim();
    return text.length > 0;
  });
}

export default {
  deriveAutoModulesFromAnswers,
  deriveAutoFeaturesFromAnswers,
  summarizeAutoModules,
  hasMeaningfulAnswers
};
