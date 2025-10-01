const fs = require('fs').promises;
const path = require('path');

class UserPreferencesManager {
  constructor() {
    this.preferencesFile = path.join(__dirname, '../data/user-preferences.json');
    this.defaultPreferences = {
      // UI Preferences
      ui: {
        theme: 'mole',
        density: 'comfortable', // 'compact', 'comfortable', 'spacious'
        sidebarCollapsed: false,
        showAdvancedOptions: false,
        animationsEnabled: true,
        reduceMotion: false
      },

      // Layout Preferences
      layout: {
        panelSizes: {
          sidebar: 280,
          main: 'auto',
          details: 320
        },
        tabOrder: ['bugs', 'features', 'modules', 'roadmap', 'canvas', 'specs', 'docs'],
        hiddenTabs: [],
        defaultTab: 'bugs'
      },

      // Content Preferences
      content: {
        itemsPerPage: 20,
        autoRefresh: true,
        refreshInterval: 30000, // 30 seconds
        showCompletedItems: false,
        groupByModule: false,
        sortBy: 'created',
        sortOrder: 'desc',
        expandedSections: {
          tickets: true,
          features: true,
          modules: true,
          roadmap: false
        }
      },

      // Quick Actions
      quickActions: [
        { id: 'new-bug', label: 'New Bug', icon: '🐛', action: 'createBug' },
        { id: 'new-feature', label: 'New Feature', icon: '✨', action: 'createFeature' },
        { id: 'run-detection', label: 'Detect Modules', icon: '🔍', action: 'detectModules' },
        { id: 'export-data', label: 'Export', icon: '📤', action: 'exportData' }
      ],

      // Developer Preferences
      developer: {
        showDebugInfo: false,
        enableConsoleLogging: false,
        showPerformanceMetrics: false,
        enableExperimentalFeatures: false
      },

      // Accessibility
      accessibility: {
        highContrast: false,
        largeText: false,
        keyboardNavigation: true,
        screenReaderOptimized: false,
        focusIndicatorEnhanced: false
      },

      // Session Management
      sessions: {
        autoSave: true,
        autoSaveInterval: 60000, // 1 minute
        maxRecentSessions: 10,
        resumeLastSession: true,
        confirmBeforeDiscard: true
      },

      // Notifications
      notifications: {
        enabled: true,
        position: 'top-right', // 'top-left', 'top-right', 'bottom-left', 'bottom-right'
        duration: 5000,
        showSuccess: true,
        showWarnings: true,
        showErrors: true,
        soundEnabled: false
      }
    };
  }

  // Load user preferences
  async loadPreferences() {
    try {
      const data = await fs.readFile(this.preferencesFile, 'utf8');
      const preferences = JSON.parse(data);

      // Merge with defaults to ensure all properties exist
      return this.mergeWithDefaults(preferences);
    } catch {
      console.log('No existing preferences found, using defaults');
      return { ...this.defaultPreferences };
    }
  }

  // Save user preferences
  async savePreferences(preferences) {
    try {
      // Merge with current preferences to avoid losing data
      const current = await this.loadPreferences();
      const merged = this.deepMerge(current, preferences);

      await fs.writeFile(this.preferencesFile, JSON.stringify(merged, null, 2));
      console.log('✓ User preferences saved');
      return merged;
    } catch (error) {
      console.error('Failed to save preferences:', error);
      throw error;
    }
  }

  // Update specific preference
  async updatePreference(path, value) {
    try {
      const preferences = await this.loadPreferences();
      this.setNestedProperty(preferences, path, value);
      return await this.savePreferences(preferences);
    } catch (error) {
      console.error('Failed to update preference:', error);
      throw error;
    }
  }

  // Get specific preference
  async getPreference(path, defaultValue = null) {
    try {
      const preferences = await this.loadPreferences();
      return this.getNestedProperty(preferences, path) || defaultValue;
    } catch (error) {
      console.error('Failed to get preference:', error);
      return defaultValue;
    }
  }

  // Reset preferences to defaults
  async resetPreferences() {
    try {
      await fs.writeFile(this.preferencesFile, JSON.stringify(this.defaultPreferences, null, 2));
      console.log('✓ Preferences reset to defaults');
      return { ...this.defaultPreferences };
    } catch (error) {
      console.error('Failed to reset preferences:', error);
      throw error;
    }
  }

  // Get UI density settings
  async getDensitySettings() {
    const density = await this.getPreference('ui.density', 'comfortable');

    const settings = {
      compact: {
        spacing: '0.5rem',
        fontSize: '0.875rem',
        padding: '0.25rem 0.5rem',
        itemHeight: '2rem',
        borderRadius: '0.25rem'
      },
      comfortable: {
        spacing: '1rem',
        fontSize: '1rem',
        padding: '0.5rem 1rem',
        itemHeight: '2.5rem',
        borderRadius: '0.375rem'
      },
      spacious: {
        spacing: '1.5rem',
        fontSize: '1.125rem',
        padding: '0.75rem 1.5rem',
        itemHeight: '3rem',
        borderRadius: '0.5rem'
      }
    };

    return settings[density] || settings.comfortable;
  }

  // Get quick actions
  async getQuickActions() {
    return await this.getPreference('quickActions', this.defaultPreferences.quickActions);
  }

  // Update quick actions
  async updateQuickActions(actions) {
    return await this.updatePreference('quickActions', actions);
  }

  // Add quick action
  async addQuickAction(action) {
    const actions = await this.getQuickActions();
    actions.push(action);
    return await this.updateQuickActions(actions);
  }

  // Remove quick action
  async removeQuickAction(actionId) {
    const actions = await this.getQuickActions();
    const filtered = actions.filter(action => action.id !== actionId);
    return await this.updateQuickActions(filtered);
  }

  // Get layout preferences
  async getLayoutPreferences() {
    return await this.getPreference('layout', this.defaultPreferences.layout);
  }

  // Update layout preferences
  async updateLayoutPreferences(layout) {
    return await this.updatePreference('layout', layout);
  }

  // Get content preferences
  async getContentPreferences() {
    return await this.getPreference('content', this.defaultPreferences.content);
  }

  // Update content preferences
  async updateContentPreferences(content) {
    return await this.updatePreference('content', content);
  }

  // Export preferences
  async exportPreferences() {
    try {
      const preferences = await this.loadPreferences();
      return {
        preferences,
        exportedAt: new Date().toISOString(),
        version: '1.0'
      };
    } catch (error) {
      console.error('Failed to export preferences:', error);
      throw error;
    }
  }

  // Import preferences
  async importPreferences(importData) {
    try {
      if (!importData.preferences) {
        throw new Error('Invalid import data format');
      }

      const merged = this.mergeWithDefaults(importData.preferences);
      await this.savePreferences(merged);

      console.log('✓ Preferences imported successfully');
      return merged;
    } catch (error) {
      console.error('Failed to import preferences:', error);
      throw error;
    }
  }

  // Merge with defaults
  mergeWithDefaults(preferences) {
    return this.deepMerge(this.defaultPreferences, preferences);
  }

  // Deep merge objects
  deepMerge(target, source) {
    const result = { ...target };

    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        result[key] = this.deepMerge(target[key] || {}, source[key]);
      } else {
        result[key] = source[key];
      }
    }

    return result;
  }

  // Set nested property
  setNestedProperty(obj, path, value) {
    const keys = path.split('.');
    let current = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  // Get nested property
  getNestedProperty(obj, path) {
    const keys = path.split('.');
    let current = obj;

    for (const key of keys) {
      if (current && typeof current === 'object' && key in current) {
        current = current[key];
      } else {
        return undefined;
      }
    }

    return current;
  }

  // Get preference schema for UI generation
  getPreferenceSchema() {
    return {
      ui: {
        title: 'User Interface',
        fields: {
          theme: { type: 'select', options: ['mole', 'canyon'], label: 'Theme' },
          density: { type: 'select', options: ['compact', 'comfortable', 'spacious'], label: 'Density' },
          animationsEnabled: { type: 'boolean', label: 'Enable Animations' },
          reduceMotion: { type: 'boolean', label: 'Reduce Motion' }
        }
      },
      layout: {
        title: 'Layout',
        fields: {
          sidebarCollapsed: { type: 'boolean', label: 'Collapse Sidebar' },
          defaultTab: { type: 'select', options: ['bugs', 'features', 'modules', 'roadmap'], label: 'Default Tab' }
        }
      },
      content: {
        title: 'Content',
        fields: {
          itemsPerPage: { type: 'number', min: 10, max: 100, label: 'Items per Page' },
          autoRefresh: { type: 'boolean', label: 'Auto Refresh' },
          showCompletedItems: { type: 'boolean', label: 'Show Completed Items' }
        }
      },
      accessibility: {
        title: 'Accessibility',
        fields: {
          highContrast: { type: 'boolean', label: 'High Contrast' },
          largeText: { type: 'boolean', label: 'Large Text' },
          keyboardNavigation: { type: 'boolean', label: 'Keyboard Navigation' }
        }
      }
    };
  }
}

module.exports = UserPreferencesManager;