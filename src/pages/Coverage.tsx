import { useMemo, useState } from 'react';
import { records, validation } from '../lib/corpus';
import type { ExperimentRecord } from '../lib/types';
import { PageHeader, Panel, Stat, Badge, EmptyState } from '../components/ui';
import { humanizeToken, pct } from '../lib/format';

interface CoverageField {
  key: keyof ExperimentRecord | 'gravity_measured' | 'ignition_method_measured' | 'outcome_measured';
  label: string;
  unit: string | null;
  critical?: boolean;
  note: string;
}

const FIELDS: CoverageField[] = [
  { key: 'oxygen_initial_pct', label: 'Initial O2', unit: '% by vol', critical: true, note: 'Saffire S1 uses a range midpoint.' },
  { key: 'oxygen_final_pct', label: 'Final O2', unit: '% by vol', note: 'Two BASS-II finals and both Saffire finals are absent.' },
  { key: 'total_pressure_psia', label: 'Total pressure', unit: 'psia', critical: true, note: 'No pressure column exists in either experimental table.' },
  { key: 'oxygen_partial_pressure_psi', label: 'Oxygen partial pressure', unit: 'psi', critical: true, note: 'Cannot be derived without total pressure.' },
  { key: 'flow_initial_cm_s', label: 'Reported flow', unit: 'cm/s', note: 'BASS-II values are slow-response instrument displays.' },
  { key: 'flow_derived_cm_s', label: 'Derived flow', unit: 'cm/s', note: 'Workbook factor applied only where a display value exists.' },
  { key: 'thickness_mm', label: 'Thickness', unit: 'mm', note: 'Parsed from free-text material descriptions.' },
  { key: 'width_cm', label: 'Width', unit: 'cm', note: 'Parsed from geometry text when present.' },
  { key: 'length_cm', label: 'Length', unit: 'cm', note: 'Parsed from geometry text when present.' },
  { key: 'diameter_mm', label: 'Diameter', unit: 'mm', note: 'Parsed from geometry text when present.' },
  { key: 'gravity_measured', label: 'Per-test gravity', unit: null, critical: true, note: 'Gravity is assigned at investigation level only.' },
  { key: 'ignition_method_measured', label: 'Ignition method', unit: null, critical: true, note: 'Not reported as a per-test field.' },
  { key: 'ignition_power_w', label: 'Ignition power', unit: 'W', note: 'Only the two Saffire-I samples report ignition power.' },
  { key: 'ignition_time_s', label: 'Ignition time', unit: 's', note: 'Only the two Saffire-I samples report ignition time.' },
  { key: 'burn_time_s', label: 'Burn time', unit: 's', note: 'A reported duration, not a standardized outcome.' },
  { key: 'outcome_measured', label: 'Standardized outcome', unit: null, critical: true, note: 'No extinction or sustained-burning classification is reported.' },
  { key: 'co2_initial_pct', label: 'Initial CO2', unit: '% by vol', note: 'Reported where the source table contains a CO2 column.' },
  { key: 'co2_final_pct', label: 'Final CO2', unit: '% by vol', note: 'Reported where the source table contains a CO2 column.' },
  { key: 'co_initial_ppm', label: 'Initial CO', unit: 'ppm', note: 'Reported where the source table contains a CO column.' },
  { key: 'co_final_ppm', label: 'Final CO', unit: 'ppm', note: 'Reported where the source table contains a CO column.' },
];

function hasValue(record: ExperimentRecord, field: CoverageField): boolean {
  if (field.key === 'gravity_measured') return record.gravity_regime.status === 'measured';
  if (field.key === 'ignition_method_measured') return record.ignition_method.status === 'measured';
  if (field.key === 'outcome_measured') return record.outcome.status === 'measured';
  const value = (record as unknown as Record<string, { value?: unknown } | undefined>)[field.key as string];
  return Boolean(value && value.value !== null && value.value !== undefined && value.value !== '');
}

function hashParam(name: string): string | null {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get(name);
}

function recordsForFlag(flag: string): ExperimentRecord[] {
  return records.filter((record) => record.quality_flags.includes(flag));
}

export function Coverage() {
  const [quality, setQuality] = useState<string>(() => hashParam('quality') ?? 'all');
  const [flag, setFlag] = useState<string | null>(() => hashParam('flag'));

  const rows = useMemo(() => {
    const total = records.length;
    return FIELDS.map((field) => {
      const reported = records.filter((record) => hasValue(record, field)).length;
      return {
        ...field,
        total,
        reported,
        missing: total - reported,
        pct: total ? Math.round((reported / total) * 100) : 0,
      };
    });
  }, []);

  const zeroCoverage = rows.filter((row) => row.critical && row.reported === 0);
  const qualityCounts = validation.quality_counts;
  const flagged = records.filter((record) => record.quality_flags.length > 0).length;
  const drilldown = useMemo(() => {
    if (flag) return recordsForFlag(flag);
    if (quality !== 'all') return records.filter((record) => record.validation_status === quality);
    return [];
  }, [flag, quality]);
  const drilldownTitle = flag
    ? `Records flagged “${humanizeToken(flag)}”`
    : quality !== 'all'
      ? `Records with ${quality} validation status`
      : '';

  function setDrilldown(nextQuality: string, nextFlag: string | null) {
    setQuality(nextQuality);
    setFlag(nextFlag);
    const params = new URLSearchParams();
    if (nextQuality !== 'all') params.set('quality', nextQuality);
    if (nextFlag) params.set('flag', nextFlag);
    const next = `#/coverage${params.toString() ? `?${params.toString()}` : ''}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }

  return (
    <div className="page page--coverage">
      <PageHeader
        index="08"
        eyebrow="Coverage & Validation"
        title={
          <>
            What the corpus <em>actually contains.</em>
          </>
        }
        lede="Every count on this page is computed from the bundled records at load time. Missing values are unknown, not zero, and no field is repaired in the browser."
        actions={
          <a className="button button--ghost button--small" href="#/methodology">
            Validation methodology
          </a>
        }
      />

      <div className="wb-stat-grid">
        <Stat value={records.length} label="Experiment records" detail={`${validation.accepted_records.total} accepted rows`} />
        <Stat
          value={qualityCounts.validated}
          label="Validated"
          tone="mint"
          detail={`${pct(qualityCounts.validated, records.length)} of records`}
        />
        <Stat
          value={qualityCounts.partial}
          label="Partial"
          tone="amber"
          detail={`${pct(qualityCounts.partial, records.length)} of records`}
        />
        <Stat
          value={qualityCounts.suspect}
          label="Suspect"
          tone="ember"
          detail={`${flagged} records carry at least one quality flag`}
        />
      </div>

      <Panel kicker="Scientific constraints" title={`${zeroCoverage.length} fields stay at zero`}>
        <div className="wb-constraint-grid">
          {zeroCoverage.map((row) => (
            <div key={String(row.key)} className="wb-constraint">
              <span className="wb-constraint__value">0 / {row.total}</span>
              <span className="wb-constraint__label">{row.label}</span>
              <p>{row.note}</p>
            </div>
          ))}
          {zeroCoverage.length === 0 && <p className="muted">No critical field has zero coverage in this build.</p>}
        </div>
        <p className="panel-caption">
          These absences are enforced by the corpus integrity checks and by the deterministic assistant. A request to
          estimate, impute, or certify them is refused rather than answered.
        </p>
      </Panel>

      <Panel kicker="Field coverage" title="Reported vs. missing">
        <div className="table-wrap">
          <table className="data-table wb-coverage-table">
            <thead>
              <tr>
                <th>Field</th>
                <th>Unit</th>
                <th className="num">Reported</th>
                <th className="num">Missing</th>
                <th className="num">Total</th>
                <th>Coverage</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={String(row.key)}>
                  <th>
                    {row.label}
                    {row.critical && <span className="wb-critical-dot" title="Scientific constraint field" />}
                    <span className="record-sub">{row.note}</span>
                  </th>
                  <td className="mono">{row.unit ?? '—'}</td>
                  <td className="num mono">{row.reported}</td>
                  <td className="num mono">{row.missing}</td>
                  <td className="num mono">{row.total}</td>
                  <td>
                    <div className="wb-bar" aria-hidden="true">
                      <span style={{ width: `${row.pct}%` }} />
                    </div>
                    <span className="mono wb-bar-label">{row.pct}%</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>

      <div className="wb-two-col">
        <Panel kicker="Validation" title="Status distribution">
          <ul className="wb-distribution">
            {(['validated', 'partial', 'suspect'] as const).map((status) => {
              const count = qualityCounts[status];
              const width = records.length ? Math.round((count / records.length) * 100) : 0;
              return (
                <li key={status}>
                  <button
                    type="button"
                    className={`wb-distribution__row ${quality === status && !flag ? 'is-active' : ''}`}
                    onClick={() => setDrilldown(status, null)}
                    aria-pressed={quality === status && !flag}
                  >
                    <span className="wb-distribution__label">
                      <Badge tone={status === 'validated' ? 'mint' : status === 'suspect' ? 'red' : 'amber'}>
                        {status}
                      </Badge>
                    </span>
                    <span className="wb-bar" aria-hidden="true">
                      <span style={{ width: `${width}%` }} />
                    </span>
                    <span className="mono">{count}</span>
                  </button>
                </li>
              );
            })}
          </ul>
          <p className="panel-caption">
            Validation status is a recorded pipeline result. It is not an independent scientific audit, and this page
            does not reclassify a row.
          </p>
        </Panel>

        <Panel kicker="Quality flags" title="Signals preserved from ingestion">
          <ul className="wb-flag-list">
            {Object.entries(validation.quality_flag_counts)
              .sort((a, b) => b[1] - a[1])
              .map(([key, count]) => (
                <li key={key}>
                  <button
                    type="button"
                    className={`wb-flag ${flag === key ? 'is-active' : ''}`}
                    onClick={() => setDrilldown('all', key)}
                    aria-pressed={flag === key}
                  >
                    <span>{humanizeToken(key)}</span>
                    <span className="mono">{count}</span>
                  </button>
                </li>
              ))}
          </ul>
          <p className="panel-caption">
            A flag is shown, never cleared. Selecting a flag lists the records that carry it.
          </p>
        </Panel>
      </div>

      {drilldownTitle && (
        <Panel
          kicker="Drill-down"
          title={drilldownTitle}
          actions={
            <button type="button" className="text-link" onClick={() => setDrilldown('all', null)}>
              Clear drill-down
            </button>
          }
        >
          {drilldown.length === 0 ? (
            <EmptyState title="No records match this selection">
              The filter is valid but no record carries it in this corpus version.
            </EmptyState>
          ) : (
            <div className="table-wrap">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Record</th>
                    <th>Family</th>
                    <th>Material</th>
                    <th>Validation</th>
                    <th>Flags</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {drilldown.slice(0, 60).map((record) => (
                    <tr key={record.experiment_id}>
                      <th className="mono">{record.experiment_id}</th>
                      <td>{record.investigation_acronym}</td>
                      <td>{record.material_family}</td>
                      <td>
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
                      </td>
                      <td>{record.quality_flags.map(humanizeToken).join(' · ') || '—'}</td>
                      <td>
                        <a className="text-link" href={`#/atlas?id=${encodeURIComponent(record.experiment_id)}`}>
                          Open
                        </a>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {drilldown.length > 60 && (
            <p className="panel-caption">Showing the first 60 of {drilldown.length} records.</p>
          )}
        </Panel>
      )}

      <Panel kicker="Ingestion checks" title="Validation report">
        <ul className="wb-check-list">
          {validation.checks.map((check) => (
            <li key={check.check}>
              <Badge tone={check.result === 'PASS' ? 'mint' : 'red'}>{check.result}</Badge>
              <span>{check.check}</span>
              <span className="mono muted">{check.detail}</span>
            </li>
          ))}
        </ul>
      </Panel>

      <div className="wb-two-col">
        <Panel kicker="Cross-check" title="CSV vs. matrix workbook">
          <dl className="kv">
            <div>
              <dt>Test IDs matched</dt>
              <dd className="mono">
                {validation.matrix_cross_check.test_ids_matched} / {validation.matrix_cross_check.test_ids_in_csv}
              </dd>
            </div>
            <div>
              <dt>Initial O2 exact matches</dt>
              <dd className="mono">
                {validation.matrix_cross_check.o2_initial_exact_matches} / {validation.matrix_cross_check.test_ids_in_csv}
              </dd>
            </div>
            <div>
              <dt>Substantive numeric conflicts</dt>
              <dd className="mono">{validation.matrix_cross_check.substantive_numeric_conflicts.length}</dd>
            </div>
            <div>
              <dt>Duplicate sample numbers</dt>
              <dd className="mono">{validation.duplicate_sample_numbers.length}</dd>
            </div>
            <div>
              <dt>Rejected rows</dt>
              <dd className="mono">{validation.rejected_rows.length}</dd>
            </div>
            <div>
              <dt>Excluded non-experiment rows</dt>
              <dd className="mono">{validation.excluded_non_experiment_rows.length}</dd>
            </div>
          </dl>
          <p className="panel-caption">{validation.matrix_cross_check.interpretation}</p>
        </Panel>

        <Panel kicker="Derived flow" title="Fan calibration caveat">
          <p className="wb-formula mono">{validation.fan_calibration.formula}</p>
          <p>{validation.fan_calibration.caveat}</p>
          <p className="panel-caption">
            Source locator: {validation.fan_calibration.source_locator}. Workbook note present:{' '}
            {validation.fan_calibration.workbook_note_present ? 'yes' : 'no'}.
          </p>
          <p className="panel-caption">
            A derived flow is labelled as derived in the explorer. It is not a per-test calibrated velocity and it is
            not used to infer a fire outcome.
          </p>
        </Panel>
      </div>

      <Panel kicker="Pipeline" title="What was excluded, and why">
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Row</th>
                <th>Sample</th>
                <th>Material text</th>
                <th>Reason</th>
              </tr>
            </thead>
            <tbody>
              {validation.excluded_non_experiment_rows.map((row) => (
                <tr key={row.row}>
                  <td className="mono">{row.row}</td>
                  <td className="mono">{row.sample}</td>
                  <td>{row.material}</td>
                  <td>{row.reason}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="panel-caption">
          Excluded rows are not experiments and are not silently promoted into the record layer. Rejected rows:{' '}
          {validation.rejected_rows.length}. Duplicate record IDs: {validation.duplicate_record_ids.length}.
        </p>
      </Panel>
    </div>
  );
}
