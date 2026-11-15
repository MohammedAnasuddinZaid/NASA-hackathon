import { expect, test } from '@playwright/test';

test.describe('research workbench', () => {
  test('notebook persists a typed observation and exposes it to verification', async ({ page }) => {
    await page.goto('/#/notebook');
    await expect(page.locator('h1').first()).toContainText('Keep the question');

    const title = `E2E low-flow PMMA ${Date.now()}`;
    await page.locator('input[placeholder="PMMA at low flow"]').fill(title);
    await page
      .locator('textarea[placeholder="What does the corpus actually report?"]')
      .fill('What initial oxygen did BASS2-B1 report?');
    await page.getByRole('button', { name: 'Create investigation' }).click();
    await expect(page.locator('.panel__title', { hasText: title })).toBeVisible();

    await page.locator('input[placeholder="BASS2-B1, BASS2-B2"]').fill('BASS2-B1');
    await page.getByRole('button', { name: 'Attach', exact: true }).click();
    await expect(page.locator('.data-table tbody')).toContainText('BASS2-B1');

    const observation = 'BASS2-B1 reports 22.2% initial oxygen in the source table.';
    await page.locator('textarea[placeholder="Initial oxygen was 22.2%."]').fill(observation);
    await page.locator('input[placeholder="BASS2-B1"]').fill('BASS2-B1');
    await page.locator('input[placeholder="oxygen_initial_pct"]').fill('oxygen_initial_pct');
    await page.getByRole('button', { name: 'Add source-backed observation' }).click();
    await expect(page.locator('.wb-item__text')).toContainText(observation);
    await expect(page.locator('.wb-item').first()).toContainText('Supported by cited evidence');

    await page.reload();
    await expect(page.locator('.wb-investigation__title', { hasText: title })).toBeVisible();
    await expect(page.locator('.wb-item__text')).toContainText(observation);

    await page.goto('/#/verification');
    await expect(page.locator('.wb-verification-list').last()).toContainText(observation);
  });

  test('coverage computes zero coverage for constrained fields', async ({ page }) => {
    await page.goto('/#/coverage');
    await expect(page.locator('.wb-constraint')).toHaveCount(5);
    await expect(page.locator('.wb-constraint-grid')).toContainText('0 / 131');
    await expect(page.locator('.wb-constraint-grid')).toContainText('Total pressure');
    await expect(page.locator('.wb-constraint-grid')).toContainText('Oxygen partial pressure');
    await expect(page.locator('.wb-constraint-grid')).toContainText('Per-test gravity');
    await expect(page.locator('.wb-constraint-grid')).toContainText('Ignition method');
    await expect(page.locator('.wb-constraint-grid')).toContainText('Standardized outcome');

    await page.locator('.wb-flag', { hasText: 'flow reported as sequence' }).click();
    await expect(page.locator('.panel__title', { hasText: 'Records flagged' })).toBeVisible();
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
  });

  test('evaluation runs the deterministic benchmark and keeps failures visible', async ({ page }) => {
    await page.goto('/#/evaluation');
    await expect(page.locator('.wb-mini-stat strong').first()).toHaveText('36 / 36', { timeout: 15_000 });
    await expect(page.locator('.wb-mini-stat strong').nth(1)).toHaveText('100%');
    await expect(page.locator('.wb-mini-stat strong').nth(2)).toHaveText('0');
    await page.getByRole('button', { name: 'fail', exact: true }).click();
    await expect(page.locator('.wb-benchmark')).toHaveCount(0);
    await page.locator('.wb-chip-row').getByRole('button', { name: 'all', exact: true }).last().click();
    await expect(page.locator('.wb-benchmark')).toHaveCount(36);
  });

  test('evidence graph searches a record and renders a typed neighborhood', async ({ page }) => {
    await page.goto('/#/graph');
    await expect(page.locator('.wb-graph-canvas svg')).toBeVisible();
    const search = page.locator('input[placeholder="BASS2-B1, PMMA, pressure, suspect"]');
    await search.fill('BASS2-B1');
    await expect(page.locator('.wb-graph-result').first()).toContainText('BASS2-B1');
    await page.locator('.wb-graph-result').first().click();
    await expect(page.locator('.wb-graph-canvas svg')).toBeVisible();
    await expect(page.locator('.wb-graph-node').first()).toBeVisible();
  });

  test('verification audits an assistant answer against the corpus', async ({ page }) => {
    await page.goto('/#/verification');
    await expect(page.locator('.wb-mini-stat strong').first()).not.toHaveText('0');
    await page.getByRole('button', { name: 'Ask and verify' }).click();
    const audit = page.locator('.wb-answer-audit');
    await expect(audit).toBeVisible();
    await expect(audit).toContainText('0 of 131');
    await expect(audit).toContainText('Answer has a direct headline');
    await expect(audit).toContainText('Every cited source exists in the manifest');
    await expect(audit.locator('.badge').first()).toContainText('grade: absent');
  });

  test('analysis runs are recorded, reproducible, and persisted', async ({ page }) => {
    await page.goto('/#/analysis');
    await page.getByRole('button', { name: 'Run all definitions' }).click();
    await expect(page.locator('.wb-run')).toHaveCount(6);
    await expect(page.locator('.data-table tbody tr').first()).toBeVisible();
    await expect(page.locator('.wb-finding-list li').first()).toBeVisible();
    await expect(page.locator('.kv').first()).toContainText('Corpus version');

    await page.reload();
    await expect(page.locator('.wb-run')).toHaveCount(6);
  });

  test('integrity reports all checks and no failures', async ({ page }) => {
    await page.goto('/#/integrity');
    await expect(page.locator('.wb-mini-stat strong').first()).toHaveText('19');
    await expect(page.locator('.wb-mini-stat strong').nth(2)).toHaveText('0');
    await expect(page.locator('.wb-mini-stat strong').nth(3)).toHaveText('0');
    await expect(page.locator('.wb-integrity.is-fail')).toHaveCount(0);
  });

  test('reports assemble a hashed bundle and download a ZIP', async ({ page }) => {
    await page.goto('/#/reports');
    await page.getByRole('button', { name: 'Generate report' }).click();
    await expect(page.locator('.panel__title', { hasText: 'FIRETRACE evidence report' })).toBeVisible();
    await expect(page.locator('.data-table tbody tr')).toHaveCount(5);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download ZIP/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^firertrace-report-\d{4}-\d{2}-\d{2}\.zip$/);
  });

  test('exports downloads the research bundle with a manifest', async ({ page }) => {
    await page.goto('/#/exports');
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: /Download research bundle/ }).click();
    const file = await download;
    expect(file.suggestedFilename()).toMatch(/^firertrace-research-\d{4}-\d{2}-\d{2}\.zip$/);
    await expect(page.getByRole('status').filter({ hasText: 'Generated 6 hashed files' })).toBeVisible();
  });

  test('health probes capabilities and the shell reports offline state', async ({ page, context }) => {
    await page.goto('/#/health');
    await expect(page.locator('.wb-capability')).toHaveCount(10);
    await expect(page.locator('.wb-health-env')).toContainText('authoritative');
    await expect(page.locator('.wb-capability-list')).toContainText('Bundled corpus');

    await context.setOffline(true);
    await expect(page.locator('.topbar__status')).toContainText('offline');
  });

  test('manifest and offline shell are installed in the production build', async ({ page, request }) => {
    await page.goto('/#/overview');
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute('href', './manifest.webmanifest');
    const response = await request.get('http://localhost:4173/manifest.webmanifest');
    expect(response.status()).toBe(200);
    const json = await response.json();
    expect(json.short_name).toBe('FIRETRACE');
    expect(json.background_color).toBe('#0B0B0C');

    const controlled = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return false;
      await navigator.serviceWorker.ready;
      return Boolean(await navigator.serviceWorker.getRegistration());
    });
    expect(controlled).toBe(true);
  });
});
