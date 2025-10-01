<template>
  <div class="modal" :class="{ active }">
    <div class="modal-content runbook-modal">
      <button class="close-modal" type="button" @click="$emit('close')">×</button>
      <h2 class="runbook-modal-title">Operational Runbook Interview</h2>
      <p class="runbook-modal-lead">
        Answer the targeted operational questions or skip directly to generation. Responses feed the shared runbook generator.
      </p>
      <div v-if="interviewError" class="form-error">{{ interviewError }}</div>
      <div v-if="generating" class="form-success">Generating runbook artefact...</div>
      <div v-if="loading" class="runbook-loading">Loading runbook question bank…</div>
      <div v-else>
        <div v-if="history && history.length" class="runbook-history">
          <h4>Answered</h4>
          <ul>
            <li v-for="(entry, index) in history" :key="'rb-history-' + index">
              <strong>{{ entry.prompt || entry.questionId }}</strong>
              <span>{{ entry.answer }}</span>
            </li>
          </ul>
        </div>
        <div v-if="currentQuestion" class="runbook-question">
          <h3>{{ currentQuestion.prompt }}</h3>
          <p class="question-help" v-if="currentQuestion.help">{{ currentQuestion.help }}</p>
          <input
            v-if="currentQuestion.type === 'text'"
            :value="draftAnswer"
            :placeholder="currentQuestion.placeholder"
            @input="onAnswerInput($event.target.value)"
            @keyup.enter.prevent="submit"
          >
          <textarea
            v-else-if="currentQuestion.type === 'textarea'"
            :value="draftAnswer"
            :placeholder="currentQuestion.placeholder"
            rows="5"
            @input="onAnswerInput($event.target.value)"
          ></textarea>
          <select
            v-else-if="currentQuestion.type === 'select'"
            :value="draftAnswer"
            @change="onAnswerInput($event.target.value)"
          >
            <option value="">Choose...</option>
            <option
              v-for="opt in currentQuestion.options || []"
              :key="opt"
              :value="opt"
            >
              {{ opt }}
            </option>
          </select>
          <input
            v-else
            :value="draftAnswer"
            :placeholder="currentQuestion.placeholder"
            @input="onAnswerInput($event.target.value)"
          >
          <div class="modal-actions">
            <button class="btn" type="button" :disabled="submitting" @click="submit">
              {{ submitting ? 'Submitting…' : 'Submit Answer' }}
            </button>
            <button class="btn secondary" type="button" :disabled="skipDisabled" @click="$emit('skip')">
              Skip &amp; Generate
            </button>
          </div>
        </div>
        <div v-else-if="generating" class="runbook-generating">
          Generating runbook from collected data…
        </div>
        <div v-else-if="latestRunbook" class="runbook-latest">
          Latest runbook saved as {{ latestRunbook.filename }}.
        </div>
      </div>
    </div>
  </div>
</template>

<script>
export default {
  name: 'RunbookModal',
  props: {
    active: {
      type: Boolean,
      default: false
    },
    interviewError: {
      type: String,
      default: ''
    },
    generating: {
      type: Boolean,
      default: false
    },
    loading: {
      type: Boolean,
      default: false
    },
    submitting: {
      type: Boolean,
      default: false
    },
    history: {
      type: Array,
      default: () => []
    },
    currentQuestion: {
      type: Object,
      default: null
    },
    draftAnswer: {
      type: String,
      default: ''
    },
    latestRunbook: {
      type: Object,
      default: null
    },
    skipDisabled: {
      type: Boolean,
      default: false
    }
  },
  emits: ['close', 'update:draftAnswer', 'submit', 'skip'],
  methods: {
    onAnswerInput(value) {
      this.$emit('update:draftAnswer', value);
    },
    submit() {
      this.$emit('submit');
    }
  }
};
</script>
