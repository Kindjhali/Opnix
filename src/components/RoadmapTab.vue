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

