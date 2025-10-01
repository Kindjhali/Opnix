const express = require('express');
const path = require('path');
const fsPromises = require('fs').promises;

function createDiagramRoutes({
    ensureExportStructure,
    listExportFiles,
    withRelativePath,
    loadDiagramContext,
    getDiagramSources,
    EXPORT_SUBDIRS,
    EXPORTS_DIR,
    DIAGRAM_TYPES,
    diagramGenerator
}) {
    const router = express.Router();

    router.get('/api/diagrams', async (_req, res) => {
        try {
            await ensureExportStructure();
            const files = await listExportFiles();
            const diagrams = files
                .filter(file => file.category === 'diagrams')
                .sort((a, b) => new Date(b.modified) - new Date(a.modified));
            res.json({ diagrams });
        } catch (error) {
            console.error('Diagram listing error:', error);
            res.status(500).json({ error: 'Failed to list diagrams' });
        }
    });

    router.get('/api/diagrams/:type', async (req, res) => {
        const type = req.params.type.toLowerCase();
        if (!DIAGRAM_TYPES.includes(type)) {
            return res.status(400).json({ error: `Unsupported diagram type: ${type}` });
        }

        const refreshRequested = typeof req.query.refresh === 'string' && req.query.refresh.toLowerCase() !== 'false';

        try {
            await ensureExportStructure();
            let diagrams = await listExportFiles();
            diagrams = diagrams
                .filter(file => file.category === 'diagrams' && file.name.includes(`-${type}-`))
                .sort((a, b) => new Date(b.modified) - new Date(a.modified));

            let meta;
            let mermaid;

            if (refreshRequested || diagrams.length === 0) {
                const context = await loadDiagramContext();
                const generated = await diagramGenerator.generateDiagramFile(type, context, EXPORT_SUBDIRS.diagrams);
                if (!generated) {
                    return res.status(500).json({ error: 'Failed to generate diagram content' });
                }
                meta = withRelativePath(generated);
                mermaid = generated.mermaid;
            } else {
                meta = diagrams[0];
                mermaid = await fsPromises.readFile(meta.path, 'utf8');
            }

            const stats = await fsPromises.stat(meta.path);
            res.json({
                type,
                filename: path.basename(meta.path),
                mermaid,
                generatedAt: stats.mtime.toISOString(),
                relativePath: path.relative(EXPORTS_DIR, meta.path),
                sources: getDiagramSources(type)
            });
        } catch (error) {
            console.error('Diagram generation error:', error);
            res.status(500).json({ error: 'Failed to generate diagram' });
        }
    });

    return router;
}

module.exports = createDiagramRoutes;
