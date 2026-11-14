import { researchCoverage as data, combustionLabel } from '../lib/researchLibrary';
import { Panel } from './ui';

export function ResearchCoverage() {
  return <Panel kicker="Research coverage" title="Records, findings and documents are different evidence">
    <div className="research-counts" aria-label="Research coverage counts">
      <p><strong>{data.counts.investigations}</strong> investigations</p>
      <p><strong>{data.counts.structured_records}</strong> structured experimental records</p>
      <p><strong>{data.counts.report_findings}</strong> curated report findings</p>
      <p><strong>{data.counts.research_reports}</strong> research reports</p>
    </div>
    <p>{data.counts.linked_sources} linked source artifacts in this research collection, including existing tables and FLEX metadata/table. This is not the entire legacy source inventory. {data.counts.findings_with_locators}/{data.counts.report_findings} findings have report locators.</p>
    <div className="research-investigations">
      {data.investigations.map(inv => <article key={inv.id}>
        <h3>{inv.acronym} · {inv.id}</h3>
        <p>{combustionLabel[inv.combustion_type as keyof typeof combustionLabel]}</p>
        <p>{inv.structured_records} structured records · {inv.report_findings} report findings</p>
        <p>{inv.gravity_context}</p>
        <p><strong>Objective (intent):</strong> {inv.objective}</p>
        <p><strong>Platform:</strong> {inv.platform}</p>
        <p>{inv.metadata_locator} Source: {inv.metadata_source_id}.</p>
        {inv.structured_records ? <dl className="research-measurements">
          <div><dt>Initial oxygen with a value</dt><dd>{inv.fields.oxygen_initial_pct.available}/{inv.structured_records} · {Object.entries(inv.fields.oxygen_initial_pct.statuses).map(([status, count]) => `${status}: ${count}`).join('; ')}</dd></div>
          <div><dt>Reported flow</dt><dd>{inv.fields.flow_initial_cm_s.available}/{inv.structured_records}</dd></div>
          <div><dt>Per-record pressure</dt><dd>{inv.fields.total_pressure_psia.available}/{inv.structured_records}</dd></div>
          <div><dt>Measured per-test gravity</dt><dd>{Object.entries(inv.fields.gravity_regime.statuses).filter(([status]) => status === 'measured').reduce((sum, [, count]) => sum + count, 0)}/{inv.structured_records} · context excluded</dd></div>
          <div><dt>Outcome annotations</dt><dd>{inv.fields.outcome.available}/{inv.structured_records} · qualitative, not standardized outcomes</dd></div>
        </dl> : <p>Droplet measurements: not normalized. Report passages and original sources are available; measurement percentages are not applicable without imported rows.</p>}
      </article>)}
    </div>
    <p>Record pressure remains unknown even where a report describes a subset. No report value is assigned to a test without a verified mapping. Solid and droplet results remain separate.</p>
    <p className="mono research-hash">Research version: {data.dataset_version}<br />Original record corpus: {data.base_corpus_sha256}</p>
    <a className="text-link" href="#/atlas?view=research">Open searchable research library →</a>
  </Panel>;
}
