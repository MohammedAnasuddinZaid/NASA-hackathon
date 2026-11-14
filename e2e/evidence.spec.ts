import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = 'docs/evidence/pr2';
test('API Atlas search, detail, sources, coverage and untouched original', async ({ page }) => {
  const responses: string[] = [];
  page.on('response', response => { if (response.url().includes('/api/v1/') && response.ok()) responses.push(response.url()); });
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-connection')).toContainText('API connected');
  await page.locator('input[type=search]').fill('BASS2-B1');
  await expect.poll(() => responses.some(url => url.includes('/experiments?') && url.includes('q=BASS2-B1'))).toBe(true);
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  mkdirSync(evidence, { recursive: true });
  await page.screenshot({ path: `${evidence}/atlas-api.png`, fullPage: true });
  await page.locator('.data-table tbody tr').click();
  await expect(page.locator('#drawer-title')).toHaveText('BASS2-B1');
  await expect.poll(() => responses.some(url => url.endsWith('/experiments/BASS2-B1'))).toBe(true);
  const original = page.getByRole('link', { name: 'Download original: PSI-25_experimental.csv', exact: true });
  await expect(original).toBeVisible();
  await original.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/provenance-api.png` });
  const download = page.waitForEvent('download');
  await original.click();
  expect((await download).suggestedFilename()).toBe('PSI-25_experimental.csv');
  await page.keyboard.press('Escape');
  await page.goto('/#/methodology');
  await expect(page.getByRole('heading', { name: 'Imported dataset coverage' })).toBeVisible();
  await page.screenshot({ path: `${evidence}/coverage-api.png`, fullPage: true });
});
test('API comparison uses existing backend matching policy', async ({ page }) => {
  await page.goto('/#/compare?ids=SAFFIRE1-S1,SAFFIRE1-S2');
  await expect(page.getByTestId('evidence-connection')).toContainText('API connected');
  await expect(page.locator('.check-grid')).toContainText('Total pressure');
  await expect(page.locator('.check-grid')).toContainText('Flow direction');
  await expect(page.locator('.check--unknown').filter({ hasText: 'Total pressure' })).toBeVisible();
});
test('unavailable or mismatched API preserves all eight routes with explicit fallback', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 409, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-connection')).toContainText('Bundled data');
  await page.locator('input[type=search]').fill('BASS2-B1');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.screenshot({ path: `${evidence}/fallback.png`, fullPage: true });
  for (const name of ['overview', 'atmosphere', 'compare', 'gap', 'assistant', 'methodology', 'exports']) {
    await page.goto(`/#/${name}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('evidence-connection')).toContainText('Bundled data');
  }
});
test('mid-session failure switches the entire evidence session to bundled mode', async ({ page }) => {
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-connection')).toContainText('API connected');
  await page.route('**/api/v1/experiments?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.locator('input[type=search]').fill('SAFFIRE1-S1');
  await expect(page.getByTestId('evidence-connection')).toContainText('Bundled data');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
});
test('actual Swagger and scientific API response capture', async ({ page }) => {
  test.skip(process.env.FIRETRACE_CAPTURE_SWAGGER !== '1', 'Optional Swagger capture uses CDN assets');
  await page.goto('http://127.0.0.1:8012/docs');
  await expect(page.getByRole('heading', { name: /FIRETRACE Evidence API/ })).toBeVisible();
  await page.screenshot({ path: `${evidence}/swagger.png`, fullPage: true });
  await page.goto('http://127.0.0.1:8012/api/v1/experiments/BASS2-B1');
  await expect(page.locator('body')).toContainText('CSV row 2');
  await page.screenshot({ path: `${evidence}/record-response.png`, fullPage: true });
});
