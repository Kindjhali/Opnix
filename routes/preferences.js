const express = require('express');
const UserPreferencesManager = require('../services/userPreferencesManager');

const router = express.Router();
const preferencesManager = new UserPreferencesManager();

// Get all user preferences
router.get('/', async (req, res) => {
  try {
    const preferences = await preferencesManager.loadPreferences();

    res.json({
      success: true,
      preferences
    });
  } catch (error) {
    console.error('Failed to load preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update all preferences
router.put('/', async (req, res) => {
  try {
    const preferences = req.body;

    if (!preferences || typeof preferences !== 'object') {
      return res.status(400).json({
        success: false,
        error: 'Preferences object is required'
      });
    }

    const updated = await preferencesManager.savePreferences(preferences);

    res.json({
      success: true,
      preferences: updated,
      message: 'Preferences updated successfully'
    });

    console.log('✓ User preferences updated');
  } catch (error) {
    console.error('Failed to update preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Reset preferences to defaults
router.post('/reset', async (req, res) => {
  try {
    const preferences = await preferencesManager.resetPreferences();

    res.json({
      success: true,
      preferences,
      message: 'Preferences reset to defaults'
    });

    console.log('✓ User preferences reset to defaults');
  } catch (error) {
    console.error('Failed to reset preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get UI density settings
router.get('/ui/density', async (req, res) => {
  try {
    const settings = await preferencesManager.getDensitySettings();

    res.json({
      success: true,
      settings
    });
  } catch (error) {
    console.error('Failed to get density settings:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get quick actions
router.get('/quick-actions', async (req, res) => {
  try {
    const actions = await preferencesManager.getQuickActions();

    res.json({
      success: true,
      actions
    });
  } catch (error) {
    console.error('Failed to get quick actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update quick actions
router.put('/quick-actions', async (req, res) => {
  try {
    const { actions } = req.body;

    if (!Array.isArray(actions)) {
      return res.status(400).json({
        success: false,
        error: 'Actions must be an array'
      });
    }

    const updated = await preferencesManager.updateQuickActions(actions);

    res.json({
      success: true,
      preferences: updated,
      message: 'Quick actions updated successfully'
    });

    console.log('✓ Quick actions updated');
  } catch (error) {
    console.error('Failed to update quick actions:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Add quick action
router.post('/quick-actions', async (req, res) => {
  try {
    const action = req.body;

    if (!action || !action.id || !action.label) {
      return res.status(400).json({
        success: false,
        error: 'Action must have id and label'
      });
    }

    const updated = await preferencesManager.addQuickAction(action);

    res.json({
      success: true,
      preferences: updated,
      message: `Quick action '${action.label}' added`
    });

    console.log(`✓ Quick action '${action.label}' added`);
  } catch (error) {
    console.error('Failed to add quick action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Remove quick action
router.delete('/quick-actions/:actionId', async (req, res) => {
  try {
    const { actionId } = req.params;
    const updated = await preferencesManager.removeQuickAction(actionId);

    res.json({
      success: true,
      preferences: updated,
      message: `Quick action '${actionId}' removed`
    });

    console.log(`✓ Quick action '${actionId}' removed`);
  } catch (error) {
    console.error('Failed to remove quick action:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get layout preferences
router.get('/layout', async (req, res) => {
  try {
    const layout = await preferencesManager.getLayoutPreferences();

    res.json({
      success: true,
      layout
    });
  } catch (error) {
    console.error('Failed to get layout preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update layout preferences
router.put('/layout', async (req, res) => {
  try {
    const layout = req.body;
    const updated = await preferencesManager.updateLayoutPreferences(layout);

    res.json({
      success: true,
      preferences: updated,
      message: 'Layout preferences updated successfully'
    });

    console.log('✓ Layout preferences updated');
  } catch (error) {
    console.error('Failed to update layout preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get content preferences
router.get('/content', async (req, res) => {
  try {
    const content = await preferencesManager.getContentPreferences();

    res.json({
      success: true,
      content
    });
  } catch (error) {
    console.error('Failed to get content preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Update content preferences
router.put('/content', async (req, res) => {
  try {
    const content = req.body;
    const updated = await preferencesManager.updateContentPreferences(content);

    res.json({
      success: true,
      preferences: updated,
      message: 'Content preferences updated successfully'
    });

    console.log('✓ Content preferences updated');
  } catch (error) {
    console.error('Failed to update content preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Export preferences
router.get('/export', async (req, res) => {
  try {
    const exportData = await preferencesManager.exportPreferences();

    res.json({
      success: true,
      export: exportData
    });
  } catch (error) {
    console.error('Failed to export preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Import preferences
router.post('/import', async (req, res) => {
  try {
    const importData = req.body;

    if (!importData || !importData.preferences) {
      return res.status(400).json({
        success: false,
        error: 'Import data with preferences is required'
      });
    }

    const preferences = await preferencesManager.importPreferences(importData);

    res.json({
      success: true,
      preferences,
      message: 'Preferences imported successfully'
    });

    console.log('✓ Preferences imported successfully');
  } catch (error) {
    console.error('Failed to import preferences:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

// Get preference schema for UI generation
router.get('/schema', (req, res) => {
  try {
    const schema = preferencesManager.getPreferenceSchema();

    res.json({
      success: true,
      schema
    });
  } catch (error) {
    console.error('Failed to get preference schema:', error);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

function resolvePreferencePath(param) {
  if (Array.isArray(param)) {
    return param.join('/');
  }
  return typeof param === 'string' ? param : String(param || '');
}

// Fallback getter for nested preference paths
router.get('/:path', async (req, res) => {
  try {
    const pathKey = resolvePreferencePath(req.params.path);
    if (!pathKey) {
      return res.status(400).json({ success: false, error: 'Preference path is required' });
    }
    const { defaultValue } = req.query;
    const value = await preferencesManager.getPreference(pathKey, defaultValue);
    res.json({ success: true, path: pathKey, value });
  } catch (error) {
    console.error('Failed to get preference path:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Fallback updater for nested preference paths
router.put('/:path', async (req, res) => {
  try {
    const pathKey = resolvePreferencePath(req.params.path);
    if (!pathKey) {
      return res.status(400).json({ success: false, error: 'Preference path is required' });
    }
    const { value } = req.body;
    if (value === undefined) {
      return res.status(400).json({ success: false, error: 'Value is required' });
    }
    const updated = await preferencesManager.updatePreference(pathKey, value);
    res.json({
      success: true,
      preferences: updated,
      path: pathKey,
      value,
      message: `Preference '${pathKey}' updated successfully`
    });
    console.log(`✓ Preference '${pathKey}' updated`);
  } catch (error) {
    console.error('Failed to update preference path:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});


module.exports = router;