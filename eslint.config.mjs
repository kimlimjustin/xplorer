import js from '@eslint/js';
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';

export default [
  js.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaFeatures: { jsx: true },
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
      globals: {
        // Browser globals
        window: 'readonly',
        document: 'readonly',
        console: 'readonly',
        navigator: 'readonly',
        localStorage: 'readonly',
        sessionStorage: 'readonly',
        fetch: 'readonly',
        crypto: 'readonly',
        confirm: 'readonly',
        alert: 'readonly',
        structuredClone: 'readonly',
        getComputedStyle: 'readonly',
        requestIdleCallback: 'readonly',
        prompt: 'readonly',

        // Timers
        setTimeout: 'readonly',
        setInterval: 'readonly',
        clearTimeout: 'readonly',
        clearInterval: 'readonly',
        requestAnimationFrame: 'readonly',
        cancelAnimationFrame: 'readonly',

        // APIs
        FileReader: 'readonly',
        Blob: 'readonly',
        File: 'readonly',
        FormData: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        TextEncoder: 'readonly',
        TextDecoder: 'readonly',
        AbortController: 'readonly',
        EventSource: 'readonly',
        WebSocket: 'readonly',
        XMLHttpRequest: 'readonly',
        Headers: 'readonly',
        Request: 'readonly',
        Response: 'readonly',
        Image: 'readonly',

        // Observers
        MutationObserver: 'readonly',
        IntersectionObserver: 'readonly',
        ResizeObserver: 'readonly',

        // Media
        AudioContext: 'readonly',

        // Other browser globals
        global: 'readonly',
        globalThis: 'readonly',
        queueMicrotask: 'readonly',
        performance: 'readonly',

        // Node.js globals (for tests/config)
        process: 'readonly',
        __dirname: 'readonly',
        NodeJS: 'readonly',
      },
    },
    plugins: {
      '@typescript-eslint': tsPlugin,
      react: reactPlugin,
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      // Disable no-undef for TypeScript files - TypeScript's compiler
      // provides much better undefined variable detection
      'no-undef': 'off',

      // TypeScript
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_', ignoreRestSiblings: true },
      ],
      '@typescript-eslint/no-explicit-any': 'error',

      // React
      'react/react-in-jsx-scope': 'off',
      'react/prop-types': 'off',
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
      'react/jsx-no-duplicate-props': 'error',
      'react/jsx-key': 'error',
      'react/no-array-index-key': 'warn',
      'react/self-closing-comp': 'warn',

      // General
      'no-console': ['warn', { allow: ['warn', 'error'] }],
      'prefer-const': 'error',
      'no-var': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-duplicate-imports': 'error',
      'no-nested-ternary': 'warn',
      curly: ['warn', 'multi-line'],
      'no-else-return': 'warn',
      'object-shorthand': 'warn',
      'prefer-template': 'warn',
    },
    settings: {
      react: { version: '18' },
    },
  },
  {
    ignores: [
      'node_modules/**',
      'dist/**',
      'target/**',
      'apps/web/**',
      'packages/extensions/**',
      'packages/extension-sdk/**',
      'packages/create-extension/**',
      'packages/cli/**',
      'scripts/**',
      '*.config.*',
      'apps/client/dist/**',
      'apps/client/public/**',
      'apps/src-tauri/**',
      '.orchestrate/**',
    ],
  },
];
