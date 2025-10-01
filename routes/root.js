const express = require('express');
const path = require('path');
const fs = require('fs');

function createRootRoutes({ rootDir, port }) {
    if (!rootDir) {
        throw new Error('createRootRoutes requires rootDir');
    }

    const router = express.Router();
    const indexHtmlPath = path.resolve(rootDir, 'public', 'index.html');

    // Verify the file exists at startup
    if (!fs.existsSync(indexHtmlPath)) {
        console.warn(`Warning: index.html not found at ${indexHtmlPath}`);
    }

    router.get('/', (req, res) => {
        const userAgent = req.headers['user-agent'] || '';
        if (userAgent.includes('curl')) {
            res.type('text/plain').send(`
OPNIX v1.0 - With Tags

Commands:
  curl http://localhost:${port}/api/claude/next      # Get next ticket
  curl http://localhost:${port}/api/export/markdown   # Export all
  curl http://localhost:${port}/api/tickets           # Get JSON
  curl http://localhost:${port}/api/search?tag=BUG    # Search by tag

Bug Workflow:
  npm run bug:start <id> [developer]                 # Start working on bug
  npm run bug:complete <id> "<summary>"              # Complete with summary
  npm run bug:pause <id> "<reason>"                  # Pause with reason
  npm run bug:resume <id>                            # Resume paused work
  npm run bug:status <id>                            # Check workflow status
  npm run bug:active                                 # List active workflows

Claude CLI:
  claude "Read data/tickets.json and fix all BUG tagged issues"
            `);
        } else {
            res.sendFile(indexHtmlPath, (err) => {
                if (err) {
                    console.error('Error serving index.html:', err);
                    console.error('Attempted path:', indexHtmlPath);
                    console.error('Root dir:', rootDir);
                    res.status(500).send('Error loading application');
                }
            });
        }
    });

    return router;
}

module.exports = {
    createRootRoutes
};
