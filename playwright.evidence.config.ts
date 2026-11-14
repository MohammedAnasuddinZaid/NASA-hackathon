import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'evidence.spec.ts', timeout: 45000, workers: 1,
  use: { baseURL: 'http://127.0.0.1:4182', ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 }, screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node scripts/evidence-test-server.mjs', url: 'http://127.0.0.1:8000/api/v1/health', reuseExistingServer: false, timeout: 60000 },
    { command: 'npm run build && npm run preview -- --port 4182', url: 'http://127.0.0.1:4182', reuseExistingServer: false, timeout: 180000 },
  ],
});
