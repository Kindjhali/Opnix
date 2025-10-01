<template>
  <div class="modal" :class="{ active }">
    <div class="modal-content" style="position: relative;">
      <button class="close-modal" type="button" @click="$emit('close')">×</button>
      <h2 style="color: var(--feature); margin-bottom: 1rem;">Propose New Feature</h2>

      <div class="form-group">
        <label>Title</label>
        <input
          :value="feature.title"
          type="text"
          placeholder="Feature title..."
          @input="update('title', $event.target.value)"
        >
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea
          :value="feature.description"
          rows="4"
          placeholder="Describe the feature..."
          @input="update('description', $event.target.value)"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Module</label>
        <select :value="feature.moduleId" @change="update('moduleId', $event.target.value)">
          <option v-for="module in modules" :key="module.id" :value="module.id">
            {{ module.name }}
          </option>
        </select>
      </div>

      <div class="form-group">
        <label>Priority</label>
        <select :value="feature.priority" @change="update('priority', $event.target.value)">
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div class="form-group">
        <label>Acceptance Criteria (one per line)</label>
        <textarea
          :value="feature.criteriaText"
          rows="4"
          placeholder="- User can do X&#10;- System validates Y&#10;- Data is saved to Z"
          @input="update('criteriaText', $event.target.value)"
        ></textarea>
      </div>

      <button class="btn feature" type="button" @click="$emit('submit')">Submit Feature</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'FeatureModal',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    feature: {
      type: Object,
      default: () => ({ title: '', description: '', moduleId: '', priority: 'medium', criteriaText: '' })
    },
    modules: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'submit', 'update:feature'],
  methods: {
    update(key, value) {
      const next = { ...this.feature, [key]: value };
      this.$emit('update:feature', next);
    }
  }
};
</script>
