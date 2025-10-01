<template>
  <div class="tab-content" :class="{ active }">
    <div class="specs-layout">
      <section class="spec-builder">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1.5rem;">
          <h2 style="color: var(--text-bright); margin: 0;">Intelligent Spec Builder</h2>
          <button 
            class="btn secondary" 
            type="button" 
            :disabled="reloadingQuestions"
            title="Reload interview questions from disk"
            @click="reloadQuestions"
          >
            <span v-if="!reloadingQuestions">↻ Reload Questions</span>
            <span v-else>Reloading...</span>
          </button>
        </div>
        <div style="margin-bottom: 2rem;">
          <span style="color: var(--accent-cyan);">Phase: </span>
          <span style="color: var(--accent-orange); font-weight: bold;">{{ currentPhase }}</span>
        </div>

        <transition name="fade">
          <section v-if="hasQuestionDiff" class="question-diff-panel">
            <header class="question-diff-header">
              <h4>Latest question changes</h4>
              <div class="question-diff-summary">
                <span>Sections +{{ questionDiffSummary.sectionsAdded }} / ~{{ questionDiffSummary.sectionsUpdated }} / -{{ questionDiffSummary.sectionsRemoved }}</span>
                <span>Questions +{{ questionDiffSummary.questionsAdded }} / ~{{ questionDiffSummary.questionsUpdated }} / -{{ questionDiffSummary.questionsRemoved }}</span>
              </div>
            </header>
            <div class="question-diff-body">
              <div v-if="diffHighlights.sections.length" class="question-diff-group">
                <h5>Sections</h5>
                <ul>
                  <li v-for="section in diffHighlights.sections" :key="section.id">
                    <strong>{{ section.title || section.id }}</strong> — {{ section.type }}
                    <template v-if="section.changes">
                      <span class="question-diff-changes">
                        <span v-if="section.changes.added.length">+{{ section.changes.added.length }}</span>
                        <span v-if="section.changes.updated.length"> ~{{ section.changes.updated.length }}</span>
                        <span v-if="section.changes.removed.length"> -{{ section.changes.removed.length }}</span>
                      </span>
                    </template>
                  </li>
                </ul>
              </div>
              <div v-if="diffHighlights.questions.length" class="question-diff-group">
                <h5>Questions</h5>
                <ul>
                  <li v-for="question in diffHighlights.questions" :key="question.sectionId + '-' + question.id">
                    <strong>{{ question.id }}</strong> — {{ question.type }}
                    <template v-if="question.previousQuestion"> (updated)</template>
                  </li>
                </ul>
              </div>
            </div>
          </section>
        </transition>

        <article v-for="question in questions" :key="question.id" class="question-card">
          <header v-if="question.isSectionFirst" class="interview-section-header">
            <h3>{{ question.sectionTitle }}</h3>
            <p v-if="question.sectionDescription" class="interview-section-description">{{ question.sectionDescription }}</p>
          </header>
          <div class="question-label">{{ question.prompt }}</div>

          <input
            v-if="question.type === 'text'"
            v-model="question.answer"
            :placeholder="question.placeholder"
            @change="emitAnswer(question)"
          >
          <textarea
            v-else-if="question.type === 'textarea'"
            v-model="question.answer"
            rows="4"
            :placeholder="question.placeholder"
            @change="emitAnswer(question)"
          ></textarea>
          <select
            v-else-if="question.type === 'select'"
            v-model="question.answer"
            @change="emitAnswer(question)"
          >
            <option value="">Choose...</option>
            <option v-for="option in question.options || []" :key="option" :value="option">
              {{ option }}
            </option>
          </select>
          <div v-if="question.help" class="question-help">{{ question.help }}</div>
        </article>

        <div style="display: flex; gap: 1rem; flex-wrap: wrap; align-items: center; margin-top: 1rem;">
          <div style="display: flex; flex-direction: column; gap: 0.4rem;">
            <label style="font-size: 0.8rem; color: var(--text-muted);">Export Format</label>
            <select
              :value="exportFormat"
              style="min-width: 180px;"
              @change="onExportFormatChange($event.target.value)"
            >
              <option value="json">JSON</option>
              <option value="markdown">Markdown</option>
              <option value="github">GitHub Spec Kit</option>
            </select>
          </div>
          <button class="btn feature" type="button" @click="$emit('generate')">Generate &amp; Save Spec</button>
          <div v-if="latestSpecMeta" style="color: var(--accent-cyan); font-size: 0.85rem;">
            Saved as {{ latestSpecMeta.filename }}
          </div>
        </div>

        <div v-if="generatedSpec" style="margin-top: 2rem;">
          <h3 style="color: var(--text-bright); margin-bottom: 1rem;">Generated Spec:</h3>
          <pre class="api-spec">{{ generatedSpec }}</pre>
        </div>
      </section>

      <aside class="cli-sessions-panel">
        <header class="cli-sessions-header">
          <div>
            <h3 style="margin: 0; color: var(--accent-cyan);">CLI Sessions</h3>
            <p style="margin: 0; font-size: 0.85rem; color: var(--text-muted);">Terminal interviews mirrored in real time</p>
          </div>
          <button class="btn secondary" type="button" :disabled="cliSessionsLoading" @click="$emit('refresh-sessions')">
            {{ cliSessionsLoading ? 'Refreshing…' : 'Refresh' }}
          </button>
        </header>

        <p v-if="cliSessionsError" class="form-error">{{ cliSessionsError }}</p>
        <p v-else-if="!cliSessionsLoading && !cliSessions.length" style="color: var(--text-muted);">No CLI interviews recorded yet.</p>

        <div class="cli-sessions-list" v-if="cliSessions.length">
          <button
            v-for="session in cliSessions"
            :key="session.sessionId"
            type="button"
            class="cli-session-item"
            @click="$emit('view-session', session.sessionId)"
          >
            <div class="cli-session-meta">
              <strong>{{ session.command || ('/' + session.category) }}</strong>
              <span class="cli-session-status" :class="{ complete: session.completed }">
                {{ formatCliSessionStatus(session) }}
              </span>
            </div>
            <div class="cli-session-meta" style="font-size: 0.8rem; color: var(--text-muted);">
              <span>Updated {{ formatCliTimestamp(session.updatedAt || session.createdAt) }}</span>
            </div>
          </button>
        </div>

        <section v-if="selectedSessionId || sessionDetails" class="cli-session-detail">
          <header class="cli-session-detail-header">
            <div>
              <h4 style="margin: 0; color: var(--accent-cyan);">
                Session {{ (sessionDetails && sessionDetails.sessionId) || selectedSessionId }}
              </h4>
              <p style="margin: 0; font-size: 0.8rem; color: var(--text-muted);">
                {{ (sessionDetails && (sessionDetails.command || ('/' + sessionDetails.category))) || 'Loading…' }} ·
                {{ formatCliTimestamp(sessionDetails ? (sessionDetails.updatedAt || sessionDetails.createdAt) : null) }}
              </p>
            </div>
            <button class="btn secondary" type="button" @click="$emit('close-session')">Close</button>
          </header>

          <div v-if="sessionDetailsError" class="form-error">{{ sessionDetailsError }}</div>
          <div v-else-if="!sessionDetails" style="font-size: 0.85rem; color: var(--text-muted);">Loading session details…</div>
          <template v-else>
            <section class="cli-session-section">
              <h5 style="margin: 0 0 0.5rem; color: var(--text-bright);">Responses</h5>
              <div v-if="!sessionDetails.responses || !sessionDetails.responses.length" style="font-size: 0.85rem; color: var(--text-muted);">
                No responses recorded yet.
              </div>
              <div
                v-for="response in sessionDetails.responses || []"
                :key="response.questionId"
                class="cli-session-response"
              >
                <div style="font-weight: 600;">{{ findCliQuestionPrompt(sessionDetails, response.questionId) }}</div>
                <div style="white-space: pre-wrap;">{{ response.answer }}</div>
              </div>
            </section>

            <section class="cli-session-section" v-if="sessionDetails.artifacts && sessionDetails.artifacts.length">
              <h5 style="margin: 1rem 0 0.5rem 0; color: var(--accent-orange);">Artifacts</h5>
              <div
                v-for="artifact in sessionDetails.artifacts"
                :key="artifact.filename || artifact.path"
                class="cli-session-artifact"
              >
                <div>{{ artifact.filename || artifact.path }}</div>
                <code v-if="artifact.path">{{ artifact.path }}</code>
              </div>
            </section>
          </template>
        </section>

        <section class="cli-gate-log" v-if="cliGateLog.length">
          <h4>Recent Alignment Gates</h4>
          <ul class="gate-list">
            <li v-for="gate in cliGateLog" :key="gate.timestamp">
              <div class="gate-meta">{{ gate.command }} · {{ formatGateTimestamp(gate.timestamp) }}</div>
              <div class="gate-diagnostics">
                DAIC: {{ gate.diagnostics?.daicState || 'unknown' }} ·
                Context: {{ formatGateContext(gate) }} ·
                Mode: {{ gate.diagnostics?.ultraThinkMode || 'default' }}
              </div>
            </li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
</template>

<script>
export default {
  name: 'SpecsTab',
  props: {
    active: { type: Boolean, default: false },
    currentPhase: { type: String, default: 'Interview' },
    questions: { type: Array, default: () => [] },
    exportFormat: { type: String, default: 'json' },
    generatedSpec: { type: String, default: '' },
    latestSpecMeta: { type: Object, default: null },
    cliSessions: { type: Array, default: () => [] },
    cliSessionsLoading: { type: Boolean, default: false },
    cliSessionsError: { type: String, default: '' },
    selectedSessionId: { type: String, default: null },
    sessionDetails: { type: Object, default: null },
    sessionDetailsError: { type: String, default: '' },
    cliGateLog: { type: Array, default: () => [] },
    findCliQuestionPrompt: { type: Function, required: true },
    formatCliTimestamp: { type: Function, required: true },
    formatCliSessionStatus: { type: Function, required: true },
    formatGateTimestamp: { type: Function, required: true },
    formatGateContext: { type: Function, required: true }
  },
  emits: ['generate', 'refresh-sessions', 'view-session', 'close-session', 'answer', 'update:export-format', 'reload-questions'],
  data() {
    return {
      reloadingQuestions: false,
      questionDiff: null
    };
  },
  computed: {
    hasQuestionDiff() {
      return !!(this.questionDiff && (
        (this.questionDiff.sections && this.questionDiff.sections.length) ||
        (this.questionDiff.questions && this.questionDiff.questions.length)
      ));
    },
    questionDiffSummary() {
      if (!this.questionDiff) {
        return null;
      }
      const sections = this.questionDiff.sections || [];
      const questions = this.questionDiff.questions || [];
      return {
        sectionsAdded: sections.filter(change => change.type === 'added').length,
        sectionsRemoved: sections.filter(change => change.type === 'removed').length,
        sectionsUpdated: sections.filter(change => change.type === 'updated').length,
        questionsAdded: questions.filter(change => change.type === 'added').length,
        questionsRemoved: questions.filter(change => change.type === 'removed').length,
        questionsUpdated: questions.filter(change => change.type === 'updated').length
      };
    },
    diffHighlights() {
      if (!this.questionDiff) {
        return { sections: [], questions: [] };
      }
      const sections = this.questionDiff.sections || [];
      const questions = this.questionDiff.questions || [];
      return {
        sections: sections.slice(0, 3),
        questions: questions.slice(0, 5)
      };
    }
  },
  methods: {
    emitAnswer(question) {
      this.$emit('answer', question);
    },
    onExportFormatChange(value) {
      this.$emit('update:export-format', value);
    },
    async reloadQuestions() {
      const showFallbackAlert = message => {
        if (typeof window !== 'undefined' && typeof window.alert === 'function') {
          window.alert(message);
        } else {
          console.warn(message);
        }
      };

      this.reloadingQuestions = true;
      this.questionDiff = null;
      try {
        const fetchImpl = typeof globalThis.fetch === 'function' ? globalThis.fetch.bind(globalThis) : null;
        if (!fetchImpl) {
          throw new Error('Fetch API is unavailable in this environment');
        }

        const response = await fetchImpl('/api/interviews/reload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' }
        });

        const data = await response.json();

        if (response.ok && data.success) {
          const diff = data.diff || { sections: [], questions: [] };
          this.questionDiff = diff;
          this.$emit('reload-questions', data);

          if (this.$toast) {
            const sectionChanges = diff.sections ? diff.sections.length : 0;
            const questionChanges = diff.questions ? diff.questions.length : 0;
            const summaryMessage = sectionChanges || questionChanges
              ? `Δ Sections: ${sectionChanges}, Questions: ${questionChanges}`
              : 'No structural changes detected';
            this.$toast.success(`Reloaded ${data.questionsReloaded} questions — ${summaryMessage}`);
          } else {
            console.log(`✅ Questions reloaded: ${data.questionsReloaded} questions (v${data.newVersion})`, diff);
          }
        } else {
          throw new Error(data.error || 'Failed to reload questions');
        }
      } catch (error) {
        console.error('Failed to reload questions:', error);

        if (this.$toast) {
          this.$toast.error(`Failed to reload: ${error.message}`);
        } else {
          showFallbackAlert(`Failed to reload questions: ${error.message}`);
        }
      } finally {
        this.reloadingQuestions = false;
      }
    }
  }
};
</script>
