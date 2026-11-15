import { expect, test, type Page } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
const corpus = JSON.parse(await readFile('src/data/corpus.json','utf8'));
const version=createHash('sha256').update(await readFile('src/data/corpus.json')).digest('hex');
const pages=['overview','atmosphere','atlas','compare','gap','assistant','methodology','exports','atlas?view=research'];
const titles=['Evidence has an address.','An atmosphere is two numbers. The corpus reports one.','Every record, every gap.','Side by side, without pretending.','Design the test the evidence is missing.','Ask the corpus. It will tell you when it can’t answer.','Built to be checked, not trusted.','Take the evidence with you.','Research with an address.'];
async function open(page:Page, path:string){await page.goto('/#/'+path);await expect(page.locator('h1')).toHaveText(titles[pages.indexOf(path)]);if(path.includes('research'))await expect(page.getByRole('searchbox',{name:'Research search'})).toBeVisible();}
async function download(page:Page,name:string){const pending=page.waitForEvent('download');await page.getByRole('button',{name,exact:true}).click();const file=await pending;expect(await file.failure()).toBeNull();return {name:file.suggestedFilename(),text:await readFile((await file.path())!,'utf8')};}

test('QA01 atmosphere presets, decimal arithmetic, sliders and invalid input never silently clamp',async({page})=>{
 await open(page,'atmosphere');
 for(const preset of corpus.presets){await page.locator('.preset').filter({hasText:preset.label}).click();await expect(page.locator('.composition-readout__main')).toContainText((preset.pressure_psia*preset.oxygen_pct/100).toFixed(2));}
 for(const [p,o] of [[2,5],[16,100],[10.2,30],[14.7,20.95],[8.25,33.33]]){
  await page.locator('#pressure-number').fill(String(p));await page.locator('#oxygen-number').fill(String(o));await expect(page.locator('.composition-readout__main')).toContainText((p*o/100).toFixed(2));
 }
 for(const value of ['','-1','100']){await page.locator('#pressure-number').fill(value);await expect(page.getByRole('alert')).toBeVisible();await expect(page.locator('.composition-readout__main')).toContainText('—');}
 await page.locator('#pressure-number').fill('10.2');for(const value of ['','0','101']){await page.locator('#oxygen-number').fill(value);await expect(page.getByRole('alert')).toBeVisible();}
 await page.locator('#oxygen').fill('40');await expect(page.locator('#oxygen-number')).toHaveValue('40');await expect(page.locator('.composition-readout__main')).toContainText('4.08');
 await page.screenshot({path:'docs/evidence/local-qa/atmosphere.png'});
});
test('QA02 skip link preserves route; menu contains keyboard focus and every menu link navigates',async({page})=>{
 await open(page,'atlas');await page.getByRole('link',{name:'Skip to content'}).press('Enter');await expect(page).toHaveURL(/#\/atlas$/);await expect(page.locator('main')).toBeFocused();
 await page.getByRole('button',{name:'Menu',exact:true}).click();const menu=page.getByRole('dialog',{name:'All sections menu'});await expect(menu).toBeVisible();await expect(menu.getByRole('button',{name:'Close',exact:true})).toBeFocused();
 for(let i=0;i<22;i++){await page.keyboard.press(i%3===0?'Shift+Tab':'Tab');expect(await menu.evaluate(e=>e.contains(document.activeElement))).toBe(true);}
 await page.keyboard.press('Escape');await expect(menu).toBeHidden();await expect(page.getByRole('button',{name:'Menu',exact:true})).toBeFocused();
 for(const path of [...pages.slice(0,8),'coverage','notebook','graph','verification','evaluation','analysis','integrity','reports','health']){await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(menu).toBeVisible();const target=menu.locator(`a[href="#/${path}"]`);const toggle=target.locator('xpath=ancestor::div[contains(@class,"menu__group")]').getByRole('button');if(await toggle.getAttribute('aria-expanded')!=='true')await toggle.click();await expect(target).toBeVisible();await target.click();await expect(page).toHaveURL(new RegExp('#/'+path+'(?:\\?|$)'));if(pages.includes(path))await expect(page.locator('h1')).toHaveText(titles[pages.indexOf(path)]);else await expect(page.locator('h1')).not.toBeEmpty();await expect(menu).toBeHidden();}
});
test('QA03 Atlas all filters, all sorts, pagination, reset and bounded search',async({page})=>{
 await open(page,'atlas');await expect(page.getByTestId('evidence-connection')).toContainText('API connected');
 await page.getByRole('button',{name:'Next →',exact:true}).click();await expect(page.locator('.filter-foot')).toContainText('page 2');await page.getByRole('button',{name:'← Previous',exact:true}).click();
 for(const query of ['  bass2-b1  ','Bhattacharjee','PMMA','%_\'','NOT-FOUND-999']){await page.getByRole('combobox',{name:'Search',exact:true}).fill(query);await expect(page.getByTestId('evidence-connection')).toContainText('API connected');}
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();
 await page.getByRole('combobox',{name:'Investigation',exact:true}).selectOption('Saffire-I');await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
 await page.getByRole('combobox',{name:'Material family'}).selectOption('SIBAL fabric');await page.getByRole('combobox',{name:'Quality',exact:true}).selectOption('partial');
 await page.getByRole('checkbox',{name:'Only records with reported flow'}).check();await expect(page.locator('.data-table tbody tr')).toHaveCount(2);
 for(const sort of ['id','o2-asc','o2-desc','material','date','thickness-asc','thickness-desc','flow-desc','family','validation'])await page.getByRole('combobox',{name:'Sort',exact:true}).selectOption(sort);
 const csv=await download(page,'Export filtered CSV');expect(csv.text).toContain('SAFFIRE1-S1');expect(csv.text).not.toContain('BASS2-B1');
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByRole('spinbutton',{name:'O2 min',exact:true}).fill('24');await page.getByRole('spinbutton',{name:'O2 max',exact:true}).fill('20');await expect(page.getByRole('alert')).toContainText('Minimum oxygen');await expect(page.getByTestId('evidence-connection')).toContainText('API connected');
 await page.getByRole('button',{name:'Reset filters',exact:true}).click();await page.getByRole('combobox',{name:'Search',exact:true}).fill('x'.repeat(250));expect((await page.getByRole('combobox',{name:'Search',exact:true}).inputValue()).length).toBe(200);
});
test('QA04 every actual experiment opens with its own source locator; no substitute detail',async({page})=>{
 test.setTimeout(180000);
 for(const record of corpus.records){await page.goto('/#/atlas?id='+record.experiment_id);const drawer=page.getByRole('dialog',{name:record.experiment_id,exact:true});await expect(drawer).toBeVisible();await expect(drawer).toContainText(record.source_locator);await page.keyboard.press('Escape');await expect(drawer).toHaveCount(0);await page.getByRole('combobox',{name:'Search',exact:true}).fill(record.experiment_id);await page.getByRole('button',{name:`Add ${record.experiment_id} to basket`,exact:true}).click();await page.getByRole('button',{name:`Remove ${record.experiment_id} from basket`,exact:true}).click();}
 await page.goto('/#/atlas?id=NOT-A-RECORD');await expect(page.getByRole('alert')).toContainText('not found');await expect(page.getByRole('dialog')).toHaveCount(0);
});
test('QA05 drawer clipboard, JSON, raw/ledger disclosure, keyboard close and focus return',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await open(page,'atlas');await page.getByRole('combobox',{name:'Search',exact:true}).fill('BASS2-B1');const row=page.getByRole('row',{name:'Open BASS2-B1',exact:true});await row.press('Enter');const dialog=page.getByRole('dialog');
 for(const summary of ['Measurement ledger: original values, units and transformations','Raw source row (17 fields)'])await dialog.getByText(summary,{exact:true}).click();
 await dialog.getByRole('button',{name:'Copy citation',exact:true}).click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('CSV row 2');const file=await download(page,'Record JSON');expect(JSON.parse(file.text).experiment_id).toBe('BASS2-B1');await page.screenshot({path:'docs/evidence/local-qa/record-drawer.png'});
 await dialog.locator('.drawer').getByRole('button',{name:'Close record detail',exact:true}).click();await expect(row).toBeFocused();
});
test('QA06 Research Library all filter categories, both comparisons, show more, retry and both exports',async({page})=>{
 await open(page,'atlas?view=research');await page.getByRole('combobox',{name:'Evidence type',exact:true}).selectOption('all');await page.getByRole('button',{name:'Show more research results',exact:true}).click();
 for(const label of ['Investigation','Combustion type','Evidence type','Scientific topic','Source document']){const select=page.getByRole('combobox',{name:label,exact:true});const options=await select.locator('option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value));for(const option of options)await select.selectOption(option);await page.getByRole('button',{name:'Reset research filters',exact:true}).click();}
 await page.getByRole('combobox',{name:'First investigation'}).selectOption('PSI-69');await page.getByRole('combobox',{name:'Second investigation'}).selectOption('PSI-25');await expect(page.getByText(/Not numerically comparable: solid-fuel/)).toBeVisible();
 for(const name of ['Download research findings and source manifest (JSON)','Download research coverage (JSON)']){const file=await download(page,name);expect(JSON.parse(file.text).base_corpus_sha256).toBe(version);}
 await page.route('**/data/research.json',r=>r.fulfill({status:503,body:''}));await page.reload();await expect(page.getByRole('alert')).toBeVisible();await page.unroute('**/data/research.json');await page.getByRole('button',{name:'Retry research loading'}).click();await expect(page.getByRole('searchbox',{name:'Research search'})).toBeVisible();await page.screenshot({path:'docs/evidence/local-qa/research-library.png'});
 await page.getByRole('button',{name:'Return to experiment records'}).click();await expect(page.locator('h1')).toHaveText(titles[2]);
});
test('QA07 Compare selection boundaries, remove/reset, provenance and actual export',async({page})=>{
 await open(page,'compare');for(const id of ['BASS2-B2','BASS2-B3'])await page.getByRole('combobox',{name:'Add a record'}).selectOption(id);await expect(page.getByRole('combobox',{name:'Add a record'})).toBeDisabled();
 await page.getByRole('button',{name:'Remove BASS2-B2',exact:true}).click();await expect(page.getByRole('combobox',{name:'Add a record'})).toBeEnabled();await page.getByRole('button',{name:'Reset demo pair'}).click();
 const csv=await download(page,'Export comparison CSV');expect(csv.text).toContain('SAFFIRE1-S1');
 await page.getByRole('button',{name:'Inspect BASS2-B1 provenance',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('22.2');await page.keyboard.press('Escape');await page.screenshot({path:'docs/evidence/local-qa/compare.png'});
 for(const id of ['BASS2-B1','SAFFIRE1-S1'])await page.getByRole('button',{name:'Remove '+id,exact:true}).click();await expect(page.getByRole('heading',{name:'Choose at least one record'})).toBeVisible();
});
test('QA08 assistant scientific questions, deterministic toggle, follow-up, copy, retry and clear',async({page,context})=>{
 await context.grantPermissions(['clipboard-read','clipboard-write']);await open(page,'assistant');await page.getByRole('checkbox',{name:'Use deterministic evidence only'}).check();
 for(const question of ['What oxygen did BASS2-B1 report?','What pressure was BASS-II run at?','Does the corpus include partial-gravity data?','Compare BASS-II and Saffire-I.','What did LUCI find?','Which records are flagged suspect?','Is PMMA safe in a lunar cabin?','What does FLEX investigate?','What is missing from the corpus?','Show evidence supporting that answer.']){
  const count=await page.locator('.answer').count();await page.getByRole('textbox',{name:'Ask the evidence assistant'}).fill(question);await page.getByRole('textbox',{name:'Ask the evidence assistant'}).press('Enter');await expect(page.locator('.answer')).toHaveCount(count+1);await expect(page.getByRole('button',{name:'Retrieve',exact:true})).toBeDisabled();
 }
 await page.getByRole('button',{name:'Copy answer',exact:true}).first().click();expect(await page.evaluate(()=>navigator.clipboard.readText())).toContain('22.2');await page.getByText('Query plan & retrieval trace',{exact:true}).first().click();await page.getByRole('button',{name:'What material does BASS2-B1 test?',exact:true}).first().click();await expect(page.locator('.answer')).toHaveCount(11);await page.getByRole('button',{name:'Retry last question'}).click();await expect(page.locator('.answer')).toHaveCount(12);await page.screenshot({path:'docs/evidence/local-qa/assistant.png'});await page.getByRole('button',{name:'Clear conversation'}).click();await expect(page.locator('.answer')).toHaveCount(0);
});
test('QA09 standalone optional voice is clear and does not break typed TRACE',async({page})=>{
 await open(page,'assistant');await page.getByRole('button',{name:'Health',exact:true}).click();await expect(page.getByRole('region',{name:'Voice agent (optional combined backend)'})).toContainText('Voice unavailable in evidence-only mode');await expect(page.getByRole('button',{name:'Ask & speak'})).toBeDisabled();
 await page.route('**/api/health',r=>r.abort());await page.getByRole('button',{name:'Health',exact:true}).click();await expect(page.getByRole('alert')).toContainText('unreachable or timed out');await page.unroute('**/api/health');await page.getByRole('button',{name:'Health',exact:true}).click();await expect(page.getByRole('region',{name:'Voice agent (optional combined backend)'})).toContainText('evidence-only mode');
 await page.getByRole('button',{name:'What oxygen did BASS2-B1 report?',exact:true}).click();await expect(page.locator('.answer')).toContainText('22.2');
});
test('QA10 dataset scopes, audit presets, every download and actual JSON/null content',async({page})=>{
 await open(page,'exports');for(const [scope,count] of [['All records',131],['BASS-II',129],['Saffire-I',2]] as const){await page.getByRole('tab',{name:new RegExp('^'+scope)}).click();for(const preset of ['Analysis fields','Full audit']){await page.getByRole('button',{name:new RegExp('^'+preset)}).click();const file=await download(page,'Download CSV');expect(file.text.split('\n').length).toBeGreaterThan(count);}
 const file=await download(page,'Download JSON');const json=JSON.parse(file.text);expect(json.records).toHaveLength(count);expect(json.records.every((r:any)=>r.total_pressure_psia.value===null)).toBe(true);}
 // Pace native downloads after the nine scope files to respect Chromium's burst limit.
 await page.waitForTimeout(1100);
 for(const title of ['Verified claim register','Source manifest','Validation report','Normalized corpus']){const pending=page.waitForEvent('download');await page.getByRole('button').filter({has:page.getByRole('heading',{name:title,exact:true})}).click();const d=await pending;expect(await d.failure()).toBeNull();expect((await readFile((await d.path())!,'utf8')).length).toBeGreaterThan(50);}
 await page.screenshot({path:'docs/evidence/local-qa/exports.png'});
});
test('QA11 source files and every local download retain their real SHA256',async({page,request})=>{
 await open(page,'methodology');const manifest=JSON.parse(await readFile('src/data/source_manifest.json','utf8'));for(const artifact of manifest.sources.filter((a:any)=>a.local_original_url)){const response=await request.get('/'+artifact.local_original_url.replace(/^\.\//,''));expect(response.ok()).toBe(true);expect(createHash('sha256').update(await response.body()).digest('hex')).toBe(artifact.sha256);}
 for(const href of ['data/corpus.json','data/source_manifest.json','data/validation_report.json']){const r=await request.get('/'+href);expect(r.ok()).toBe(true);expect(()=>JSON.parse(r.headers()['content-type']?.includes('json')?'{}':'INVALID')).not.toThrow();}
 await page.screenshot({path:'docs/evidence/local-qa/methodology.png'});
});
for(const width of [320,390,768,1024,1440,1920])test(`QA12 all views fit ${width}px and keep controls accessible`,async({page})=>{
 await page.setViewportSize({width,height:950});for(const path of pages){await open(page,path);await expect.poll(()=>page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2),{message:`${path} at ${width}px`}).toBe(true);}
 await page.screenshot({path:`docs/evidence/local-qa/viewport-${width}.png`});
});
for(const path of pages)test(`QA13 accessibility ${path}`,async({page})=>{
 await open(page,path);if(path==='overview')await page.emulateMedia({reducedMotion:'reduce'});const result=await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze();expect(result.violations.map(v=>({id:v.id,nodes:v.nodes.map(n=>n.target)}))).toEqual([]);
});
test('QA14 caption-only release is explicit while visual captions stay usable',async({page})=>{
 await page.route('**/audio/*.mp3',r=>r.fulfill({status:404,body:''}));await open(page,'overview');await page.getByRole('button',{name:/Watch the 45s demo/}).click();await expect(page.getByText('Caption-only release: narration is excluded until its authorship and reuse rights are verified.')).toBeVisible();await expect(page.locator('.film__subtitle')).not.toBeEmpty();
});

test('QA15 scenario controls, all categorical choices, rank controls, source detail, basket and gap download',async({page})=>{
 await open(page,'atmosphere');await page.locator('#pressure-number').fill('10.2');await page.locator('#oxygen-number').fill('30');await expect(page.locator('.composition-readout__main')).toContainText('3.06');
 await open(page,'gap');for(const label of ['Geometry','Target investigation','Measurement method','Gravity target','Flow direction']){const field=page.getByRole('combobox',{name:label,exact:true});for(const option of await field.locator('option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value)))await field.selectOption(option);await field.selectOption('');}
 for(const [label,value] of [['Total pressure (psia)','10.2'],['Oxygen (% by vol)','30'],['Flow velocity (cm/s)','5'],['Thickness (mm)','0.1']])await page.getByRole('spinbutton',{name:label,exact:true}).fill(value);
 await page.getByRole('combobox',{name:'Material family (hypothetical target)',exact:true}).fill('PMMA film');await expect(page.locator('.target-readout')).toContainText('3.06');
 for(const label of ['Order candidates','Result investigation filter','Result material filter']){const f=page.getByRole('combobox',{name:label,exact:true});const values=await f.locator('option').evaluateAll(es=>es.map(e=>(e as HTMLOptionElement).value));for(const value of values)await f.selectOption(value);await f.selectOption(values[0]);}
 for(const label of ['Exclude known material differences (unknowns remain unknown)','Include records with no retrieval credit']){await page.getByRole('checkbox',{name:label,exact:true}).uncheck();await page.getByRole('checkbox',{name:label,exact:true}).check();}
 await page.getByText('How ranking works · weights and tolerances',{exact:true}).click();await page.getByRole('button',{name:'Show 8 more records',exact:true}).click();
 const first=page.locator('.scenario-candidate').first();await first.getByRole('button',{name:/Inspect .* provenance/}).click();await expect(page.getByRole('dialog')).toBeVisible();await page.keyboard.press('Escape');
 await first.getByRole('button',{name:/Add .* to basket/}).click();const id=(await first.locator('h3').innerText()).match(/BASS2-[A-Za-z0-9]+|SAFFIRE1-S\d+/)![0];await page.getByText('Condition explanations for '+id,{exact:true}).click();await expect(first).toContainText('Missing experimental value');
 const plan=await download(page,'Download evidence requirements (.md)');expect(plan.text).toContain('10.2');expect(plan.text).toContain('pressure');expect(plan.name).toMatch(/\.md$/);await page.screenshot({path:'docs/evidence/local-qa/gap-planner.png'});
 await page.getByRole('button',{name:'Reset target and selection'}).click();await page.getByRole('spinbutton',{name:'Total pressure (psia)',exact:true}).fill('-1');await expect(page.getByRole('alert')).toBeVisible();await expect(page.getByRole('button',{name:'Download evidence requirements (.md)'})).toBeDisabled();
});
test('QA16 basket settings, stale preview, MIME types, escaped HTML, print layout and removal continuity',async({page,context})=>{
 await page.addInitScript(()=>{(window as any).__qaTypes=[];const original=URL.createObjectURL;URL.createObjectURL=(blob)=>{if(blob instanceof Blob)(window as any).__qaTypes.push(blob.type);return original(blob);};});
 await open(page,'atlas');for(const id of ['BASS2-B1','SAFFIRE1-S1']){await page.getByRole('combobox',{name:'Search',exact:true}).fill(id);await page.getByRole('button',{name:`Add ${id} to basket`,exact:true}).click();}
 await open(page,'exports');await page.getByRole('button',{name:'Move SAFFIRE1-S1 up',exact:true}).click();await page.getByRole('button',{name:'Move SAFFIRE1-S1 down',exact:true}).click();await page.getByRole('button',{name:'Inspect BASS2-B1',exact:true}).click();await expect(page.getByRole('dialog')).toContainText('22.2');await page.keyboard.press('Escape');
 await page.getByRole('textbox',{name:'Report title',exact:true}).fill('');await expect(page.getByRole('button',{name:'Generate research brief',exact:true})).toBeDisabled();await page.getByRole('textbox',{name:'Report title',exact:true}).fill('<img src=x onerror=alert(1)>');await page.getByRole('textbox',{name:'Research question (optional)',exact:true}).fill('Which conditions are missing?');
 for(const label of ['Include detailed measurement tables','Include missing-record summary','Include source notes']){await page.getByRole('checkbox',{name:label,exact:true}).uncheck();await page.getByRole('checkbox',{name:label,exact:true}).check();}
 await page.getByRole('button',{name:'Generate research brief',exact:true}).click();await page.screenshot({path:'docs/evidence/local-qa/basket-brief.png'});
 for(const format of ['CSV','JSON','Markdown','printable HTML']){const file=await download(page,'Download basket '+format);expect(file.text.length).toBeGreaterThan(200);if(format==='JSON'){const json=JSON.parse(file.text);expect(json.dataset_version).toBe(version);expect(json.selected_ids).toEqual(['BASS2-B1','SAFFIRE1-S1']);expect(json.records[0].total_pressure_psia.value).toBeNull();}
  if(format==='printable HTML'){expect(file.text).not.toContain('<img src=x');expect(file.text).toContain('&lt;img');const print=await context.newPage();await print.setContent(file.text);await print.emulateMedia({media:'print'});await expect(print.locator('body')).toContainText('22.2');await print.pdf({path:'tmp/native-print-check.pdf',format:'A4'});await print.close();}
 }
 const mime=await page.evaluate(()=>(window as any).__qaTypes as string[]);expect(mime.some(t=>t.startsWith('text/csv'))).toBe(true);expect(mime.some(t=>t.startsWith('application/json'))).toBe(true);expect(mime.some(t=>t.startsWith('text/html'))).toBe(true);expect(mime.some(t=>t.startsWith('text/markdown'))).toBe(true);
 await page.getByRole('button',{name:'Remove BASS2-B1',exact:true}).click();await expect(page.getByRole('button',{name:'Download basket JSON'})).toBeDisabled();await page.reload();await page.getByRole('button',{name:'Generate research brief',exact:true}).click();const regenerated=await download(page,'Download basket JSON');expect(JSON.parse(regenerated.text).selected_ids).toEqual(['SAFFIRE1-S1']);
 await page.getByRole('button',{name:'Clear basket',exact:true}).click();await page.getByRole('button',{name:'Cancel',exact:true}).click();await page.getByRole('button',{name:'Clear basket',exact:true}).click();await page.getByRole('button',{name:'Confirm clear basket',exact:true}).click();await expect(page.getByText('Your evidence basket is empty',{exact:true})).toBeVisible();
});

test('QA17 core routes and Research have no uncaught errors or failed local assets',async({page})=>{
 const errors:string[]=[];const assets:string[]=[];page.on('pageerror',e=>errors.push(e.message));page.on('response',r=>{if(r.status()>=400&&/\.(js|css|json|mp3|woff2)(\?|$)/.test(r.url())&&!r.url().includes('/api/'))assets.push(r.url());});
 for(const route of pages)await open(page,route);expect(errors).toEqual([]);expect(assets).toEqual([]);
 await page.goto('/#/unknown-route');await expect(page.getByRole('heading',{name:'This route is not in the evidence graph.'})).toBeVisible();await page.getByRole('link',{name:'Evidence Atlas',exact:true}).filter({hasText:'Evidence Atlas'}).first().click();
});
test('QA18 overview CTAs, live model controls and actual fullscreen/clip navigation',async({page})=>{
 await open(page,'overview');await page.getByRole('button',{name:/Watch the 45s demo/}).click();await expect(page.locator('.film')).toBeInViewport();await page.getByRole('button',{name:'Try the live model',exact:false}).click();await expect(page.locator('#live-model')).toBeInViewport();
 for(const preset of corpus.presets)await page.locator('.live__preset').filter({hasText:preset.label}).click();await page.locator('#live-pressure').fill('10.2');await page.locator('#live-oxygen').fill('30');await page.getByRole('button',{name:/Attempt placement/}).click();await expect(page.getByRole('button',{name:/Placement failed/})).toBeVisible();
 for(let index=0;index<5;index++)await page.locator('.film__chapter').nth(index).click();await page.getByRole('button',{name:'Replay',exact:true}).click();await page.getByRole('button',{name:'Full screen',exact:false}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(true);await page.getByRole('button',{name:'Exit full screen',exact:false}).click();await expect.poll(()=>page.evaluate(()=>!!document.fullscreenElement)).toBe(false);
 await page.screenshot({path:'docs/evidence/local-qa/overview.png'});
 for(let i=0;i<6;i++){await open(page,'overview');const href=await page.locator('a.feature').nth(i).getAttribute('href');await page.locator('a.feature').nth(i).click();await expect.poll(()=>new URL(page.url()).hash.split('?')[0]).toBe(href!.split('?')[0]);}
});

test('QA19 denied clipboard access is handled without an unhandled rejection',async({page})=>{
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(()=>Object.defineProperty(navigator,'clipboard',{value:{writeText:()=>Promise.reject(new DOMException('Denied','NotAllowedError'))}}));
 await open(page,'assistant');await page.getByRole('button',{name:'What oxygen did BASS2-B1 report?',exact:true}).click();await expect(page.locator('.answer')).toContainText('22.2');await page.getByRole('button',{name:'Copy answer',exact:true}).click();await expect(page.getByText('Clipboard unavailable. Select and copy the answer text manually.',{exact:true})).toBeVisible();expect(errors).toEqual([]);
 await page.route('**/api/v1/assistant/query',r=>r.fulfill({status:429,json:{}}));await page.getByRole('button',{name:'Retry last question'}).click();await expect(page.locator('.answer').last()).toContainText('429');
});
test('QA20 expanded menu and measurement drawer pass the same accessibility checks',async({page})=>{
 await open(page,'atlas');await page.getByRole('button',{name:'Menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'All sections menu'}).getByRole('button',{name:'Close',exact:true})).toBeFocused();expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);await page.keyboard.press('Escape');
 await page.getByRole('combobox',{name:'Search',exact:true}).fill('BASS2-B1');await page.getByRole('row',{name:'Open BASS2-B1',exact:true}).press('Enter');await page.getByText('Measurement ledger: original values, units and transformations',{exact:true}).click();expect((await new AxeBuilder({page}).withTags(['wcag2a','wcag2aa','wcag21aa']).analyze()).violations.map(v=>v.id)).toEqual([]);
});
