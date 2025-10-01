function createRoadmapSupportBloc() {
  return {
    queueRoadmapRefresh({ delay = 500 } = {}) {
      if (this.roadmapRefreshHandle) {
        clearTimeout(this.roadmapRefreshHandle);
        this.roadmapRefreshHandle = null;
      }
      this.roadmapRefreshHandle = setTimeout(() => {
        if (typeof this.refreshRoadmapState === 'function') {
          this.refreshRoadmapState({ background: true });
        }
        this.roadmapRefreshHandle = null;
      }, delay);
    }
  };
}

export { createRoadmapSupportBloc };
export default createRoadmapSupportBloc;
