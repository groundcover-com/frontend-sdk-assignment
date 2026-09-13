import { fileURLToPath } from 'node:url';
import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { mockIngest } from './mock-ingest/plugin';

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss(), mockIngest()],
  build: {
    rollupOptions: {
      // Two consumers of the same SDK: the React playground and a page with no
      // framework at all. `appType` stays at its default so unknown paths still
      // fall back to index.html.
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        plain: fileURLToPath(new URL('./plain.html', import.meta.url)),
      },
    },
  },
});
