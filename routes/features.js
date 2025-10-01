const express = require('express');

let featuresDeps = null;

function setFeaturesDependencies(deps) {
    featuresDeps = deps;
}

function getDeps() {
    if (!featuresDeps) {
        throw new Error('Features routes not initialised with dependencies');
    }
    return featuresDeps;
}

async function listFeaturesRoute(_req, res) {
    const { readFeaturesFile } = getDeps();
    try {
        const features = await readFeaturesFile();
        res.json(features);
    } catch (error) {
        console.error('Features read error:', error);
        res.status(500).json({ error: 'Failed to read features' });
    }
}

async function createFeatureRoute(req, res) {
    const {
        readFeaturesFile,
        writeFeaturesFile,
        normaliseAcceptanceCriteria,
        normaliseFeatureStatus,
        VALID_FEATURE_STATUSES,
        validateFeatureStatusChange,
        normaliseFeatureRecord,
        syncRoadmapState
    } = getDeps();

    try {
        const features = await readFeaturesFile();

        const acceptanceCriteria = normaliseAcceptanceCriteria(req.body.acceptanceCriteria || []);
        const requestedStatus = normaliseFeatureStatus(req.body.status, { fallback: 'proposed' }) || 'proposed';
        const featureStatus = VALID_FEATURE_STATUSES.includes(requestedStatus) ? requestedStatus : 'proposed';

        const validation = validateFeatureStatusChange('proposed', featureStatus, acceptanceCriteria);
        if (!validation.ok) {
            return res.status(400).json({ error: validation.message });
        }

        const newFeature = normaliseFeatureRecord({
            id: Date.now(),
            title: req.body.title,
            description: req.body.description,
            moduleId: req.body.moduleId,
            priority: req.body.priority || 'medium',
            status: featureStatus,
            votes: 0,
            acceptanceCriteria,
            created: new Date().toISOString()
        });

        const updatedFeatures = [...features, newFeature];
        await writeFeaturesFile(updatedFeatures);
        await syncRoadmapState({ reason: 'feature:create', overrides: { features: updatedFeatures } });

        console.log(`✓ Created feature: ${newFeature.title}`);
        res.status(201).json(newFeature);
    } catch (error) {
        console.error('Feature creation error:', error);
        res.status(500).json({ error: 'Failed to create feature' });
    }
}

async function updateFeatureRoute(req, res) {
    const {
        readFeaturesFile,
        writeFeaturesFile,
        normaliseAcceptanceCriteria,
        normaliseFeatureStatus,
        validateFeatureStatusChange,
        normaliseFeatureRecord,
        syncRoadmapState
    } = getDeps();

    try {
        const features = await readFeaturesFile();
        const featureId = req.params.id;
        const index = features.findIndex(feature => String(feature.id) === String(featureId));
        if (index === -1) {
            return res.status(404).json({ error: 'Feature not found' });
        }

        const existing = features[index];
        const acceptanceCriteria = req.body.acceptanceCriteria !== undefined
            ? normaliseAcceptanceCriteria(req.body.acceptanceCriteria)
            : normaliseAcceptanceCriteria(existing.acceptanceCriteria || []);

        const nextStatus = normaliseFeatureStatus(
            req.body.status !== undefined ? req.body.status : existing.status,
            { fallback: existing.status }
        );
        const validation = validateFeatureStatusChange(existing.status, nextStatus, acceptanceCriteria);
        if (!validation.ok) {
            return res.status(412).json({ error: validation.message });
        }

        const updated = normaliseFeatureRecord({
            ...existing,
            title: req.body.title !== undefined ? req.body.title : existing.title,
            description: req.body.description !== undefined ? req.body.description : existing.description,
            moduleId: req.body.moduleId !== undefined ? req.body.moduleId : existing.moduleId,
            priority: req.body.priority !== undefined ? req.body.priority : existing.priority,
            status: nextStatus,
            acceptanceCriteria,
            updated: new Date().toISOString()
        });

        if (req.body.git && typeof req.body.git === 'object') {
            updated.git = { ...(existing.git || {}), ...req.body.git };
        }

        if (req.body.branchName) {
            updated.branchName = req.body.branchName;
        }

        // Get git automation manager once
        const { gitAutomationManager } = getDeps();

        if (nextStatus === 'deployed' && existing.status !== 'deployed') {
            if (!updated.completedAt) {
                updated.completedAt = new Date().toISOString();
            }
            const summaryText = typeof updated.completionSummary === 'string'
                ? updated.completionSummary.trim()
                : '';
            if ((!summaryText || summaryText.length < 20) && gitAutomationManager?.generateFeatureCompletionSummary) {
                updated.completionSummary = gitAutomationManager.generateFeatureCompletionSummary(updated);
            }
        }

        features[index] = updated;
        await writeFeaturesFile(features);
        await syncRoadmapState({ reason: 'feature:update', overrides: { features } });

        // Auto-commit if feature was deployed/completed
        if (nextStatus === 'deployed' && existing.status !== 'deployed') {
            try {
                const commitResult = await gitAutomationManager.autoCommitFeature(updated, {
                    branchName: updated.git?.branchName || updated.branchName,
                    targetBranch: updated.git?.targetBranch
                });
                if (commitResult.success) {
                    console.log(`✓ Auto-committed feature ${updated.id}: ${commitResult.commitMessage.split('\n')[0]}`);
                    if (commitResult.mergeResult && !commitResult.mergeResult.success) {
                        console.warn(`⚠ Merge skipped for feature ${updated.id}: ${commitResult.mergeResult.reason}`);
                    } else if (commitResult.mergeResult && commitResult.mergeResult.success) {
                        console.log(`✓ Merged feature branch ${commitResult.mergeResult.mergedBranch} into ${commitResult.mergeResult.targetBranch}`);
                    }
                } else {
                    console.log(`⚠ Auto-commit failed for feature ${updated.id}: ${commitResult.reason}`);
                }
            } catch (error) {
                console.error(`✗ Git automation error for feature ${updated.id}:`, error.message);
            }
        }

        console.log(`✓ Updated feature: ${updated.title} → ${updated.status}`);
        res.json(updated);
    } catch (error) {
        console.error('Feature update error:', error);
        res.status(500).json({ error: 'Failed to update feature' });
    }
}

function createFeaturesRoutes(deps) {
    setFeaturesDependencies(deps);
    const router = express.Router();

    router.get('/api/features', listFeaturesRoute);
    router.post('/api/features', createFeatureRoute);
    router.put('/api/features/:id', updateFeatureRoute);

    return router;
}

module.exports = {
    createFeaturesRoutes,
    listFeaturesRoute,
    createFeatureRoute,
    updateFeatureRoute
};
