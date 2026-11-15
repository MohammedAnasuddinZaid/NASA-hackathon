import { expect, test } from '@playwright/test';
const primary = ['overview','atlas','compare','assistant'];
const research = ['atmosphere','gap','coverage','verification','analysis','graph','evaluation','integrity'];
const workspace = ['notebook','reports','exports','methodology','health'];

for (const width of [320,390,714,768,1024,1440,1920]) test(`compact navigation remains usable at ${width}px`,async({page})=>{
  await page.setViewportSize({width,height:1000});await page.goto('/#/overview');
  const nav=page.getByRole('navigation',{name:'Primary sections',exact:true});
  await expect(nav.getByRole('link')).toHaveCount(4);
  for(const path of primary)await expect(nav.locator(`a[href="#/${path}"]`)).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
  expect((await page.locator('header.topbar--primary').boundingBox())!.height).toBeLessThan(170);
  const researchButton=nav.getByRole('button',{name:'Research',exact:true});
  await researchButton.click();await expect(researchButton).toHaveAttribute('aria-expanded','true');
  const panel=page.locator('#nav-research');const box=(await panel.boundingBox())!;expect(box.x).toBeGreaterThanOrEqual(0);expect(box.x+box.width).toBeLessThanOrEqual(width+1);
  await page.keyboard.press('Escape');await expect(researchButton).toBeFocused();await expect(panel).toBeHidden();
  await researchButton.click();await nav.locator('a[href="#/graph"]').click();await expect(page.locator('h1')).toContainText('Every claim has a');
  await expect(researchButton).toHaveClass(/is-active/);await expect(panel).toBeHidden();
  const workspaceButton=nav.getByRole('button',{name:'Workspace',exact:true});await workspaceButton.focus();await page.keyboard.press('ArrowDown');
  await expect(nav.locator('a[href="#/notebook"]')).toBeFocused();await page.keyboard.press('Escape');await expect(workspaceButton).toBeFocused();
  await workspaceButton.click();await page.mouse.click(1,300);await expect(page.locator('#nav-workspace')).toBeHidden();
  await page.getByRole('button',{name:'Menu',exact:true}).click();const menu=page.getByRole('dialog',{name:'All sections menu'});
  await expect(menu).toBeVisible();await expect(menu.locator('.menu__group-toggle[aria-expanded="true"]')).toHaveCount(1);
  const menuBox=(await menu.locator('.menu__panel').boundingBox())!;expect(menuBox.width).toBeLessThanOrEqual(Math.min(width-30,680));
  await page.keyboard.press('Escape');await expect(menu).toBeHidden();
  expect(await page.locator('main').evaluate(node=>node.firstElementChild!.getBoundingClientRect().top>=document.querySelector('header')!.getBoundingClientRect().bottom)).toBe(true);
});

test('every route remains reachable through compact tabs and dropdowns',async({page})=>{
  await page.goto('/#/overview');const nav=page.getByRole('navigation',{name:'Primary sections',exact:true});
  for(const path of [...primary,...research,...workspace]){
    if(research.includes(path))await nav.getByRole('button',{name:'Research',exact:true}).click();
    if(workspace.includes(path))await nav.getByRole('button',{name:'Workspace',exact:true}).click();
    const link=nav.locator(`a[href="#/${path}"]`);await link.click();await expect(link).toHaveAttribute('aria-current','page');await expect(page.locator('h1')).not.toBeEmpty();
  }
});
