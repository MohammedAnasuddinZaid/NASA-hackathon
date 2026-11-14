import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';

const datasetId = createHash('sha256').update(['corpus.json', 'source_manifest.json', 'validation_report.json'].map(name => readFileSync(new URL(`./src/data/${name}`, import.meta.url), 'utf8').replaceAll('\r\n', '\n')).join('\n')).digest('hex');

export default defineConfig({
  plugins: [react()],
  define: { __FIRETRACE_DATASET_ID__: JSON.stringify(datasetId) },
  base: './',
  build: {
    outDir: 'dist',
    assetsDir: 'assets',
    sourcemap: false,
  },
  server: { host: '127.0.0.1', port: 5173, strictPort: true, proxy: { '/api/v1': 'http://127.0.0.1:8000' } },
  preview: { host: '127.0.0.1', port: 4173, strictPort: true, proxy: { '/api/v1': 'http://127.0.0.1:8000' } },
});
