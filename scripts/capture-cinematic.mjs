// Genuine browser capture, including a native Playwright WebM; no generated media.
import {chromium, firefox, webkit, expect} from '@playwright/test';
import {mkdir, writeFile} from 'node:fs/promises';
const base=process.env.FIRETRACE_CAPTURE_URL ?? 'http://127.0.0.1:5212';
const out='docs/evidence/pr9/after';await mkdir(out,{recursive:true});await mkdir('tmp/cinematic-video',{recursive:true});
const results=[];
for(const [name,engine] of Object.entries({chromium,firefox,webkit})){
 const browser=await engine.launch();
 try{
  const context=await browser.newContext({viewport:{width:1440,height:1000},...(name==='chromium'?{recordVideo:{dir:'tmp/cinematic-video',size:{width:1440,height:1000}}}:{})});
  const page=await context.newPage();const errors=[];page.on('pageerror',error=>errors.push(error.message));
  await page.goto(base+'/#/overview');await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion','running');
  await expect(page.locator('.cinema-scene')).toHaveCount(6);
  const film=page.locator('.film__sound');await expect(film).toHaveAttribute('aria-pressed','false');
  if(name==='chromium'){
   await page.screenshot({path:`${out}/hero-live.png`});
   for(const scene of ['problem','context','records','gaps','workflow','begin']){
    const node=page.locator(`[data-scene="${scene}"]`);await node.scrollIntoViewIfNeeded();await expect(node.locator('h3')).toBeVisible();
    // Hold the first original SVG flight long enough to capture real motion in the recording.
    await page.waitForTimeout(scene==='problem'?4500:800);
    await node.screenshot({path:`${out}/scene-${scene}.png`});
   }
   await page.evaluate(()=>window.scrollTo({top:0,behavior:'instant'}));
   await page.getByRole('button',{name:'Pause decorative motion'}).click();
   await expect(page.locator('.cinema-space--hero')).toHaveAttribute('data-motion','paused');
   await page.screenshot({path:`${out}/paused.png`});
  }
  await page.locator('.cinema-scene--begin').getByRole('link',{name:'Open Evidence Atlas'}).click();await expect(page.locator('h1')).toContainText('Every record');
  await page.goBack();await expect(page.locator('.cinema-story')).toBeVisible();
  await page.goto(base+'/#/atlas?view=research');
  await page.getByRole('combobox',{name:'Evidence type',exact:true}).selectOption('experiment');
  await page.getByRole('searchbox',{name:'Research search',exact:true}).fill('BASS2-B1');
  await page.getByRole('link',{name:'Inspect unchanged experiment and provenance →',exact:true}).click();
  await expect(page.getByRole('dialog')).toContainText('22.2');await page.keyboard.press('Escape');
  for(const [route,heading] of [['graph','Every claim has a'],['notebook','Keep the question'],['reports','A report that']]){
   await page.goto(base+'/#/'+route);await expect(page.locator('h1')).toContainText(heading);
  }
  expect(errors).toEqual([]);results.push({browser:name,status:'PASS',checks:'Six-scene story, motion boundary, muted film, actual CTA, Back, Research-to-BASS2-B1 drawer, Graph/Notebook/Reports',uncaughtErrors:errors});
  const video=name==='chromium'?page.video():null;await context.close();
  if(video)await video.saveAs(`${out}/cinematic-walkthrough.webm`);
  if(name==='chromium'){
   for(const [label,width,reduced] of [['mobile',390,false],['reduced-motion',1440,true]]){
    const c=await browser.newContext({viewport:{width,height:1000},reducedMotion:reduced?'reduce':'no-preference'});const p=await c.newPage();
    await p.goto(base+'/#/overview');await expect(p.locator('.cinema-space--hero')).toHaveAttribute('data-motion','static');await p.screenshot({path:`${out}/${label}-hero.png`});
    for(const scene of ['problem','records','begin']){const n=p.locator(`[data-scene="${scene}"]`);await n.scrollIntoViewIfNeeded();await n.screenshot({path:`${out}/${label}-${scene}.png`});}
    expect(await p.evaluate(()=>document.documentElement.scrollWidth<=document.documentElement.clientWidth)).toBe(true);await c.close();
   }
  }
 }finally{await browser.close();}
}
await writeFile('docs/evidence/pr9/cross-browser.json',JSON.stringify(results,null,2)+'\n');console.log(JSON.stringify(results,null,2));
