import { useMemo, useState } from 'react';
import { claims, corpus, records, sourceManifest, validation } from '../lib/corpus';
import {
  claimsToCsv,
  coreExportColumns,
  downloadJson,
  downloadText,
  exportColumns,
  formatExportStamp,
  previewCsv,
  recordsToCsv,
} from '../lib/export';
import { Badge, PageHeader, Panel, SectionRule } from '../components/ui';

type Scope = 'all' | 'BASS-II' | 'Saffire-I';
type Preset = 'core' | 'full';

const scopes: Array<{ id: Scope; label: string; count: number }> = [
  { id: 'all', label: 'All records', count: records.length },
  { id: 'BASS-II', label: 'BASS-II', count: records.filter((record) => record.family === 'BASS-II').length },
  { id: 'Saffire-I', label: 'Saffire-I', count: records.filter((record) => record.family === 'Saffire-I').length },
];

export function Exports() {
  const [scope, setScope] = useState<Scope>('all');
  const [preset, setPreset] = useState<Preset>('core');

  const selected = useMemo(
    () => (scope === 'all' ? records : records.filter((record) => record.family === scope)),
    [scope],
  );
  const columns = preset === 'core' ? coreExportColumns : exportColumns;
  const csv = useMemo(() => recordsToCsv(selected, columns), [selected, columns]);
  const preview = useMemo(() => previewCsv(csv, 5), [csv]);
  const stamp = formatExportStamp();
  const pressure = selected.filter((record) => record.total_pressure_psia.value !== null).length;

  return (
    <div className="page page--exports">
      <PageHeader
        index="07"
        eyebrow="Exports"
        title={<>Take the evidence <em>with you.</em></>}
        lede="Download the exact records behind a finding, with raw source locators and validation status. Exports are generated locally from the bundled corpus; no server, account or network call is required."
        actions={<Badge tone="mint">Local generation</Badge>}
      />

      <div className="export-layout">
        <Panel kicker="Dataset" title="Choose a scope" className="export-config">
          <div className="scope-tabs" role="tablist" aria-label="Dataset scope">
            {scopes.map((item) => (
              <button
                key={item.id}
                className={scope === item.id ? 'scope-tab is-active' : 'scope-tab'}
                onClick={() => setScope(item.id)}
                role="tab"
                aria-selected={scope === item.id}
              >
                <span>{item.label}</span>
                <span className="mono">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="preset-toggle">
            <button className={preset === 'core' ? 'is-active' : ''} onClick={() => setPreset('core')}>
              Analysis fields
              <small>{coreExportColumns.length} columns</small>
            </button>
            <button className={preset === 'full' ? 'is-active' : ''} onClick={() => setPreset('full')}>
              Full audit
              <small>{exportColumns.length} columns</small>
            </button>
          </div>

          <dl className="export-summary">
            <div><dt>Rows</dt><dd className="mono">{selected.length}</dd></div>
            <div><dt>Columns</dt><dd className="mono">{columns.length}</dd></div>
            <div><dt>Records with pressure</dt><dd className="mono">{pressure}</dd></div>
            <div><dt>Records with per-test gravity</dt><dd className="mono">{selected.filter((record) => record.gravity_regime.status === 'measured').length}</dd></div>
            <div><dt>Validation</dt><dd className="mono">{selected.filter((record) => record.validation_status === 'validated').length} validated / {selected.filter((record) => record.validation_status === 'partial').length} partial / {selected.filter((record) => record.validation_status === 'suspect').length} suspect (selected)</dd></div>
            <div><dt>Encoding</dt><dd className="mono">UTF-8 CSV</dd></div>
          </dl>

          <div className="export-buttons">
            <button
              className="button button--ember button--full"
              onClick={() => downloadText(`firertrace-${scope.toLowerCase()}-${stamp}.csv`, csv, 'text/csv;charset=utf-8')}
            >
              Download CSV <span aria-hidden="true">↓</span>
            </button>
            <button
              className="button button--ghost button--full"
              onClick={() =>
                downloadJson(`firertrace-${scope.toLowerCase()}-${stamp}.json`, {
                  generated_at: new Date().toISOString(),
                  scope,
                  source_corpus: corpus.meta.generated_at,
                  record_count: selected.length,
                  records: selected,
                })
              }
            >
              Download JSON <span aria-hidden="true">↓</span>
            </button>
          </div>

          <p className="panel-caption">
            Empty cells mean “not reported,” not zero. A null pressure is preserved as an empty CSV
            cell and as <span className="mono">null</span> in JSON.
          </p>
        </Panel>

        <Panel
          kicker="Preview"
          title={`${selected.length} rows · ${columns.length} columns`}
          actions={<span className="mono muted">first 5 lines</span>}
          className="export-preview"
        >
          <div className="preview-scroll">
            <pre>{preview.join('\n')}</pre>
          </div>
          <div className="preview-notes">
            <div>
              <span className="kicker">Interpretation guardrail</span>
              <p>
                This export is a record layer, not a flammability dataset. The pair
                (oxygen fraction, total pressure) is incomplete for every row, and no standardized
                outcome is present.
              </p>
            </div>
            <div className="preview-notes__stats">
              <span><strong>0</strong> pressure values</span>
              <span><strong>0</strong> per-test g</span>
              <span><strong>0</strong> outcomes</span>
            </div>
          </div>
        </Panel>
      </div>

      <SectionRule label="Other audit artifacts" meta="Claims, sources, validation" />
      <div className="artifact-grid">
        <button
          className="artifact-card"
          onClick={() => downloadText(`firertrace-claims-${stamp}.csv`, claimsToCsv(claims), 'text/csv;charset=utf-8')}
        >
          <div className="artifact-card__head">
            <span className="kicker">Claims</span>
            <span className="mono">{claims.length}</span>
          </div>
          <h3>Verified claim register</h3>
          <p>Claim text, type, supporting source IDs and locators, limitation, and validation status.</p>
          <span className="artifact-card__action">Download CSV ↓</span>
        </button>

        <button
          className="artifact-card"
          onClick={() => downloadJson(`firertrace-source-manifest-${stamp}.json`, sourceManifest)}
        >
          <div className="artifact-card__head">
            <span className="kicker">Provenance</span>
            <span className="mono">{sourceManifest.sources.length}</span>
          </div>
          <h3>Source manifest</h3>
          <p>SHA-256 hashes, file sizes, retrieval timestamps, versions, DOIs, licenses and limitations.</p>
          <span className="artifact-card__action">Download JSON ↓</span>
        </button>

        <button
          className="artifact-card"
          onClick={() => downloadJson(`firertrace-validation-${stamp}.json`, validation)}
        >
          <div className="artifact-card__head">
            <span className="kicker">Validation</span>
            <span className="mono">{validation.checks.length}</span>
          </div>
          <h3>Validation report</h3>
          <p>Cross-check counts, missing-data gates, quality flags, excluded rows and retained anomalies.</p>
          <span className="artifact-card__action">Download JSON ↓</span>
        </button>

        <button
          className="artifact-card"
          onClick={() => downloadJson(`firertrace-corpus-${stamp}.json`, corpus)}
        >
          <div className="artifact-card__head">
            <span className="kicker">Full corpus</span>
            <span className="mono">v{corpus.meta.pipeline_version}</span>
          </div>
          <h3>Normalized corpus</h3>
          <p>All records, raw fields, measurements, claims, presets and limitations in one JSON file.</p>
          <span className="artifact-card__action">Download JSON ↓</span>
        </button>
      </div>

      <div className="citation-block">
        <div>
          <div className="kicker">How to cite the sources</div>
          <h3>Cite the original investigations, not this interface.</h3>
          <p>
            If you reuse a record, cite the PSI investigation and its DOI, plus the exact table row.
            FIRETRACE is a retrieval layer; it does not replace the source.
          </p>
        </div>
        <div className="citation-block__dois">
          {corpus.meta.investigations.map((investigation) => (
            <div key={investigation.doi}>
              <span className="mono">{investigation.family}</span>
              <a href={`https://doi.org/${investigation.doi}`} target="_blank" rel="noreferrer">
                {investigation.doi} ↗
              </a>
              <span className="muted">PSI-{investigation.psi.replace('PSI-', '')} · {investigation.records} records</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
