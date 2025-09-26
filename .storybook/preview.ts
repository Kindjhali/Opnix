import type { Preview } from '@storybook/vue3';
import '../src/theme/storybook.css';

const THEMES = ['mole', 'canyon'] as const;

function applyTheme(theme: string) {
  const root = document.documentElement;
  THEMES.forEach(name => root.classList.remove(`${name}-theme`));
  if (THEMES.includes(theme as typeof THEMES[number])) {
    root.classList.add(`${theme}-theme`);
  } else {
    root.classList.add('mole-theme');
  }
}

const preview: Preview = {
  globalTypes: {
    theme: {
      name: 'Theme',
      description: 'Global theme',
      defaultValue: 'mole',
      toolbar: {
        icon: 'paintbrush',
        items: [
          { value: 'mole', title: 'Mole' },
          { value: 'canyon', title: 'Canyon' }
        ]
      }
    }
  },
  parameters: {
    actions: { argTypesRegex: '^on[A-Z].*' },
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/
      }
    },
    backgrounds: {
      default: 'mole',
      values: [
        {
          name: 'mole',
          value: 'linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 50%, #0a0a0a 100%)'
        },
        {
          name: 'canyon',
          value: 'linear-gradient(135deg, #0f0705 0%, #2a1810 50%, #0f0705 100%)'
        }
      ]
    }
  },
  decorators: [
    (story, context) => {
      const theme = context.globals.theme || 'mole';
      applyTheme(theme);
      return {
        template: '<div class="sb-wrapper"><story /></div>'
      };
    }
  ]
};

export default preview;
