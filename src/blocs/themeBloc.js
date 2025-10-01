import { setThemeFlow, bootstrapThemeFlow } from '../composables/themeManager.js';

function createThemeBloc() {
  return {
    bootstrapTheme(options) {
      bootstrapThemeFlow.call(this, options);
    },
    setTheme(theme) {
      setThemeFlow.call(this, theme);
      if (typeof this.refreshStorybookFrame === 'function') {
        this.refreshStorybookFrame({ reason: 'theme-change' });
      }
    }
  };
}

export { createThemeBloc };
export default createThemeBloc;
