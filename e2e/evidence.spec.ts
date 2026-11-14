import { expect, test } from '@playwright/test';
import { mkdirSync } from 'node:fs';
const evidence = 'docs/evidence/pr2';

test('real API: search, detail, provenance, original download and coverage', async ({ page }) => {
  const responses: string[] = [];
  page.on('response', response => { if (response.url().includes('/api/v1/') && response.ok()) responses.push(response.url()); });
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-status')).toContainText('API connected');
  await expect(page.getByTestId('evidence-status')).toContainText('131 records');
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
  await expect(page.locator('.drawer')).toContainText('CSV row 2');
  await original.scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${evidence}/provenance-api.png` });
  const download = page.waitForEvent('download');
  await original.click();
  expect((await download).suggestedFilename()).toBe('PSI-25_experimental.csv');
  await page.keyboard.press('Escape');
  await page.goto('/#/methodology');
  await expect(page.getByRole('heading', { name: 'Imported dataset coverage' })).toBeVisible();
  await expect(page.getByText('Local evidence API · dataset verified')).toBeVisible();
  await page.screenshot({ path: `${evidence}/coverage-api.png`, fullPage: true });
});

test('real API comparison retains missing pressure, context gravity and differing direction', async ({ page }) => {
  await page.goto('/#/compare?ids=SAFFIRE1-S1,SAFFIRE1-S2');
  await expect(page.getByTestId('evidence-status')).toContainText('API connected');
  await expect(page.locator('.check-grid')).toContainText('Flow direction');
  await expect(page.locator('.check-grid')).toContainText('Missing values do not establish a match');
  await expect(page.locator('.check--unknown').filter({ hasText: 'Total pressure' })).toBeVisible();
  await expect(page.locator('.check--unknown').filter({ hasText: 'Per-test gravity' })).toBeVisible();
  await expect(page.locator('.check--blocked').filter({ hasText: 'Flow direction' })).toBeVisible();
});

test('backend unavailable: complete bundled fallback stays searchable across routes', async ({ page }) => {
  await page.route('**/api/v1/**', route => route.fulfill({ status: 200, contentType: 'application/json', body: '{}' }));
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-status')).toContainText('Bundled data');
  await page.locator('input[type=search]').fill('BASS2-B1');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await page.screenshot({ path: `${evidence}/fallback.png`, fullPage: true });
  await page.locator('.data-table tbody tr').click();
  await expect(page.locator('#drawer-title')).toHaveText('BASS2-B1');
  for (const route of ['overview', 'atmosphere', 'compare', 'gap', 'assistant', 'methodology', 'exports']) {
    await page.goto(`/#/${route}`);
    await expect(page.locator('h1')).toBeVisible();
    await expect(page.getByTestId('evidence-status')).toContainText('Bundled data');
  }
});

test('dataset mismatch and mid-session API failure switch the entire session to bundled data', async ({ page }) => {
  await page.route('**/api/v1/coverage', route => route.fulfill({ status: 409, contentType: 'application/json', body: '{"error":{"code":"dataset_mismatch"}}' }));
  await page.goto('/#/atlas');
  await expect(page.getByTestId('evidence-status')).toContainText('Dataset mismatch');
  await expect(page.locator('.atlas-summary__count strong')).toHaveText('131');
  await page.unroute('**/api/v1/coverage');
  await page.reload();
  await expect(page.getByTestId('evidence-status')).toContainText('API connected');
  await page.route('**/api/v1/experiments?**', route => route.fulfill({ status: 503, contentType: 'application/json', body: '{}' }));
  await page.locator('input[type=search]').fill('SAFFIRE1-S1');
  await expect(page.getByTestId('evidence-status')).toContainText('Bundled data');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
});

test('capture real Swagger and actual experimental response', async ({ page }) => {
  test.skip(process.env.FIRETRACE_CAPTURE_SWAGGER !== '1', 'Optional capture uses Swagger CDN assets; default suite stays local.');
  await page.goto('http://127.0.0.1:8000/docs');
  await expect(page.getByRole('heading', { name: /FIRETRACE Evidence API/ })).toBeVisible();
  await expect(page.locator('.opblock')).toHaveCount(9);
  await page.screenshot({ path: `${evidence}/swagger.png`, fullPage: true });
  await page.goto('http://127.0.0.1:8000/api/v1/experiments/BASS2-B1');
  await expect(page.locator('body')).toContainText('PSI-25 experimental table, CSV row 2, test B1');
  await page.screenshot({ path: `${evidence}/record-response.png`, fullPage: true });
});
