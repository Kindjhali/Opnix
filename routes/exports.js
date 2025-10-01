const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;

let exportsDeps = null;

function setExportsDependencies(deps) {
    exportsDeps = deps;
}

function getDeps() {
    if (!exportsDeps) {
        throw new Error('Exports routes not initialised with dependencies');
    }
    return exportsDeps;
}

function validateMarkdownExtension(relativePath) {
    const { markdownExtensions } = getDeps();
    if (!relativePath) return false;
    const ext = path.extname(relativePath).toLowerCase();
    return markdownExtensions.has(ext);
}

function extractMarkdownParams(req = {}) {
    const params = req.params || {};
    const query = req.query || {};
    const body = req.body || {};

    const rootId = params.rootId || body.rootId || query.rootId || null;
    let fromParams = params.relativePath;
    if (Array.isArray(fromParams)) {
        fromParams = fromParams.join('/');
    }
    if (!fromParams && params[0]) {
        fromParams = params[0];
    }
    const relativePath = fromParams || body.relativePath || query.relativePath || null;

    return { rootId, relativePath };
}

function resolveMarkdownPath(rootId, relativePath) {
    const { markdownArchiveRoots } = getDeps();
    const rootMeta = markdownArchiveRoots.find(root => root.id === rootId);
    if (!rootMeta) return null;
    const normalized = path.normalize(relativePath || '');
    const target = path.resolve(rootMeta.dir, normalized);
    if (!target.startsWith(rootMeta.dir)) return null;
    return { rootMeta, target, normalizedRelative: normalized.replace(/^[\\/]+/, '') };
}

function buildMarkdownMeta(rootMeta, targetPath, stats) {
    const { toPosixPath, rootDir } = getDeps();
    if (!rootMeta || !targetPath || !stats) return null;
    const relativeToRoot = toPosixPath(path.relative(rootMeta.dir, targetPath));
    const workspacePath = toPosixPath(path.relative(rootDir, targetPath));
    return {
        id: `${rootMeta.id}:${relativeToRoot}`,
        name: path.basename(targetPath),
        rootId: rootMeta.id,
        category: rootMeta.label,
        relativePath: relativeToRoot,
        workspacePath,
        size: stats.size,
        modified: stats.mtime.toISOString()
    };
}

async function collectMarkdownArchive() {
    const { markdownArchiveRoots, markdownArchiveDenylist, markdownExtensions, rootDir, toPosixPath } = getDeps();
    const entries = [];

    async function walkDirectory(rootMeta, currentDir) {
        let dirEntries;
        try {
            dirEntries = await fsPromises.readdir(currentDir, { withFileTypes: true });
        } catch {
            return;
        }

        for (const entry of dirEntries) {
            const fullPath = path.join(currentDir, entry.name);
            if (entry.isDirectory()) {
                const dirName = entry.name.toLowerCase();
                if (markdownArchiveDenylist.has(dirName)) {
                    continue;
                }
                await walkDirectory(rootMeta, fullPath);
                continue;
            }

            if (!entry.isFile()) continue;
            const ext = path.extname(entry.name).toLowerCase();
            if (!markdownExtensions.has(ext)) continue;

            let stats;
            try {
                stats = await fsPromises.stat(fullPath);
            } catch {
                continue;
            }

            const relativeToRoot = toPosixPath(path.relative(rootMeta.dir, fullPath));
            const workspacePath = toPosixPath(path.relative(rootDir, fullPath));

            entries.push({
                id: `${rootMeta.id}:${relativeToRoot}`,
                name: entry.name,
                rootId: rootMeta.id,
                category: rootMeta.label,
                relativePath: relativeToRoot,
                workspacePath,
                size: stats.size,
                modified: stats.mtime.toISOString()
            });
        }
    }

    for (const root of markdownArchiveRoots) {
        if (!root.dir) continue;
        let stats;
        try {
            stats = await fsPromises.stat(root.dir);
        } catch {
            continue;
        }
        if (!stats.isDirectory()) continue;
        await walkDirectory(root, root.dir);
    }

    return entries.sort((a, b) => (a.workspacePath || '').localeCompare(b.workspacePath || ''));
}

async function markdownListRoute(req, res) {
    try {
        const files = await collectMarkdownArchive();
        res.json({ files });
    } catch (error) {
        console.error('Markdown archive list error:', error);
        res.status(500).json({ error: 'Failed to list markdown files' });
    }
}

async function markdownReadRoute(req, res) {
    try {
        const { rootId, relativePath } = extractMarkdownParams(req);
        if (typeof rootId !== 'string' || typeof relativePath !== 'string' || !rootId || !relativePath) {
            return res.status(400).json({ error: 'rootId and relativePath are required' });
        }
        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }
        await fsPromises.access(resolved.target);
        const content = await fsPromises.readFile(resolved.target, 'utf8');
        res.type('text/markdown').send(content);
    } catch (error) {
        if (error.code === 'ENOENT') {
            return res.status(404).json({ error: 'File not found' });
        }
        console.error('Markdown read error:', error);
        res.status(500).json({ error: 'Failed to read markdown file' });
    }
}

async function markdownCreateRoute(req, res) {
    try {
        const { ensureDirectory } = getDeps();
        const { rootId, relativePath } = extractMarkdownParams(req);
        const content = typeof req.body?.content === 'string' ? req.body.content : '';
        const overwrite = Boolean(req.body?.overwrite);

        if (typeof rootId !== 'string' || !rootId.trim()) {
            return res.status(400).json({ error: 'rootId is required' });
        }
        if (typeof relativePath !== 'string' || !relativePath.trim()) {
            return res.status(400).json({ error: 'relativePath is required' });
        }
        if (!validateMarkdownExtension(relativePath)) {
            return res.status(400).json({ error: 'Unsupported markdown extension' });
        }

        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }

        await ensureDirectory(path.dirname(resolved.target));

        const exists = await fsPromises.access(resolved.target).then(() => true).catch(error => {
            if (error.code === 'ENOENT') return false;
            throw error;
        });
        if (exists && !overwrite) {
            return res.status(409).json({ error: 'File already exists' });
        }

        await fsPromises.writeFile(resolved.target, content, 'utf8');
        const stats = await fsPromises.stat(resolved.target);
        const meta = buildMarkdownMeta(resolved.rootMeta, resolved.target, stats);
        res.status(exists ? 200 : 201).json({ file: meta });
    } catch (error) {
        console.error('Markdown create error:', error);
        res.status(500).json({ error: 'Failed to create markdown file' });
    }
}

async function markdownUpdateRoute(req, res) {
    try {
        const { rootId, relativePath } = extractMarkdownParams(req);
        const content = typeof req.body?.content === 'string' ? req.body.content : '';

        if (typeof rootId !== 'string' || !rootId.trim()) {
            return res.status(400).json({ error: 'rootId is required' });
        }
        if (typeof relativePath !== 'string' || !relativePath.trim()) {
            return res.status(400).json({ error: 'relativePath is required' });
        }
        if (!validateMarkdownExtension(relativePath)) {
            return res.status(400).json({ error: 'Unsupported markdown extension' });
        }

        const resolved = resolveMarkdownPath(rootId, relativePath);
        if (!resolved) {
            return res.status(400).json({ error: 'Invalid markdown path' });
        }

        const exists = await fsPromises.access(resolved.target).then(() => true).catch(error => {
            if (error.code === 'ENOENT') return false;
            throw error;
        });
        if (!exists) {
            return res.status(404).json({ error: 'File not found' });
        }

        await fsPromises.writeFile(resolved.target, content, 'utf8');
        const stats = await fsPromises.stat(resolved.target);
        const meta = buildMarkdownMeta(resolved.rootMeta, resolved.target, stats);
        res.json({ file: meta });
    } catch (error) {
        console.error('Markdown update error:', error);
        res.status(500).json({ error: 'Failed to update markdown file' });
    }
}

async function markdownExportRoute(_req, res) {
    const { readData, logServerError } = getDeps();
    try {
        const data = await readData();
        let markdown = '# Claude CLI Ticket Analysis\n\n';
        markdown += `Generated: ${new Date().toISOString()}\n\n`;

        const tagGroups = {};
        const untagged = [];

        data.tickets.forEach(ticket => {
            if (ticket.tags && ticket.tags.length > 0) {
                ticket.tags.forEach(tag => {
                    if (!tagGroups[tag]) tagGroups[tag] = [];
                    tagGroups[tag].push(ticket);
                });
            } else {
                untagged.push(ticket);
            }
        });

        Object.keys(tagGroups).sort().forEach(tag => {
            markdown += `## TAG: ${tag}\n\n`;
            tagGroups[tag].forEach(ticket => {
                markdown += `### Ticket #${ticket.id}: ${ticket.title}\n`;
                markdown += `Priority: ${ticket.priority} | Status: ${ticket.status}\n`;
                markdown += `Tags: ${ticket.tags.join(', ')}\n`;
                markdown += `Description: ${ticket.description}\n\n`;
            });
        });

        if (untagged.length > 0) {
            markdown += '## UNTAGGED\n\n';
            untagged.forEach(ticket => {
                markdown += `### Ticket #${ticket.id}: ${ticket.title}\n`;
                markdown += `Priority: ${ticket.priority} | Status: ${ticket.status}\n`;
                markdown += `Description: ${ticket.description}\n\n`;
            });
        }

        res.type('text/plain').send(markdown);
    } catch (error) {
        logServerError('export:markdown', error);
        res.status(500).json({ error: 'Failed to export' });
    }
}

async function exportsListRoute(_req, res) {
    const { ensureExportStructure, listExportFiles, exportsDir } = getDeps();
    try {
        await ensureExportStructure();
        const files = await listExportFiles(exportsDir);
        res.json({ files });
    } catch (error) {
        console.error('Exports listing error:', error);
        res.status(500).json({ error: 'Failed to list exports' });
    }
}

async function exportFilenameRoute(req, res) {
    const { ensureExportStructure, listExportFiles, exportsDir } = getDeps();
    try {
        await ensureExportStructure();
        const filename = path.basename(req.params.filename);
        const files = await listExportFiles(exportsDir);
        const match = files.find(file => file.name === filename);
        if (!match) {
            return res.status(404).json({ error: 'File not found' });
        }
        res.sendFile(match.path);
    } catch (error) {
        console.error('Export download error:', error);
        res.status(500).json({ error: 'Failed to download export' });
    }
}

async function exportDownloadRoute(req, res) {
    const { ensureExportStructure, exportsDir } = getDeps();
    try {
        await ensureExportStructure();
        const requestedPath = req.query.path;
        if (typeof requestedPath !== 'string' || requestedPath.trim() === '') {
            return res.status(400).json({ error: 'Missing path query parameter' });
        }
        const normalized = path.normalize(requestedPath);
        if (normalized.startsWith('..') || path.isAbsolute(normalized)) {
            return res.status(400).json({ error: 'Invalid path' });
        }
        const filePath = path.join(exportsDir, normalized);
        await fsPromises.access(filePath);
        res.sendFile(filePath);
    } catch (error) {
        console.error('Export direct download error:', error);
        res.status(500).json({ error: 'Failed to download export' });
    }
}

function createExportsRoutes(deps) {
    setExportsDependencies(deps);
    const router = express.Router();

    router.get('/api/archive/markdown', markdownListRoute);
    router.get('/api/archive/markdown/content', (req, res) => markdownReadRoute(req, res));

    router.get('/api/markdown', markdownListRoute);
    router.get(/^\/api\/markdown\/([^/]+)\/(.+)$/i, (req, res) => {
        const [rootId, relative] = req.params;
        req.params = {
            rootId: decodeURIComponent(rootId),
            relativePath: decodeURIComponent(relative)
        };
        return markdownReadRoute(req, res);
    });
    router.post('/api/markdown', markdownCreateRoute);
    router.put('/api/markdown', markdownUpdateRoute);
    router.put(/^\/api\/markdown\/([^/]+)\/(.+)$/i, (req, res) => {
        const [rootId, relative] = req.params;
        req.params = {
            rootId: decodeURIComponent(rootId),
            relativePath: decodeURIComponent(relative)
        };
        return markdownUpdateRoute(req, res);
    });

    router.get('/api/export/markdown', markdownExportRoute);
    router.get('/api/exports', exportsListRoute);
    router.get('/api/exports/:filename', exportFilenameRoute);
    router.get('/api/exports/download', exportDownloadRoute);

    return router;
}

module.exports = {
    createExportsRoutes,
    markdownListRoute,
    markdownReadRoute,
    markdownCreateRoute,
    markdownUpdateRoute
};
