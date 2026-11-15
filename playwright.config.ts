import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  testIgnore: ['evidence.spec.ts', 'trace.spec.ts', 'integration.spec.ts', 'local-qa.spec.ts'],
  timeout: 45_000,
  expect: { timeout: 7_500 },
  fullyParallel: true,
  retries: 0,
  reporter: [['list']],
  use: {
    baseURL: 'http://127.0.0.1:4197',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run build && npm run preview -- --port 4197',
    url: 'http://127.0.0.1:4197',
    reuseExistingServer: false,
    timeout: 180_000,
    env: { VITE_EVIDENCE_API: 'off' },
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], viewport: { width: 1440, height: 1000 } },
    },
  ],
});
