const express = require('express');
const path = require('path');

const ONE_HOUR_MS = 1000 * 60 * 60;

function normaliseMaxAge(maxAge) {
    if (typeof maxAge === 'number') {
        return Math.max(0, maxAge);
    }
    if (typeof maxAge === 'string') {
        const trimmed = maxAge.trim().toLowerCase();
        if (trimmed.endsWith('h')) {
            const hours = Number.parseFloat(trimmed.slice(0, -1));
            if (Number.isFinite(hours)) {
                return Math.max(0, hours * ONE_HOUR_MS);
            }
        }
        if (trimmed.endsWith('m')) {
            const minutes = Number.parseFloat(trimmed.slice(0, -1));
            if (Number.isFinite(minutes)) {
                return Math.max(0, minutes * 60 * 1000);
            }
        }
        if (trimmed.endsWith('s')) {
            const seconds = Number.parseFloat(trimmed.slice(0, -1));
            if (Number.isFinite(seconds)) {
                return Math.max(0, seconds * 1000);
            }
        }
    }
    return ONE_HOUR_MS;
}

function createStaticRoutes({ rootDir, mountPath = '/', sourceDir = 'public', maxAge = '1h' } = {}) {
    if (!rootDir) {
        throw new Error('createStaticRoutes requires rootDir');
    }

    const router = express.Router();
    const resolvedMaxAge = normaliseMaxAge(maxAge);
    const staticRoot = path.join(rootDir, sourceDir);

    console.log(`🗂️  Static route: ${mountPath} -> ${staticRoot}`);

    const staticOptions = {
        fallthrough: true,
        maxAge: resolvedMaxAge,
        setHeaders(res, servedPath) {
            if (servedPath.endsWith('.html')) {
                res.setHeader('Cache-Control', 'no-cache');
            } else {
                res.setHeader('Cache-Control', `public, max-age=${Math.floor(resolvedMaxAge / 1000)}`);
            }
        }
    };

    router.use(mountPath, express.static(staticRoot, staticOptions));
    return router;
}

module.exports = {
    createStaticRoutes
};
