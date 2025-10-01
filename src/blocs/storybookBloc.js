import { startStorybook as startStorybookApi } from '../services/apiClient.js';

function createStorybookBloc() {
  return {
    async startStorybookInstance() {
      try {
        this.storybookStatus = 'Starting Storybook...';
        const response = await startStorybookApi();
        const message = response?.message || 'Storybook start requested';
        this.storybookStatus = message;
        this.addTask('Storybook', message, 'complete');
        this.refreshStorybookFrame({ reason: 'start-storybook' });
      } catch (error) {
        console.error('Storybook start failed', error);
        const message = error?.message || 'Failed to start Storybook';
        this.storybookStatus = message;
        this.addTask('Storybook', message, 'complete');
      }
    },
    refreshStorybookFrame({ reason } = {}) {
      this.storybookFrameVersion += 1;
      if (reason === 'theme-change') {
        this.storybookStatus = `Theme synced at ${new Date().toLocaleTimeString()}`;
      } else if (reason === 'manual-refresh') {
        this.storybookStatus = `Frame refreshed at ${new Date().toLocaleTimeString()}`;
      } else if (reason === 'tab-activate' && !this.storybookStatus) {
        this.storybookStatus = 'Storybook panel ready';
      }
    }
  };
}

export { createStorybookBloc };
export default createStorybookBloc;
