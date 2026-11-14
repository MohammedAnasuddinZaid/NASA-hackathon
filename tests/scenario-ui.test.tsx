import { afterEach, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { GapPlanner } from '../src/pages/GapPlanner';
import { Compare } from '../src/pages/Compare';
import { Atlas } from '../src/pages/Atlas';
import { defaultScenario } from '../src/lib/scenario';

afterEach(() => vi.unstubAllGlobals());
it('renders actual candidates, weights, unknown pressure and usable links', () => {
  vi.stubGlobal('sessionStorage', {
    getItem: () =>
      JSON.stringify({ scenario: defaultScenario, selected: ['SAFFIRE1-S1', 'SAFFIRE1-S2'] }),
  });
  const html = renderToStaticMarkup(<GapPlanner />);
  expect(html).toContain('SAFFIRE1-S1');
  expect(html).toContain('How ranking works');
  expect(html).toContain('Missing experimental value');
  expect(html).toContain('No assumption substituted');
  expect(html).toContain('#/compare?ids=SAFFIRE1-S1%2CSAFFIRE1-S2');
  expect(html).toContain('NASA source');
  expect(html).toContain('Condition explanations');
});
it('renders a useful no-credit empty state without fabricated candidates', () => {
  // Result filters are interactive; this rendering checks unsupported target wording.
  vi.stubGlobal('sessionStorage', {
    getItem: () =>
      JSON.stringify({ scenario: { ...defaultScenario, material: 'Cotton' }, selected: [] }),
  });
  const html = renderToStaticMarkup(<GapPlanner />);
  expect(html).toContain('Cotton');
  expect(html).toContain('Different');
  expect(html).not.toContain('Cotton experimental measurement');
});
it('rejects invalid comparison deep-link IDs instead of substituting demo records', () => {
  vi.stubGlobal('window', { location: { hash: '#/compare?ids=NOT-A-RECORD' } });
  const html = renderToStaticMarkup(<Compare />);
  expect(html).toContain('Unknown record IDs excluded');
  expect(html).toContain('Choose at least one record');
  expect(html).not.toContain('compare-head__id');
});
it('renders source-located comparison relationships and corrected values', () => {
  vi.stubGlobal('window', { location: { hash: '#/compare?ids=BASS2-B1,SAFFIRE1-S1&from=gap' } });
  const html = renderToStaticMarkup(<Compare />);
  expect(html).toContain('Not comparable');
  expect(html).toContain('Investigation context only');
  expect(html).toContain('22.2');
  expect(html).toContain('Reported · corrected');
  expect(html).toContain('Return to saved scenario');
  expect(html).toContain('CSV row 2');
});
it('opens a genuine Atlas record from a planner deep link', () => {
  vi.stubGlobal('window', { location: { hash: '#/atlas?id=BASS2-B1&from=gap' } });
  const html = renderToStaticMarkup(<Atlas />);
  expect(html).toContain('role="dialog"');
  expect(html).toContain('BASS2-B1');
  expect(html).toContain('Return to saved scenario');
});
