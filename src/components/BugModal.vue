<template>
  <div class="modal" :class="{ active }">
    <div class="modal-content" style="position: relative;">
      <button class="close-modal" type="button" @click="$emit('close')">×</button>
      <h2 style="color: var(--danger); margin-bottom: 1rem;">Report New Bug</h2>

      <div class="form-group">
        <label>Title</label>
        <input
          :value="bug.title"
          type="text"
          placeholder="Bug title..."
          @input="update('title', $event.target.value)"
        >
      </div>

      <div class="form-group">
        <label>Description</label>
        <textarea
          :value="bug.description"
          rows="4"
          placeholder="Describe the bug..."
          @input="update('description', $event.target.value)"
        ></textarea>
      </div>

      <div class="form-group">
        <label>Priority</label>
        <select :value="bug.priority" @change="update('priority', $event.target.value)">
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </div>

      <div class="form-group">
        <label>Modules (select multiple)</label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem;">
          <label
            v-for="module in modules"
            :key="module.id"
            style="display: flex; align-items: center;"
          >
            <input
              type="checkbox"
              :value="module.id"
              :checked="bug.modules.includes(module.id)"
              style="margin-right: 0.5rem; width: auto;"
              @change="toggleModule(module.id, $event.target.checked)"
            >
            {{ module.name }}
          </label>
        </div>
      </div>

      <div class="form-group">
        <label>Tags (comma separated)</label>
        <input
          :value="bug.tagsText"
          type="text"
          placeholder="BUG, AUTH, BACKEND"
          @input="update('tagsText', $event.target.value)"
        >
      </div>

      <button class="btn danger" type="button" @click="$emit('submit')">Submit Bug</button>
    </div>
  </div>
</template>

<script>
export default {
  name: 'BugModal',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    bug: {
      type: Object,
      default: () => ({ title: '', description: '', priority: 'medium', modules: [], tagsText: '' })
    },
    modules: {
      type: Array,
      default: () => []
    }
  },
  emits: ['close', 'submit', 'update:bug'],
  methods: {
    update(key, value) {
      const next = { ...this.bug, [key]: value };
      this.$emit('update:bug', next);
    },
    toggleModule(moduleId, checked) {
      const set = new Set(this.bug.modules || []);
      if (checked) {
        set.add(moduleId);
      } else {
        set.delete(moduleId);
      }
      this.update('modules', Array.from(set));
    }
  }
};
</script>
