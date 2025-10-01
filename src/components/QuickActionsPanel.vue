<template>
  <div class="quick-actions-panel" :class="{ 'is-collapsed': collapsed, 'is-loading': loading }">
    <div class="panel-header" @click="toggleCollapsed">
      <div class="panel-title">
        <span class="panel-icon">⚡</span>
        <h3>Quick Actions</h3>
      </div>
      <button
        class="collapse-toggle"
        :aria-expanded="!collapsed"
        :aria-label="collapsed ? 'Expand quick actions' : 'Collapse quick actions'"
      >
        {{ collapsed ? '+' : '−' }}
      </button>
    </div>

    <div class="panel-content" v-if="!collapsed">
      <div v-if="loading" class="panel-loading">
        <div class="loading-spinner"></div>
        <span>Loading actions...</span>
      </div>

      <div v-else-if="error" class="panel-error">
        <span class="error-icon">⚠</span>
        <span>{{ error }}</span>
        <button class="retry-btn" @click="loadActions">Retry</button>
      </div>

      <div v-else class="actions-container">
        <!-- Primary Actions -->
        <div class="actions-section" v-if="primaryActions.length">
          <h4 class="section-title">Primary</h4>
          <div class="actions-grid">
            <button
              v-for="action in primaryActions"
              :key="action.id"
              class="action-btn primary"
              :class="{ 'is-active': action.active, 'is-disabled': action.disabled }"
              :disabled="action.disabled || executing.has(action.id)"
              @click="executeAction(action)"
              :title="action.description || action.label"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
              <span v-if="executing.has(action.id)" class="action-spinner">⟳</span>
            </button>
          </div>
        </div>

        <!-- Settings Actions -->
        <div class="actions-section" v-if="settingsActions.length">
          <h4 class="section-title">Settings</h4>
          <div class="actions-grid">
            <button
              v-for="action in settingsActions"
              :key="action.id"
              class="action-btn setting"
              :class="{ 'is-active': action.active, 'is-toggle': action.type === 'toggle' }"
              :disabled="action.disabled || executing.has(action.id)"
              @click="executeAction(action)"
              :title="action.description || action.label"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
              <span v-if="action.type === 'toggle'" class="toggle-indicator">
                {{ action.active ? '●' : '○' }}
              </span>
              <span v-if="executing.has(action.id)" class="action-spinner">⟳</span>
            </button>
          </div>
        </div>

        <!-- Tool Actions -->
        <div class="actions-section" v-if="toolActions.length">
          <h4 class="section-title">Tools</h4>
          <div class="actions-grid">
            <button
              v-for="action in toolActions"
              :key="action.id"
              class="action-btn tool"
              :class="{ 'is-active': action.active, 'is-disabled': action.disabled }"
              :disabled="action.disabled || executing.has(action.id)"
              @click="executeAction(action)"
              :title="action.description || action.label"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
              <span v-if="executing.has(action.id)" class="action-spinner">⟳</span>
            </button>
          </div>
        </div>

        <!-- Custom Actions -->
        <div class="actions-section" v-if="customActions.length">
          <h4 class="section-title">
            Custom
            <button class="edit-actions-btn" @click="showCustomEditor = !showCustomEditor">
              ⚙
            </button>
          </h4>
          <div class="actions-grid">
            <button
              v-for="action in customActions"
              :key="action.id"
              class="action-btn custom"
              :class="{ 'is-active': action.active }"
              :disabled="action.disabled || executing.has(action.id)"
              @click="executeAction(action)"
              :title="action.description || action.label"
            >
              <span class="action-icon">{{ action.icon }}</span>
              <span class="action-label">{{ action.label }}</span>
              <span v-if="executing.has(action.id)" class="action-spinner">⟳</span>
            </button>
          </div>
        </div>

        <!-- Custom Actions Editor -->
        <div class="custom-editor" v-if="showCustomEditor">
          <h4>Edit Custom Actions</h4>
          <div class="editor-form">
            <input
              v-model="newAction.label"
              placeholder="Action label"
              class="editor-input"
            >
            <input
              v-model="newAction.icon"
              placeholder="Icon (emoji)"
              class="editor-input small"
              maxlength="2"
            >
            <select v-model="newAction.actionType" class="editor-select">
              <option value="navigate">Navigate to Tab</option>
              <option value="command">Run Command</option>
              <option value="toggle">Toggle Setting</option>
              <option value="modal">Open Modal</option>
            </select>
            <input
              v-model="newAction.actionValue"
              :placeholder="getActionValuePlaceholder()"
              class="editor-input"
            >
            <div class="editor-actions">
              <button @click="addCustomAction" class="add-btn" :disabled="!canAddAction">
                Add
              </button>
              <button @click="resetNewAction" class="cancel-btn">
                Clear
              </button>
            </div>
          </div>

          <div class="existing-actions" v-if="customActions.length">
            <div
              v-for="action in customActions"
              :key="action.id"
              class="existing-action"
            >
              <span class="action-preview">
                {{ action.icon }} {{ action.label }}
              </span>
              <button
                @click="removeCustomAction(action.id)"
                class="remove-btn"
                title="Remove action"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        <!-- Empty state -->
        <div v-if="!hasAnyActions" class="panel-empty">
          <span class="empty-icon">⚡</span>
          <p>No quick actions available</p>
          <button class="add-custom-btn" @click="showCustomEditor = true">
            Add Custom Action
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'QuickActionsPanel',
  props: {
    defaultCollapsed: {
      type: Boolean,
      default: false
    },
    autoLoad: {
      type: Boolean,
      default: true
    }
  },
  emits: ['action-executed', 'toggle-collapsed'],
  data() {
    return {
      collapsed: this.defaultCollapsed,
      loading: false,
      error: null,
      executing: new Set(),
      showCustomEditor: false,

      // Action categories
      primaryActions: [],
      settingsActions: [],
      toolActions: [],
      customActions: [],

      // New action form
      newAction: {
        label: '',
        icon: '',
        actionType: 'navigate',
        actionValue: ''
      },

      // Default actions
      defaultActions: {
        primary: [
          {
            id: 'new-ticket',
            label: 'New Ticket',
            icon: '🎫',
            action: 'modal',
            value: 'bug-modal',
            description: 'Create a new bug/ticket'
          },
          {
            id: 'new-feature',
            label: 'New Feature',
            icon: '✨',
            action: 'modal',
            value: 'feature-modal',
            description: 'Create a new feature'
          },
          {
            id: 'detect-modules',
            label: 'Detect Modules',
            icon: '🔍',
            action: 'command',
            value: '/detect',
            description: 'Re-detect project modules'
          }
        ],
        settings: [
          {
            id: 'toggle-theme',
            label: 'Dark Mode',
            icon: '🌙',
            type: 'toggle',
            action: 'preference',
            value: 'ui.theme',
            description: 'Toggle between light and dark themes'
          },
          {
            id: 'toggle-density',
            label: 'Compact View',
            icon: '📏',
            type: 'toggle',
            action: 'preference',
            value: 'ui.density',
            description: 'Toggle between comfortable and compact density'
          },
          {
            id: 'toggle-auto-refresh',
            label: 'Auto Refresh',
            icon: '🔄',
            type: 'toggle',
            action: 'preference',
            value: 'content.autoRefresh',
            description: 'Enable/disable automatic data refresh'
          },
          {
            id: 'toggle-animations',
            label: 'Animations',
            icon: '✨',
            type: 'toggle',
            action: 'preference',
            value: 'ui.animationsEnabled',
            description: 'Enable/disable UI animations'
          }
        ],
        tools: [
          {
            id: 'export-data',
            label: 'Export',
            icon: '📤',
            action: 'command',
            value: '/export',
            description: 'Export project data'
          },
          {
            id: 'view-sessions',
            label: 'Sessions',
            icon: '📋',
            action: 'navigate',
            value: 'sessions',
            description: 'View all sessions'
          },
          {
            id: 'preferences',
            label: 'Settings',
            icon: '⚙',
            action: 'modal',
            value: 'preferences-modal',
            description: 'Open preferences'
          }
        ]
      }
    };
  },
  computed: {
    hasAnyActions() {
      return this.primaryActions.length > 0 ||
             this.settingsActions.length > 0 ||
             this.toolActions.length > 0 ||
             this.customActions.length > 0;
    },

    canAddAction() {
      return this.newAction.label.trim() &&
             this.newAction.icon.trim() &&
             this.newAction.actionValue.trim();
    }
  },
  mounted() {
    if (this.autoLoad) {
      this.loadActions();
    }

    // Load collapsed state from preferences
    this.loadCollapsedState();
  },
  methods: {
    async loadActions() {
      this.loading = true;
      this.error = null;

      try {
        // Load default actions
        this.primaryActions = [...this.defaultActions.primary];
        this.toolActions = [...this.defaultActions.tools];

        // Load settings actions with current preference values
        await this.loadSettingsActions();

        // Load custom actions from preferences
        await this.loadCustomActions();

        // Update action states
        await this.updateActionStates();

      } catch (err) {
        console.error('Failed to load quick actions:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadSettingsActions() {
      try {
        // Get current preferences to set toggle states
        const response = await fetch('/api/preferences');
        if (response.ok) {
          const data = await response.json();
          const preferences = data.preferences || {};

          this.settingsActions = this.defaultActions.settings.map(action => {
            const actionCopy = { ...action };

            if (action.type === 'toggle' && action.value) {
              const currentValue = this.getNestedProperty(preferences, action.value);
              actionCopy.active = !!currentValue;
            }

            return actionCopy;
          });
        }
      } catch (error) {
        console.warn('Failed to load preferences for settings actions:', error);
        this.settingsActions = [...this.defaultActions.settings];
      }
    },

    async loadCustomActions() {
      try {
        const response = await fetch('/api/preferences/quick-actions');
        if (response.ok) {
          const data = await response.json();
          this.customActions = data.actions || [];
        }
      } catch (error) {
        console.warn('Failed to load custom actions:', error);
        this.customActions = [];
      }
    },

    async updateActionStates() {
      // Update action states based on current app state
      // This could check if modals are open, current tab, etc.
    },

    async executeAction(action) {
      if (this.executing.has(action.id) || action.disabled) {
        return;
      }

      this.executing.add(action.id);

      try {
        let result = false;

        switch (action.action) {
          case 'navigate':
            result = await this.handleNavigateAction(action);
            break;
          case 'modal':
            result = await this.handleModalAction(action);
            break;
          case 'command':
            result = await this.handleCommandAction(action);
            break;
          case 'preference':
            result = await this.handlePreferenceAction(action);
            break;
          default:
            console.warn('Unknown action type:', action.action);
        }

        if (result) {
          // Update action state if it's a toggle
          if (action.type === 'toggle') {
            action.active = !action.active;
          }

          this.$emit('action-executed', action);
        }

      } catch (error) {
        console.error('Failed to execute action:', error);
        // Could show a notification here
      } finally {
        this.executing.delete(action.id);
      }
    },

    async handleNavigateAction(action) {
      this.$emit('action-executed', {
        type: 'navigate',
        target: action.value,
        action
      });
      return true;
    },

    async handleModalAction(action) {
      this.$emit('action-executed', {
        type: 'modal',
        modal: action.value,
        action
      });
      return true;
    },

    async handleCommandAction(action) {
      try {
        const response = await fetch('/api/claude/execute', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            command: action.value
          })
        });

        if (!response.ok) {
          throw new Error(`Command failed: ${response.statusText}`);
        }

        this.$emit('action-executed', {
          type: 'command',
          command: action.value,
          action
        });

        return true;
      } catch (error) {
        console.error('Command execution failed:', error);
        return false;
      }
    },

    async handlePreferenceAction(action) {
      try {
        if (action.type === 'toggle') {
          const newValue = !action.active;

          const response = await fetch(`/api/preferences/${action.value}`, {
            method: 'PUT',
            headers: {
              'Content-Type': 'application/json'
            },
            body: JSON.stringify({
              value: newValue
            })
          });

          if (!response.ok) {
            throw new Error(`Preference update failed: ${response.statusText}`);
          }

          this.$emit('action-executed', {
            type: 'preference',
            preference: action.value,
            value: newValue,
            action
          });

          return true;
        }
      } catch (error) {
        console.error('Preference update failed:', error);
        return false;
      }

      return false;
    },

    async addCustomAction() {
      if (!this.canAddAction) return;

      const action = {
        id: `custom-${Date.now()}`,
        label: this.newAction.label.trim(),
        icon: this.newAction.icon.trim(),
        action: this.newAction.actionType,
        value: this.newAction.actionValue.trim(),
        description: `Custom action: ${this.newAction.label}`
      };

      this.customActions.push(action);
      await this.saveCustomActions();
      this.resetNewAction();
    },

    async removeCustomAction(actionId) {
      this.customActions = this.customActions.filter(a => a.id !== actionId);
      await this.saveCustomActions();
    },

    async saveCustomActions() {
      try {
        await fetch('/api/preferences/quick-actions', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            actions: this.customActions
          })
        });
      } catch (error) {
        console.error('Failed to save custom actions:', error);
      }
    },

    resetNewAction() {
      this.newAction = {
        label: '',
        icon: '',
        actionType: 'navigate',
        actionValue: ''
      };
    },

    getActionValuePlaceholder() {
      switch (this.newAction.actionType) {
        case 'navigate':
          return 'Tab name (e.g., bugs, features)';
        case 'command':
          return 'Command (e.g., /detect, /export)';
        case 'toggle':
          return 'Preference path (e.g., ui.theme)';
        case 'modal':
          return 'Modal name (e.g., bug-modal)';
        default:
          return 'Action value';
      }
    },

    toggleCollapsed() {
      this.collapsed = !this.collapsed;
      this.saveCollapsedState();
      this.$emit('toggle-collapsed', this.collapsed);
    },

    async loadCollapsedState() {
      try {
        const response = await fetch('/api/preferences/ui.quickActionsCollapsed');
        if (response.ok) {
          const data = await response.json();
          this.collapsed = data.value || false;
        }
      } catch (error) {
        console.warn('Failed to load collapsed quick actions state:', error);
      }
    },

    async saveCollapsedState() {
      try {
        await fetch('/api/preferences/ui.quickActionsCollapsed', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: this.collapsed
          })
        });
      } catch (error) {
        console.warn('Failed to save collapsed state:', error);
      }
    },

    getNestedProperty(obj, path) {
      return path.split('.').reduce((current, key) => {
        return current && current[key] !== undefined ? current[key] : undefined;
      }, obj);
    }
  }
};
</script>