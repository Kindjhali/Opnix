<template>
  <div class="tab-content" :class="{ active }">
    <div class="controls">
      <button class="btn secondary" type="button" @click="triggerStart" :disabled="starting">
        {{ starting ? 'Starting…' : 'Start Storybook' }}
      </button>
      <button class="btn doc" type="button" @click="triggerRefresh">
        🔄 Refresh Frame
      </button>
      <span class="storybook-status" v-if="status">{{ status }}</span>
    </div>

    <div class="storybook-shell" v-if="active">
      <iframe
        class="storybook-frame"
        :key="frameKey"
        :src="iframeSrc"
        title="Storybook"
      ></iframe>
      <div class="storybook-indicator">
        Theme: {{ themeDisplay }}
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'StorybookFrame',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    theme: {
      type: String,
      default: 'mole'
    },
    status: {
      type: String,
      default: ''
    },
    frameVersion: {
      type: Number,
      default: 0
    },
    onStart: {
      type: Function,
      default: null
    },
    onRefresh: {
      type: Function,
      default: null
    }
  },
  data() {
    return {
      starting: false
    };
  },
  computed: {
    themeDisplay() {
      return this.theme.charAt(0).toUpperCase() + this.theme.slice(1);
    },
    iframeSrc() {
      const base = 'http://localhost:6006/';
      const themeParam = `globals=theme:${this.theme || 'mole'}`;
      return `${base}?${themeParam}`;
    },
    frameKey() {
      return `${this.theme}-${this.frameVersion}`;
    }
  },
  methods: {
    async triggerStart() {
      if (this.starting) return;
      this.starting = true;
      try {
        if (typeof this.onStart === 'function') {
          await this.onStart();
        }
      } finally {
        this.starting = false;
      }
    },
    triggerRefresh() {
      if (typeof this.onRefresh === 'function') {
        this.onRefresh({ reason: 'manual-refresh' });
      }
    }
  }
};
</script>
