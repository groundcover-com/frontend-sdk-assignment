import { fileURLToPath } from 'node:url';

import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, lazyPlugins } from 'vite-plus';

import { mockCatalog } from './mock-catalog/plugin';
import { mockIngest } from './mock-ingest/plugin';

// https://viteplus.dev/config/
export default defineConfig({
  plugins: lazyPlugins(() => [
    react(),
    tailwindcss(),
    mockIngest(),
    mockCatalog(),
  ]),
  build: {
    rolldownOptions: {
      // Two consumers of the same SDK: the React playground and a page with no
      // framework at all. `appType` stays at its default so unknown paths still
      // fall back to index.html.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        plain: fileURLToPath(new URL('./plain.html', import.meta.url)),
      },
    },
  },
  fmt: {
    printWidth: 80,
    singleQuote: true,
    sortImports: true,
    sortTailwindcss: { stylesheet: './src/index.css' },
    ignorePatterns: ['dist/**', 'pnpm-lock.yaml'],
  },
  lint: {
    plugins: ['eslint', 'typescript', 'unicorn', 'oxc', 'react', 'jsx-a11y'],
    categories: { correctness: 'error' },
    ignorePatterns: ['dist/**'],
    jsPlugins: [{ name: 'vite-plus', specifier: 'vite-plus/oxlint-plugin' }],
    rules: { 'vite-plus/prefer-vite-plus-imports': 'error' },
    overrides: [
      {
        // Captures native prototype methods before patching them, and only
        // ever invokes them with an explicit receiver via `.call`.
        files: ['src/demo/hostile-env.ts'],
        rules: { 'typescript/unbound-method': 'off' },
      },
    ],
    options: { typeAware: true, typeCheck: true },
  },
  test: {
    passWithNoTests: true,
  },
});
