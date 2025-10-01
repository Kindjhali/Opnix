import {
  fetchRoadmapStateFlow,
  fetchRoadmapVersionsFlow,
  setRoadmapViewModeFlow,
  generateRoadmapFlow,
  exportRoadmapFlow,
  rollbackRoadmapFlow,
  queueRoadmapRefreshFlow,
  downloadRoadmapSnapshotFlow,
  refreshRoadmapStateFlow,
  updateRoadmapMilestoneFlow
} from '../composables/roadmapManager.js';

function createRoadmapBloc() {
  return {
    setRoadmapViewMode(mode) {
      setRoadmapViewModeFlow.call(this, mode);
    },
    selectRoadmapVersion(version) {
      this.roadmapSelectedVersion = version || '';
    },
    async refreshRoadmapState(options = {}) {
      await refreshRoadmapStateFlow.call(this, options);
    },
    async fetchRoadmapState(options = {}) {
      await fetchRoadmapStateFlow.call(this, options);
    },
    async fetchRoadmapVersions(options = {}) {
      await fetchRoadmapVersionsFlow.call(this, options);
    },
    async generateRoadmapFromData() {
      await generateRoadmapFlow.call(this);
    },
    async exportRoadmapSnapshot() {
      await exportRoadmapFlow.call(this);
    },
    downloadRoadmapSnapshot() {
      downloadRoadmapSnapshotFlow.call(this);
    },
    async rollbackRoadmap(version) {
      const target = version || this.roadmapSelectedVersion;
      if (!target) {
        this.roadmapError = 'Select a version to rollback.';
        return;
      }
      await rollbackRoadmapFlow.call(this, target);
      this.roadmapSelectedVersion = '';
      await fetchRoadmapVersionsFlow.call(this, { background: true });
    },
    async updateRoadmapMilestone(payload = {}) {
      await updateRoadmapMilestoneFlow.call(this, payload);
    },
    queueRoadmapRefresh(options = {}) {
      queueRoadmapRefreshFlow.call(this, options);
    }
  };
}

export { createRoadmapBloc };
export default createRoadmapBloc;
