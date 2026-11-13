const { chromium } = require('playwright');

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ ignoreHTTPSErrors: true });
  const page = await ctx.newPage();
  const calls = [];
  page.on('response', async (res) => {
    const u = res.url();
    if (u.includes('geode') || u.includes('api') || u.includes('download')) {
      calls.push(`${res.status()} ${res.request().method()} ${u}`);
    }
  });
  await page.goto('https://psi.nasa.gov/physci/repo/data/investigations/PSI-25', { waitUntil: 'networkidle', timeout: 90000 }).catch(e => console.error('goto', e.message));
  await page.waitForTimeout(5000);
  console.log('URL:', page.url());
  console.log('TITLE:', await page.title());
  const text = await page.innerText('body').catch(() => '');
  console.log('TEXT STARTS:\n', text.slice(0, 3000));
  console.log('\nCALLS:\n' + calls.join('\n'));
  await page.screenshot({ path: 'psi25.png', fullPage: true });
  await browser.close();
})();
