<template>
  <div class="density-controls" :class="{ 'is-loading': loading }">
    <div class="controls-header">
      <h4 class="controls-title">Information Density</h4>
      <p class="controls-description">Adjust the spacing and size of interface elements</p>
    </div>

    <div class="density-options">
      <div
        v-for="option in densityOptions"
        :key="option.value"
        class="density-option"
        :class="{ 'is-active': currentDensity === option.value, 'is-loading': loading }"
        @click="selectDensity(option.value)"
      >
        <div class="option-header">
          <div class="option-icon">{{ option.icon }}</div>
          <div class="option-info">
            <h5 class="option-name">{{ option.name }}</h5>
            <p class="option-description">{{ option.description }}</p>
          </div>
          <div class="option-indicator">
            <span v-if="currentDensity === option.value" class="active-indicator">●</span>
            <span v-else class="inactive-indicator">○</span>
          </div>
        </div>

        <div class="option-preview">
          <div class="preview-sample" :class="`density-${option.value}`">
            <div class="sample-header">
              <div class="sample-icon">📄</div>
              <div class="sample-content">
                <div class="sample-title">Sample Item</div>
                <div class="sample-subtitle">Description text</div>
              </div>
              <div class="sample-badge">Badge</div>
            </div>
            <div class="sample-body">
              <div class="sample-text">This is how content will appear with {{ option.name.toLowerCase() }} density.</div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <div class="controls-footer" v-if="showAdvanced">
      <button class="advanced-toggle" @click="showAdvancedSettings = !showAdvancedSettings">
        {{ showAdvancedSettings ? 'Hide' : 'Show' }} Advanced Settings
      </button>

      <div v-if="showAdvancedSettings" class="advanced-settings">
        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="customSettings.reducedMotion"
              @change="updateCustomSetting('reducedMotion', $event.target.checked)"
            >
            Reduce motion and animations
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="customSettings.largeText"
              @change="updateCustomSetting('largeText', $event.target.checked)"
            >
            Increase text size for better readability
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            <input
              type="checkbox"
              v-model="customSettings.highContrast"
              @change="updateCustomSetting('highContrast', $event.target.checked)"
            >
            High contrast colors
          </label>
        </div>

        <div class="setting-group">
          <label class="setting-label">
            Custom spacing:
            <input
              type="range"
              min="0.5"
              max="2"
              step="0.1"
              v-model.number="customSettings.spacingMultiplier"
              @input="updateCustomSetting('spacingMultiplier', $event.target.value)"
              class="spacing-slider"
            >
            <span class="slider-value">{{ customSettings.spacingMultiplier }}x</span>
          </label>
        </div>
      </div>
    </div>

    <div v-if="error" class="controls-error">
      <span class="error-icon">⚠</span>
      <span>{{ error }}</span>
      <button class="retry-btn" @click="loadCurrentDensity">Retry</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'DensityControls',
  props: {
    showAdvanced: {
      type: Boolean,
      default: false
    },
    autoApply: {
      type: Boolean,
      default: true
    }
  },
  emits: ['density-changed', 'setting-changed'],
  data() {
    return {
      currentDensity: 'comfortable',
      loading: false,
      error: null,
      showAdvancedSettings: false,

      customSettings: {
        reducedMotion: false,
        largeText: false,
        highContrast: false,
        spacingMultiplier: 1.0
      },

      densityOptions: [
        {
          value: 'compact',
          name: 'Compact',
          icon: '📐',
          description: 'Maximum information density with minimal spacing',
          settings: {
            spacing: '0.5rem',
            fontSize: '0.875rem',
            padding: '0.25rem 0.5rem',
            itemHeight: '2rem',
            borderRadius: '0.25rem'
          }
        },
        {
          value: 'comfortable',
          name: 'Comfortable',
          icon: '📏',
          description: 'Balanced spacing for comfortable reading and interaction',
          settings: {
            spacing: '1rem',
            fontSize: '1rem',
            padding: '0.5rem 1rem',
            itemHeight: '2.5rem',
            borderRadius: '0.375rem'
          }
        },
        {
          value: 'spacious',
          name: 'Spacious',
          icon: '📐',
          description: 'Generous spacing for relaxed browsing and accessibility',
          settings: {
            spacing: '1.5rem',
            fontSize: '1.125rem',
            padding: '0.75rem 1.5rem',
            itemHeight: '3rem',
            borderRadius: '0.5rem'
          }
        }
      ]
    };
  },
  mounted() {
    this.loadCurrentDensity();
    this.loadCustomSettings();
  },
  methods: {
    async loadCurrentDensity() {
      this.loading = true;
      this.error = null;

      try {
        const response = await fetch('/api/preferences/ui.density');
        if (response.ok) {
          const data = await response.json();
          this.currentDensity = data.value || 'comfortable';
        }

        // Apply density to body element
        this.applyDensityToUI();

      } catch (err) {
        console.error('Failed to load density preference:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async loadCustomSettings() {
      try {
        const response = await fetch('/api/preferences/accessibility');
        if (response.ok) {
          const data = await response.json();
          const accessibility = data.accessibility || {};

          this.customSettings = {
            reducedMotion: accessibility.reduceMotion || false,
            largeText: accessibility.largeText || false,
            highContrast: accessibility.highContrast || false,
            spacingMultiplier: accessibility.spacingMultiplier || 1.0
          };

          this.applyCustomSettings();
        }
      } catch (error) {
        console.warn('Failed to load custom settings:', error);
      }
    },

    async selectDensity(density) {
      if (this.loading || density === this.currentDensity) return;

      this.loading = true;
      this.error = null;

      try {
        const response = await fetch('/api/preferences/ui.density', {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: density
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update density: ${response.statusText}`);
        }

        this.currentDensity = density;

        if (this.autoApply) {
          this.applyDensityToUI();
        }

        this.$emit('density-changed', density);

        console.log(`Density changed to: ${density}`);

      } catch (err) {
        console.error('Failed to update density:', err);
        this.error = err.message;
      } finally {
        this.loading = false;
      }
    },

    async updateCustomSetting(setting, value) {
      try {
        const path = `accessibility.${setting}`;
        const response = await fetch(`/api/preferences/${path}`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            value: value
          })
        });

        if (!response.ok) {
          throw new Error(`Failed to update ${setting}`);
        }

        this.customSettings[setting] = value;
        this.applyCustomSettings();

        this.$emit('setting-changed', setting, value);

        console.log(`Custom setting ${setting} updated:`, value);

      } catch (error) {
        console.error(`Failed to update ${setting}:`, error);
        // Revert the change in UI
        this.customSettings[setting] = !value;
      }
    },

    applyDensityToUI() {
      const body = document.body;

      // Remove existing density classes
      body.classList.remove('density-compact', 'density-comfortable', 'density-spacious');

      // Add current density class
      body.classList.add(`density-${this.currentDensity}`);

      // Apply CSS custom properties for dynamic density
      const option = this.densityOptions.find(opt => opt.value === this.currentDensity);
      if (option) {
        const root = document.documentElement;
        root.style.setProperty('--density-spacing', option.settings.spacing);
        root.style.setProperty('--density-font-size', option.settings.fontSize);
        root.style.setProperty('--density-padding', option.settings.padding);
        root.style.setProperty('--density-item-height', option.settings.itemHeight);
        root.style.setProperty('--density-border-radius', option.settings.borderRadius);
      }
    },

    applyCustomSettings() {
      const body = document.body;
      const root = document.documentElement;

      // Apply reduced motion
      if (this.customSettings.reducedMotion) {
        body.classList.add('reduce-motion');
        root.style.setProperty('--animation-duration', '0.01ms');
      } else {
        body.classList.remove('reduce-motion');
        root.style.setProperty('--animation-duration', '0.2s');
      }

      // Apply large text
      if (this.customSettings.largeText) {
        body.classList.add('large-text');
        root.style.setProperty('--text-scale', '1.25');
      } else {
        body.classList.remove('large-text');
        root.style.setProperty('--text-scale', '1');
      }

      // Apply high contrast
      if (this.customSettings.highContrast) {
        body.classList.add('high-contrast');
      } else {
        body.classList.remove('high-contrast');
      }

      // Apply spacing multiplier
      root.style.setProperty('--spacing-multiplier', this.customSettings.spacingMultiplier);
    },

    resetToDefault() {
      this.selectDensity('comfortable');
      this.customSettings = {
        reducedMotion: false,
        largeText: false,
        highContrast: false,
        spacingMultiplier: 1.0
      };
      this.applyCustomSettings();
    }
  }
};
</script>