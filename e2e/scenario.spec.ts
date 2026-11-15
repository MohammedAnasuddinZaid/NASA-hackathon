import { expect, test } from '@playwright/test';

test('scenario candidates, explanations, selection, Atlas, and return state', async ({ page }) => {
  await page.goto('/#/gap');
  await page
    .getByRole('combobox', { name: 'Material family (hypothetical target)', exact: true })
    .fill('PMMA film');
  await page.getByRole('spinbutton', { name: 'Oxygen (% by vol)', exact: true }).fill('22.2');
  await page.getByRole('spinbutton', { name: 'Flow velocity (cm/s)', exact: true }).fill('5');
  await expect(page.locator('.scenario-candidate').first()).toContainText('BASS2-B1');
  await page.getByText('Condition explanations for BASS2-B1', { exact: true }).click();
  await expect(page.locator('.scenario-candidate').first()).toContainText(
    'Missing experimental value',
  );
  await page.getByRole('checkbox', { name: 'Select BASS2-B1 for comparison', exact: true }).check();
  await page
    .locator('.scenario-candidate')
    .first()
    .getByRole('link', { name: 'Open in Atlas', exact: true })
    .click();
  await expect(page.getByRole('dialog')).toContainText('BASS2-B1');
  await page.keyboard.press('Escape');
  await page.getByRole('link', { name: 'Return to saved scenario', exact: false }).click();
  await expect(
    page.getByRole('spinbutton', { name: 'Oxygen (% by vol)', exact: true }),
  ).toHaveValue('22.2');
  await expect(
    page.getByRole('checkbox', { name: 'Select BASS2-B1 for comparison', exact: true }),
  ).toBeChecked();
  await page.getByRole('link', { name: 'Compare selected records', exact: false }).click();
  await expect(page.locator('.selected-chips')).toContainText('BASS2-B1');
  await expect(
    page.getByText('Differences relative to the first selected record', { exact: true }),
  ).toBeVisible();
});

test('invalid targets and no-credit filters produce explicit states', async ({ page }) => {
  await page.goto('/#/gap');
  await page.getByRole('spinbutton', { name: 'Oxygen (% by vol)', exact: true }).fill('101');
  await expect(page.getByRole('alert')).toContainText('Initial oxygen');
  await page.getByRole('spinbutton', { name: 'Oxygen (% by vol)', exact: true }).fill('100');
  await page.getByRole('spinbutton', { name: 'Flow velocity (cm/s)', exact: true }).fill('');
  await page
    .getByRole('checkbox', { name: 'Include records with no retrieval credit', exact: true })
    .uncheck();
  await expect(
    page.getByText('No candidate records under these conditions', { exact: true }),
  ).toBeVisible();
});

test('comparison direction and method differences retain original sources', async ({ page }) => {
  await page.goto('/#/compare?ids=SAFFIRE1-S1,SAFFIRE1-S2');
  await expect(page.locator('.comparability .check-grid')).toContainText('Concurrent versus Opposed');
  await expect(page.locator('.compare-table').first()).toContainText('Different');
  await page.getByRole('button', { name: 'Inspect SAFFIRE1-S1 provenance', exact: true }).click();
  await expect(page.getByRole('dialog')).toContainText('21.5 - 21.7');
  await page.keyboard.press('Escape');
  await page.goto('/#/compare?ids=BASS2-B1,SAFFIRE1-S1');
  await expect(page.locator('.selected-chips')).toContainText('BASS2-B1');
  await expect(page.locator('.selected-chips')).not.toContainText('SAFFIRE1-S2');
});
