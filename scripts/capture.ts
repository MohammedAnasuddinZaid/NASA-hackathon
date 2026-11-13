import { chromium } from '@playwright/test';
import { mkdirSync, rmSync } from 'node:fs';

const base = process.env.BASE_URL ?? 'http://localhost:4173';
const out = 'presentation/screenshots';

rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });

const browser = await chromium.launch();
const errors: string[] = [];

const desktop = await browser.newPage({
  viewport: { width: 1440, height: 1000 },
  deviceScaleFactor: 1,
});
desktop.on('console', (message) => {
  if (message.type() === 'error') errors.push(`console: ${message.text()}`);
});
desktop.on('pageerror', (error) => errors.push(`pageerror: ${error.message}`));

const routes = [
  ['overview', '/#/overview'],
  ['atmosphere', '/#/atmosphere'],
  ['atlas', '/#/atlas'],
  ['compare', '/#/compare'],
  ['gap', '/#/gap'],
  ['assistant', '/#/assistant'],
  ['methodology', '/#/methodology'],
  ['exports', '/#/exports'],
] as const;

for (const [name, path] of routes) {
  await desktop.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await desktop.waitForTimeout(550);
  await desktop.evaluate(() => {
    window.scrollTo(0, 0);
    (document.activeElement as HTMLElement | null)?.blur();
  });
  await desktop.waitForTimeout(150);
  await desktop.screenshot({ path: `${out}/${name}.png`, fullPage: true });
  const heading = (await desktop.locator('h1').first().textContent())?.replace(/\s+/g, ' ').trim();
  console.log(`${name.padEnd(12)} ${heading?.slice(0, 72)}`);
}

await desktop.goto(`${base}/#/atlas`, { waitUntil: 'networkidle' });
await desktop.locator('input[type="search"]').fill('BASS2-B1');
await desktop.locator('.data-table tbody tr').first().click();
await desktop.waitForTimeout(450);
await desktop.screenshot({ path: `${out}/atlas-drawer.png`, fullPage: false });
console.log(`drawer       ${await desktop.locator('#drawer-title').textContent()}`);

await desktop.goto(`${base}/#/assistant`, { waitUntil: 'networkidle' });
await desktop.evaluate(() => {
  (Element.prototype as { scrollIntoView?: () => void }).scrollIntoView = () => {};
});
await desktop.locator('.suggestion').first().click();
await desktop.waitForTimeout(550);
await desktop.evaluate(() => {
  window.scrollTo(0, 0);
  (document.activeElement as HTMLElement | null)?.blur();
});
await desktop.waitForTimeout(250);
await desktop.screenshot({ path: `${out}/assistant-answer.png`, fullPage: true });
console.log(`assistant    ${await desktop.locator('.answer .badge').first().textContent()}`);

const mobile = await browser.newPage({
  viewport: { width: 390, height: 844 },
  deviceScaleFactor: 2,
});
mobile.on('console', (message) => {
  if (message.type() === 'error') errors.push(`mobile console: ${message.text()}`);
});
mobile.on('pageerror', (error) => errors.push(`mobile pageerror: ${error.message}`));

for (const [name, path] of [
  ['overview', '/#/overview'],
  ['atlas', '/#/atlas'],
  ['compare', '/#/compare'],
  ['assistant', '/#/assistant'],
] as const) {
  await mobile.goto(`${base}${path}`, { waitUntil: 'networkidle' });
  await mobile.waitForTimeout(450);
  await mobile.screenshot({ path: `${out}/mobile-${name}.png`, fullPage: true });
}

await browser.close();

if (errors.length) {
  console.error('Browser errors:\n' + errors.join('\n'));
  process.exit(1);
}
console.log('No console or page errors.');
