import { useEffect, useMemo, useRef, useState } from 'react';
import type { ExperimentRecord, DataValue } from '../lib/types';
import { artifactsFor, records } from '../lib/corpus';
import { formatCompact, humanizeToken, shortDate, statusLabel } from '../lib/format';
import { Badge, SourceLink, StatusBadge } from './ui';
import { downloadJson } from '../lib/export';
import { evidenceApi } from '../lib/apiClient';
import { useEvidenceSession } from '../lib/evidenceSession';

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), summary, [tabindex]:not([tabindex="-1"])';

function Field({
  label,
  data,
  unit,
}: {
  label: string;
  data: DataValue<string> | DataValue<number>;
  unit?: string;
}) {
  return (
    <div className="drawer-field">
      <div className="drawer-field__label">{label}</div>
      <div className={`drawer-field__value ${data.value === null ? 'is-missing' : ''}`}>
        {data.value === null
          ? data.status === 'not_reported'
            ? 'Not reported in this record'
            : statusLabel(data.status)
          : formatCompact(data, unit)}
      </div>
      <div className="drawer-field__status">
        <StatusBadge status={data.status} />
      </div>
      {data.note && <p className="drawer-field__note">{data.note}</p>}
      {data.raw !== null && (
        <p className="drawer-field__note">
          Original token: <code>{data.raw}</code>
        </p>
      )}
      {data.source_file && (
        <p className="drawer-field__note">
          Source: {data.source_file} · {data.source_locator}
        </p>
      )}
    </div>
  );
}

function relatedRecords(record: ExperimentRecord): ExperimentRecord[] {
  const sameMaterial = records.filter(
    (item) => item.experiment_id !== record.experiment_id && item.material_family === record.material_family,
  );
  const sameFamily = records.filter(
    (item) =>
      item.experiment_id !== record.experiment_id &&
      item.material_family !== record.material_family &&
      item.family === record.family,
  );
  return [...sameMaterial, ...sameFamily].slice(0, 6);
}

export function RecordDrawer({
  record,
  onClose,
  onNavigate,
  onAddToNotebook,
}: {
  record: ExperimentRecord | null;
  onClose: () => void;
  onNavigate?: (record: ExperimentRecord) => void;
  onAddToNotebook?: (record: ExperimentRecord) => string | null;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const [copied, setCopied] = useState(false);
  const [notebookMessage, setNotebookMessage] = useState<string | null>(null);
  const session = useEvidenceSession();
  const [originals, setOriginals] = useState<
    Array<{ artifact_id: string; original_filename: string; download_available: boolean }>
  >([]);
  useEffect(() => {
    setOriginals([]);
    setNotebookMessage(null);
    setCopied(false);
    if (!record || session.mode !== 'api') return;
    let active = true;
    evidenceApi
      .source(record.source_id)
      .then((result) => {
        if (active) setOriginals(result.artifacts as typeof originals);
      })
      .catch((error) => {
        if (active) session.fallback(error.message);
      });
    return () => {
      active = false;
    };
  }, [record?.source_id, session.mode]);

  useEffect(() => {
    if (!record) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== 'Tab') return;
      const drawer = drawerRef.current;
      if (!drawer) return;
      const focusable = [...drawer.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(
        (element) => element.offsetParent !== null || element === closeRef.current,
      );
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    document.body.classList.add('has-drawer');
    closeRef.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.classList.remove('has-drawer');
      previousFocus?.focus?.();
    };
  }, [record, onClose]);

  const related = useMemo(() => (record ? relatedRecords(record) : []), [record]);

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
      <button className="drawer-backdrop" aria-label="Close record detail" onClick={onClose} tabIndex={-1} />
      <aside className="drawer" ref={drawerRef}>
        <header className="drawer__head">
          <div>
            <div className="kicker">Experiment record</div>
            <h2 id="drawer-title">{record.experiment_id}</h2>
            <div className="drawer__badges">
              <Badge tone="ember">{record.investigation_acronym}</Badge>
              <Badge
                tone={
                  record.validation_status === 'validated'
                    ? 'mint'
                    : record.validation_status === 'suspect'
                      ? 'red'
                      : 'amber'
                }
              >
                {record.validation_status}
              </Badge>
              <span className="mono muted">{record.source_id}</span>
            </div>
          </div>
          <button ref={closeRef} className="icon-button" onClick={onClose} aria-label="Close record detail">
            ✕
          </button>
        </header>

        <div className="drawer__scroll">
          <section className="drawer-section">
            <div className="drawer-section__title">Record summary</div>
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

          <section className="drawer-section drawer-section--absence">
            <div className="drawer-section__title">What this record does not report</div>
            <p className="panel-caption">
              These absences are evidence findings. They are not zeroes and they are never filled from another
              record or a nominal cabin condition.
            </p>
            <ul className="drawer-absence">
              <li>
                <strong>Total pressure</strong> — {record.total_pressure_psia.value === null ? 'not reported in this record layer.' : 'reported; verify the source row.'}
              </li>
              <li>
                <strong>Per-test gravity</strong> — {record.gravity_regime.status === 'measured' ? 'reported.' : 'investigation-level label only, not a per-test measurement.'}
              </li>
              <li>
                <strong>Ignition method</strong> — {record.ignition_method.status === 'measured' ? 'reported.' : 'not reported as a per-test field.'}
              </li>
              <li>
                <strong>Standardized outcome</strong> — {record.outcome.status === 'measured' ? 'reported.' : 'no standardized extinction or burning outcome.'}
              </li>
              <li>
                <strong>Oxygen partial pressure</strong> — {record.oxygen_partial_pressure_psi.value === null ? 'cannot be derived without total pressure.' : 'reported; verify the source row.'}
              </li>
            </ul>
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
              <Field label="Initial CO2" data={record.co2_initial_pct} />
              <Field label="Final CO2" data={record.co2_final_pct} />
              <Field label="Initial CO" data={record.co_initial_ppm} />
              <Field label="Final CO" data={record.co_final_ppm} />
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
              {record.missing_fields.length === 0 && <span className="muted">No missing-field markers.</span>}
              {record.missing_fields.map((field) => (
                <span className="missing-tag" key={field}>
                  {humanizeToken(field)}
                </span>
              ))}
            </div>
          </section>

          {related.length > 0 && (
            <section className="drawer-section">
              <div className="drawer-section__title">Related records</div>
              <p className="panel-caption">
                Chosen by parsed material family first, then by investigation. Related does not mean comparable.
              </p>
              <ul className="drawer-related">
                {related.map((item) => (
                  <li key={item.experiment_id}>
                    <button
                      type="button"
                      className="text-link"
                      onClick={() => {
                        if (onNavigate) onNavigate(item);
                      }}
                      disabled={!onNavigate}
                    >
                      {item.experiment_id}
                    </button>
                    <span>{item.material_family}</span>
                    <span className="mono muted">
                      O2 {formatCompact(item.oxygen_initial_pct)}
                    </span>
                    <span className="mono muted">{item.validation_status}</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="drawer-section">
            <div className="drawer-section__title">Provenance</div>
            <p className="provenance-line">
              <span className="mono">{record.source_id}</span> · {record.source_locator}
            </p>
            <p className="provenance-line">
              DOI {artifact?.doi ?? 'not assigned'} · {artifact?.license ?? 'license not stated'}
            </p>
            {artifact?.source_url && <SourceLink href={artifact.source_url}>Open source landing page</SourceLink>}
            {session.mode === 'api'
              ? originals
                  .filter((item) => item.download_available)
                  .map((item) => (
                    <p key={item.artifact_id}>
                      <a href={evidenceApi.originalUrl(record.source_id, item.artifact_id)} download>
                        Download original: {item.original_filename}
                      </a>
                    </p>
                  ))
              : artifact?.local_original_url && (
                  <p>
                    <a href={artifact.local_original_url} download>
                      Download preserved NASA CSV original ↓
                    </a>
                  </p>
                )}
            <p className="panel-caption">
              Not reported means absent from this record layer, not absent from all NASA research. The BASS-II report
              discusses pressure and ignition for subsets without a verified mapping to these rows.
            </p>
            <ul className="provenance-notes">
              {record.provenance_notes.map((note) => (
                <li key={note}>{note}</li>
              ))}
            </ul>
          </section>

          <details className="raw-row">
            <summary>Measurement ledger: original values, units and transformations</summary>
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Quantity</th>
                    <th>Original</th>
                    <th>Normalized</th>
                    <th>Basis / source</th>
                  </tr>
                </thead>
                <tbody>
                  {record.measurements.map((measurement) => (
                    <tr key={measurement.measurement_id}>
                      <th>{humanizeToken(measurement.quantity)}</th>
                      <td>
                        {measurement.original_value ?? 'Not reported'} {measurement.original_unit}
                      </td>
                      <td>
                        {measurement.normalized_value ?? 'Unknown'} {measurement.normalized_unit}
                      </td>
                      <td>
                        {statusLabel(measurement.status)} · {measurement.note} · {measurement.source_file} ·{' '}
                        {measurement.source_locator}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="panel-caption">
              Per-value uncertainty is not supplied in these tables. Correction and interpretation notes are not
              uncertainty estimates.
            </p>
          </details>

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
          {onAddToNotebook && (
            <button
              className="button button--ghost button--small"
              onClick={() => {
                const message = onAddToNotebook(record);
                if (message) setNotebookMessage(message);
              }}
            >
              Add to notebook
            </button>
          )}
          <a
            className="button button--ember button--small"
            href={`#/compare?ids=${record.experiment_id}`}
            onClick={onClose}
          >
            Compare →
          </a>
        </footer>
        {notebookMessage && (
          <p className="drawer__notice" role="status">
            {notebookMessage}
          </p>
        )}
      </aside>
    </div>
  );
}
