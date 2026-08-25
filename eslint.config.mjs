import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import reactPlugin from 'eslint-plugin-react';
import reactHooksPlugin from 'eslint-plugin-react-hooks';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '**/release/**', '**/.package/**'],
  },

  // Base JS recommended rules for all files
  js.configs.recommended,

  // Node.js globals for JS config and script files
  {
    files: ['**/*.js', '**/*.cjs', '**/*.mjs'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },

  // TypeScript recommended rules
  ...tseslint.configs.recommended.map((cfg) => ({
    ...cfg,
    files: ['**/*.ts', '**/*.tsx'],
  })),

  // TypeScript-specific overrides
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      // Allow explicit any in rare cases (prefer unknown)
      '@typescript-eslint/no-explicit-any': 'warn',
      // Allow unused vars prefixed with _
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      // Allow non-null assertions (used carefully)
      '@typescript-eslint/no-non-null-assertion': 'warn',
      // Allow empty functions (lifecycle hooks, placeholders)
      '@typescript-eslint/no-empty-function': 'warn',
    },
  },

  // React JSX support
  {
    files: ['**/*.tsx'],
    plugins: {
      react: reactPlugin,
    },
    languageOptions: {
      parserOptions: {
        ecmaFeatures: { jsx: true },
      },
    },
    rules: {
      'react/jsx-uses-react': 'off',
      'react/react-in-jsx-scope': 'off',
    },
    settings: {
      react: { version: 'detect' },
    },
  },

  // React Hooks
  {
    files: ['**/*.tsx'],
    plugins: {
      'react-hooks': reactHooksPlugin,
    },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },

  // Test files — relax rules
  {
    files: ['**/*.test.ts', '**/*.test.tsx', '**/*.spec.ts', '**/*.spec.tsx'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
    },
  },

  // Config and script files — relax rules
  {
    files: ['**/*.config.{js,cjs,mjs,ts}', 'scripts/**', '**/jest.config.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  }
);
