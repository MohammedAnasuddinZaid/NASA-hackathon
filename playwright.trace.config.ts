import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testIgnore: [], testMatch: 'trace.spec.ts', workers: 1,
  use: { baseURL: 'http://127.0.0.1:4195' },
  webServer: { command: 'npm run build && npm run preview -- --port 4195',
    url: 'http://127.0.0.1:4195', reuseExistingServer: false, timeout: 180000,
    env: { VITE_EVIDENCE_API: 'auto' } },
});
