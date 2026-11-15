import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { records, recordById } from '../lib/corpus';
import type { ExperimentRecord } from '../lib/types';
import { emptyFilters, filterRecords, uniqueFamilies, uniqueMaterials } from '../lib/records';
import type { AtlasFilters, SortKey } from '../lib/records';
import { formatCompact, formatNumber } from '../lib/format';
import { downloadText, formatExportStamp, recordsToCsv } from '../lib/export';
import { Badge, EmptyState, PageHeader, Panel } from '../components/ui';
import { RecordDrawer } from '../components/RecordDrawer';
import { BasketButton } from '../lib/basketContext';
import { evidenceApi, ServiceUnavailable, type ExperimentPage } from '../lib/apiClient';
import { useEvidenceSession } from '../lib/evidenceSession';

const PAGE_SIZE = 24;
const ResearchLibrary = lazy(() => import('../components/ResearchLibrary'));

function initialFamily(): string {
  const query = window.location.hash.split('?')[1] ?? '';
  return new URLSearchParams(query).get('family') ?? 'all';
}

export function Atlas() {
  const [research, setResearch] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('view') === 'research');
  useEffect(() => {
    const readView = () => setResearch(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('view') === 'research');
    window.addEventListener('hashchange', readView);
    return () => window.removeEventListener('hashchange', readView);
  }, []);
  const [filters, setFilters] = useState<AtlasFilters>({
    ...emptyFilters,
    family: initialFamily(),
  });
  const [page, setPage] = useState(0);
  const session = useEvidenceSession();
  const [remote, setRemote] = useState<{ key: string; data: ExperimentPage } | null>(null);
  const queryKey = JSON.stringify([filters, page]);
  useEffect(() => {
    if (research || session.mode !== 'api') return;
    let active = true;
    evidenceApi.experiments({
      q: filters.query, family: filters.family === 'all' ? undefined : filters.family,
      material: filters.material === 'all' ? undefined : filters.material,
      material_exact: true, atlas_search: true, validation_status: filters.quality === 'all' ? undefined : filters.quality,
      min_o2: filters.o2Min ?? undefined, max_o2: filters.o2Max ?? undefined,
      flow_only: filters.flowOnly, sort: filters.sort, limit: PAGE_SIZE, offset: page * PAGE_SIZE,
    }).then(data => {
      if (data.items.some(item => !recordById.has(item.experiment_id))) throw new ServiceUnavailable('API returned an unknown experiment; using bundled data.');
      if (active) setRemote({ key: queryKey, data });
    }).catch(error => { if (active) session.fallback(error.message); });
    return () => { active = false; };
  }, [queryKey, session.mode, research]);
  const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
  const [selected, setSelected] = useState<ExperimentRecord | null>(
    () => recordById.get(params.get('id') ?? '') ?? null,
  );
  useEffect(() => {
    const readDetail = () => {
      if (!window.location.hash.startsWith('#/atlas')) return;
      const query = new URLSearchParams(window.location.hash.split('?')[1] ?? '');
      setSelected(recordById.get(query.get('id') ?? '') ?? null);
    };
    window.addEventListener('hashchange', readDetail);
    return () => window.removeEventListener('hashchange', readDetail);
  }, []);

  const filtered = useMemo(() => filterRecords(records, filters), [filters]);
  const apiData = session.mode === 'api' && remote?.key === queryKey ? remote.data : null;
  const count = apiData?.total ?? filtered.length;
  const pageCount = Math.max(1, Math.ceil(count / PAGE_SIZE));
  const safePage = Math.min(page, pageCount - 1);
  const visible = apiData ? apiData.items.map(item => recordById.get(item.experiment_id)!) : filtered.slice(safePage * PAGE_SIZE, safePage * PAGE_SIZE + PAGE_SIZE);
  const families = useMemo(() => uniqueFamilies(), []);
  const materials = useMemo(() => uniqueMaterials(), []);
  const flagged = filtered.filter((record) => record.validation_status !== 'validated').length;

  function update(patch: Partial<AtlasFilters>) {
    setFilters((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function exportFiltered() {
    downloadText(
      `firertrace-records-${formatExportStamp()}.csv`,
      recordsToCsv(filtered),
      'text/csv;charset=utf-8',
    );
  }

  if (research) return <Suspense fallback={<div className="page" role="status">Loading research library…</div>}><ResearchLibrary onBack={() => { setResearch(false); window.history.replaceState(null, '', '#/atlas'); }} /></Suspense>;

  return (
    <div className="page page--atlas">
      <PageHeader
        index="02"
        eyebrow="Evidence Atlas"
        title={
          <>
            Every record, <em>every gap.</em>
          </>
        }
        lede="Search the normalized experiment records and open any row for its measurements, quality flags, raw source fields and provenance. Missing values stay missing."
        actions={
          <><button className="button button--ghost button--small" onClick={() => { setResearch(true); window.history.replaceState(null, '', '#/atlas?view=research'); }}>Research findings & coverage</button><button className="button button--ghost button--small" onClick={exportFiltered}>
            Export filtered CSV
          </button></>
        }
      />
      {params.get('from') === 'gap' && (
        <p>
          <a className="text-link" href="#/gap">
            ← Return to saved scenario
          </a>
        </p>
      )}
      {params.has('id') && !recordById.has(params.get('id') ?? '') && (
        <p role="alert">Requested record ID was not found. No substitute record was opened.</p>
      )}

      <div className="atlas-summary">
        <div className="atlas-summary__count">
          <strong>{count}</strong>
          <span>records in view</span>
        </div>
        <div className="atlas-summary__meta">
          <span className="mono">{families.join(' · ')}</span>
          <span>{flagged} flagged partial or suspect</span>
          <span>Pressure reported: 0</span>
        </div>
      </div>

      <Panel className="filter-panel" kicker="Query" title="Filter the corpus">
        <div className="filter-grid">
          <label className="field field--search">
            <span>Search</span>
            <input
              type="search"
              placeholder="ID, material, PI, sample…"
              value={filters.query}
              onChange={(event) => update({ query: event.target.value })}
            />
          </label>
          <label className="field">
            <span>Investigation</span>
            <select
              value={filters.family}
              onChange={(event) => update({ family: event.target.value })}
            >
              <option value="all">All investigations</option>
              {families.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Material family</span>
            <select
              value={filters.material}
              onChange={(event) => update({ material: event.target.value })}
            >
              <option value="all">All materials</option>
              {materials.map((material) => (
                <option key={material} value={material}>
                  {material}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            <span>Quality</span>
            <select
              value={filters.quality}
              onChange={(event) => update({ quality: event.target.value })}
            >
              <option value="all">All statuses</option>
              <option value="validated">Validated</option>
              <option value="partial">Partial</option>
              <option value="suspect">Suspect</option>
            </select>
          </label>
          <label className="field">
            <span>O2 min</span>
            <input
              type="number"
              min={0}
              max={25}
              step={0.1}
              value={filters.o2Min ?? ''}
              placeholder="13.6"
              onChange={(event) =>
                update({ o2Min: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>O2 max</span>
            <input
              type="number"
              min={0}
              max={25}
              step={0.1}
              value={filters.o2Max ?? ''}
              placeholder="22.2"
              onChange={(event) =>
                update({ o2Max: event.target.value === '' ? null : Number(event.target.value) })
              }
            />
          </label>
          <label className="field">
            <span>Sort</span>
            <select
              value={filters.sort}
              onChange={(event) => update({ sort: event.target.value as SortKey })}
            >
              <option value="id">Record ID</option>
              <option value="o2-asc">O2 ascending</option>
              <option value="o2-desc">O2 descending</option>
              <option value="material">Material</option>
              <option value="date">Date reported</option>
            </select>
          </label>
        </div>
        <div className="filter-foot">
          <label className="field field--check">
            <input
              type="checkbox"
              checked={filters.flowOnly}
              onChange={(event) => update({ flowOnly: event.target.checked })}
            />
            <span>Only records with reported flow</span>
          </label>
          <span className="mono">
            {count} / {records.length} records · showing {visible.length} on page{' '}
            {safePage + 1} of {pageCount}
          </span>
          <button
            className="text-link"
            onClick={() => {
              setFilters({ ...emptyFilters });
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </div>
      </Panel>

      <Panel className="table-panel" kicker="Records" title="Experiment table">
        {visible.length === 0 ? (
          <EmptyState title="No records match these filters">
            The corpus still contains {records.length} records. Clear a filter or widen the oxygen
            range.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Record</th>
                  <th>Investigation</th>
                  <th>Material</th>
                  <th className="num">Initial O2</th>
                  <th className="num">Flow</th>
                  <th>Pressure</th>
                  <th>Gravity</th>
                  <th>Status</th>
                  <th>Evidence basket</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => (
                  <tr
                    key={record.experiment_id}
                    className="data-table__row"
                    onClick={() => setSelected(record)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelected(record);
                      }
                    }}
                    aria-label={`Open ${record.experiment_id}`}
                  >
                    <td>
                      <span className="record-id">{record.experiment_id}</span>
                      <span className="record-sub mono">sample {record.sample_number}</span>
                    </td>
                    <td>
                      <span className="family-tag">{record.investigation_acronym}</span>
                      <span className="record-sub">{record.pi ?? 'PI not recorded'}</span>
                    </td>
                    <td>
                      <span>{record.material_family}</span>
                      <span className="record-sub">{record.geometry}</span>
                    </td>
                    <td className="num mono">{formatCompact(record.oxygen_initial_pct)}</td>
                    <td className="num mono">
                      {record.flow_initial_cm_s.value === null
                        ? '—'
                        : formatCompact(record.flow_initial_cm_s)}
                    </td>
                    <td>
                      <span className="missing-value">Not reported</span>
                    </td>
                    <td>
                      <span className="context-value">{record.gravity_regime.value}</span>
                      <span className="record-sub">investigation level</span>
                    </td>
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
                    <td><BasketButton id={record.experiment_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button
            className="button button--ghost button--small"
            disabled={safePage === 0}
            onClick={() => setPage((value) => Math.max(0, value - 1))}
          >
            ← Previous
          </button>
          <span className="mono">
            page {safePage + 1} / {pageCount}
          </span>
          <button
            className="button button--ghost button--small"
            disabled={safePage >= pageCount - 1}
            onClick={() => setPage((value) => Math.min(pageCount - 1, value + 1))}
          >
            Next →
          </button>
        </div>
      </Panel>

      <div className="atlas-note">
        <div>
          <span className="kicker">Reading the table</span>
          <p>
            “Not reported” is a source finding, not a blank to fill. Pressure is absent for every
            record; gravity is an investigation-level label; flow is an instrument display for
            BASS-II. Open a record to see the raw field before trusting the normalized value.
          </p>
        </div>
        <div className="atlas-note__stats">
          <span>
            <strong>{formatNumber(records.length, 0)}</strong> total records
          </span>
          <span>
            <strong>{records.filter((record) => record.quality_flags.length > 0).length}</strong>{' '}
            with quality flags
          </span>
          <span>
            <strong>{records.filter((record) => record.thickness_mm.value !== null).length}</strong>{' '}
            with thickness
          </span>
        </div>
      </div>

      <RecordDrawer record={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
