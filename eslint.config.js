import js from '@eslint/js';
import tsParser from '@typescript-eslint/parser';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import security from 'eslint-plugin-security';
import securityNode from 'eslint-plugin-security-node';
import globals from 'globals';

export default [
  {
    ignores: [
      'dist/**',
      'coverage/**',
      'node_modules/**',
      'web/node_modules/**',
      'web/dist/**',
      'web/coverage/**',
    ],
  },
  js.configs.recommended,
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
      globals: {
        ...globals.node,
        ...globals.browser,
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      security,
      'security-node': securityNode,
    },
    rules: {
      ...security.configs.recommended.rules,
      ...securityNode.configs.recommended.rules,
      // Avoid noisy false positives; re-enable per-file if needed.
      'security/detect-object-injection': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': 'warn',
      'no-redeclare': 'warn',
      'no-undef': 'off',
      'no-floating-promises': 'off',
    },
  },
];
