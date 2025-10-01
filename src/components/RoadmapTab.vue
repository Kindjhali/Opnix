<template>
  <div class="tab-content roadmap-tab" :class="{ active }">
    <header class="roadmap-toolbar">
      <div class="roadmap-actions">
        <button class="btn" type="button" :disabled="loading || updating" @click="handleRefresh">🔄 Refresh</button>
        <button class="btn feature" type="button" :disabled="loading || updating" @click="handleGenerate">⚙️ Generate</button>
        <button class="btn doc" type="button" :disabled="loading || updating" @click="handleExport">📦 Export JSON</button>
        <button class="btn secondary" type="button" @click="handleDownload">⬇️ Download Snapshot</button>
      </div>
      <RoadmapViewToggle
        :view="viewMode"
        :disabled="loading || updating"
        @change="setView"
      />
    </header>

    <section class="roadmap-meta">
      <div class="roadmap-version-picker">
        <label for="roadmap-version-select">Version history</label>
        <select
          id="roadmap-version-select"
          :disabled="versionsLoading || loading || updating"
          :value="selectedVersion"
          @change="onSelectVersion($event.target.value || '')"
        >
          <option value="">Current state</option>
          <option
            v-for="version in versions"
            :key="version.filename"
            :value="version.filename"
          >
            {{ formatVersionLabel(version) }}
          </option>
        </select>
        <button class="btn secondary" type="button" :disabled="!selectedVersion || loading || updating" @click="handleRollback">
          ↩️ Rollback
        </button>
      </div>
      <div class="roadmap-updated" v-if="lastUpdated">
        <span>Last updated:</span>
        <strong>{{ lastUpdated }}</strong>
      </div>
    </section>

    <p v-if="error" class="inline-error">⚠️ {{ error }}</p>
    <p v-if="!error && updateMessage" class="inline-success">✔️ {{ updateMessage }}<span v-if="updateTimestamp" class="success-timestamp"> ({{ updateTimestamp }})</span></p>
    <p v-if="loading" class="loading-message">Loading roadmap…</p>

    <div v-if="hasSummary" class="roadmap-stats">
      <div class="roadmap-stat">
        <div class="roadmap-stat-label">Tickets</div>
        <div class="roadmap-stat-value">{{ summary.ticketCount }}</div>
      </div>
      <div class="roadmap-stat">
        <div class="roadmap-stat-label">Modules</div>
        <div class="roadmap-stat-value">{{ summary.moduleCount }}</div>
      </div>
      <div class="roadmap-stat">
        <div class="roadmap-stat-label">Features</div>
        <div class="roadmap-stat-value">{{ summary.featureCount }}</div>
      </div>
      <div class="roadmap-stat">
        <div class="roadmap-stat-label">Source</div>
        <div class="roadmap-stat-value">{{ summary.source }}</div>
      </div>
    </div>

    <section class="roadmap-container" v-if="hasMilestones">
      <div v-if="viewMode === 'minimal'" class="roadmap-minimal">
        <h3>Upcoming milestones</h3>
        <ul class="minimal-milestone-grid">
          <li
            v-for="card in minimalCards"
            :key="card.id"
            class="minimal-milestone-card"
            :class="card.status ? `status-${card.status}` : ''"
            :style="{ '--progress': card.progress + '%' }"
            :title="card.fullTitle"
          >
            <header class="minimal-card-header">
              <h4>{{ card.title }}</h4>
              <span v-if="card.status" :class="['status-pill', `status-pill-${card.status}`]">{{ formatStatus(card.status) }}</span>
            </header>
            <div class="minimal-card-progress">
              <span class="minimal-card-progress-bar"></span>
              <span class="minimal-card-progress-value">{{ card.progress }}%</span>
            </div>
            <dl class="minimal-card-meta">
              <div v-if="card.start" class="meta-item">
                <dt>Start</dt>
                <dd>{{ card.start }}</dd>
              </div>
              <div v-if="card.end" class="meta-item">
                <dt>Target</dt>
                <dd>{{ card.end }}</dd>
              </div>
              <div v-if="card.linkedPreview.length" class="meta-item meta-linked">
                <dt>Linked</dt>
                <dd>
                  <span v-for="item in card.linkedPreview" :key="item">{{ item }}</span>
                  <span v-if="card.totalLinked > card.linkedPreview.length" class="meta-more">+{{ card.totalLinked - card.linkedPreview.length }}&nbsp;more</span>
                </dd>
              </div>
            </dl>
          </li>
        </ul>
        <button
          v-if="milestones.length > minimalCards.length"
          class="btn ghost"
          type="button"
          @click="setView('detailed')"
        >View full timeline →</button>
      </div>

      <RoadmapDetailedView
        v-else
        :milestones="enhancedMilestones"
        :disabled="loading || updating"
        @update-milestone="handleMilestoneUpdate"
      />
    </section>

    <section class="roadmap-history" v-if="history.length">
      <h3>Recent updates</h3>
      <ul>
        <li v-for="entry in history" :key="entry.timestamp">
          <span class="history-date">{{ entry.timestamp }}</span>
          <span class="history-reason">{{ entry.reason }}</span>
          <span class="history-count">Tickets {{ entry.ticketCount }} • Modules {{ entry.moduleCount }} • Features {{ entry.featureCount }}</span>
        </li>
      </ul>
    </section>

    <p v-if="!loading && !hasMilestones" class="empty-state">No roadmap data yet. Generate a roadmap to get started.</p>
  </div>
</template>

<script>
import RoadmapViewToggle from './RoadmapViewToggle.vue';
import RoadmapDetailedView from './RoadmapDetailedView.vue';
export default {
  name: 'RoadmapTab',
  components: {
    RoadmapViewToggle,
    RoadmapDetailedView
  },
  props: {
    active: {
      type: Boolean,
      default: false
    },
    state: {
      type: Object,
      default: () => ({})
    },
    versions: {
      type: Array,
      default: () => []
    },
    loading: {
      type: Boolean,
      default: false
    },
    updating: {
      type: Boolean,
      default: false
    },
    versionsLoading: {
      type: Boolean,
      default: false
    },
    error: {
      type: String,
      default: ''
    },
    updateMessage: {
      type: String,
      default: ''
    },
    updateTimestamp: {
      type: String,
      default: ''
    },
    viewMode: {
      type: String,
      default: 'minimal'
    },
    selectedVersion: {
      type: String,
      default: ''
    },
    onRefresh: {
      type: Function,
      default: () => {}
    },
    onGenerate: {
      type: Function,
      default: () => {}
    },
    onExport: {
      type: Function,
      default: () => {}
    },
    onDownload: {
      type: Function,
      default: () => {}
    },
    onRollback: {
      type: Function,
      default: () => {}
    },
    onSelectVersion: {
      type: Function,
      default: () => {}
    },
    onViewMode: {
      type: Function,
      default: () => {}
    },
    onFetchVersions: {
      type: Function,
      default: () => {}
    },
    onUpdateMilestone: {
      type: Function,
      default: () => {}
    }
  },
  computed: {
    summary() {
      return this.state?.summary || {};
    },
    history() {
      return Array.isArray(this.state?.history) ? this.state.history : [];
    },
    milestones() {
      return Array.isArray(this.state?.milestones) ? this.state.milestones : [];
    },
    hasMilestones() {
      return this.milestones.length > 0;
    },
    hasSummary() {
      return !!(this.summary && (this.summary.ticketCount || this.summary.moduleCount || this.summary.featureCount));
    },
    minimalCards() {
      const limit = Math.max(4, Math.min(this.milestones.length, 6));
      return this.milestones.slice(0, limit).map(milestone => {
        const title = milestone.name || milestone.title || 'Untitled milestone';
        const truncatedTitle = title.length > 50 ? `${title.slice(0, 47)}…` : title;
        const progressValue = Number(milestone.progress);
        const progress = Number.isFinite(progressValue) ? Math.max(0, Math.min(100, progressValue)) : 0;
        const status = (milestone.status || '').toLowerCase();
        const start = milestone.start || milestone.startDate || milestone.startedAt || '';
        const end = milestone.end || milestone.targetDate || milestone.dueDate || '';
        const linkedTickets = Array.isArray(milestone.linkedTickets) ? milestone.linkedTickets : [];
        const linkedFeatures = Array.isArray(milestone.linkedFeatures) ? milestone.linkedFeatures : [];
        const linkedModules = Array.isArray(milestone.linkedModules) ? milestone.linkedModules : [];
        const linkedPreview = [];
        linkedTickets.slice(0, 3).forEach(id => linkedPreview.push(`Ticket #${id}`));
        if (linkedPreview.length < 3) {
          linkedFeatures.slice(0, 3 - linkedPreview.length).forEach(id => linkedPreview.push(`Feature #${id}`));
        }
        if (linkedPreview.length < 3) {
          linkedModules.slice(0, 3 - linkedPreview.length).forEach(id => linkedPreview.push(`Module ${id}`));
        }
        const totalLinked = linkedTickets.length + linkedFeatures.length + linkedModules.length;
        return {
          id: milestone.id ?? truncatedTitle,
          title: truncatedTitle,
          fullTitle: title,
          status,
          progress,
          start,
          end,
          linkedPreview,
          totalLinked,
          milestone
        };
      });
    },
    enhancedMilestones() {
      return this.milestones.map(milestone => {
        const title = milestone.name || milestone.title || 'Untitled milestone';
        const progressValue = Number(milestone.progress);
        return {
          ...milestone,
          name: title,
          title,
          status: (milestone.status || '').toLowerCase(),
          progress: Number.isFinite(progressValue) ? Math.max(0, Math.min(100, Math.round(progressValue))) : 0,
          notes: milestone.notes || milestone.description || '',
          linkedTickets: Array.isArray(milestone.linkedTickets) ? milestone.linkedTickets : [],
          linkedFeatures: Array.isArray(milestone.linkedFeatures) ? milestone.linkedFeatures : [],
          linkedModules: Array.isArray(milestone.linkedModules) ? milestone.linkedModules : [],
          dependencies: Array.isArray(milestone.dependencies) ? milestone.dependencies : []
        };
      });
    },
    lastUpdated() {
      return this.state?.lastUpdated || this.summary?.generatedAt || '';
    }
  },
  watch: {
    active(value) {
      if (value) {
        this.ensureData();
      }
    }
  },
  mounted() {
    if (this.active) {
      this.ensureData();
    }
  },
  methods: {
    ensureData() {
      if (!this.versions.length && !this.versionsLoading) {
        this.onFetchVersions({ background: true });
      }
      if (!this.milestones.length && !this.loading) {
        this.handleRefresh();
      }
    },
    handleRefresh() {
      this.onRefresh({ background: false });
    },
    handleGenerate() {
      this.onGenerate();
    },
    handleExport() {
      this.onExport();
    },
    handleDownload() {
      this.onDownload();
    },
    handleRollback() {
      this.onRollback(this.selectedVersion);
    },
    setView(mode) {
      if (mode !== this.viewMode) {
        this.onViewMode(mode);
      }
    },
    formatStatus(status) {
      if (!status) return '';
      return status
        .split(/[\s_-]+/)
        .filter(Boolean)
        .map(chunk => chunk.charAt(0).toUpperCase() + chunk.slice(1))
        .join(' ');
    },
    formatVersionLabel(version) {
      const created = version.createdAt ? new Date(version.createdAt).toLocaleString() : version.filename;
      return `${created} (${Math.round((version.size || 0) / 1024)} KB)`;
    },
    handleMilestoneUpdate(payload) {
      if (!payload || !payload.id) return;
      if (this.loading || this.updating) return;
      const request = { ...payload, actor: 'ui:roadmap-tab' };
      this.onUpdateMilestone(request);
    }
  }
};
</script>

<style scoped>
.roadmap-toolbar {
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  margin-bottom: 1.5rem;
}

.roadmap-actions {
  display: flex;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.roadmap-view-toggle .view-btn {
  min-width: 96px;
}

.roadmap-view-toggle .view-btn.active {
  border-color: var(--accent-1);
  color: var(--accent-1);
}

.roadmap-version-picker {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex-wrap: wrap;
}

.roadmap-version-picker select {
  min-width: 220px;
}

.inline-error {
  color: var(--danger);
  margin-bottom: 1rem;
}

.inline-success {
  color: var(--accent-1);
  margin-bottom: 1rem;
}

.inline-success .success-timestamp {
  font-size: 0.85em;
  color: var(--text-muted);
}

.loading-message {
  color: var(--text-muted);
}

.empty-state {
  margin-top: 2rem;
  color: var(--text-muted);
  text-align: center;
}

.roadmap-history {
  margin-top: 2rem;
}

.roadmap-history ul {
  list-style: none;
  padding: 0;
  margin: 0;
  display: grid;
  gap: 0.75rem;
}

.roadmap-history li {
  display: flex;
  flex-wrap: wrap;
  gap: 0.75rem;
  align-items: baseline;
}

.history-date {
  font-weight: 600;
  color: var(--accent-2);
}

.history-reason {
  color: var(--text-primary);
}

.history-count {
  color: var(--text-muted);
}


.roadmap-view-toggle {
  display: inline-flex;
  align-items: center;
}

.minimal-milestone-grid {
  list-style: none;
  padding: 0;
  margin: 0 0 1.25rem 0;
  display: grid;
  gap: 1rem;
  grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
}

.minimal-milestone-card {
  position: relative;
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
  padding: 1rem 1.15rem;
  border-radius: 10px;
  border: 1px solid var(--border);
  background: var(--surface-primary);
  transition: background-color 0.3s ease, border-color 0.3s ease, box-shadow 0.3s ease, transform 0.2s ease;
}

.minimal-milestone-card:hover {
  border-color: var(--accent-1);
  box-shadow: var(--shadow-medium);
  transform: translateY(-2px);
}

.minimal-card-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: 0.75rem;
}

.minimal-card-header h4 {
  margin: 0;
  font-size: 1rem;
  color: var(--text-bright);
}

.status-pill {
  padding: 0.15rem 0.55rem;
  border-radius: 999px;
  font-size: 0.7rem;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  background: var(--glass-overlay-strong);
  border: 1px solid transparent;
  color: var(--accent-1);
  transition: background-color 0.3s ease, border-color 0.3s ease, color 0.3s ease;
}

.status-pill.status-pill-pending {
  background: var(--status-gradient-pending, var(--glass-overlay-strong));
  border-color: var(--status-border-muted);
  color: var(--text-light);
}

.status-pill.status-pill-active {
  background: var(--status-gradient-active, var(--glass-overlay-strong));
  border-color: var(--status-active, var(--accent-2));
  color: var(--text-on-accent);
}

.status-pill.status-pill-completed {
  background: var(--status-gradient-completed, var(--glass-overlay-strong));
  border-color: var(--status-completed, var(--success));
  color: var(--text-on-accent);
}

.status-pill.status-pill-blocked,
.status-pill.status-pill-paused {
  background: var(--status-gradient-blocked, var(--glass-overlay-strong));
  border-color: var(--status-blocked, var(--danger));
  color: var(--text-on-accent);
}

.minimal-card-progress {
  position: relative;
  height: 0.45rem;
  border-radius: 999px;
  background: var(--glass-overlay-soft);
  overflow: hidden;
  transition: background-color 0.3s ease;
}

.minimal-card-progress-bar {
  position: absolute;
  inset: 0;
  width: var(--progress, 0%);
  border-radius: inherit;
  background: linear-gradient(90deg, var(--accent-1), var(--accent-2));
  transition: background 0.3s ease;
}

.minimal-card-progress-value {
  position: absolute;
  top: 50%;
  right: 0.5rem;
  transform: translateY(-50%);
  font-size: 0.7rem;
  color: var(--text-on-accent);
  font-weight: 600;
  transition: color 0.3s ease;
}

.minimal-card-meta {
  display: grid;
  gap: 0.5rem;
  margin: 0;
}

.meta-item {
  display: grid;
  gap: 0.15rem;
}

.meta-item dt {
  font-size: 0.68rem;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-muted);
}

.meta-item dd {
  margin: 0;
  font-size: 0.9rem;
  color: var(--text-primary);
}

.meta-linked dd {
  display: flex;
  flex-wrap: wrap;
  gap: 0.3rem;
}

.meta-linked dd span {
  display: inline-flex;
  align-items: center;
  padding: 0.15rem 0.45rem;
  border-radius: 999px;
  background: var(--glass-overlay-strong);
  font-size: 0.75rem;
  transition: background-color 0.3s ease, color 0.3s ease;
}

.meta-more {
  color: var(--accent-1);
}

.minimal-milestone-card.status-pending { border-color: var(--status-border-muted); }
.minimal-milestone-card.status-active { border-color: var(--status-active, var(--accent-2)); }
.minimal-milestone-card.status-completed { border-color: var(--status-completed, var(--success)); }
.minimal-milestone-card.status-blocked { border-color: var(--status-blocked, var(--danger)); }

</style>
