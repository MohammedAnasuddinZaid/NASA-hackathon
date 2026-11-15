import { useEffect, useMemo, useState } from 'react';
import { records } from '../lib/corpus';
import { downloadText } from '../lib/export';
import { combustionLabel, emptyResearchFilters, findingLocator, loadResearch, researchCompatibility, researchCoverage, searchResearch, type ResearchFilters, type ResearchLibraryData, type ResearchResult } from '../lib/researchLibrary';
import { Badge, PageHeader, Panel, SourceLink } from './ui';
import { ResearchCoverage } from './ResearchCoverage';

export function ResearchResults({ data, results }: { data: ResearchLibraryData; results: ResearchResult[] }) {
  return <div className="research-results">
    {results.length === 0 && <p role="status">No research matches these filters. Try another topic or clear the filters. No replacement evidence was invented.</p>}
    {results.map(result => {
      const finding = data.findings.find(f => f.id === result.id);
      const source = data.sources.find(s => s.id === (finding?.source_id ?? result.id));
      const inv = data.investigations.find(i => i.id === result.investigation_id)!;
      const type = { finding: 'Research finding', experiment: 'Experimental record', source: 'Source document', investigation: 'Investigation overview' }[result.type];
      return <article className="research-result" key={`${result.type}-${result.id}`}>
        <div className="research-result__meta"><Badge>{type}</Badge><span>{inv.acronym} · {combustionLabel[inv.combustion_type]}</span></div>
        <h3>{result.title}</h3><p className="mono">{result.id}</p><p>{result.text}</p>
        {finding && <>
          <p>{finding.finding_type.replaceAll('_', ' ')} · {finding.quantitative ? 'Quantitative report content' : 'Qualitative report content'}</p>
          <p>{finding.content_origin}</p><p>{findingLocator(finding)}</p>
          <p>Topics: {finding.topics.join(' · ')}</p>
          {finding.quantities.length > 0 && <div className="research-table-wrap"><table><caption>Report-level quantities — not per-test measurements</caption><thead><tr><th>Quantity</th><th>Original wording/value</th><th>Numeric reference</th><th>Unit / status</th><th>Qualification</th></tr></thead><tbody>
            {finding.quantities.map(q => <tr key={q.quantity}><th>{q.quantity}</th><td>{q.raw}</td><td>{q.value ?? 'Not established'}</td><td>{q.unit} · {q.status}</td><td>{q.qualifier}{q.uncertainty && ` Uncertainty: ${q.uncertainty}`}</td></tr>)}
          </tbody></table></div>}
          <ul>{finding.limitations.map(l => <li key={l}>{l}</li>)}</ul>
          <p>Experiment mappings: none verified. This finding cannot enter numeric Compare, scenario ranking or the experiment basket as a test record.</p>
        </>}
        {source && <div className="research-source">
          <h4>{source.title}</h4>
          <p>{source.id} · {source.doi ? `DOI ${source.doi}` : 'No report DOI recorded'} · version {source.version}</p>
          <SourceLink href={source.url}>NASA source</SourceLink>{' · '}
          <SourceLink href={`${source.download_url}${finding ? `#page=${finding.locator.pdf_page}` : ''}`}>{finding ? 'Original PDF at cited page' : 'Original NASA artifact'}</SourceLink>
          {result.type === 'source' && <><p>{source.access.replaceAll('_', ' ')} · {source.license}</p><p className="mono research-hash">SHA-256 {source.sha256}</p><ul>{source.limitations.map(l => <li key={l}>{l}</li>)}</ul></>}
        </div>}
        {result.type === 'experiment' && <a className="text-link" href={`#/atlas?id=${encodeURIComponent(result.id)}`}>Inspect unchanged experiment and provenance →</a>}
        {result.type === 'investigation' && <>
          <p>{inv.metadata_locator} Source: {inv.metadata_source_id}.</p>
          <p>DOI {inv.doi}. {inv.combustion_type === 'liquid_droplet' ? 'Liquid-fuel droplets; no normalized test records imported.' : 'Solid-fuel records remain in the original table layer.'}</p>
          {data.sources.filter(s => s.investigation_id === inv.id).map(s => <p key={s.id}><SourceLink href={s.url}>{s.title}</SourceLink></p>)}
        </>}
      </article>;
    })}
  </div>;
}

export default function ResearchLibrary({ onBack }: { onBack: () => void }) {
  const [data, setData] = useState<ResearchLibraryData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [filters, setFilters] = useState<ResearchFilters>(emptyResearchFilters);
  const [limit, setLimit] = useState(24);
  const [left, setLeft] = useState('PSI-25');
  const [right, setRight] = useState('PSI-69');
  useEffect(() => {
    let active = true;
    setError('');
    loadResearch().then(next => { if (active) setData(next); }).catch(() => {
      if (active) setError('Verified research could not load or does not match this build. Experiment browsing remains available. Retry or use Methodology source links.');
    });
    return () => { active = false; };
  }, [attempt]);
  function update(patch: Partial<ResearchFilters>) { setFilters(current => ({ ...current, ...patch })); setLimit(24); }
  const results = useMemo(() => data ? searchResearch(data, records, filters) : [], [data, filters]);
  return <div className="page page--research">
    <PageHeader index="02" eyebrow="Evidence Atlas / Research library" title={<>Research with an <em>address.</em></>}
      lede="Search report findings, NASA sources, investigation metadata and existing experiment records. Findings are attributed paraphrases; they never become test measurements."
      actions={<button className="button button--ghost" onClick={onBack}>Return to experiment records</button>} />
    <ResearchCoverage />
    {error ? <div role="alert"><p>{error}</p><button className="button" onClick={() => setAttempt(n => n + 1)}>Retry research loading</button></div> : !data ? <p role="status">Loading verified research…</p> : <>
      <Panel kicker="Discovery" title="Search expanded research">
        <div className="research-filters">
          <label>Research search<input type="search" value={filters.query} onChange={e => update({ query: e.target.value })} placeholder="oxygen correction, contamination, FLEX…" /></label>
          <label>Investigation<select value={filters.investigation} onChange={e => update({ investigation: e.target.value })}><option value="all">All investigations</option>{data.investigations.map(i => <option key={i.id} value={i.id}>{i.acronym}</option>)}</select></label>
          <label>Combustion type<select value={filters.combustion} onChange={e => update({ combustion: e.target.value })}><option value="all">All combustion types</option>{Object.entries(combustionLabel).map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Evidence type<select value={filters.evidence} onChange={e => update({ evidence: e.target.value })}>{[['all', 'All evidence types'], ['finding', 'Research findings'], ['experiment', 'Experimental records'], ['source', 'Source documents'], ['investigation', 'Investigation overviews']].map(([id, label]) => <option key={id} value={id}>{label}</option>)}</select></label>
          <label>Scientific topic<select value={filters.topic} onChange={e => update({ topic: e.target.value })}><option value="all">All topics</option>{[...new Set(data.findings.flatMap(f => f.topics))].sort().map(t => <option key={t}>{t}</option>)}</select></label>
          <label>Source document<select value={filters.source} onChange={e => update({ source: e.target.value })}><option value="all">All sources</option>{data.sources.map(s => <option key={s.id} value={s.id}>{s.title}</option>)}</select></label>
        </div>
        <button className="text-link" onClick={() => { setFilters(emptyResearchFilters); setLimit(24); }}>Reset research filters</button>
        <p role="status">{results.length} results · {results.filter(r => r.type === 'experiment').length} experimental records / {results.filter(r => r.type === 'finding').length} research findings in this search. These counts are separate.</p>
      </Panel>
      <ResearchResults data={data} results={results.slice(0, limit)} />
      {limit < results.length && <button className="button" onClick={() => setLimit(n => n + 24)}>Show more research results</button>}
      <Panel kicker="Compatibility" title="Shared topic does not mean interchangeable evidence">
        <div className="research-filters">
          <label>First investigation<select value={left} onChange={e => setLeft(e.target.value)}>{data.investigations.map(i => <option key={i.id} value={i.id}>{i.acronym}</option>)}</select></label>
          <label>Second investigation<select value={right} onChange={e => setRight(e.target.value)}>{data.investigations.map(i => <option key={i.id} value={i.id}>{i.acronym}</option>)}</select></label>
        </div>
        <p role="status">{researchCompatibility(data.investigations.find(i => i.id === left), data.investigations.find(i => i.id === right))}</p>
        <a className="text-link" href="#/compare">Compare original solid-fuel records with the existing audit →</a>
      </Panel>
      <Panel kicker="Sources and limitations" title="What was deliberately not imported">
        <ul>{data.limitations.map(l => <li key={l}>{l}</li>)}</ul>
        <p>FLEX CSV has {researchCoverage.deferred_source_rows} source rows, while the report describes {data.findings.find(f => f.id === 'FLEX-REPORT-SCOPE')?.quantities[0]?.value ?? 'an unresolved number of'} historical tests. These counts and sources are not silently equated. Burning-rate units and test1 diameter disagree; all droplet rows remain unnormalized.</p>
        <p>Original PDFs are externally linked and kept in a local verification cache, not embedded in the app or redistributed. BASS report rights differ from CC0 PSI artifacts; source-specific rights are retained.</p>
        <button className="text-link" onClick={() => downloadText('firetrace-research.json', JSON.stringify(data, null, 2) + '\n', 'application/json')}>Download research findings and source manifest (JSON)</button>{' · '}
        <button className="text-link" onClick={() => downloadText('firetrace-research-coverage.json', JSON.stringify(researchCoverage, null, 2) + '\n', 'application/json')}>Download research coverage (JSON)</button>
        <p>Independent research support. No NASA endorsement, fire-risk prediction, engineering certification or material safety conclusion.</p>
      </Panel>
    </>}
  </div>;
}
