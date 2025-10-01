import { ref, reactive, watch, onMounted } from 'vue';

/**
 * Preferences Manager Composable
 * Provides reactive user preferences management with automatic persistence
 */
export function usePreferencesManager(options = {}) {
  const {
    autoSave = true,
    autoSaveDelay = 1000,
    loadOnMount = true
  } = options;

  // Reactive state
  const preferences = reactive({});
  const isLoading = ref(false);
  const isSaving = ref(false);
  const error = ref(null);
  const lastSaved = ref(null);
  const hasUnsavedChanges = ref(false);

  // Internal state
  let saveTimeout = null;
  let originalPreferences = {};

  /**
   * Load preferences from server
   */
  async function loadPreferences() {
    isLoading.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/preferences');

      if (!response.ok) {
        throw new Error(`Failed to load preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to load preferences');
      }

      // Clear existing preferences and set new ones
      Object.keys(preferences).forEach(key => {
        delete preferences[key];
      });

      Object.assign(preferences, data.preferences);
      originalPreferences = JSON.parse(JSON.stringify(data.preferences));
      hasUnsavedChanges.value = false;

      console.log('Preferences loaded successfully');
      return data.preferences;

    } catch (err) {
      console.error('Failed to load preferences:', err);
      error.value = err.message;
      return null;
    } finally {
      isLoading.value = false;
    }
  }

  /**
   * Save preferences to server
   */
  async function savePreferences(prefsToSave = null) {
    const dataToSave = prefsToSave || preferences;

    isSaving.value = true;
    error.value = null;

    try {
      const response = await fetch('/api/preferences', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(dataToSave)
      });

      if (!response.ok) {
        throw new Error(`Failed to save preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to save preferences');
      }

      // Update local state
      if (!prefsToSave) {
        originalPreferences = JSON.parse(JSON.stringify(preferences));
        hasUnsavedChanges.value = false;
      }

      lastSaved.value = new Date().toISOString();

      console.log('Preferences saved successfully');
      return data.preferences;

    } catch (err) {
      console.error('Failed to save preferences:', err);
      error.value = err.message;
      return null;
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Update a specific preference
   */
  async function updatePreference(path, value) {
    try {
      const response = await fetch(`/api/preferences/${path}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ value })
      });

      if (!response.ok) {
        throw new Error(`Failed to update preference: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to update preference');
      }

      // Update local preferences
      setNestedProperty(preferences, path, value);
      lastSaved.value = new Date().toISOString();

      console.log(`Preference '${path}' updated successfully`);
      return value;

    } catch (err) {
      console.error('Failed to update preference:', err);
      error.value = err.message;
      return null;
    }
  }

  /**
   * Get a specific preference value
   */
  function getPreference(path, defaultValue = null) {
    return getNestedProperty(preferences, path) ?? defaultValue;
  }

  /**
   * Set a preference value locally (will be auto-saved if enabled)
   */
  function setPreference(path, value) {
    setNestedProperty(preferences, path, value);

    if (autoSave) {
      scheduleAutoSave();
    }
  }

  /**
   * Reset preferences to defaults
   */
  async function resetPreferences() {
    try {
      const response = await fetch('/api/preferences/reset', {
        method: 'POST'
      });

      if (!response.ok) {
        throw new Error(`Failed to reset preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to reset preferences');
      }

      // Update local state
      Object.keys(preferences).forEach(key => {
        delete preferences[key];
      });

      Object.assign(preferences, data.preferences);
      originalPreferences = JSON.parse(JSON.stringify(data.preferences));
      hasUnsavedChanges.value = false;
      lastSaved.value = new Date().toISOString();

      console.log('Preferences reset to defaults');
      return data.preferences;

    } catch (err) {
      console.error('Failed to reset preferences:', err);
      error.value = err.message;
      return null;
    }
  }

  /**
   * Get UI density settings
   */
  async function getDensitySettings() {
    try {
      const response = await fetch('/api/preferences/ui/density');

      if (!response.ok) {
        throw new Error(`Failed to get density settings: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.settings : null;

    } catch (err) {
      console.error('Failed to get density settings:', err);
      return null;
    }
  }

  /**
   * Get quick actions
   */
  async function getQuickActions() {
    try {
      const response = await fetch('/api/preferences/quick-actions');

      if (!response.ok) {
        throw new Error(`Failed to get quick actions: ${response.statusText}`);
      }

      const data = await response.json();
      return data.success ? data.actions : [];

    } catch (err) {
      console.error('Failed to get quick actions:', err);
      return [];
    }
  }

  /**
   * Export preferences
   */
  async function exportPreferences() {
    try {
      const response = await fetch('/api/preferences/export');

      if (!response.ok) {
        throw new Error(`Failed to export preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to export preferences');
      }

      // Download as JSON file
      const blob = new Blob([JSON.stringify(data.export, null, 2)], {
        type: 'application/json'
      });

      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `opnix-preferences-${new Date().toISOString().split('T')[0]}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      console.log('Preferences exported successfully');
      return data.export;

    } catch (err) {
      console.error('Failed to export preferences:', err);
      error.value = err.message;
      return null;
    }
  }

  /**
   * Import preferences from file
   */
  async function importPreferences(importData) {
    try {
      const response = await fetch('/api/preferences/import', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(importData)
      });

      if (!response.ok) {
        throw new Error(`Failed to import preferences: ${response.statusText}`);
      }

      const data = await response.json();

      if (!data.success) {
        throw new Error(data.error || 'Failed to import preferences');
      }

      // Update local state
      Object.keys(preferences).forEach(key => {
        delete preferences[key];
      });

      Object.assign(preferences, data.preferences);
      originalPreferences = JSON.parse(JSON.stringify(data.preferences));
      hasUnsavedChanges.value = false;
      lastSaved.value = new Date().toISOString();

      console.log('Preferences imported successfully');
      return data.preferences;

    } catch (err) {
      console.error('Failed to import preferences:', err);
      error.value = err.message;
      return null;
    }
  }

  /**
   * Schedule auto-save
   */
  function scheduleAutoSave() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
    }

    hasUnsavedChanges.value = true;

    saveTimeout = setTimeout(() => {
      savePreferences();
      saveTimeout = null;
    }, autoSaveDelay);
  }

  /**
   * Set nested property in object
   */
  function setNestedProperty(obj, path, value) {
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

  /**
   * Get nested property from object
   */
  function getNestedProperty(obj, path) {
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

  /**
   * Watch for changes and trigger auto-save
   */
  function setupAutoSave() {
    if (autoSave) {
      watch(
        () => preferences,
        (newPrefs) => {
          const hasChanged = JSON.stringify(newPrefs) !== JSON.stringify(originalPreferences);
          if (hasChanged) {
            scheduleAutoSave();
          }
        },
        { deep: true }
      );
    }
  }

  /**
   * Cleanup function
   */
  function cleanup() {
    if (saveTimeout) {
      clearTimeout(saveTimeout);
      saveTimeout = null;
    }
  }

  // Initialize on mount
  onMounted(async () => {
    if (loadOnMount) {
      await loadPreferences();
      setupAutoSave();
    }
  });

  return {
    // State
    preferences,
    isLoading,
    isSaving,
    error,
    lastSaved,
    hasUnsavedChanges,

    // Core operations
    loadPreferences,
    savePreferences,
    updatePreference,
    getPreference,
    setPreference,
    resetPreferences,

    // Specialized getters
    getDensitySettings,
    getQuickActions,

    // Import/Export
    exportPreferences,
    importPreferences,

    // Cleanup
    cleanup
  };
}