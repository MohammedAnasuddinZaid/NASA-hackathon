import { expect, test } from '@playwright/test';
import { readFileSync } from 'node:fs';
const corpus = JSON.parse(readFileSync('src/data/corpus.json', 'utf8'));
const sceneNames = ['problem', 'context', 'records', 'gaps', 'workflow', 'begin'];

test('cinematic story preserves source-derived counts, unknowns, original demo and research workflow', async ({ page }) => {
  await page.goto('/#/overview');
  await expect(page.locator('h1')).toHaveText('Evidence has an address.');
  await expect(page.locator('#explainer-film')).toBeAttached();
  expect(await page.locator('.cinema-scene').evaluateAll(nodes => nodes.map(node => node.getAttribute('data-scene')))).toEqual(sceneNames);
  await expect(page.locator('.cinema-counts dd')).toHaveText([
    String(corpus.records.filter((r: any) => r.investigation_acronym === 'BASS-II').length),
    String(corpus.records.filter((r: any) => r.investigation_acronym === 'Saffire-I').length), String(corpus.records.length),
  ]);
  await expect(page.locator('.cinema-missing dd')).toHaveText(['— not reported', '— not reported']);
  await expect(page.locator('.cinema-missing')).toContainText('Zero coverage counts. Unknown measurement values.');
  await expect(page.locator('.cinema-scene[data-scene="problem"] a')).toHaveAttribute('href', /psi\.nasa\.gov.*PSI-25/);
  for (const [label, route] of [['Original sources', 'methodology'], ['Experimental records', 'atlas'], ['Claim verification', 'verification'], ['Research reports', 'reports']]) {
    await page.locator('.cinema-workflow').getByRole('link', { name: new RegExp(label) }).click();
    await expect(page).toHaveURL(new RegExp('#/' + route + '$'));
    await page.goBack();
    await expect(page.locator('.cinema-story')).toBeVisible();
  }
  await page.locator('.cinema-scene--begin').getByRole('link', { name: 'Open Evidence Atlas' }).click();
  await expect(page.locator('h1')).toContainText('Every record');
  await page.goBack();
  await page.locator('.cinema-scene--begin').getByRole('link', { name: 'Open Gap Planner' }).click();
  await expect(page.locator('h1')).toContainText('Design the test');
});

test('motion runs only onscreen and pauses through the keyboard-accessible user control', async ({ page }) => {
  await page.goto('/#/overview');
  const hero = page.locator('.cinema-space--hero');
  await expect(hero).toHaveAttribute('data-motion', 'running');
  const vessel = hero.locator('.cinema-vessel');
  const start = await vessel.evaluate(node => getComputedStyle(node).offsetDistance);
  await expect.poll(() => vessel.evaluate(node => getComputedStyle(node).offsetDistance)).not.toBe(start);
  const pause = page.getByRole('button', { name: 'Pause decorative motion' });
  await pause.focus(); await page.keyboard.press('Enter');
  await expect(page.getByRole('button', { name: 'Resume decorative motion' })).toHaveAttribute('aria-pressed', 'true');
  await expect(hero).toHaveAttribute('data-motion', 'paused');
  expect(await vessel.evaluate(node => getComputedStyle(node).animationPlayState)).toBe('paused');
  await page.keyboard.press('Enter');
  await expect(hero).toHaveAttribute('data-motion', 'running');
  await page.locator('.cinema-scene[data-scene="gaps"]').scrollIntoViewIfNeeded();
  await expect(hero).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(hero).toHaveAttribute('data-motion', 'running');
});

test('hidden document signal pauses and resumes decoration; observers clean up across route changes', async ({ page }) => {
  await page.addInitScript(() => {
    const active = new Set<IntersectionObserver>();
    const NativeObserver = window.IntersectionObserver;
    window.IntersectionObserver = class extends NativeObserver {
      constructor(callback: IntersectionObserverCallback, options?: IntersectionObserverInit) { super(callback, options); active.add(this); }
      disconnect() { active.delete(this); super.disconnect(); }
    };
    let hidden = false;
    Object.defineProperty(document, 'hidden', { configurable: true, get: () => hidden });
    (window as any).cinemaTest = { active, setHidden(value: boolean) { hidden = value; document.dispatchEvent(new Event('visibilitychange')); } };
  });
  await page.goto('/#/overview');
  const hero = page.locator('.cinema-space--hero');
  await expect(hero).toHaveAttribute('data-motion', 'running');
  await page.evaluate(() => (window as any).cinemaTest.setHidden(true));
  await expect(hero).toHaveAttribute('data-motion', 'paused');
  await page.evaluate(() => (window as any).cinemaTest.setHidden(false));
  await expect(hero).toHaveAttribute('data-motion', 'running');
  for (let i = 0; i < 4; i++) {
    await page.locator('.hero__actions a[href="#/atlas"]').click();
    await expect(page.locator('.cinema-story')).toHaveCount(0);
    expect(await page.evaluate(() => (window as any).cinemaTest.active.size)).toBe(0);
    await page.goBack();
    await expect(hero).toHaveAttribute('data-motion', 'running');
  }
});

test('reduced motion is complete and static, including preference changes while open', async ({ page }) => {
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.goto('/#/overview');
  await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion', 'static');
  for (const selector of ['.cinema-stars', '.cinema-vessel', '.cinema-flight-path']) {
    expect(await page.locator(selector).first().evaluate(node => getComputedStyle(node).animationName)).toBe('none');
  }
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe('auto');
  await page.getByRole('button', { name: 'Read the six-scene story ↓' }).click();
  await expect(page.locator('#cinema-story-title')).toBeFocused();
  await expect(page).toHaveURL(/#\/overview$/);
  for (const name of sceneNames) await expect(page.locator(`[data-scene="${name}"] h3`)).toBeVisible();
  await page.emulateMedia({ reducedMotion: 'no-preference' });
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }));
  await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion', 'running');
});

test('without intersection effects every scene and CTA remains available', async ({ page }) => {
  await page.addInitScript(() => { delete (window as any).IntersectionObserver; });
  await page.goto('/#/overview');
  await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion', 'static');
  for (const name of sceneNames) {
    const scene = page.locator(`[data-scene="${name}"]`); await scene.scrollIntoViewIfNeeded();
    await expect(scene.locator('h3')).toBeVisible();
    expect(await scene.locator('.cinema-scene__copy').evaluate(node => getComputedStyle(node).opacity)).toBe('1');
  }
  await page.locator('.cinema-scene--begin').getByRole('link', { name: 'Open Evidence Atlas' }).click();
  await expect(page).toHaveURL(/#\/atlas$/);
});

for (const width of [320, 390, 768, 1440, 1920]) test(`story remains readable with forward/reverse/fast scroll at ${width}px`, async ({ page }) => {
  await page.setViewportSize({ width, height: 900 });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await page.goto('/#/overview');
  for (const name of [...sceneNames, ...[...sceneNames].reverse()]) {
    const scene = page.locator(`[data-scene="${name}"]`); await scene.scrollIntoViewIfNeeded();
    await expect(scene.locator('h3')).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true);
  }
  await page.evaluate(() => { window.scrollTo({ top: document.body.scrollHeight, behavior: 'instant' }); window.scrollTo({ top: 0, behavior: 'instant' }); });
  await expect(page.locator('h1')).toBeVisible(); expect(errors).toEqual([]);
  if (width <= 640) await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion', 'static');
});
