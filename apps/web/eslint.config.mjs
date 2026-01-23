import nextConfig from 'eslint-config-next';
import tseslint from 'typescript-eslint';

const eslintConfig = [
  // Next.js core-web-vitals config (already a flat config array)
  ...nextConfig,

  // TypeScript rules for source files (with project)
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['**/*.test.ts', '**/*.test.tsx', '**/__tests__/**', 'tests/**', 'playwright.config.ts', 'vitest.config.ts', 'vitest.setup.ts'],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.json',
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      // Warn on any types - these pre-existed and need gradual cleanup
      '@typescript-eslint/no-explicit-any': 'warn',
      // Disable the overly strict purity rule - Date.now() is a common pattern
      'react-hooks/purity': 'off',
    },
  },

  // TypeScript rules for test files (without project - avoids parsing errors)
  {
    files: [
      '**/*.test.ts',
      '**/*.test.tsx',
      '**/__tests__/**/*.ts',
      '**/__tests__/**/*.tsx',
      'tests/**/*.ts',
      'tests/**/*.tsx',
      'playwright.config.ts',
      'vitest.config.ts',
      'vitest.setup.ts',
    ],
    plugins: {
      '@typescript-eslint': tseslint.plugin,
    },
    languageOptions: {
      parser: tseslint.parser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'warn', // Relaxed for tests
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
      '@typescript-eslint/no-explicit-any': 'off', // Tests can use any
    },
  },

  // Global rules for all files
  {
    rules: {
      'no-console': [
        'warn',
        {
          allow: ['warn', 'error'],
        },
      ],
      // Disable the overly strict purity rule globally - Date.now() is a common pattern
      'react-hooks/purity': 'off',
    },
  },

  // Additional ignores
  {
    ignores: [
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
    ],
  },
];

export default eslintConfig;
