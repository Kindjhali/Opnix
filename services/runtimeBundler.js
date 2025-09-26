const path = require('path');
const fs = require('fs').promises;

const ROOT_DIR = path.join(__dirname, '..');
const RUNTIME_ROOT = path.join(ROOT_DIR, '.opnix', 'runtime');
const INDEX_FILE = path.join(RUNTIME_ROOT, 'index.json');

function normaliseCategory(category) {
    if (!category) return 'misc';
    return String(category).trim().toLowerCase();
}

async function ensureDir(targetPath) {
    await fs.mkdir(targetPath, { recursive: true });
}

async function loadIndex() {
    try {
        const raw = await fs.readFile(INDEX_FILE, 'utf8');
        return JSON.parse(raw);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return { updatedAt: new Date().toISOString(), artefacts: [] };
        }
        throw error;
    }
}

async function saveIndex(index) {
    const payload = {
        ...index,
        updatedAt: new Date().toISOString()
    };
    await ensureDir(path.dirname(INDEX_FILE));
    await fs.writeFile(INDEX_FILE, JSON.stringify(payload, null, 2));
}

async function registerArtefact({ sourcePath, category, filename, metadata = {} }) {
    if (!sourcePath) return null;

    const absoluteSource = path.isAbsolute(sourcePath) ? sourcePath : path.join(ROOT_DIR, sourcePath);
    const sourceExists = await fs.access(absoluteSource).then(() => true).catch(() => false);
    if (!sourceExists) {
        return null;
    }

    const normalisedCategory = normaliseCategory(category);
    const name = filename || path.basename(absoluteSource);
    const targetDir = path.join(RUNTIME_ROOT, normalisedCategory);
    const targetPath = path.join(targetDir, name);

    await ensureDir(targetDir);
    await fs.copyFile(absoluteSource, targetPath);

    const index = await loadIndex();
    const sourceKey = path.relative(ROOT_DIR, absoluteSource);
    const runtimeKey = path.relative(ROOT_DIR, targetPath);
    const entry = {
        category: normalisedCategory,
        name,
        source: sourceKey,
        runtimePath: runtimeKey,
        metadata: {
            ...metadata,
            copiedAt: new Date().toISOString()
        }
    };

    index.artefacts = index.artefacts.filter(item => !(item.category === entry.category && item.name === entry.name));
    index.artefacts.push(entry);
    await saveIndex(index);

    return entry;
}

// Hook: intercept artefacts here to trigger downstream publishing or alerting workflows.
async function syncExportArtefacts(metaList) {
    if (!Array.isArray(metaList) || metaList.length === 0) return [];
    const results = [];
    for (const meta of metaList) {
        if (!meta) continue;
        const category = meta.category || path.dirname(meta.relativePath || meta.filename || '').split(path.sep)[0] || 'exports';
        const filename = path.basename(meta.path || meta.relativePath || meta.filename || 'artifact');
        const metadata = {
            relativePath: meta.relativePath || null,
            format: meta.format || null
        };
        const entry = await registerArtefact({
            sourcePath: meta.path,
            category,
            filename,
            metadata
        });
        if (entry) results.push(entry);
    }
    return results;
}

async function syncStoryFiles(storyPaths) {
    if (!Array.isArray(storyPaths) || storyPaths.length === 0) return [];
    const results = [];
    for (const storyPath of storyPaths) {
        const entry = await registerArtefact({
            sourcePath: storyPath,
            category: 'stories',
            filename: path.basename(storyPath),
            metadata: { type: 'story', sourceScript: 'storybook:generate' }
        });
        if (entry) results.push(entry);
    }
    return results;
}

async function syncScaffoldManifest(manifestPath) {
    if (!manifestPath) return null;
    return registerArtefact({
        sourcePath: manifestPath,
        category: 'scaffold',
        filename: 'manifest.json',
        metadata: { type: 'scaffold-manifest' }
    });
}

module.exports = {
    RUNTIME_ROOT,
    registerArtefact,
    syncExportArtefacts,
    syncStoryFiles,
    syncScaffoldManifest
};
