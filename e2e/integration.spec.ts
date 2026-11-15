import { expect, test } from '@playwright/test';
import { readFile, mkdir } from 'node:fs/promises';

test('real API to basket, comparison, verified brief downloads, research citation and original record', async ({ page }) => {
  await page.goto('/#/atlas');
  for (const id of ['BASS2-B1', 'SAFFIRE1-S1']) {
    await page.locator('input[type="search"]').fill(id);
    await page.getByRole('button', { name: `Add ${id} to basket`, exact: true }).click();
  }
  await page.screenshot({ path: 'docs/evidence/integration/atlas-basket.png' });
  await page.goto('/#/exports');
  await page.reload();
  await expect(page.getByRole('heading', { name: 'Evidence basket · 2 records', exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Move SAFFIRE1-S1 up', exact: true }).click();
  for (const id of ['BASS2-B1', 'SAFFIRE1-S1'])
    await page.getByRole('checkbox', { name: `Compare ${id}`, exact: true }).check();
  await page.getByRole('link', { name: 'Compare chosen basket records →', exact: true }).click();
  await expect(page.getByTestId('api-comparison')).toBeVisible();
  await expect(page.getByTestId('api-comparison')).toContainText('unknown');
  await page.screenshot({ path: 'docs/evidence/integration/comparison.png' });
  await page.getByRole('link', { name: '← Return to evidence basket', exact: true }).click();
  await page.getByRole('button', { name: 'Generate research brief', exact: true }).click();
  await expect(page.getByRole('article', { name: 'Generated research brief' })).toContainText('0/2 available');
  await page.screenshot({ path: 'docs/evidence/integration/research-brief.png' });
  for (const format of ['CSV', 'JSON', 'Markdown', 'printable HTML']) {
    const pending = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download basket ${format}`, exact: true }).click();
    const download = await pending;
    expect(await download.failure()).toBeNull();
    const raw = await readFile((await download.path())!, 'utf8');
    // Markdown deliberately escapes punctuation for safe rendering.
    const content = format === 'Markdown' ? raw.replace(/\\([\-._()])/g, '$1') : raw;
    expect(content).toContain('BASS2-B1'); expect(content).toContain('SAFFIRE1-S1');
    expect(content).toContain('22.2');
    if (format === 'JSON') { const json = JSON.parse(content); expect(json).toBeTruthy(); expect(content).toContain('null'); }
    if (format === 'printable HTML') expect(content).toContain('<html');
  }
  await page.goto('/#/atlas?view=research');
  await page.getByRole('searchbox', { name: 'Research search', exact: true }).fill('daily oxygen');
  await expect(page.getByRole('link', { name: 'Original PDF at cited page', exact: true })).toHaveAttribute('href', /#page=14$/);
  await mkdir('docs/evidence/integration', { recursive: true });
  await page.getByRole('heading', { name: 'Daily oxygen correction', exact: true }).scrollIntoViewIfNeeded();
  await page.screenshot({ path: 'docs/evidence/integration/research-citation.png' });
  await page.getByRole('button', { name: 'Reset research filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Evidence type', exact: true }).selectOption('experiment');
  await page.getByRole('searchbox', { name: 'Research search', exact: true }).fill('BASS2-B1');
  await page.getByRole('link', { name: 'Inspect unchanged experiment and provenance →', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('22.2');
  for (let i = 0; i < 28; i++) {
    await page.keyboard.press('Tab');
    expect(await page.getByRole('dialog').evaluate(el => el.contains(document.activeElement))).toBe(true);
  }
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
});

test('stale basket, invalid research, empty search and unavailable AI fail explicitly', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('firetrace-evidence-basket-v1', JSON.stringify({ schema: 1, version: 'stale', ids: ['NOT-A-RECORD'], fingerprints: {} })));
  await page.addInitScript(() => { if ('serviceWorker' in navigator) navigator.serviceWorker.register = () => Promise.reject(new Error('disabled for test')); });
  await page.goto('/#/exports');
  await expect(page.getByText(/Removed stale\/invalid record references/)).toBeVisible();
  await page.route('**/*research.json', route => route.fulfill({ json: { schema_version: 'invalid' } }));
  await page.goto('/#/atlas?view=research');
  await expect(page.getByRole('alert')).toBeVisible();
  await page.evaluate(() => { window.location.hash = '#/overview'; });
  await page.waitForTimeout(300);
  await page.evaluate(() => { window.location.hash = '#/atlas'; });
  await page.waitForTimeout(300);
  await page.locator('input[type="search"]').fill('NO-SUCH-EXPERIMENT-9999');
  await expect(page.getByText(/No records match/)).toBeVisible();
  await page.evaluate(() => { window.location.hash = '#/assistant'; });
  await page.getByRole('button', { name: 'What oxygen did BASS2-B1 report?', exact: true }).click();
  await expect(page.locator('.answer')).toContainText('22.2');
  await expect(page.locator('.answer')).toContainText(/disabled|deterministic/i);
  await page.screenshot({ path: 'docs/evidence/integration/trace-deterministic.png' });
});

for (const width of [1440, 768, 390]) {
  test(`all eight routes and research are usable at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 950 });
    for (const path of ['overview', 'atmosphere', 'atlas', 'compare', 'gap', 'assistant', 'methodology', 'exports', 'atlas?view=research']) {
      await page.goto(`/#/${path}`);
      await expect(page.locator('h1')).toBeVisible();
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 2), { message: `Overflow at ${path}, ${width}px` }).toBe(true);
    }
    await page.screenshot({ path: `docs/evidence/integration/mobile-${width}.png` });
  });
}
