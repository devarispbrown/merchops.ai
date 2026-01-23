/// <reference types="vitest" />
import { defineConfig } from 'vitest/config';
import path from 'path';

// Set required environment variables before tests load modules
process.env.NODE_ENV = 'test';
process.env.SHOPIFY_TOKEN_ENCRYPTION_KEY = '0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
process.env.SHOPIFY_API_KEY = 'test-api-key-12345';
process.env.SHOPIFY_API_SECRET = 'test-api-secret-67890';
process.env.SHOPIFY_APP_URL = 'https://test-app.example.com';
process.env.SHOPIFY_SCOPES = 'read_products,write_products,read_inventory,read_orders';

export default defineConfig({
  test: {
    name: 'merchops-web',

    /* Test environment */
    environment: 'jsdom',

    /* Global test setup */
    setupFiles: ['./tests/setup.ts'],

    /* Include patterns */
    include: [
      'tests/unit/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'app/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'components/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'lib/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
      'server/**/*.{test,spec}.{js,mjs,cjs,ts,mts,cts,jsx,tsx}',
    ],

    /* Exclude patterns */
    exclude: [
      '**/node_modules/**',
      '**/dist/**',
      '**/.next/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/tests/e2e/**',
    ],

    /* Coverage configuration */
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        '**/node_modules/**',
        '**/dist/**',
        '**/.next/**',
        '**/tests/**',
        '**/*.config.{js,ts}',
        '**/*.d.ts',
        '**/types/**',
        '**/coverage/**',
      ],
      include: [
        'app/**/*.{js,jsx,ts,tsx}',
        'components/**/*.{js,jsx,ts,tsx}',
        'lib/**/*.{js,jsx,ts,tsx}',
        'server/**/*.{js,jsx,ts,tsx}',
      ],
      all: true,
    },

    /* Globals */
    globals: true,

    /* Test timeout */
    testTimeout: 10000,

    /* Hook timeout */
    hookTimeout: 10000,

    /* Retry failed tests */
    retry: process.env.CI ? 2 : 0,

    /* Pool options */
    pool: 'threads',
    poolOptions: {
      threads: {
        singleThread: false,
      },
    },

    /* Reporter */
    reporters: process.env.CI
      ? ['verbose', 'json']
      : ['verbose'],

    /* Output */
    outputFile: {
      json: './test-results/results.json',
    },

    /* Benchmark */
    benchmark: {
      include: ['**/*.bench.{js,mjs,cjs,ts,mts,cts,jsx,tsx}'],
    },
  },

  resolve: {
    alias: {
      '@': path.resolve(__dirname, './'),
      '@/app': path.resolve(__dirname, './app'),
      '@/components': path.resolve(__dirname, './components'),
      '@/lib': path.resolve(__dirname, './lib'),
      '@/server': path.resolve(__dirname, './server'),
      '@/tests': path.resolve(__dirname, './tests'),
      '@/types': path.resolve(__dirname, './types'),
      '@merchops/shared': path.resolve(__dirname, '../../packages/shared'),
    },
  },
});
