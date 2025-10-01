const js = require('@eslint/js');
const vue = require('eslint-plugin-vue');

module.exports = [
  {
    ignores: ['node_modules/**', 'exports/**', '.storybook/**', 'cc-sessions/**', '.opnix/**', 'public/assets/**', 'public/**/*.pretty.js', 'storybook-static/**', 'tests/installerAgentFiles.test.mjs', 'tests/installerAgentFilesE2E.test.mjs']
  },
  js.configs.recommended,
  ...vue.configs['flat/recommended'],
  {
    files: ['public/**/*.js'],
    rules: {
      'no-undef': 'off',
      'prefer-const': 'off',
      'no-var': 'off',
      'no-unused-vars': 'off',
      'camelcase': 'off',
      'no-prototype-builtins': 'off',
      'no-setter-return': 'off'
    }
  },
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
        clearImmediate: 'readonly',
        navigator: 'readonly'
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
        'ignoreGlobals': false,
        'allow': ['__dirname', '__filename', 'child_process', 'process_exit', 'ansi_up', 'node_modules', 'npm_package_name']
      }]
    }
  },
  {
    files: ['src/**/*.js'],
    languageOptions: {
      ecmaVersion: 2024,
      sourceType: 'module',
      globals: {
        console: 'readonly',
        window: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        fetch: 'readonly',
        navigator: 'readonly',
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
        process: 'readonly',
        fetch: 'readonly',
        queueMicrotask: 'readonly',
        document: 'readonly',
        localStorage: 'readonly',
        performance: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly'
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
        document: 'readonly',
        fetch: 'readonly',
        setTimeout: 'readonly',
        clearTimeout: 'readonly',
        setInterval: 'readonly',
        clearInterval: 'readonly',
        confirm: 'readonly',
        alert: 'readonly'
      }
    },
    rules: {
      'vue/multi-word-component-names': 'off',
      'vue/max-attributes-per-line': 'off',
      'vue/singleline-html-element-content-newline': 'off',
      'vue/multiline-html-element-content-newline': 'off',
      'vue/v-on-event-hyphenation': 'off',
      'vue/html-indent': 'off',
      'vue/require-explicit-emits': 'off',
      'vue/html-self-closing': 'off',
      'vue/no-deprecated-dollar-listeners-api': 'off',
      'vue/no-v-html': 'off',
      'vue/attributes-order': 'off',
      'vue/order-in-components': 'off',
      'camelcase': ['error', {
        'properties': 'always',
        'ignoreDestructuring': false,
        'ignoreImports': false,
        'ignoreGlobals': false,
        'allow': ['__dirname', '__filename', 'child_process', 'process_exit', 'ansi_up', 'node_modules', 'npm_package_name']
      }]
    }
  },
];
