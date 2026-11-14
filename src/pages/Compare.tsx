import { useMemo, useState } from 'react';
import { records, recordById } from '../lib/corpus';
import type { ExperimentRecord } from '../lib/types';
import { comparabilityAudit, compareFields, comparisonBlockerCount, fieldDisplay, fieldStatus } from '../lib/compare';
import { formatCompact } from '../lib/format';
import { downloadText, formatExportStamp, recordsToCsv } from '../lib/export';
import { Badge, Callout, EmptyState, PageHeader, Panel } from '../components/ui';

function initialSelection(): ExperimentRecord[] {
  const query = window.location.hash.split('?')[1] ?? '';
  const ids = new URLSearchParams(query).get('ids')?.split(',').filter(Boolean) ?? [];
  const selected = ids
    .map((id) => recordById.get(id))
    .filter((record): record is ExperimentRecord => Boolean(record));
  if (selected.length) return selected.slice(0, 4);
  return [recordById.get('BASS2-B1'), recordById.get('SAFFIRE1-S1')].filter(
    (record): record is ExperimentRecord => Boolean(record),
  );
}

const stateLabel = {
  shared: 'Shared',
  partial: 'Partial',
  blocked: 'Blocker',
  unknown: 'Unknown',
} as const;

export function Compare() {
  const [selected, setSelected] = useState<ExperimentRecord[]>(initialSelection);
  const [toAdd, setToAdd] = useState('');
  const checks = useMemo(() => comparabilityAudit(selected), [selected]);
  const blockers = comparisonBlockerCount(checks);
  const groups = [...new Set(compareFields.map((field) => field.group))];

  function addRecord(id: string) {
    const record = recordById.get(id);
    if (!record || selected.some((item) => item.experiment_id === id) || selected.length >= 4) return;
    setSelected((current) => [...current, record]);
    setToAdd('');
  }

  function removeRecord(id: string) {
    setSelected((current) => current.filter((record) => record.experiment_id !== id));
  }

  return (
    <div className="page page--compare">
      <PageHeader
        index="03"
        eyebrow="Compare"
        title={<>Side by side, <em>without pretending.</em></>}
        lede="A comparison table is useful only if it shows what differs in the measurement basis. Pick up to four records and read the blockers before the numbers."
        actions={
          <button
            className="button button--ghost button--small"
            disabled={selected.length < 1}
            onClick={() =>
              downloadText(
                `firertrace-comparison-${formatExportStamp()}.csv`,
                recordsToCsv(selected),
                'text/csv;charset=utf-8',
              )
            }
          >
            Export comparison CSV
          </button>
        }
      />

      <Panel kicker="Selection" title="Records in this comparison" actions={<Badge tone={selected.length > 1 ? 'ember' : 'muted'}>{selected.length} / 4</Badge>}>
        <div className="compare-picker">
          <div className="selected-chips">
            {selected.map((record) => (
              <span className="selected-chip" key={record.experiment_id}>
                <span className="selected-chip__id mono">{record.experiment_id}</span>
                <span className="selected-chip__meta">{record.investigation_acronym} · {record.material_family}</span>
                <button onClick={() => removeRecord(record.experiment_id)} aria-label={`Remove ${record.experiment_id}`}>✕</button>
              </span>
            ))}
            {selected.length === 0 && <span className="muted">No records selected.</span>}
          </div>
          <div className="compare-add">
            <label className="field">
              <span>Add a record</span>
              <select
                value={toAdd}
                onChange={(event) => addRecord(event.target.value)}
                disabled={selected.length >= 4}
              >
                <option value="">Choose a record…</option>
                {records.map((record) => (
                  <option key={record.experiment_id} value={record.experiment_id}>
                    {record.experiment_id} · {record.material_family} · {record.investigation_acronym}
                  </option>
                ))}
              </select>
            </label>
            <button
              className="text-link"
              onClick={() => {
                const bass = recordById.get('BASS2-B1');
                const saffire = recordById.get('SAFFIRE1-S1');
                setSelected([bass, saffire].filter((record): record is ExperimentRecord => Boolean(record)));
              }}
            >
              Reset demo pair
            </button>
          </div>
        </div>
      </Panel>

      {selected.length === 0 ? (
        <EmptyState title="Choose at least one record">
          Add a record above, or open the Evidence Atlas and use “Compare” from any record.
        </EmptyState>
      ) : (
        <>
          <section className={`comparability ${blockers > 0 ? 'comparability--blocked' : ''}`}>
            <div className="comparability__head">
              <div>
                <div className="kicker">Comparability audit</div>
                <h2>{blockers > 0 ? `${blockers} blocker${blockers === 1 ? '' : 's'} to a direct comparison` : 'No audit blockers detected'}</h2>
              </div>
              <div className="comparability__note">
                No similarity score. A score would hide the measurement mismatch.
              </div>
            </div>
            <div className="check-grid">
              {checks.map((check) => (
                <div className={`check check--${check.state}`} key={check.id}>
                  <div className="check__top">
                    <span className="check__label">{check.label}</span>
                    <span className="check__state">{stateLabel[check.state]}</span>
                  </div>
                  <p>{check.detail}</p>
                </div>
              ))}
            </div>
          </section>

          <Callout title="What this table can support" tone="neutral">
            It can show the reported values and their provenance side by side. It cannot establish
            atmospheric equivalence, isolate a gravity effect, compare spread rates, or rank
            materials: total pressure and per-test gravity are absent, flow and sample conditions require separate checks, and no
            standardized outcome exists.
          </Callout>

          <div className="compare-table-wrap">
            <table className="compare-table">
              <thead>
                <tr>
                  <th className="compare-table__rowhead">Field</th>
                  {selected.map((record) => (
                    <th key={record.experiment_id}>
                      <div className="compare-head">
                        <span className="compare-head__id">{record.experiment_id}</span>
                        <span className="compare-head__family">{record.investigation_acronym}</span>
                        <span className="compare-head__sample mono">sample {record.sample_number}</span>
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {groups.map((group) => (
                  <>
                    <tr className="compare-group" key={`group-${group}`}>
                      <th colSpan={selected.length + 1}>{group}</th>
                    </tr>
                    {compareFields
                      .filter((field) => field.group === group)
                      .map((field) => (
                        <tr key={field.key}>
                          <th className="compare-table__rowhead">
                            {field.label}
                            {field.note && <span className="row-note">{field.note}</span>}
                          </th>
                          {selected.map((record) => {
                            const display = fieldDisplay(field, record);
                            const missing = display === 'Not reported';
                            const status = fieldStatus(field, record);
                            return (
                              <td key={record.experiment_id} className={missing ? 'is-missing' : ''}>
                                <span className="compare-value">{display}</span>
                                {!missing && status.toLowerCase() !== 'reported' && (
                                  <span className="compare-status">{status}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                  </>
                ))}
              </tbody>
            </table>
          </div>

          <div className="compare-atmosphere">
            <div>
              <div className="kicker">Atmospheric equivalence</div>
              <h3>Not calculable for this selection.</h3>
              <p>
                Pressure is missing on every selected record, so oxygen partial pressure is missing
                too. The comparison can show an oxygen fraction, but it cannot say the records sat in
                the same atmosphere.
              </p>
            </div>
            <div className="compare-atmosphere__values">
              {selected.map((record) => (
                <div key={record.experiment_id}>
                  <span className="mono">{record.experiment_id}</span>
                  <span>{formatCompact(record.oxygen_initial_pct)} O2</span>
                  <span className="is-missing">{formatCompact(record.total_pressure_psia)} pressure</span>
                </div>
              ))}
            </div>
            <a className="button button--ghost button--small" href="#/atmosphere">Open Atmosphere Explorer →</a>
          </div>
        </>
      )}
    </div>
  );
}
