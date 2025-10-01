<template>
  <div class="modal" :class="{ active }">
    <div class="modal-content" style="position: relative;">
      <button class="close-modal" type="button" @click="$emit('close')">×</button>
      <h2 style="color: var(--accent-orange); margin-bottom: 1rem;">Add New Module</h2>

      <div class="form-group">
        <label>Module Name</label>
        <input :value="moduleDraft.name" placeholder="Authentication" @input="update('name', $event.target.value)">
      </div>

      <div class="form-group">
        <label>Module ID</label>
        <input :value="moduleDraft.id" placeholder="auth" @input="update('id', $event.target.value)">
      </div>

      <div class="form-group">
        <label>Relative Path</label>
        <input :value="moduleDraft.path" placeholder="src/auth" @input="update('path', $event.target.value)">
      </div>

      <div class="form-group">
        <label>Dependencies (comma-separated)</label>
        <input :value="moduleDraft.depsString" placeholder="database, crypto, utils" @input="update('depsString', $event.target.value)">
      </div>

      <div class="form-group">
        <label>Module Type</label>
        <select :value="moduleDraft.type" @change="update('type', $event.target.value)">
          <option value="custom">Custom</option>
          <option value="frontend">Frontend</option>
          <option value="backend">Backend</option>
          <option value="service">Service</option>
          <option value="documentation">Documentation</option>
        </select>
      </div>

      <button class="btn" type="button" @click="$emit('submit')">Add Module</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'AddModuleModal',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    moduleDraft: {
      type: Object,
      default: () => ({ name: '', id: '', path: '', depsString: '', type: 'custom' })
    }
  },
  emits: ['close', 'submit', 'update:moduleDraft'],
  methods: {
    update(key, value) {
      const next = { ...this.moduleDraft, [key]: value };
      this.$emit('update:moduleDraft', next);
    }
  }
};
</script>
