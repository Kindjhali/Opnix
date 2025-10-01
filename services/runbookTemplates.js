const path = require('path');
const fs = require('fs').promises;

const TEMPLATE_DIR = path.join(process.cwd(), 'spec', 'runbook', 'templates');

function normaliseId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-');
}

async function ensureTemplateDirectory() {
  await fs.mkdir(TEMPLATE_DIR, { recursive: true });
}

function parseFrontMatter(content = '') {
  if (!content.startsWith('---')) {
    return { metadata: {}, body: content };
  }

  const endIndex = content.indexOf('\n---', 3);
  if (endIndex === -1) {
    return { metadata: {}, body: content };
  }

  const header = content.slice(3, endIndex).trim();
  const body = content.slice(endIndex + 4).trimStart();
  const metadata = {};

  header.split('\n').forEach(line => {
    const [key, ...rest] = line.split(':');
    if (!key) return;
    const value = rest.join(':').trim();
    metadata[key.trim()] = value;
  });

  return { metadata, body };
}

async function loadTemplateFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8');
  const { metadata, body } = parseFrontMatter(raw);
  const id = metadata.id ? normaliseId(metadata.id) : normaliseId(path.basename(filePath, path.extname(filePath)));
  const name = metadata.name || path.basename(filePath);
  const description = metadata.description || '';

  return {
    id,
    name,
    description,
    filename: path.basename(filePath),
    path: filePath,
    content: body.trim()
  };
}

async function listTemplates() {
  await ensureTemplateDirectory();
  const entries = await fs.readdir(TEMPLATE_DIR, { withFileTypes: true });
  const templates = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.md')) {
      continue;
    }
    try {
      const filePath = path.join(TEMPLATE_DIR, entry.name);
      const template = await loadTemplateFile(filePath);
      templates.push({
        id: template.id,
        name: template.name,
        description: template.description,
        filename: template.filename
      });
    } catch (error) {
      console.warn(`[runbookTemplates] Failed to load template ${entry.name}:`, error.message);
    }
  }

  return templates.sort((a, b) => a.name.localeCompare(b.name));
}

async function loadTemplatesById(templateIds) {
  if (!Array.isArray(templateIds) || templateIds.length === 0) {
    return [];
  }
  const available = await listTemplates();
  const wantedIds = templateIds.map(normaliseId);

  const matches = available.filter(template => wantedIds.includes(normaliseId(template.id)));
  const results = [];

  for (const template of matches) {
    try {
      const filePath = path.join(TEMPLATE_DIR, template.filename);
      const loaded = await loadTemplateFile(filePath);
      results.push(loaded);
    } catch (error) {
      console.warn(`[runbookTemplates] Failed to read template ${template.id}:`, error.message);
    }
  }

  return results;
}

function defaultTemplates() {
  return ['operational-overview'];
}

module.exports = {
  listTemplates,
  loadTemplatesById,
  defaultTemplates,
  ensureTemplateDirectory,
  TEMPLATE_DIR
};

