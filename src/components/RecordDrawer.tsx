import { useEffect, useRef, useState } from 'react';
import type { ExperimentRecord } from '../lib/types';
import { artifactsFor } from '../lib/corpus';
import { formatCompact, humanizeToken, shortDate, statusLabel, statusTone } from '../lib/format';
import { Badge, SourceLink, StatusBadge } from './ui';
import { downloadJson } from '../lib/export';

function Field({
  label,
  data,
  unit,
}: {
  label: string;
  data: { value: string | number | null; status: string; note: string | null; unit: string | null };
  unit?: string;
}) {
  return (
    <div className="drawer-field">
      <div className="drawer-field__label">{label}</div>
      <div className={`drawer-field__value ${data.value === null ? 'is-missing' : ''}`}>
        {data.value === null ? 'Not reported' : formatCompact(data as never, unit)}
      </div>
      <div className="drawer-field__status">
        <StatusBadge status={data.status} />
      </div>
      {data.note && <p className="drawer-field__note">{data.note}</p>}
    </div>
  );
}

export function RecordDrawer({
  record,
  onClose,
}: {
  record: ExperimentRecord | null;
  onClose: () => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!record) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-drawer');
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-drawer');
    };
  }, [record, onClose]);

  if (!record) return null;
  const artifact = artifactsFor(record.source_id).find((item) => item.role === 'experiment_table');
  const citation = `${record.investigation_acronym} ${record.experiment_id}, ${record.source_locator}. ${artifact?.source_url ?? ''}`;

  async function copyCitation() {
    try {
      await navigator.clipboard.writeText(citation);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1600);
    } catch {
      setCopied(false);
    }
  }

  return (
    <div className="drawer-layer" role="dialog" aria-modal="true" aria-labelledby="drawer-title">
      <button className="drawer-backdrop" aria-label="Close record detail" onClick={onClose} />
      <aside className="drawer">
        <header className="drawer__head">
          <div>
            <div className="kicker">Experiment record</div>
            <h2 id="drawer-title">{record.experiment_id}</h2>
            <div className="drawer__badges">
              <Badge tone="ember">{record.investigation_acronym}</Badge>
              <Badge tone={record.validation_status === 'validated' ? 'mint' : record.validation_status === 'suspect' ? 'red' : 'amber'}>
                {record.validation_status}
              </Badge>
              <span className="mono muted">{record.source_id}</span>
            </div>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </header>

        <div className="drawer__scroll">
          <section className="drawer-section">
            <div className="drawer-section__title">Sample</div>
            <dl className="kv">
              <div>
                <dt>Material (as reported)</dt>
                <dd>{record.material_raw}</dd>
              </div>
              <div>
                <dt>Material family (parsed)</dt>
                <dd>{record.material_family}</dd>
              </div>
              <div>
                <dt>Geometry</dt>
                <dd>{record.geometry}</dd>
              </div>
              <div>
                <dt>Sample number</dt>
                <dd className="mono">{record.sample_number}</dd>
              </div>
              <div>
                <dt>Test number</dt>
                <dd className="mono">{record.test_number}</dd>
              </div>
              <div>
                <dt>Date reported</dt>
                <dd>{shortDate(record.date_reported)}</dd>
              </div>
              <div>
                <dt>Principal investigator</dt>
                <dd>{record.pi ?? 'Not reported'}</dd>
              </div>
              <div>
                <dt>Validation</dt>
                <dd>{record.validation_status}</dd>
              </div>
            </dl>
          </section>

          <section className="drawer-section">
            <div className="drawer-section__title">Conditions & measurements</div>
            <div className="drawer-grid">
              <Field label="Initial O2" data={record.oxygen_initial_pct} />
              <Field label="Final O2" data={record.oxygen_final_pct} />
              <Field label="Total pressure" data={record.total_pressure_psia} />
              <Field label="O2 partial pressure" data={record.oxygen_partial_pressure_psi} />
              <Field label="Air flow (reported)" data={record.flow_initial_cm_s} />
              <Field label="Air flow (derived)" data={record.flow_derived_cm_s} />
              <Field label="Flow direction" data={record.flow_direction} />
              <Field label="Gravity regime" data={record.gravity_regime} />
              <Field label="Ignition power" data={record.ignition_power_w} />
              <Field label="Ignition time" data={record.ignition_time_s} />
              <Field label="Burn time" data={record.burn_time_s} />
              <Field label="Standardized outcome" data={record.outcome} />
              <Field label="Thickness" data={record.thickness_mm} />
              <Field label="Width" data={record.width_cm} />
              <Field label="Length" data={record.length_cm} />
              <Field label="Diameter" data={record.diameter_mm} />
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section__title">Quality signals</div>
            <div className="tag-list">
              {record.quality_flags.length === 0 && <span className="muted">No quality flags.</span>}
              {record.quality_flags.map((flag) => (
                <Badge key={flag} tone="amber">
                  {humanizeToken(flag)}
                </Badge>
              ))}
            </div>
            <div className="drawer-section__sub">Missing fields</div>
            <div className="tag-list">
              {record.missing_fields.map((field) => (
                <span className="missing-tag" key={field}>
                  {humanizeToken(field)}
                </span>
              ))}
            </div>
          </section>

          <section className="drawer-section">
            <div className="drawer-section__title">Provenance</div>
            <p className="provenance-line">
              <span className="mono">{record.source_id}</span> · {record.source_locator}
            </p>
            <p className="provenance-line">
              DOI {artifact?.doi ?? 'not assigned'} · {artifact?.license ?? 'license not stated'}
            </p>
            {artifact?.source_url && <SourceLink href={artifact.source_url}>Open source landing page</SourceLink>}
            <ul className="provenance-notes">
              {record.provenance_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <details className="raw-row">
            <summary>Raw source row ({Object.keys(record.raw).length} fields)</summary>
            <dl className="kv kv--raw">
              {Object.entries(record.raw).map(([key, value]) => (
                <div key={key}>
                  <dt>{key.trim() || '(blank header)'}</dt>
                  <dd>{value === null || value === '' ? <span className="muted">empty</span> : value}</dd>
                </div>
              ))}
            </dl>
          </details>
        </div>

        <footer className="drawer__foot">
          <button className="button button--ghost button--small" onClick={copyCitation}>
            {copied ? 'Citation copied' : 'Copy citation'}
          </button>
          <button
            className="button button--ghost button--small"
            onClick={() => downloadJson(`${record.experiment_id}.json`, record)}
          >
            Record JSON
          </button>
          <a
            className="button button--ember button--small"
            href={`#/compare?ids=${record.experiment_id}`}
            onClick={onClose}
          >
            Compare →
          </a>
        </footer>
      </aside>
    </div>
  );
}
