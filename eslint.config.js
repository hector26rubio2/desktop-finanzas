const tsParser = require('@typescript-eslint/parser');
const tsPlugin = require('@typescript-eslint/eslint-plugin');
// En angular-eslint 22 los presets dejaron de vivir en `@angular-eslint/eslint-plugin`
// —ese paquete ya solo exporta `rules`— y pasaron al paquete paraguas
// `angular-eslint`, que expone `configs` y los plugins ya construidos.
const angular = require('angular-eslint');
const prettierPlugin = require('eslint-plugin-prettier');
const prettierConfig = require('eslint-config-prettier');

/** Reúne las reglas de una lista de configuraciones planas en un solo objeto. */
const rulesOf = (configs) => Object.assign({}, ...configs.map((config) => config.rules ?? {}));

module.exports = [
  { ignores: ['dist/**', 'node_modules/**', 'scripts/**', 'src/index.html'] },
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
      'prettier': prettierPlugin,
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
    files: ['**/*.html'],
    languageOptions: {
      parser: angular.templateParser,
    },
    plugins: {
      '@angular-eslint/template': angular.templatePlugin,
      'prettier': prettierPlugin,
    },
    rules: {
      ...rulesOf(angular.configs.templateRecommended),
      'prettier/prettier': 'warn',
      '@angular-eslint/template/no-negated-async': 'error',
    },
  },
];
