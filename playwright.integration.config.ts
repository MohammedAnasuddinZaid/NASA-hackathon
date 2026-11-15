import { defineConfig } from '@playwright/test';
import base from './playwright.config';
export default defineConfig({ ...base,
  testIgnore: [], testMatch: 'integration.spec.ts', workers: 1, timeout: 90000,
  // Fault-injected requests must reach Playwright instead of the new offline service worker.
  // The default workbench suite still verifies the real PWA installation/offline behavior.
  use: { baseURL: 'http://127.0.0.1:4196', serviceWorkers: 'block' },
  webServer: [
    { command: 'node scripts/evidence-test-server.mjs', url: 'http://127.0.0.1:8017/health/ready',
      env: { FIRETRACE_TEST_PORT: '8017', AI_ENABLED: 'false' }, reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run build && npm run preview -- --port 4196', url: 'http://127.0.0.1:4196',
      env: { FIRETRACE_API_TARGET: 'http://127.0.0.1:8017', VITE_EVIDENCE_API: 'auto' }, reuseExistingServer: false, timeout: 180000 },
  ],
});
