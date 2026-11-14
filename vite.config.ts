import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
const corpusVersion = createHash('sha256').update(readFileSync(new URL('./src/data/corpus.json', import.meta.url))).digest('hex');
const target = process.env.FIRETRACE_API_TARGET ?? 'http://127.0.0.1:8000';

export default defineConfig({
  plugins: [react()],
  define: { __BUNDLED_CORPUS_VERSION__: JSON.stringify(corpusVersion) },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/v1': target, '/health': target } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api/v1': target, '/health': target } },
});
