<template>
  <div class="modal" :class="{ active }">
    <div class="modal-content">
      <button class="close-modal" type="button" @click="$emit('cancel')">×</button>
      <h2 class="ticket-completion-title">Wrap Up Ticket</h2>
      <p class="ticket-completion-lead">
        Provide a concise summary of what changed, how it was validated, and any follow-up actions before closing this ticket.
      </p>
      <div class="form-group">
        <label>Summary of Work Completed</label>
        <textarea
          :value="summary"
          rows="5"
          placeholder="Describe the fix, validation steps, and remaining follow-ups..."
          @input="$emit('update:summary', $event.target.value)"
        ></textarea>
      </div>
      <p v-if="error" class="form-error">{{ error }}</p>
      <div class="modal-actions">
        <button class="btn secondary" type="button" @click="$emit('cancel')">Cancel</button>
        <button class="btn success" type="button" @click="$emit('confirm')">Mark as Finished</button>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'TicketCompletionModal',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    summary: {
      type: String,
      default: ''
    },
    error: {
      type: String,
      default: ''
    }
  },
  emits: ['cancel', 'confirm', 'update:summary']
};
</script>
