import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { BasketIndicator, BasketProvider } from '../src/lib/basketContext';
import { snapshot } from '../src/lib/basket';
import { researchSource } from '../src/lib/researchData';
import { ResearchWorkspace } from '../src/components/ResearchWorkspace';
import { ResearchBriefPreview } from '../src/components/ResearchBriefPreview';
import { buildBrief, defaultBriefOptions } from '../src/lib/researchBrief';
import { Atlas } from '../src/pages/Atlas';
const ids = ['BASS2-B1', 'SAFFIRE1-S1'];
afterEach(() => vi.unstubAllGlobals());
function storage(value: string | null) {
  vi.stubGlobal('localStorage', { getItem: () => value });
}
it('renders basket count, selected records, comparison bounds and source actions', () => {
  storage(JSON.stringify(snapshot(ids, researchSource)));
  const html = renderToStaticMarkup(
    <BasketProvider>
      <BasketIndicator />
      <ResearchWorkspace />
    </BasketProvider>,
  );
  expect(html).toContain('Evidence basket: 2 records');
  expect(html).toContain('22.2');
  expect(html).toContain('Choose up to four');
  expect(html).toContain('Inspect BASS2-B1');
  expect(html).toContain('Report title');
  expect(html).toContain('Generate research brief');
  expect(html).toContain('NASA source');
  expect(html).toContain('not_reported');
});
it('shows the empty-state Atlas navigation and handles unavailable storage', () => {
  vi.stubGlobal('localStorage', {
    getItem: () => {
      throw new Error('disabled');
    },
  });
  const html = renderToStaticMarkup(
    <BasketProvider>
      <ResearchWorkspace />
    </BasketProvider>,
  );
  expect(html).toContain('Your evidence basket is empty');
  expect(html).toContain('href="#/atlas"');
  expect(html).toContain('Browser storage is unavailable');
});
it('version change requires explicit review before brief generation', () => {
  storage(JSON.stringify({ ...snapshot(ids, researchSource), version: 'old-version' }));
  const html = renderToStaticMarkup(
    <BasketProvider>
      <ResearchWorkspace />
    </BasketProvider>,
  );
  expect(html).toContain('I reviewed the current dataset');
  expect(html).toContain('Saved dataset references have changed');
  expect(html).toMatch(/disabled=""[^>]*>Generate research brief/);
});
it('Atlas selection controls reflect persisted IDs and have keyboard-accessible buttons', () => {
  storage(JSON.stringify(snapshot(ids, researchSource)));
  vi.stubGlobal('window', { location: { hash: '#/atlas' } });
  const html = renderToStaticMarkup(
    <BasketProvider>
      <Atlas />
    </BasketProvider>,
  );
  expect(html).toContain('aria-label="Remove BASS2-B1 from basket"');
  expect(html).toContain('aria-pressed="true"');
  expect(html).toContain('Evidence basket');
});
it('research preview contains all scientific sections, exact values and escaped metadata', () => {
  const brief = buildBrief(
    ids,
    researchSource,
    { ...defaultBriefOptions, title: '<img src=x onerror=alert(1)>' },
    '2026-11-15T00:00:00Z',
  );
  const html = renderToStaticMarkup(<ResearchBriefPreview brief={brief} />);
  for (const section of [
    'Research scope',
    'Selected experiments',
    'Evidence observations',
    'Comparison limitations',
    'Missing evidence and research gaps',
    'Source references',
    'Scientific disclaimer',
  ])
    expect(html).toContain(section);
  expect(html).toContain('&lt;img');
  expect(html).not.toContain('<img');
  expect(html).toContain('22.2');
  expect(html).toContain('Unknown');
  expect(html).toContain('CSV row 2');
});
