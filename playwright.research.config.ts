import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig(base, {
  testMatch: '**/research.spec.ts',
  workers: 1,
  use: { baseURL: 'http://127.0.0.1:4188' },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4188',
    url: 'http://127.0.0.1:4188',
    reuseExistingServer: false,
    timeout: 180000,
    env: { VITE_EVIDENCE_API: 'off' },
  },
});
