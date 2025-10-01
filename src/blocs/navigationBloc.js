function createNavigationBloc() {
  return {
    setTab(tab) {
      this.activeTab = tab;

      if (tab === 'canvas' && typeof this.ensureCanvas === 'function') {
        this.$nextTick(() => this.ensureCanvas());
      }

      if (tab === 'specs' && typeof this.fetchCliSessions === 'function') {
        this.fetchCliSessions();
      }

      if (tab === 'diagrams') {
        if (!this.mermaidCode && typeof this.generateDiagram === 'function') {
          this.generateDiagram('architecture');
        } else if (typeof this.renderMermaid === 'function') {
          this.$nextTick(() => this.renderMermaid());
        }
      }

      if (tab === 'storybook' && typeof this.refreshStorybookFrame === 'function') {
        this.refreshStorybookFrame({ reason: 'tab-activate' });
      }

      if (tab === 'roadmap' && typeof this.refreshRoadmapState === 'function') {
        this.refreshRoadmapState();
      }

      if (tab === 'stack' && typeof this.refreshTechStackSummary === 'function') {
        this.refreshTechStackSummary();
      }
    }
  };
}

export { createNavigationBloc };
export default createNavigationBloc;
