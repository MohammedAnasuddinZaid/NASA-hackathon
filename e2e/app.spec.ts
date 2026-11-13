import { expect, test } from '@playwright/test';

const routes = [
  ['Overview', '/#/overview', 'Fire changes when gravity lets go'],
  ['Atmosphere', '/#/atmosphere', 'An atmosphere is two numbers'],
  ['Evidence Atlas', '/#/atlas', 'Every record'],
  ['Compare', '/#/compare', 'Side by side'],
  ['Gap Planner', '/#/gap', 'Design the test'],
  ['Evidence Assistant', '/#/assistant', 'Ask the corpus'],
  ['Methodology', '/#/methodology', 'Built to be checked'],
  ['Exports', '/#/exports', 'Take the evidence'],
] as const;

test.describe('route smoke', () => {
  for (const [name, path, heading] of routes) {
    test(`${name} renders without console or page errors`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (message) => {
        if (message.type() === 'error') errors.push(`console: ${message.text()}`);
      });
      page.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

      await page.goto(path);
      await expect(page.locator('h1').first()).toContainText(heading);
      await expect(page.locator('h1').first()).toBeVisible();
      await expect(page).toHaveTitle(/FIRETRACE/);
      expect(errors).toEqual([]);
    });
  }
});

test('Atlas exact-ID search narrows to one row and opens its provenance drawer', async ({ page }) => {
  await page.goto('/#/atlas');
  const search = page.locator('input[type="search"]');
  await search.fill('BASS2-B1');
  await expect(page.locator('.atlas-summary__count strong')).toHaveText('1');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await expect(page.locator('.data-table tbody tr').first()).toContainText('BASS2-B1');

  await page.locator('.data-table tbody tr').first().click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toBeVisible();
  await expect(page.locator('#drawer-title')).toHaveText('BASS2-B1');
  await expect(drawer).toContainText('Total pressure');
  await expect(drawer).toContainText('Not reported');
  await expect(drawer).toContainText('PSI-25');
  await expect(drawer).toContainText('10.60555/4qc4-de67');

  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('Atlas investigation filter shows only the two Saffire records', async ({ page }) => {
  await page.goto('/#/atlas');
  await page.locator('.filter-grid select').first().selectOption('Saffire-I');
  await expect(page.locator('.atlas-summary__count strong')).toHaveText('2');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
  await expect(page.locator('.data-table tbody')).toContainText('SAFFIRE1-S1');
  await expect(page.locator('.data-table tbody')).toContainText('SAFFIRE1-S2');
  await expect(page.locator('.data-table tbody')).not.toContainText('BASS2-B1');
});

test('Compare states the comparability blockers before the numbers', async ({ page }) => {
  await page.goto('/#/compare');
  await expect(page.locator('.comparability h2')).toContainText('5 blockers');
  await expect(page.locator('.check-grid')).toContainText('No selected record reports total pressure');
  await expect(page.locator('.check-grid')).toContainText('No selected record has a measured g-level');
  await expect(page.locator('.compare-table')).toContainText('Not reported');
  await expect(page.locator('.comparability__note')).toContainText('No similarity score');
});

test('Assistant answers pressure with abstention and refuses a safety question', async ({ page }) => {
  await page.goto('/#/assistant');
  await page.locator('.suggestion').first().click();

  const firstAnswer = page.locator('.message--assistant').first();
  await expect(firstAnswer.locator('.badge').first()).toHaveText('Evidence absent');
  await expect(firstAnswer.locator('h3')).toContainText('0 of 131');
  await expect(firstAnswer).toContainText('No external model was called');
  await expect(firstAnswer.locator('.answer__citations')).toContainText('PSI-25');
  await expect(firstAnswer.locator('.answer__citations')).toContainText('PSI-98');

  await page.locator('#assistant-input').fill('Is PMMA safe in a lunar cabin?');
  await page.locator('.ask-form button').click();
  const secondAnswer = page.locator('.message--assistant').nth(1);
  await expect(secondAnswer.locator('.badge').first()).toHaveText('Outside scope');
  await expect(secondAnswer.locator('h3')).toContainText('does not predict fire risk');
});

test('Gap Planner computes the target ppO2 and labels the missing evidence', async ({ page }) => {
  await page.goto('/#/gap');
  await expect(page.locator('.target-readout strong')).toContainText('3.06');
  await expect(page.locator('.target-readout')).toContainText('10.2 psia × 30% O2');
  await expect(page.locator('.gap-callout')).toContainText('not directly evidenced');
  await expect(page.locator('.evidence-rows')).toContainText('Atmosphere · total pressure');
  await expect(page.locator('.evidence-rows')).toContainText('NTRS 20250010653');
  const absentBadges = page.locator('.evidence-row .badge', { hasText: 'Absent' });
  await expect(absentBadges.first()).toBeVisible();
});

test('Exports switches scope and previews only the selected records', async ({ page }) => {
  await page.goto('/#/exports');
  await expect(page.locator('.export-preview')).toContainText('131 rows · 23 columns');
  await page.getByRole('tab', { name: /Saffire-I/ }).click();
  await expect(page.locator('.export-preview')).toContainText('2 rows · 23 columns');
  await expect(page.locator('.export-preview pre')).toContainText('SAFFIRE1-S1');
  await expect(page.locator('.export-preview pre')).toContainText('SAFFIRE1-S2');
  await expect(page.locator('.export-preview pre')).not.toContainText('BASS2-B1');
});

test('the loaded app keeps working with the network offline', async ({ page, context }) => {
  await page.goto('/#/overview');
  await expect(page.locator('h1').first()).toBeVisible();
  await context.setOffline(true);
  await page.locator('a[href="#/atlas"]').first().click();
  await expect(page.locator('h1').first()).toContainText('Every record');
  await page.locator('input[type="search"]').fill('SAFFIRE1-S1');
  await expect(page.locator('.data-table tbody tr')).toHaveCount(1);
  await context.setOffline(false);
});

test('mobile layout has no page-level horizontal overflow', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  for (const path of ['/#/overview', '/#/atlas', '/#/atmosphere']) {
    await page.goto(path);
    await expect(page.locator('h1').first()).toBeVisible();
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, `horizontal overflow on ${path}`).toBeLessThanOrEqual(1);
  }
});
