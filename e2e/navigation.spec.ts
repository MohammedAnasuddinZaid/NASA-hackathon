import { expect, test } from '@playwright/test';
const paths = ['overview','atmosphere','atlas','compare','gap','assistant','notebook','methodology','exports','coverage','graph','verification','evaluation','analysis','integrity','reports','health'];

for (const width of [320, 390, 714, 768, 1024, 1440, 1920]) test(`page tabs remain available at ${width}px`, async ({page}) => {
  await page.setViewportSize({width,height:1000});
  await page.goto('/#/overview');
  const nav=page.getByRole('navigation',{name:'Primary sections',exact:true});
  await expect(nav).toBeVisible();
  await expect(nav.getByRole('link')).toHaveCount(17);
  for (const path of paths) await expect(nav.locator(`a[href="#/${path}"]`)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  await nav.locator('a[href="#/graph"]').click();
  await expect(page.locator('h1')).toContainText('Every claim has a');
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  const last=nav.locator('a[href="#/health"]');await last.focus();
  expect(await last.evaluate(node=>{const item=node.getBoundingClientRect(),nav=node.closest('nav')!.getBoundingClientRect();return item.left>=nav.left-1&&item.right<=nav.right+1;})).toBe(true);
  await page.keyboard.press('Enter');await expect(page.locator('h1')).toContainText('Prove the capability');
  await expect(last).toHaveAttribute('aria-current','page');
  expect(await page.locator('main').evaluate(node=>node.firstElementChild!.getBoundingClientRect().top >= document.querySelector('header')!.getBoundingClientRect().bottom)).toBe(true);
});

test('every page tab navigates and identifies the active page without opening Menu',async({page})=>{
  await page.goto('/#/overview');
  const nav=page.getByRole('navigation',{name:'Primary sections',exact:true});
  for(const path of paths){const link=nav.locator(`a[href="#/${path}"]`);await link.click();await expect.poll(()=>new URL(page.url()).hash.split('?')[0]).toBe('#/'+path);await expect(link).toHaveAttribute('aria-current','page');await expect(page.locator('h1')).not.toBeEmpty();}
  await page.setViewportSize({width:390,height:900});
  await expect.poll(()=>nav.locator('[aria-current="page"]').evaluate(node=>{const a=node.getBoundingClientRect(),b=node.closest('nav')!.getBoundingClientRect();return a.left>=b.left-1&&a.right<=b.right+1;})).toBe(true);
});
