import { expect, test } from '@playwright/test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
const version = createHash('sha256').update(readFileSync('src/data/corpus.json')).digest('hex');
test.beforeEach(async ({ page }) => {
  await page.route('**/api/v1/coverage', route => route.fulfill({ headers: { 'X-Corpus-Version': version }, json: { corpus_version: version, record_count: 131 } }));
});

test('TRACE loading, interpretation citations, failure and history rendering', async ({ page }) => {
  await page.route('**/api/v1/assistant/query', async (route) => {
    const body = route.request().postDataJSON();
    // UI fixture only: scientific claims come from real backend tests, not this mock.
    await new Promise((resolve) => setTimeout(resolve, 250));
    await route.fulfill({ headers: { 'X-Corpus-Version': version }, json: {
      answer: { answer_id:'fixture', question:body.question, corpus_version:version, grade:'direct',
        headline:'UI test evidence', claims:[], paragraphs:[], bullets:[], citations:[{source_id:'PSI-25',title:'UI fixture',locator:'CSV row 2',url:'https://psi.nasa.gov/physci/repo/data/investigations/PSI-25',doi:null}],
        trace:[], follow_ups:[], limitations:['Test fixture only.'], validation:{checked:0}, },
      answer_type:'ai_powered', ai_status:'generated', model_used:'mock-provider-not-live',
      interpretation:'Test interpretation.', interpretation_evidence_ids:['ev-test'],
      evidence:[{evidence_id:'ev-test',source_id:'PSI-25',locator:'CSV row 2'}], notice:'Mock provider, not live.', resolved_question:body.question,
    }});
  });
  await page.goto('/#/assistant');
  await page.getByRole('textbox', { name:'Ask the evidence assistant', exact:true }).fill('BASS2-B1 oxygen');
  await page.getByRole('button', { name:'Retrieve', exact:true }).click();
  await expect(page.getByText('TRACE is retrieving and verifying evidence…')).toBeVisible();
  await expect(page.getByRole('region', { name:'AI interpretation' })).toContainText('mock-provider-not-live');
  await page.getByRole('button', { name:'PSI-25 · CSV row 2', exact:true }).click();
  await expect(page).toHaveURL(/#\/assistant$/);
  await expect(page.getByRole('link', { name:'Source', exact:true }).first()).toHaveAttribute('href', /psi.nasa.gov/);
});

test('TRACE shows offline fallback honestly', async ({ page }) => {
  await page.route('**/api/v1/assistant/query', (route) => route.abort());
  await page.goto('/#/assistant');
  await page.getByRole('button', { name:'What oxygen did BASS2-B1 report?', exact:true }).click();
  await expect(page.getByText('Backend unavailable. Bundled deterministic evidence answer; no external model called.')).toBeVisible();
  await expect(page.locator('.answer')).toContainText('22.2');
});
