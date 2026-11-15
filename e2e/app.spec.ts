import { expect, test } from '@playwright/test';
// Keep this original suite deterministic in bundled mode; real API tests are separate.

const routes = [
  ['Overview', '/#/overview', 'Evidence has an address'],
  ['Atmosphere', '/#/atmosphere', 'An atmosphere is two numbers'],
  ['Evidence Atlas', '/#/atlas', 'Every record'],
  ['Compare', '/#/compare', 'Side by side'],
  ['Gap Planner', '/#/gap', 'Design the test'],
  ['Evidence Assistant', '/#/assistant', 'Ask the corpus'],
  ['Methodology', '/#/methodology', 'Built to be checked'],
  ['Exports', '/#/exports', 'Take the evidence'],
  ['Coverage', '/#/coverage', 'What the corpus'],
  ['Research Notebook', '/#/notebook', 'Keep the question'],
  ['Evidence Graph', '/#/graph', 'Every claim has a'],
  ['Verification Center', '/#/verification', 'Check the statement'],
  ['Evaluation Harness', '/#/evaluation', 'Test the retrieval'],
  ['Analysis Runs', '/#/analysis', 'Reproducible counts'],
  ['Corpus Integrity', '/#/integrity', 'Internal consistency'],
  ['Reports', '/#/reports', 'A report that'],
  ['System Health', '/#/health', 'Prove the capability'],
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
  await expect(page.locator('.comparability h2')).toContainText('blockers to a direct comparison');
  await expect(page.locator('.comparability .check-grid')).toContainText('No selected record reports total pressure');
  await expect(page.locator('.comparability .check-grid')).toContainText('No selected record has a measured g-level');
  await expect(page.locator('.compare-table').first()).toContainText('Missing');
  await expect(page.locator('.comparability__note')).toContainText('No similarity score');
});

test('Assistant answers pressure with abstention and refuses a safety question', async ({ page }) => {
  await page.goto('/#/assistant');
  await page.locator('.suggestion').first().click();

  const firstAnswer = page.locator('.message--assistant').first();
  await expect(firstAnswer.locator('.badge').first()).toHaveText('Evidence absent');
  await expect(firstAnswer.locator('h3')).toContainText('0 of 131');
  await expect(firstAnswer).toContainText('No external model');
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

test('film narration follows play, pause, mute and chapter changes', async ({ page }) => {
  await page.goto('/#/overview');
  await page.locator('.film').scrollIntoViewIfNeeded();

  const audios = page.locator('.film audio');
  await expect(audios).toHaveCount(5);
  await expect
    .poll(() =>
      audios.evaluateAll((nodes) =>
        nodes.every((node) => {
          const duration = (node as HTMLAudioElement).duration;
          return Number.isFinite(duration) && duration > 4.5 && duration < 9.5;
        }),
      ),
    )
    .toBe(true);

  // A blocked-autoplay prompt may appear depending on browser policy.
  if (await page.locator('.film__unmute').isVisible().catch(() => false)) {
    await page.locator('.film__unmute').click();
  }

  await page.locator('.film__chapter').first().click();
  await expect
    .poll(() => audios.nth(0).evaluate((node) => !(node as HTMLAudioElement).paused))
    .toBe(true);

  await page.locator('.film__button--play').click();
  await expect
    .poll(() => audios.nth(0).evaluate((node) => (node as HTMLAudioElement).paused))
    .toBe(true);

  await page.locator('.film__button--play').click();
  await expect
    .poll(() => audios.nth(0).evaluate((node) => !(node as HTMLAudioElement).paused))
    .toBe(true);

  await page.locator('.film__chapter').nth(3).click();
  await expect
    .poll(() => audios.nth(3).evaluate((node) => !(node as HTMLAudioElement).paused))
    .toBe(true);
  await expect
    .poll(() => audios.nth(0).evaluate((node) => (node as HTMLAudioElement).paused))
    .toBe(true);

  await page.locator('.film__sound').click();
  await expect
    .poll(() => audios.evaluateAll((nodes) => nodes.every((node) => (node as HTMLAudioElement).paused)))
    .toBe(true);

  await page.locator('.film__sound').click();
  await expect
    .poll(() => audios.nth(3).evaluate((node) => !(node as HTMLAudioElement).paused))
    .toBe(true);
});

test('film offers a sound prompt when autoplay is blocked', async ({ page }) => {
  await page.addInitScript(() => {
    const state = window as unknown as { __allowPlay?: boolean };
    state.__allowPlay = false;
    document.addEventListener('click', () => {
      state.__allowPlay = true;
    }, true);
    const original = HTMLMediaElement.prototype.play;
    HTMLMediaElement.prototype.play = function play() {
      if (!state.__allowPlay) {
        return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
      }
      return original.call(this);
    };
  });

  await page.goto('/#/overview');
  await page.locator('.film').scrollIntoViewIfNeeded();

  await expect(page.locator('.film__unmute')).toBeVisible();
  await expect(page.locator('.film__head-meta')).toContainText('Tap for sound');
  await expect(page.locator('.film audio').first()).toBeAttached();
  expect(
    await page.locator('.film audio').first().evaluate((node) => (node as HTMLAudioElement).paused),
  ).toBe(true);

  await page.locator('.film__unmute').click();
  await expect(page.locator('.film__unmute')).toBeHidden();
  await expect(page.locator('.film__head-meta')).toContainText('Voiceover');
  await expect
    .poll(() =>
      page.locator('.film audio').first().evaluate((node) => !(node as HTMLAudioElement).paused),
    )
    .toBe(true);
});


test('Saffire export quality summary follows the selected scope', async ({ page }) => {
  await page.goto('/#/exports');
  await page.getByRole('tab', { name: 'Saffire-I 2', exact: true }).click();
  await expect(page.getByText('0 validated / 2 partial / 0 suspect (selected)', { exact: true })).toBeVisible();
});

test('specific burn-time question is direct evidence', async ({ page }) => {
  await page.goto('/#/assistant');
  await page.getByRole('textbox', { name: 'Ask the evidence assistant' }).fill('What burn time did SAFFIRE1-S2 report?');
  await page.getByRole('button', { name: 'Retrieve', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'SAFFIRE1-S2 reports burn time: 70 s.', exact: true })).toBeVisible();
  await expect(page.getByText('Direct evidence', { exact: true })).toBeVisible();
});


test('record provenance exposes corrected values, original files and missing-value scope', async ({ page }) => {
  await page.goto('/#/atlas');
  await page.locator('input[type="search"]').fill('BASS2-B1');
  await page.getByRole('row', { name: 'Open BASS2-B1', exact: true }).click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toContainText('Reported · corrected');
  await expect(drawer).toContainText('Original token: 22.2');
  await expect(drawer).toContainText('not absent from all NASA research');
  const original = drawer.getByRole('link', { name: 'Download preserved NASA CSV original' });
  const [download] = await Promise.all([page.waitForEvent('download'), original.click()]);
  const { readFile } = await import('node:fs/promises');
  const { createHash } = await import('node:crypto');
  const bytes = await readFile((await download.path())!);
  expect(createHash('sha256').update(bytes).digest('hex')).toBe('71e792bf6b5fb5ea620c5dd70fbbac05515992e12aefcf5dff47312caa48c042');
});

test('methodology scopes table omissions against report context', async ({ page }) => {
  await page.goto('/#/methodology');
  await expect(page.getByLabel('Evidence scope')).toContainText('table-coverage gap');
  await expect(page.getByText(/Printed p.38/).first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Original report PDF (NASA)', exact: true })).toHaveAttribute('href', /ntrs.nasa.gov/);
});


test('demo uses real oxygen values and the real B1 source row', async ({ page }) => {
  await page.goto('/#/overview');
  await page.getByRole('button', { name: '01 The problem', exact: true }).click();
  await expect(page.locator('.fm-tr').filter({ hasText: 'BASS2-B1' })).toContainText('22.2');
  await expect(page.locator('.fm-drawer')).toContainText('CSV row 2, test B1');
  await expect(page.locator('.fm-drawer')).not.toContainText('row 14');
});
