import { expect, test } from '@playwright/test';

test('report findings retain source/page/measurement distinctions and filters', async ({ page }) => {
  await page.goto('/#/atlas?view=research');
  await expect(page.getByRole('heading', { name: 'Research with an address.' })).toBeVisible();
  await page.getByRole('searchbox', { name: 'Research search', exact: true }).fill('daily oxygen');
  await expect(page.getByRole('heading', { name: 'Daily oxygen correction', exact: true })).toBeVisible();
  await expect(page.getByText('Printed p.6 · PDF p.14 · 1.2 Experimental Hardware', { exact: true })).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original PDF at cited page', exact: true })).toHaveAttribute('href', /TM-20210011385.pdf#page=14$/);
  await page.getByRole('button', { name: 'Reset research filters', exact: true }).click();
  await page.getByRole('combobox', { name: 'Investigation', exact: true }).selectOption('PSI-69');
  await expect(page.getByText('8 results · 0 experimental records / 8 research findings in this search. These counts are separate.', { exact: true })).toBeVisible();
  await page.getByRole('combobox', { name: 'Evidence type', exact: true }).selectOption('experiment');
  await expect(page.getByText(/No research matches these filters/)).toBeVisible();
  await expect(page.getByText(/Not numerically comparable: solid-fuel/)).toBeVisible();
});

test('original record navigation, discovery and actual JSON export', async ({ page }) => {
  await page.goto('/#/atlas?view=research');
  await page.getByRole('combobox', { name: 'Evidence type', exact: true }).selectOption('experiment');
  await page.getByRole('searchbox', { name: 'Research search', exact: true }).fill('BASS2-B1');
  await page.getByRole('link', { name: 'Inspect unchanged experiment and provenance →', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page.getByRole('dialog')).toContainText('22.2');
  await page.keyboard.press('Escape');
  await page.getByRole('button', { name: 'Research findings & coverage', exact: true }).click();
  const pending = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Download research findings and source manifest (JSON)', exact: true }).click();
  const download = await pending;
  expect(download.suggestedFilename()).toBe('firetrace-research.json');
  const path = await download.path();
  const { readFile } = await import('node:fs/promises');
  const exported = JSON.parse(await readFile(path!, 'utf8'));
  expect(exported.findings).toHaveLength(16);
  expect(exported.sources).toHaveLength(8);
  expect(exported.findings.every((f: { experiment_ids: string[] }) => f.experiment_ids.length === 0)).toBe(true);
});
