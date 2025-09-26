const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');

module.exports = [
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'script',
      globals: {
        console: 'readonly',
        process: 'readonly',
        Buffer: 'readonly',
        __dirname: 'readonly',
        __filename: 'readonly',
        module: 'readonly',
        require: 'readonly',
        exports: 'readonly',
        global: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        setImmediate: 'readonly',
        clearImmediate: 'readonly'
      }
    },
    rules: {
      'no-unused-vars': 'warn',
      'no-undef': 'error',
      'prefer-const': 'warn',
      'no-var': 'warn',
      'no-useless-escape': 'warn',
      'no-dupe-class-members': 'error',
      'camelcase': ['error', {
        'properties': 'always',
        'ignoreDestructuring': false,
        'ignoreImports': false,
        'allow': ['__dirname', '__filename']
      }]
    }
  },
  {
    files: ['public/**/*.js', 'src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        Blob: 'readonly',
        Vue: 'readonly',
        mermaid: 'readonly',
        cytoscape: 'readonly',
        AnsiUp: 'readonly',
        Gantt: 'readonly',
        getComputedStyle: 'readonly',
        confirm: 'readonly',
        alert: 'readonly'
      }
    }
  },
  {
    files: ['**/*.mjs'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        process: 'readonly'
      }
    }
  },
  {
    files: ['tests/fixtures/**/*.js'],
    languageOptions: {
      sourceType: 'module'
    }
  },
  {
    files: ['scripts/terminalStatusBar.js'],
    languageOptions: {
      globals: {
        TEXT_COLOR: 'readonly'
      }
    }
  },
  {
    files: ['**/*.vue'],
    languageOptions: {
      parser: require('vue-eslint-parser'),
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'camelcase': ['error', {
        'properties': 'always',
        'ignoreDestructuring': false,
        'ignoreImports': false,
        'allow': ['__dirname', '__filename']
      }]
    }
  },
  {
    ignores: ['node_modules/**', 'exports/**', '.storybook/**', 'cc-sessions/**', 'public/assets/**']
  }
];