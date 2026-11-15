/// <reference types="node" />
import { afterEach, describe, expect, it, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { records } from '../src/lib/corpus';
import { recordsToCsv } from '../src/lib/export';
import { ResearchCoverage } from '../src/components/ResearchCoverage';
import { ResearchResults } from '../src/components/ResearchLibrary';
import { emptyResearchFilters, findingLocator, loadResearch, nasaUrl, researchCompatibility, researchCoverage, researchEntries, searchResearch, validateResearch } from '../src/lib/researchLibrary';

const raw = JSON.parse(readFileSync('public/data/research.json', 'utf8'));
const data = validateResearch(raw);
afterEach(() => vi.unstubAllGlobals());
describe('separate verified research corpus', () => {
  it('retains exact legacy bytes and distinct counts', () => {
    expect(createHash('sha256').update(readFileSync('src/data/corpus.json')).digest('hex')).toBe(researchCoverage.base_corpus_sha256);
    expect(data.findings).toHaveLength(16);
    expect(records).toHaveLength(131);
    expect(researchEntries(data, records)).toHaveLength(158);
    expect(researchCoverage.counts.new_structured_records).toBe(0);
    expect(records.every(r => r.total_pressure_psia.value === null && r.gravity_regime.status === 'investigation_level')).toBe(true);
  });
  it('refuses mutually consistent research/coverage snapshots built for a different actual experiment bundle', () => {
    expect(() => validateResearch(raw, 'newer-actual-bundle')).toThrow(/does not match/);
  });
  it.each(['dataset_version', 'base_corpus_sha256', 'schema_version'])('rejects stale %s', key => {
    expect(() => validateResearch({ ...raw, [key]: 'stale' })).toThrow();
  });
  it('rejects duplicate sources and unknown source references', () => {
    expect(() => validateResearch({ ...raw, sources: [...raw.sources, raw.sources[0]] })).toThrow(/Duplicate/);
    const changed = structuredClone(raw);
    changed.findings[0].source_id = 'made-up';
    expect(() => validateResearch(changed)).toThrow(/locator/);
  });
  it('rejects wrong association, missing locator and test promotion', () => {
    for (const patch of [{ investigation_id: 'PSI-69' }, { locator: { pdf_page: 0 } }, { experiment_ids: ['BASS2-B1'] }]) {
      const changed = structuredClone(raw); Object.assign(changed.findings[0], patch);
      expect(() => validateResearch(changed)).toThrow();
    }
  });
  it.each(['http://ntrs.nasa.gov/', 'https://ntrs.nasa.gov.evil.test/', 'https://x:y@ntrs.nasa.gov/', 'javascript:alert(1)'])('rejects unsafe source %s', url => expect(nasaUrl(url)).toBe(false));
  it('keeps original and normalized report quantities with qualifications', () => {
    const f = data.findings.find(f => f.id === 'BASS-REPORT-PRESSURE-SUBSET')!;
    expect(f.quantities.map(q => q.value)).toEqual([99.2, 99.5]);
    expect(f.quantities.every(q => q.status === 'reported_range_bound' && q.unit === 'kPa')).toBe(true);
    expect(f.experiment_ids).toEqual([]);
    expect(findingLocator(f)).toContain('Printed p.38 · PDF p.46');
  });
});
describe('deterministic search and classification', () => {
  it('finds daily oxygen correction and genuine report citation', () => {
    const found = searchResearch(data, records, { ...emptyResearchFilters, query: 'daily oxygen' });
    expect(found.map(f => f.id)).toEqual(['BASS-REPORT-OXYGEN-OFFSET']);
    expect(found[0].type).toBe('finding');
    expect(found[0].source_ids).toEqual(['NTRS-20210011385']);
  });
  it.each([['PSI-25', 8], ['PSI-69', 8], ['PSI-98', 0]])('investigation %s returns %s findings', (investigation, count) => {
    expect(searchResearch(data, records, { ...emptyResearchFilters, investigation: String(investigation) })).toHaveLength(Number(count));
  });
  it.each([['finding',16], ['experiment',131], ['source',8], ['investigation',3], ['all',158]])('separates %s counts', (evidence, count) => {
    expect(searchResearch(data, records, { ...emptyResearchFilters, evidence: String(evidence) })).toHaveLength(Number(count));
  });
  it('filters droplet evidence and report topics without solid record leakage', () => {
    const found = searchResearch(data, records, { ...emptyResearchFilters, combustion: 'liquid_droplet', topic: 'extinction' });
    expect(found.length).toBeGreaterThan(1);
    expect(found.every(f => f.investigation_id === 'PSI-69' && f.type === 'finding')).toBe(true);
    expect(searchResearch(data, records, { ...emptyResearchFilters, evidence: 'experiment', combustion: 'liquid_droplet' })).toEqual([]);
  });
  it('supports source filter and real experiment IDs', () => {
    expect(searchResearch(data, records, { ...emptyResearchFilters, source: 'NTRS-20150023456' })).toHaveLength(8);
    expect(searchResearch(data, records, { ...emptyResearchFilters, query: 'BASS2-B1', evidence: 'experiment' }).map(x => x.id)).toEqual(['BASS2-B1']);
  });
  it('returns empty for unknown concepts and unsupported filters', () => {
    expect(searchResearch(data, records, { ...emptyResearchFilters, query: 'NOT-A-REAL-SCIENTIFIC-TOKEN' })).toEqual([]);
  });
  it('discovers findings by document identifier and investigation DOI', () => {
    expect(searchResearch(data, records, { ...emptyResearchFilters, query: 'NTRS-20210011385' })).toHaveLength(8);
    expect(searchResearch(data, records, { ...emptyResearchFilters, query: '10.60555/mbq8-0451' })).toHaveLength(8);
  });
  it('blocks droplet/solid equivalence and qualifies same category', () => {
    const [bass, saffire, flex] = data.investigations;
    expect(researchCompatibility(bass, flex)).toContain('Not numerically comparable');
    expect(researchCompatibility(bass, saffire)).toContain('does not establish comparability');
    expect(researchCompatibility(undefined, flex)).toContain('No substitution');
  });
});
describe('rendering, loading and exports', () => {
  it('renders coverage with separate categories and no zero denominator', () => {
    const html = renderToStaticMarkup(<ResearchCoverage />);
    expect(html).toContain('131'); expect(html).toContain('16'); expect(html).toContain('FLEX');
    expect(html).toContain('Liquid-fuel droplet combustion');
    expect(html).toContain('context excluded'); expect(html).not.toContain('0/0');
  });
  it('renders attributed finding, exact page link, raw status and caveat', () => {
    const found = searchResearch(data, records, { ...emptyResearchFilters, query: 'pressure subset' });
    const html = renderToStaticMarkup(<ResearchResults data={data} results={found} />);
    expect(html).toContain('Research finding'); expect(html).toContain('PDF p.46');
    expect(html).toContain('TM-20210011385.pdf#page=46'); expect(html).toContain('reported_range_bound');
    expect(html).toContain('99.2'); expect(html).toContain('FIRETRACE-authored paraphrase');
    expect(html).not.toContain('add to basket');
  });
  it('renders no-result state and escaped authored/source text', () => {
    expect(renderToStaticMarkup(<ResearchResults data={data} results={[]} />)).toContain('No research matches');
    const results = [{ ...researchEntries(data, [])[0], title: '<script>unsafe</script>' }];
    expect(renderToStaticMarkup(<ResearchResults data={data} results={results} />)).not.toContain('<script>');
  });
  it('renders source and experiment navigation distinctly', () => {
    const html = renderToStaticMarkup(<ResearchResults data={data} results={searchResearch(data, records, { ...emptyResearchFilters, evidence: 'experiment', query: 'BASS2-B1' })} />);
    expect(html).toContain('#/atlas?id=BASS2-B1'); expect(html).toContain('Experimental record');
    const sources = renderToStaticMarkup(<ResearchResults data={data} results={searchResearch(data, [], { ...emptyResearchFilters, evidence: 'source', query: 'FLEX' })} />);
    expect(sources).toContain('Source document'); expect(sources).toContain('10.60555/mbq8-0451');
  });
  it('loads actual research JSON through validated snapshot', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => JSON.stringify(raw) }));
    expect((await loadResearch()).dataset_version).toBe(researchCoverage.dataset_version);
  });
  it('fails honestly on HTTP errors and stale content', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: false }));
    await expect(loadResearch()).rejects.toThrow('unavailable');
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, text: async () => '{"schema_version":"stale"}' }));
    await expect(loadResearch()).rejects.toThrow('invalid');
  });
  it('preserves existing export record scope and source data', () => {
    const csv = recordsToCsv(records);
    expect(csv).toContain('BASS2-B1'); expect(csv).not.toContain('FLEX-REPORT');
    expect(JSON.parse(readFileSync('public/data/research.json','utf8')).findings).toEqual(raw.findings);
  });
});
