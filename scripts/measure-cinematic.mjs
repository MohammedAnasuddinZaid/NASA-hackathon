// Same local production method before/after; not a Lighthouse score or real-device benchmark.
import {chromium, expect} from '@playwright/test';
import {readFile, readdir, mkdir, writeFile} from 'node:fs/promises';
import {gzipSync} from 'node:zlib';
const label=process.argv[2] ?? 'after';
const base=process.env.FIRETRACE_MEASURE_URL ?? 'http://127.0.0.1:5211';
const dist=process.env.FIRETRACE_MEASURE_DIST ?? 'dist';
const controlled=process.env.FIRETRACE_MEASURE_BLOCK_REMOTE === 'true';
const output=`docs/evidence/pr9/${label}`;
await mkdir(output,{recursive:true});
const names=await readdir(`${dist}/assets`);
const bundle=[];
for(const name of names.filter(name=>/^index-.*\.(js|css)$/.test(name))){const bytes=await readFile(`${dist}/assets/${name}`);bundle.push({file:name,bytes:bytes.length,gzip:gzipSync(bytes).length});}
const browser=await chromium.launch();const samples=[];
try{
 for(const rate of [1,4])for(let sample=0;sample<3;sample++){
  const context=await browser.newContext({viewport:{width:1440,height:1000},serviceWorkers:'block'});const page=await context.newPage();const cdp=await context.newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate});
  if(controlled)await page.route('https://fonts.googleapis.com/**',route=>route.fulfill({contentType:'text/css',body:''}));
  const start=performance.now();await page.goto(base+'/#/overview');await expect(page.locator('h1')).toHaveText('Evidence has an address.');
  const ms=Math.round(performance.now()-start);samples.push({cpuRate:rate,sample,headingMs:ms});
  if(rate===1&&sample===0)await page.screenshot({path:`${output}/hero.png`,animations:'disabled'});
  await context.close();
 }
}finally{await browser.close();}
const result={method:'Three fresh Chromium contexts per CPU rate, 1440×1000, production preview, service workers blocked, time to original h1 assertion; local samples only.',remoteFontStylesheet:controlled?'empty fixture to remove font-network variance':'live',bundle,samples};
await writeFile(`${output}/performance.json`,JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
