const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
const eslint = require('@eslint/js');

const angular = require('angular-eslint');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

const rulesOf = (configs) => Object.assign({}, ...configs.map((config) => config.rules ?? {}));

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'src/index.html'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      '@angular-eslint': angular.tsPlugin,
      prettier: prettierPlugin,
    },
    processor: angular.processInlineTemplates,
    rules: {
      ...tsPlugin.configs.recommended.rules,
      ...rulesOf(angular.configs.tsRecommended),
      ...prettierConfig.rules,
      'prettier/prettier': 'warn',
      '@angular-eslint/component-class-suffix': ['error', { suffixes: ['Component'] }],
      '@angular-eslint/contextual-lifecycle': 'error',
      '@angular-eslint/no-empty-lifecycle-method': 'error',
      '@angular-eslint/no-input-rename': 'error',
      '@angular-eslint/no-output-rename': 'error',
      '@angular-eslint/use-lifecycle-interface': 'error',
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['electron/**/*.js', 'eslint.config.js'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'commonjs',
      globals: {
        Buffer: 'readonly',
        URL: 'readonly',
        __dirname: 'readonly',
        console: 'readonly',
        module: 'readonly',
        process: 'readonly',
        require: 'readonly',
        setImmediate: 'readonly',
        setTimeout: 'readonly',
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
    },
  },
  {
    files: ['scripts/**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      globals: {
        URL: 'readonly',
        console: 'readonly',
        document: 'readonly',
        process: 'readonly',
        window: 'readonly',
      },
    },
    rules: {
      ...eslint.configs.recommended.rules,
    },
  },
  {
    files: ['**/*.html'],
    languageOptions: {
      parser: angular.templateParser,
    },
    plugins: {
      '@angular-eslint/template': angular.templatePlugin,
      prettier: prettierPlugin,
    },
    rules: {
      ...rulesOf(angular.configs.templateRecommended),
      ...rulesOf(angular.configs.templateAccessibility),
      'prettier/prettier': 'warn',
      '@angular-eslint/template/no-negated-async': 'error',
    },
  },
];
