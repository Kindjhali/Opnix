import { ref, reactive, watch, onMounted, onUnmounted } from 'vue';

/**
 * Context Restoration Composable
 * Provides automatic form state restoration and session context management
 */
export function useContextRestoration(options = {}) {
  const {
    sessionId = null,
    autoSave = true,
    autoSaveInterval = 5000, // 5 seconds
    debounceDelay = 1000, // 1 second
    excludeFields = [],
    onRestore = null,
    onSave = null
  } = options;

  // Reactive state
  const isRestoring = ref(false);
  const isSaving = ref(false);
  const lastSaved = ref(null);
  const restoreError = ref(null);
  const saveError = ref(null);
  const hasUnsavedChanges = ref(false);

  // Track registered forms and their contexts
  const registeredForms = reactive(new Map());
  const formContexts = reactive(new Map());

  // Auto-save and debounce timers
  let autoSaveTimer = null;
  let debounceTimer = null;

  /**
   * Register a form for context restoration
   */
  function registerForm(formId, formData, options = {}) {
    if (!formId) {
      console.warn('Form ID is required for context restoration');
      return;
    }

    const formConfig = {
      id: formId,
      data: formData,
      originalData: JSON.parse(JSON.stringify(formData)),
      excludeFields: options.excludeFields || [],
      restoreCallback: options.onRestore,
      saveCallback: options.onSave,
      autoSave: options.autoSave !== false
    };

    registeredForms.set(formId, formConfig);

    // Watch for changes in form data
    if (formData && typeof formData === 'object') {
      watch(
        () => formData,
        (newData) => {
          handleFormDataChange(formId, newData);
        },
        { deep: true }
      );
    }

    console.log(`Form ${formId} registered for context restoration`);
    return formId;
  }

  /**
   * Unregister a form from context restoration
   */
  function unregisterForm(formId) {
    if (registeredForms.has(formId)) {
      registeredForms.delete(formId);
      formContexts.delete(formId);
      console.log(`Form ${formId} unregistered from context restoration`);
    }
  }

  /**
   * Handle form data changes (for auto-save and change tracking)
   */
  function handleFormDataChange(formId, newData) {
    const formConfig = registeredForms.get(formId);
    if (!formConfig) return;

    // Check if data has actually changed
    const hasChanged = JSON.stringify(newData) !== JSON.stringify(formConfig.originalData);
    hasUnsavedChanges.value = hasChanged;

    if (hasChanged && autoSave && formConfig.autoSave) {
      // Debounce auto-save
      if (debounceTimer) {
        clearTimeout(debounceTimer);
      }

      debounceTimer = setTimeout(() => {
        saveFormContext(formId, newData);
      }, debounceDelay);
    }
  }

  /**
   * Save form context to session
   */
  async function saveFormContext(formId, formData = null) {
    if (!sessionId) {
      console.warn('No session ID provided for context saving');
      return false;
    }

    const formConfig = registeredForms.get(formId);
    if (!formConfig) {
      console.warn(`Form ${formId} not registered`);
      return false;
    }

    isSaving.value = true;
    saveError.value = null;

    try {
      const dataToSave = formData || formConfig.data;
      const filteredData = filterExcludedFields(dataToSave, [
        ...excludeFields,
        ...(formConfig.excludeFields || [])
      ]);

      const contextUpdate = {
        formData: {
          ...formContexts.get('formData') || {},
          [formId]: {
            data: filteredData,
            timestamp: new Date().toISOString(),
            formId
          }
        }
      };

      const response = await fetch(`/api/sessions/${sessionId}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(contextUpdate)
      });

      if (!response.ok) {
        throw new Error(`Failed to save context: ${response.statusText}`);
      }

      const result = await response.json();

      const autoSaveState = result?.session?.autoSave;
      if (autoSaveState) {
        formContexts.set('formData', autoSaveState.forms || {});
        formContexts.set('selectedItems', autoSaveState.context?.selectedItems || []);
        formContexts.set('filters', autoSaveState.context?.filters || {});
        formContexts.set('viewState', autoSaveState.context?.viewState || {});
        lastSaved.value = autoSaveState.updatedAt || new Date().toISOString();
      } else {
        formContexts.set('formData', contextUpdate.formData);
        lastSaved.value = new Date().toISOString();
      }
      hasUnsavedChanges.value = false;

      // Call save callback if provided
      if (formConfig.saveCallback) {
        formConfig.saveCallback(filteredData, result);
      }

      if (onSave) {
        onSave(formId, filteredData, result);
      }

      console.log(`Context saved for form ${formId}`);
      return true;

    } catch (error) {
      console.error('Failed to save form context:', error);
      saveError.value = error.message;
      return false;
    } finally {
      isSaving.value = false;
    }
  }

  /**
   * Restore form context from session
   */
  async function restoreFormContext(formId = null) {
    if (!sessionId) {
      console.warn('No session ID provided for context restoration');
      return null;
    }

    isRestoring.value = true;
    restoreError.value = null;

    try {
      let savedState = null;

      try {
        const contextResponse = await fetch(`/api/sessions/${sessionId}/context`);
        if (contextResponse.ok) {
          const contextPayload = await contextResponse.json();
          if (contextPayload.success && contextPayload.state) {
            savedState = contextPayload.state;
          }
        } else if (contextResponse.status !== 404) {
          throw new Error(`Failed to load session context: ${contextResponse.statusText}`);
        }
      } catch (error) {
        console.warn('Context restoration fallback:', error.message || error);
      }

      if (!savedState) {
        const response = await fetch(`/api/sessions/${sessionId}`);
        if (!response.ok) {
          throw new Error(`Failed to load session: ${response.statusText}`);
        }

        const sessionData = await response.json();
        if (!sessionData.success || !sessionData.session) {
          throw new Error(sessionData.error || 'Invalid session data received');
        }

        const session = sessionData.session;
        savedState = {
          forms: (session.context && session.context.formData) || session.autoSave?.forms || {},
          context: {
            selectedItems: session.context?.selectedItems || session.autoSave?.context?.selectedItems || [],
            filters: session.context?.filters || session.autoSave?.context?.filters || {},
            viewState: session.context?.viewState || session.autoSave?.context?.viewState || {}
          },
          updatedAt: session.autoSave?.updatedAt || session.metadata?.updatedAt || null
        };
      }

      const savedFormData = savedState.forms || {};
      const savedContext = savedState.context || {};

      if (savedState.updatedAt) {
        lastSaved.value = savedState.updatedAt;
      }

      formContexts.set('formData', savedFormData);
      formContexts.set('selectedItems', savedContext.selectedItems || []);
      formContexts.set('filters', savedContext.filters || {});
      formContexts.set('viewState', savedContext.viewState || {});

      if (formId) {
        const formContext = savedFormData[formId];
        if (formContext) {
          await restoreSpecificForm(formId, formContext);
          return formContext.data;
        }
        console.log(`No saved context found for form ${formId}`);
        return null;
      }

      const restored = {};
      for (const [registeredFormId] of registeredForms) {
        const formContext = savedFormData[registeredFormId];
        if (formContext) {
          await restoreSpecificForm(registeredFormId, formContext);
          restored[registeredFormId] = formContext.data;
        }
      }
      return restored;

    } catch (error) {
      console.error('Failed to restore form context:', error);
      restoreError.value = error.message;
      return null;
    } finally {
      isRestoring.value = false;
    }
  }

  /**
   * Restore a specific form's data
   */
  async function restoreSpecificForm(formId, formContext) {
    const formConfig = registeredForms.get(formId);
    if (!formConfig) {
      console.warn(`Cannot restore form ${formId}: not registered`);
      return;
    }

    try {
      // Merge saved data with current form data
      if (formConfig.data && typeof formConfig.data === 'object') {
        Object.assign(formConfig.data, formContext.data);
      }

      // Call restore callback if provided
      if (formConfig.restoreCallback) {
        formConfig.restoreCallback(formContext.data, formContext);
      }

      if (onRestore) {
        onRestore(formId, formContext.data, formContext);
      }

      console.log(`Form ${formId} restored from context (saved: ${formContext.timestamp})`);
    } catch (error) {
      console.error(`Failed to restore form ${formId}:`, error);
    }
  }

  /**
   * Save all registered forms
   */
  async function saveAllForms() {
    const promises = [];
    for (const [formId] of registeredForms) {
      promises.push(saveFormContext(formId));
    }

    const results = await Promise.allSettled(promises);
    const successful = results.filter(r => r.status === 'fulfilled' && r.value).length;

    console.log(`Saved context for ${successful}/${results.length} forms`);
    return successful === results.length;
  }

  /**
   * Get saved context for selections, filters, etc.
   */
  function getSavedContext(key) {
    return formContexts.get(key);
  }

  /**
   * Update non-form context (selections, filters, view state)
   */
  async function updateContext(updates) {
    if (!sessionId) return false;

    try {
      const response = await fetch(`/api/sessions/${sessionId}/context`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(updates)
      });

      if (!response.ok) {
        throw new Error(`Failed to update context: ${response.statusText}`);
      }

      const result = await response.json();
      const autoSaveState = result?.session?.autoSave;
      if (autoSaveState) {
        formContexts.set('formData', autoSaveState.forms || {});
        formContexts.set('selectedItems', autoSaveState.context?.selectedItems || []);
        formContexts.set('filters', autoSaveState.context?.filters || {});
        formContexts.set('viewState', autoSaveState.context?.viewState || {});
        lastSaved.value = autoSaveState.updatedAt || lastSaved.value;
      } else {
        for (const [key, value] of Object.entries(updates)) {
          formContexts.set(key, value);
        }
      }

      return true;
    } catch (error) {
      console.error('Failed to update context:', error);
      return false;
    }
  }

  /**
   * Filter out excluded fields from data
   */
  function filterExcludedFields(data, excludeList) {
    if (!data || typeof data !== 'object' || !Array.isArray(excludeList)) {
      return data;
    }

    const filtered = { ...data };
    for (const field of excludeList) {
      delete filtered[field];
    }

    return filtered;
  }

  /**
   * Setup auto-save interval
   */
  function startAutoSave() {
    if (autoSave && autoSaveInterval > 0) {
      autoSaveTimer = setInterval(() => {
        if (hasUnsavedChanges.value) {
          saveAllForms();
        }
      }, autoSaveInterval);
    }
  }

  /**
   * Stop auto-save interval
   */
  function stopAutoSave() {
    if (autoSaveTimer) {
      clearInterval(autoSaveTimer);
      autoSaveTimer = null;
    }
  }

  /**
   * Clear all timers
   */
  function cleanup() {
    stopAutoSave();
    if (debounceTimer) {
      clearTimeout(debounceTimer);
      debounceTimer = null;
    }
  }

  // Lifecycle hooks
  onMounted(() => {
    if (sessionId) {
      // Restore context on mount
      restoreFormContext();
      startAutoSave();
    }
  });

  onUnmounted(() => {
    cleanup();
  });

  // Return public API
  return {
    // State
    isRestoring,
    isSaving,
    lastSaved,
    restoreError,
    saveError,
    hasUnsavedChanges,

    // Form management
    registerForm,
    unregisterForm,

    // Context operations
    saveFormContext,
    restoreFormContext,
    saveAllForms,
    getSavedContext,
    updateContext,

    // Auto-save control
    startAutoSave,
    stopAutoSave,

    // Cleanup
    cleanup
  };
}
