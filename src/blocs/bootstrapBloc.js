function createBootstrapBloc() {
  return {
    async bootstrap() {
      await this.loadInterviewBlueprint();
      this.initializeInterview();
      await Promise.all([
        this.fetchAgents(),
        this.fetchTickets(),
        this.fetchFeatures(),
        this.fetchModulesGraph(),
        this.fetchExports(),
        this.fetchStats(),
        this.fetchTechStackSummary({ background: true, force: true }),
        this.refreshRoadmapState({ background: true }),
        this.loadTerminalHistory(),
        this.refreshBranchStatus(),
        this.refreshContextStatus()
      ]);
      await this.fetchCliSessions();
      if (this.activeTab === 'canvas' && typeof this.ensureCanvas === 'function') {
        this.$nextTick(() => this.ensureCanvas());
      }
    }
  };
}

export { createBootstrapBloc };
export default createBootstrapBloc;
