import { expect, test } from '@playwright/test';

test('basket survives navigation/reload, compares selections, generates and downloads all formats', async ({
  page,
}) => {
  await page.goto('/#/atlas');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('BASS2-B1');
  await page.getByRole('button', { name: 'Add BASS2-B1 to basket', exact: true }).press('Enter');
  await expect(page.getByRole('searchbox', { name: 'Search', exact: true })).toHaveValue(
    'BASS2-B1',
  );
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('SAFFIRE1-S1');
  await page.getByRole('button', { name: 'Add SAFFIRE1-S1 to basket', exact: true }).click();
  await page.goto('/#/methodology');
  await page.getByRole('link', { name: 'Evidence basket: 2 records', exact: true }).click();
  await page.reload();
  await expect(
    page.getByRole('heading', { name: 'Evidence basket · 2 records', exact: true }),
  ).toBeVisible();
  await page.getByRole('checkbox', { name: 'Compare BASS2-B1', exact: true }).check();
  await page.getByRole('checkbox', { name: 'Compare SAFFIRE1-S1', exact: true }).check();
  await page.getByRole('link', { name: 'Compare chosen basket records →', exact: true }).click();
  await expect(page.locator('.selected-chips')).toContainText('BASS2-B1');
  await page.getByRole('link', { name: '← Return to evidence basket', exact: true }).click();
  await page.getByRole('button', { name: 'Generate research brief', exact: true }).click();
  const report = page.getByRole('article', { name: 'Generated research brief', exact: true });
  await expect(report).toContainText('22.2');
  await expect(report).toContainText('0/2 available');
  for (const format of ['CSV', 'JSON', 'Markdown', 'printable HTML']) {
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: `Download basket ${format}`, exact: true }).click();
    const file = await downloadPromise;
    expect(file.suggestedFilename()).toContain('firetrace-evidence-brief-');
    expect(await file.failure()).toBeNull();
  }
  await page.getByRole('button', { name: 'Remove BASS2-B1', exact: true }).click();
  await expect(
    page.getByRole('button', { name: 'Download basket JSON', exact: true }),
  ).toBeDisabled();
  await page.getByRole('button', { name: 'Generate research brief', exact: true }).click();
  await expect(report).toContainText('1 selected records');
});

test('clearing requires confirmation and cancellation retains the basket', async ({ page }) => {
  await page.goto('/#/atlas');
  await page.getByRole('searchbox', { name: 'Search', exact: true }).fill('BASS2-B1');
  await page.getByRole('button', { name: 'Add BASS2-B1 to basket', exact: true }).click();
  await page.goto('/#/exports');
  await page.getByRole('button', { name: 'Clear basket', exact: true }).click();
  await page.getByRole('button', { name: 'Cancel', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Evidence basket · 1 records', exact: true }),
  ).toBeVisible();
  await page.getByRole('button', { name: 'Clear basket', exact: true }).click();
  await page.getByRole('button', { name: 'Confirm clear basket', exact: true }).click();
  await expect(page.getByText('Your evidence basket is empty', { exact: true })).toBeVisible();
});
