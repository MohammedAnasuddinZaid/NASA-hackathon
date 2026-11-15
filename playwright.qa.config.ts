import { defineConfig, devices } from '@playwright/test';
export default defineConfig({
  testDir: './e2e', testMatch: 'local-qa.spec.ts', timeout: 60000, workers: 1,
  expect: { timeout: 10000 }, reporter: [['list']],
  use: { baseURL: 'http://127.0.0.1:4200', ...devices['Desktop Chrome'], viewport: {width:1440,height:1000},
    trace: 'retain-on-failure', screenshot: 'only-on-failure' },
  webServer: [
    { command: 'node scripts/evidence-test-server.mjs', url: 'http://127.0.0.1:8030/health/ready',
      env: { FIRETRACE_TEST_PORT: '8030', AI_ENABLED: 'false' }, reuseExistingServer: false, timeout:60000 },
    { command: 'npm run build && npm run preview -- --port 4200', url:'http://127.0.0.1:4200',
      env:{FIRETRACE_API_TARGET:'http://127.0.0.1:8030', VITE_EVIDENCE_API:'auto'}, reuseExistingServer:false, timeout:180000 },
  ],
});
