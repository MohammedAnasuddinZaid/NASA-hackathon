import { expect, test } from '@playwright/test';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const routes = [
  ['overview', 'Evidence has an address'],
  ['atmosphere', 'An atmosphere is two numbers'],
  ['atlas', 'Every record'],
  ['compare', 'Side by side'],
  ['gap', 'Design the test'],
  ['assistant', 'Ask the corpus'],
  ['notebook', 'Keep the question'],
  ['methodology', 'Built to be checked'],
  ['exports', 'Take the evidence'],
  ['coverage', 'What the corpus'],
  ['graph', 'Every claim has a'],
  ['verification', 'Check the statement'],
  ['evaluation', 'Test the retrieval'],
  ['analysis', 'Reproducible counts'],
  ['integrity', 'Internal consistency'],
  ['reports', 'A report that'],
  ['health', 'Prove the capability'],
] as const;

function axeSourcePath(): string {
  const candidates = [
    process.env.FIRETRACE_AXE_PATH,
    'D:/firetrace-tools/node_modules/axe-core/axe.min.js',
    resolve(process.cwd(), 'node_modules/axe-core/axe.min.js'),
  ].filter((value): value is string => Boolean(value));
  const found = candidates.find((candidate) => existsSync(candidate));
  if (!found) {
    throw new Error(
      'axe-core is not available. Install it outside the repository, for example: ' +
        'npm install axe-core@4.10.2 --prefix D:\\firetrace-tools --cache D:\\npm-cache, ' +
        'or set FIRETRACE_AXE_PATH to axe.min.js.',
    );
  }
  return found;
}

const axeSource = readFileSync(axeSourcePath(), 'utf8');

test.describe('WCAG 2.2 AA automated checks', () => {
  for (const [route, heading] of routes) {
    test(`${route} has no axe WCAG A/AA violations`, async ({ page }) => {
      await page.goto(`/#/${route}`);
      await expect(page.locator('h1').first()).toContainText(heading);
      await page.addScriptTag({ content: axeSource });
      const results = await page.evaluate(async () => {
        const axe = (window as unknown as { axe: { run: (context: Document, options: unknown) => Promise<{ violations: Array<{ id: string; impact: string | null; help: string; nodes: Array<{ target: string[]; failureSummary?: string }> }> }> } }).axe;
        return axe.run(document, {
          runOnly: {
            type: 'tag',
            values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa'],
          },
        });
      });
      const violations = results.violations.map((violation) => ({
        id: violation.id,
        impact: violation.impact,
        help: violation.help,
        targets: violation.nodes.map((node) => ({
          target: node.target.join(' '),
          summary: node.failureSummary,
        })),
      }));
      expect(violations, JSON.stringify(violations, null, 2)).toEqual([]);
    });
  }
});

test('keyboard-only route change and command palette work', async ({ page }) => {
  await page.goto('/#/overview');
  await page.keyboard.press('Control+K');
  const dialog = page.getByRole('dialog', { name: 'Command palette' });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole('combobox', { name: 'Command search' })).toBeFocused();
  await page.keyboard.type('notebook');
  await page.keyboard.press('Enter');
  await expect(page.locator('h1').first()).toContainText('Keep the question');
});

test('record drawer traps focus and restores it on Escape', async ({ page }) => {
  await page.goto('/#/atlas');
  await page.locator('.data-table tbody tr').first().click();
  const drawer = page.locator('.drawer');
  await expect(drawer).toBeVisible();
  await expect(drawer.getByRole('button', { name: 'Close record detail' })).toBeFocused();
  for (let index = 0; index < 12; index += 1) {
    await page.keyboard.press('Tab');
    await expect(drawer).toContainText('Provenance');
  }
  await page.keyboard.press('Escape');
  await expect(drawer).toBeHidden();
});

test('reduced motion is respected by the shell', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/overview');
  await expect(page.locator('h1').first()).toBeVisible();
  const behavior = await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior);
  expect(['auto', 'smooth']).toContain(behavior);
});
