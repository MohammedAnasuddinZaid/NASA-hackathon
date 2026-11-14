import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'research-library.spec.ts', workers: 1, timeout: 45000,
  use: { baseURL: 'http://127.0.0.1:4190', ...devices['Desktop Chrome'], screenshot: 'only-on-failure' },
  webServer: { command: 'npm run preview -- --port 4190', url: 'http://127.0.0.1:4190',
    reuseExistingServer: false, timeout: 30000 },
});
