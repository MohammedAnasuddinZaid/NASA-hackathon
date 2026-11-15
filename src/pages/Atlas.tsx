import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { corpusVersion, records, recordById } from '../lib/corpus';
import type { ExperimentRecord } from '../lib/types';
import { filterRecords, uniqueFamilies, uniqueMaterials } from '../lib/records';
import type { SortKey } from '../lib/records';
import { formatCompact, formatNumber } from '../lib/format';
import { downloadText, formatExportStamp, recordsToCsv } from '../lib/export';
import { Badge, EmptyState, PageHeader, Panel } from '../components/ui';
import { RecordDrawer } from '../components/RecordDrawer';
import { BasketButton } from '../lib/basketContext';
const ResearchLibrary = lazy(() => import('../components/ResearchLibrary'));
import {
  ATLAS_COLUMNS,
  PAGE_SIZES,
  createSavedView,
  decodeAtlasView,
  defaultAtlasView,
  deleteSavedView,
  duplicateSavedView,
  encodeAtlasView,
  loadSavedViews,
  renameSavedView,
  saveSavedViews,
  viewToFilters,
} from '../lib/atlasView';
import type { AtlasColumnKey, AtlasViewState, SavedViewDocument } from '../lib/atlasView';
import {
  addRecordToDefaultInvestigation,
  loadNotebook,
  saveNotebook,
} from '../lib/notebook';
import type { NotebookDocument } from '../lib/notebook';

function hashParams(): URLSearchParams {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '');
}

function initialView(): AtlasViewState {
  return decodeAtlasView(hashParams().toString());
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const needle = query.trim().toLowerCase();
  if (!needle) return <>{text}</>;
  const terms = needle.split(/\s+/).filter(Boolean);
  const index = terms
    .map((term) => text.toLowerCase().indexOf(term))
    .filter((position) => position >= 0)
    .sort((a, b) => a - b)[0];
  if (index === undefined) return <>{text}</>;
  const term = terms.find((item) => text.toLowerCase().indexOf(item) === index) ?? terms[0];
  return (
    <>
      {text.slice(0, index)}
      <mark className="wb-mark">{text.slice(index, index + term.length)}</mark>
      {text.slice(index + term.length)}
    </>
  );
}

function FieldStatus({ status }: { status: string }) {
  if (status === 'measured') return null;
  return <span className="wb-cell-status">{status.replaceAll('_', ' ')}</span>;
}

function cellContent(
  record: ExperimentRecord,
  column: AtlasColumnKey,
  query: string,
): React.ReactNode {
  switch (column) {
    case 'experiment_id':
      return (
        <>
          <span className="record-id">
            <Highlighted text={record.experiment_id} query={query} />
          </span>
          <span className="record-sub mono">sample {record.sample_number}</span>
        </>
      );
    case 'investigation':
      return (
        <>
          <span className="family-tag">{record.investigation_acronym}</span>
          <span className="record-sub">
            <Highlighted text={record.pi ?? 'PI not recorded'} query={query} />
          </span>
        </>
      );
    case 'material':
      return (
        <>
          <span>
            <Highlighted text={record.material_family} query={query} />
          </span>
          <span className="record-sub">{record.geometry}</span>
        </>
      );
    case 'geometry':
      return <span>{record.geometry}</span>;
    case 'oxygen_initial':
      return (
        <>
          <span className={`mono ${record.oxygen_initial_pct.value === null ? 'is-missing' : ''}`}>
            {formatCompact(record.oxygen_initial_pct)}
          </span>
          <FieldStatus status={record.oxygen_initial_pct.status} />
        </>
      );
    case 'oxygen_final':
      return (
        <>
          <span className={`mono ${record.oxygen_final_pct.value === null ? 'is-missing' : ''}`}>
            {formatCompact(record.oxygen_final_pct)}
          </span>
          <FieldStatus status={record.oxygen_final_pct.status} />
        </>
      );
    case 'flow':
      return (
        <>
          <span className={`mono ${record.flow_initial_cm_s.value === null ? 'is-missing' : ''}`}>
            {formatCompact(record.flow_initial_cm_s)}
          </span>
          {record.flow_varies && <span className="wb-cell-status">varies</span>}
        </>
      );
    case 'flow_derived':
      return (
        <span className={`mono ${record.flow_derived_cm_s.value === null ? 'is-missing' : ''}`}>
          {formatCompact(record.flow_derived_cm_s)}
        </span>
      );
    case 'thickness':
      return (
        <span className={`mono ${record.thickness_mm.value === null ? 'is-missing' : ''}`}>
          {formatCompact(record.thickness_mm)}
        </span>
      );
    case 'pressure':
      return (
        <>
          <span className="missing-value">Not reported</span>
          <FieldStatus status={record.total_pressure_psia.status} />
        </>
      );
    case 'gravity':
      return (
        <>
          <span className="context-value">{record.gravity_regime.value}</span>
          <span className="record-sub">investigation level</span>
        </>
      );
    case 'ignition':
      return (
        <span className={`mono ${record.ignition_power_w.value === null ? 'is-missing' : ''}`}>
          {formatCompact(record.ignition_power_w)}
        </span>
      );
    case 'outcome':
      return (
        <>
          <span className="missing-value">{record.outcome.value ?? 'No standardized outcome'}</span>
          <FieldStatus status={record.outcome.status} />
        </>
      );
    case 'validation':
      return (
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
      );
    case 'source':
      return (
        <>
          <span className="mono">{record.source_id}</span>
          <span className="record-sub">{record.source_locator}</span>
        </>
      );
  }
}

export function Atlas() {
  const [view, setView] = useState<AtlasViewState>(initialView);
  const [research, setResearch] = useState(() => new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('view') === 'research');
  useEffect(() => {
    const readView = () => setResearch(new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('view') === 'research');
    window.addEventListener('hashchange', readView);
    return () => window.removeEventListener('hashchange', readView);
  }, []);
  const [page, setPage] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(() => hashParams().get('id'));
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [notice, setNotice] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedViewDocument>(() => loadSavedViews().value);
  const [savedWarning, setSavedWarning] = useState<string | null>(() => loadSavedViews().warning);
  const [notebook, setNotebook] = useState<NotebookDocument>(() => loadNotebook().value);
  const [newViewName, setNewViewName] = useState('');
  const [editingViewId, setEditingViewId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [columnsOpen, setColumnsOpen] = useState(false);

  const filters = useMemo(() => viewToFilters(view), [view]);
  const filtered = useMemo(() => filterRecords(records, filters), [filters]);
  const pageCount = Math.max(1, Math.ceil(filtered.length / view.pageSize));
  const safePage = Math.min(page, pageCount - 1);
  const visible = filtered.slice(safePage * view.pageSize, safePage * view.pageSize + view.pageSize);
  const families = useMemo(() => uniqueFamilies(), []);
  const materials = useMemo(() => uniqueMaterials(), []);
  const flagged = filtered.filter((record) => record.validation_status !== 'validated').length;
  const selected = selectedId ? recordById.get(selectedId) ?? null : null;

  const activeChips: Array<{ key: string; label: string; clear: () => void }> = [];
  if (view.query) activeChips.push({ key: 'query', label: `“${view.query}”`, clear: () => update({ query: '' }) });
  if (view.family !== 'all') activeChips.push({ key: 'family', label: view.family, clear: () => update({ family: 'all' }) });
  if (view.material !== 'all') activeChips.push({ key: 'material', label: view.material, clear: () => update({ material: 'all' }) });
  if (view.quality !== 'all') activeChips.push({ key: 'quality', label: view.quality, clear: () => update({ quality: 'all' }) });
  if (view.o2Min !== null || view.o2Max !== null) {
    activeChips.push({
      key: 'o2',
      label: `O2 ${view.o2Min ?? 'min'}–${view.o2Max ?? 'max'}%`,
      clear: () => update({ o2Min: null, o2Max: null }),
    });
  }
  if (view.flowOnly) activeChips.push({ key: 'flow', label: 'flow reported', clear: () => update({ flowOnly: false }) });
  if (view.hasThickness) activeChips.push({ key: 'thickness', label: 'thickness reported', clear: () => update({ hasThickness: false }) });
  if (view.hasIgnition) activeChips.push({ key: 'ignition', label: 'ignition power reported', clear: () => update({ hasIgnition: false }) });

  function update(patch: Partial<AtlasViewState>) {
    setView((current) => ({ ...current, ...patch }));
    setPage(0);
  }

  function applySavedView(state: AtlasViewState) {
    setView(state);
    setPage(0);
    setNotice('Saved view applied.');
  }

  function persistSaved(next: SavedViewDocument, message: string) {
    const result = saveSavedViews(next);
    if (result.ok) {
      setSaved(next);
      setSavedWarning(null);
      setNotice(message);
    } else {
      setNotice(result.error);
    }
  }

  function saveCurrentView() {
    const created = createSavedView(saved, newViewName, view);
    if (created.error || !created.view) {
      setNotice(created.error);
      return;
    }
    persistSaved(created.document, `Saved view “${created.view.name}”.`);
    setNewViewName('');
  }

  function renameView(id: string) {
    const renamed = renameSavedView(saved, id, editingName);
    if (renamed.error) {
      setNotice(renamed.error);
      return;
    }
    persistSaved(renamed.document, `Renamed view to “${renamed.view?.name}”.`);
    setEditingViewId(null);
    setEditingName('');
  }

  function removeView(id: string) {
    const target = saved.views.find((item) => item.id === id);
    persistSaved(deleteSavedView(saved, id), `Deleted saved view${target ? ` “${target.name}”` : ''}.`);
  }

  function duplicateView(id: string) {
    const duplicated = duplicateSavedView(saved, id);
    if (duplicated.error) {
      setNotice(duplicated.error);
      return;
    }
    persistSaved(duplicated.document, `Duplicated saved view as “${duplicated.view?.name}”.`);
  }

  function toggleRecord(recordId: string) {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(recordId)) next.delete(recordId);
      else next.add(recordId);
      return next;
    });
  }

  function exportRows(rows: ExperimentRecord[], label: string) {
    downloadText(
      `firertrace-${label}-${formatExportStamp()}.csv`,
      recordsToCsv(rows),
      'text/csv;charset=utf-8',
    );
  }

  function addSelectionToNotebook() {
    const ids = [...selectedIds];
    if (!ids.length) return;
    let document = notebook;
    let created = false;
    let targetTitle = '';
    let error: string | null = null;
    for (const id of ids) {
      const result = addRecordToDefaultInvestigation(document, id, { corpusVersion });
      if (result.error) {
        error = result.error;
        break;
      }
      document = result.document;
      created = created || result.created;
      targetTitle = result.investigation?.title ?? targetTitle;
    }
    if (error) {
      setNotice(error);
      return;
    }
    const savedResult = saveNotebook(document);
    if (!savedResult.ok) {
      setNotice(savedResult.error);
      return;
    }
    setNotebook(document);
    setNotice(
      `${ids.length} record${ids.length === 1 ? '' : 's'} added to ${created ? 'new investigation' : 'investigation'} “${targetTitle}”.`,
    );
  }

  useEffect(() => {
    const params = new URLSearchParams(encodeAtlasView(view));
    if (selectedId) params.set('id', selectedId);
    if (hashParams().get('from') === 'gap') params.set('from', 'gap');
    const next = `#/atlas${params.toString() ? `?${params.toString()}` : ''}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [view, selectedId]);

  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash.startsWith('#/atlas')) return;
      const params = hashParams();
      setView(decodeAtlasView(params.toString()));
      setSelectedId(params.get('id'));
      setPage(0);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  if (research) {
    return (
      <Suspense fallback={<div className="page" role="status">Loading research library…</div>}>
        <ResearchLibrary onBack={() => { setResearch(false); window.history.replaceState(null, '', '#/atlas'); }} />
      </Suspense>
    );
  }

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
          <>
            <button className="button button--ghost button--small" onClick={() => { setResearch(true); window.history.replaceState(null, '', '#/atlas?view=research'); }}>
              Research findings & coverage
            </button>
            <button className="button button--ghost button--small" onClick={() => exportRows(filtered, 'records')}>
              Export filtered CSV
            </button>
            <button
              className="button button--ghost button--small"
              onClick={() => exportRows([...selectedIds].map((id) => recordById.get(id)).filter((record): record is ExperimentRecord => Boolean(record)), 'selected')}
              disabled={selectedIds.size === 0}
            >
              Export selected ({selectedIds.size})
            </button>
          </>
        }
      />

      {hashParams().get('from') === 'gap' && (
        <p>
          <a className="text-link" href="#/gap">
            ← Return to saved scenario
          </a>
        </p>
      )}
      {selectedId && !selected && (
        <p role="alert" className="wb-alert">
          Requested record ID “{selectedId}” was not found. No substitute record was opened.
        </p>
      )}
      {notice && (
        <div className="wb-notice" role="status">
          <span>{notice}</span>
          <button type="button" className="text-link" onClick={() => setNotice(null)}>
            Dismiss
          </button>
        </div>
      )}
      {savedWarning && (
        <p role="alert" className="wb-alert">
          Saved views were not loaded: {savedWarning}
        </p>
      )}

      <div className="atlas-summary">
        <div className="atlas-summary__count">
          <strong>{filtered.length}</strong>
          <span>records in view</span>
        </div>
        <div className="atlas-summary__meta">
          <span className="mono">{families.join(' · ')}</span>
          <span>{flagged} flagged partial or suspect</span>
          <span>Pressure reported: 0</span>
          <span>Selected: {selectedIds.size}</span>
        </div>
      </div>

      <Panel className="filter-panel" kicker="Query" title="Filter the corpus">
        <div className="filter-grid">
          <label className="field field--search">
            <span>Search</span>
            <input
              type="search"
              list="atlas-suggestions"
              placeholder="ID, material, PI, sample…"
              value={view.query}
              onChange={(event) => update({ query: event.target.value })}
            />
            <datalist id="atlas-suggestions">
              {records.slice(0, 131).map((record) => (
                <option key={record.experiment_id} value={record.experiment_id}>
                  {record.material_raw}
                </option>
              ))}
              {materials.map((material) => (
                <option key={material} value={material} />
              ))}
            </datalist>
          </label>
          <label className="field">
            <span>Investigation</span>
            <select value={view.family} onChange={(event) => update({ family: event.target.value })}>
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
            <select value={view.material} onChange={(event) => update({ material: event.target.value })}>
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
            <select value={view.quality} onChange={(event) => update({ quality: event.target.value })}>
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
              max={100}
              step={0.1}
              value={view.o2Min ?? ''}
              placeholder="13.6"
              onChange={(event) => update({ o2Min: event.target.value === '' ? null : Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>O2 max</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.1}
              value={view.o2Max ?? ''}
              placeholder="22.2"
              onChange={(event) => update({ o2Max: event.target.value === '' ? null : Number(event.target.value) })}
            />
          </label>
          <label className="field">
            <span>Sort</span>
            <select value={view.sort} onChange={(event) => update({ sort: event.target.value as SortKey })}>
              <option value="id">Record ID</option>
              <option value="o2-asc">O2 ascending</option>
              <option value="o2-desc">O2 descending</option>
              <option value="material">Material</option>
              <option value="family">Investigation</option>
              <option value="date">Date reported</option>
              <option value="thickness-asc">Thickness ascending</option>
              <option value="thickness-desc">Thickness descending</option>
              <option value="flow-desc">Flow descending</option>
              <option value="validation">Validation status</option>
            </select>
          </label>
          <label className="field">
            <span>Page size</span>
            <select value={view.pageSize} onChange={(event) => update({ pageSize: Number(event.target.value) })}>
              {PAGE_SIZES.map((size) => (
                <option key={size} value={size}>
                  {size} rows
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="filter-foot">
          <label className="field field--check">
            <input type="checkbox" checked={view.flowOnly} onChange={(event) => update({ flowOnly: event.target.checked })} />
            <span>Only records with reported flow</span>
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={view.hasThickness} onChange={(event) => update({ hasThickness: event.target.checked })} />
            <span>Only records with thickness</span>
          </label>
          <label className="field field--check">
            <input type="checkbox" checked={view.hasIgnition} onChange={(event) => update({ hasIgnition: event.target.checked })} />
            <span>Only records with ignition power</span>
          </label>
          <span className="mono">
            {filtered.length} / {records.length} records · showing {visible.length} on page {safePage + 1} of {pageCount}
          </span>
          <button
            className="text-link"
            onClick={() => {
              setView({ ...defaultAtlasView });
              setPage(0);
            }}
          >
            Reset filters
          </button>
        </div>
        <div className="wb-chip-row" aria-label="Active filters">
          {activeChips.map((chip) => (
            <button key={chip.key} type="button" className="wb-chip" onClick={chip.clear}>
              {chip.label} <span aria-hidden="true">×</span>
              <span className="sr-only">Remove filter</span>
            </button>
          ))}
          {!activeChips.length && <span className="muted">No active filters. The full corpus is in view.</span>}
        </div>
        <div className="wb-suggestion-row">
          <span className="kicker">Try</span>
          {['PMMA', 'SIBAL', 'suspect', 'thickness', 'flow'].map((suggestion) => (
            <button key={suggestion} type="button" className="wb-suggestion" onClick={() => update({ query: suggestion })}>
              {suggestion}
            </button>
          ))}
        </div>
      </Panel>

      <div className="wb-two-col">
        <details className="wb-disclosure" open={columnsOpen} onToggle={(event) => setColumnsOpen((event.target as HTMLDetailsElement).open)}>
          <summary>Columns ({view.columns.length} of {ATLAS_COLUMNS.length})</summary>
          <div className="wb-check-grid">
            {ATLAS_COLUMNS.map((column) => {
              const checked = view.columns.includes(column.key);
              return (
                <label key={column.key} className="field field--check">
                  <input
                    type="checkbox"
                    checked={checked}
                    disabled={checked && view.columns.length === 1}
                    onChange={(event) =>
                      update({
                        columns: event.target.checked
                          ? [...view.columns, column.key]
                          : view.columns.filter((key) => key !== column.key),
                      })
                    }
                  />
                  <span>{column.label}</span>
                </label>
              );
            })}
          </div>
          <button type="button" className="text-link" onClick={() => update({ columns: defaultAtlasView.columns })}>
            Restore default columns
          </button>
        </details>

        <details className="wb-disclosure">
          <summary>Saved views ({saved.views.length})</summary>
          <div className="wb-save-row">
            <label className="field">
              <span>Name this view</span>
              <input
                type="text"
                value={newViewName}
                maxLength={60}
                placeholder="Low-flow PMMA"
                onChange={(event) => setNewViewName(event.target.value)}
              />
            </label>
            <button type="button" className="button button--ghost button--small" onClick={saveCurrentView}>
              Save current view
            </button>
          </div>
          {saved.views.length === 0 ? (
            <p className="muted">No saved views yet. A saved view stores only the query, not a copy of the corpus.</p>
          ) : (
            <ul className="wb-saved-list">
              {saved.views.map((item) => (
                <li key={item.id}>
                  {editingViewId === item.id ? (
                    <div className="wb-save-row">
                      <input
                        type="text"
                        value={editingName}
                        maxLength={60}
                        aria-label={`Rename ${item.name}`}
                        onChange={(event) => setEditingName(event.target.value)}
                      />
                      <button type="button" className="text-link" onClick={() => renameView(item.id)}>
                        Save
                      </button>
                      <button type="button" className="text-link" onClick={() => setEditingViewId(null)}>
                        Cancel
                      </button>
                    </div>
                  ) : (
                    <>
                      <button type="button" className="wb-saved-name" onClick={() => applySavedView(item.state)}>
                        {item.name}
                      </button>
                      <span className="mono muted">
                        {item.state.query || item.state.family !== 'all' ? item.state.query || item.state.family : 'all records'}
                      </span>
                      <span className="wb-saved-actions">
                        <button
                          type="button"
                          className="text-link"
                          onClick={() => {
                            setEditingViewId(item.id);
                            setEditingName(item.name);
                          }}
                        >
                          Rename
                        </button>
                        <button type="button" className="text-link" onClick={() => duplicateView(item.id)}>
                          Duplicate
                        </button>
                        <button type="button" className="text-link" onClick={() => removeView(item.id)}>
                          Delete
                        </button>
                      </span>
                    </>
                  )}
                </li>
              ))}
            </ul>
          )}
        </details>
      </div>

      {selectedIds.size > 0 && (
        <div className="wb-selection-bar" role="region" aria-label="Selection actions">
          <span>
            <strong>{selectedIds.size}</strong> selected
          </span>
          <button type="button" className="button button--ghost button--small" onClick={() => setSelectedIds(new Set(visible.map((record) => record.experiment_id)))}>
            Select page
          </button>
          <a className="button button--ghost button--small" href={`#/compare?ids=${[...selectedIds].slice(0, 4).join(',')}`}>
            Compare selected
          </a>
          <button type="button" className="button button--ghost button--small" onClick={addSelectionToNotebook}>
            Add to notebook
          </button>
          <button type="button" className="text-link" onClick={() => setSelectedIds(new Set())}>
            Clear
          </button>
        </div>
      )}

      <Panel className="table-panel" kicker="Records" title="Experiment table">
        {visible.length === 0 ? (
          <EmptyState title="No records match these filters">
            The corpus still contains {records.length} records. Clear a filter or widen the oxygen range.
          </EmptyState>
        ) : (
          <div className="table-wrap">
            <table className="data-table wb-atlas-table">
              <thead>
                <tr>
                  <th className="wb-check-cell">
                    <input
                      type="checkbox"
                      aria-label="Select all visible records"
                      checked={visible.every((record) => selectedIds.has(record.experiment_id))}
                      onChange={(event) =>
                        setSelectedIds((current) => {
                          const next = new Set(current);
                          for (const record of visible) {
                            if (event.target.checked) next.add(record.experiment_id);
                            else next.delete(record.experiment_id);
                          }
                          return next;
                        })
                      }
                    />
                  </th>
                  {view.columns.map((column) => {
                    const definition = ATLAS_COLUMNS.find((item) => item.key === column);
                    return (
                      <th key={column} className={definition?.align === 'num' ? 'num' : undefined}>
                        {definition?.label ?? column}
                        {definition?.unit && <span className="wb-unit">{definition.unit}</span>}
                      </th>
                    );
                  })}
                  <th>Evidence basket</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((record) => (
                  <tr
                    key={record.experiment_id}
                    className={`data-table__row ${selectedIds.has(record.experiment_id) ? 'is-selected' : ''}`}
                    onClick={() => setSelectedId(record.experiment_id)}
                    tabIndex={0}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        setSelectedId(record.experiment_id);
                      }
                    }}
                    aria-label={`Open ${record.experiment_id}`}
                  >
                    <td className="wb-check-cell">
                      <input
                        type="checkbox"
                        aria-label={`Select ${record.experiment_id}`}
                        checked={selectedIds.has(record.experiment_id)}
                        onClick={(event) => event.stopPropagation()}
                        onChange={() => toggleRecord(record.experiment_id)}
                      />
                    </td>
                    {view.columns.map((column) => (
                      <td key={column} className={ATLAS_COLUMNS.find((item) => item.key === column)?.align === 'num' ? 'num' : undefined}>
                        {cellContent(record, column, view.query)}
                      </td>
                    ))}
                    <td><BasketButton id={record.experiment_id} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        <div className="pagination">
          <button className="button button--ghost button--small" disabled={safePage === 0} onClick={() => setPage((value) => Math.max(0, value - 1))}>
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
            “Not reported” is a source finding, not a blank to fill. Pressure is absent for every record; gravity is an
            investigation-level label; flow is an instrument display for BASS-II. Open a record to see the raw field
            before trusting the normalized value.
          </p>
        </div>
        <div className="atlas-note__stats">
          <span>
            <strong>{formatNumber(records.length, 0)}</strong> total records
          </span>
          <span>
            <strong>{records.filter((record) => record.quality_flags.length > 0).length}</strong> with quality flags
          </span>
          <span>
            <strong>{records.filter((record) => record.thickness_mm.value !== null).length}</strong> with thickness
          </span>
        </div>
      </div>

      <RecordDrawer
        record={selected}
        onClose={() => setSelectedId(null)}
        onNavigate={(record) => setSelectedId(record.experiment_id)}
        onAddToNotebook={(record) => {
          const result = addRecordToDefaultInvestigation(notebook, record.experiment_id, { corpusVersion });
          if (result.error) {
            setNotice(result.error);
            return result.error;
          }
          const savedResult = saveNotebook(result.document);
          if (!savedResult.ok) {
            setNotice(savedResult.error);
            return savedResult.error;
          }
          setNotebook(result.document);
          return `${record.experiment_id} added to ${result.created ? 'new investigation' : 'investigation'} “${result.investigation?.title}”.`;
        }}
      />
    </div>
  );
}
