import { useEffect, useMemo, useState } from 'react';
import { corpusVersion, recordById, sourceManifest } from '../lib/corpus';
import type { ExperimentRecord } from '../lib/types';
import { PageHeader, Panel, Badge, EmptyState } from '../components/ui';
import { RecordDrawer } from '../components/RecordDrawer';
import { downloadText, downloadZip } from '../lib/export';
import { formatCompact } from '../lib/format';
import {
  CALCULATIONS,
  calculationToMarkdown,
  runCalculation,
} from '../lib/calculation';
import type { CalculationId, CalculationRun } from '../lib/calculation';
import {
  INVESTIGATION_STATUSES,
  addNotebookItem,
  addRecordToDefaultInvestigation,
  addRecordsToInvestigation,
  buildNotebookBundle,
  createInvestigation,
  deleteInvestigation,
  investigationRecords,
  itemTypeLabels,
  itemTypeTones,
  loadNotebook,
  notebookStats,
  notebookToMarkdown,
  removeNotebookItem,
  removeRecordFromInvestigation,
  saveNotebook,
  statusLabels,
  updateInvestigation,
} from '../lib/notebook';
import type { Investigation, NotebookDocument, NotebookItemType } from '../lib/notebook';
import { verifyNotebookItem, verdictLabels, verdictTones } from '../lib/verification';

const ITEM_TYPES = Object.keys(itemTypeLabels) as NotebookItemType[];

const FIELD_KEYS = [
  'oxygen_initial_pct',
  'oxygen_final_pct',
  'total_pressure_psia',
  'oxygen_partial_pressure_psi',
  'flow_initial_cm_s',
  'flow_derived_cm_s',
  'thickness_mm',
  'width_cm',
  'length_cm',
  'diameter_mm',
  'ignition_power_w',
  'ignition_time_s',
  'burn_time_s',
  'gravity_regime',
  'ignition_method',
  'outcome',
  'flow_direction',
  'hardware',
];

const SOURCE_IDS = [
  ...sourceManifest.sources.map((source) => source.source_id),
  ...sourceManifest.context_sources.map((source) => source.source_id),
];

function splitIds(value: string): string[] {
  return [...new Set(value.split(/[\s,]+/).map((item) => item.trim()).filter(Boolean))];
}

function hashInvestigationId(): string | null {
  return new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('id');
}

export function Notebook() {
  const [document, setDocument] = useState<NotebookDocument>(() => loadNotebook().value);
  const [storageWarning, setStorageWarning] = useState<string | null>(() => loadNotebook().warning);
  const [activeId, setActiveId] = useState<string | null>(() => hashInvestigationId());
  const [notice, setNotice] = useState<string | null>(null);
  const [openRecordId, setOpenRecordId] = useState<string | null>(null);

  const [newTitle, setNewTitle] = useState('');
  const [newQuestion, setNewQuestion] = useState('');
  const [newHypothesis, setNewHypothesis] = useState('');

  const [recordInput, setRecordInput] = useState('');
  const [itemType, setItemType] = useState<NotebookItemType>('observation');
  const [itemText, setItemText] = useState('');
  const [itemRecords, setItemRecords] = useState('');
  const [itemFields, setItemFields] = useState('');
  const [itemSources, setItemSources] = useState('');
  const [itemError, setItemError] = useState<string | null>(null);

  const [calcId, setCalcId] = useState<CalculationId>('flow-from-air-display');
  const [calcInputs, setCalcInputs] = useState<Record<string, string>>({});
  const [calcRun, setCalcRun] = useState<CalculationRun | null>(null);
  const [calcError, setCalcError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const active = document.investigations.find((investigation) => investigation.id === activeId) ?? null;
  const records = useMemo(() => (active ? investigationRecords(active) : []), [active]);
  const openRecord = openRecordId ? recordById.get(openRecordId) ?? null : null;
  const definition = CALCULATIONS.find((item) => item.id === calcId) ?? CALCULATIONS[0];

  useEffect(() => {
    const onHash = () => {
      if (!window.location.hash.startsWith('#/notebook')) return;
      setActiveId(hashInvestigationId());
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    const next = `#/notebook?id=${encodeURIComponent(activeId)}`;
    if (window.location.hash !== next) window.history.replaceState(null, '', next);
  }, [activeId]);

  function persist(next: NotebookDocument, message: string) {
    const result = saveNotebook(next);
    if (!result.ok) {
      setNotice(result.error);
      return false;
    }
    setDocument(next);
    setStorageWarning(null);
    setNotice(message);
    return true;
  }

  function createNew() {
    const created = createInvestigation(
      document,
      { title: newTitle, question: newQuestion, hypothesis: newHypothesis, corpus_version: corpusVersion },
    );
    if (!created.investigation) {
      setNotice(created.error);
      return;
    }
    if (persist(created.document, `Created investigation “${created.investigation.title}”.`)) {
      setActiveId(created.investigation.id);
      setNewTitle('');
      setNewQuestion('');
      setNewHypothesis('');
    }
  }

  function patchActive(patch: { title?: string; question?: string; hypothesis?: string; status?: Investigation['status'] }) {
    if (!active) return;
    const updated = updateInvestigation(document, active.id, patch);
    if (updated.error) {
      setNotice(updated.error);
      return;
    }
    persist(updated.document, 'Investigation updated.');
  }

  function attachRecords() {
    if (!active) return;
    const ids = splitIds(recordInput);
    if (!ids.length) {
      setNotice('Enter one or more record IDs.');
      return;
    }
    const updated = addRecordsToInvestigation(document, active.id, ids);
    if (updated.error) {
      setNotice(updated.error);
      return;
    }
    if (persist(updated.document, `Attached ${ids.length} record(s) to “${active.title}”.`)) setRecordInput('');
  }

  function addItem() {
    if (!active) return;
    setItemError(null);
    const result = addNotebookItem(document, active.id, {
      type: itemType,
      text: itemText,
      record_ids: splitIds(itemRecords),
      source_ids: splitIds(itemSources),
      field_keys: splitIds(itemFields),
    });
    if (result.error) {
      setItemError(result.error);
      return;
    }
    if (persist(result.document, `Added ${itemTypeLabels[itemType].toLowerCase()}.`)) {
      setItemText('');
      setItemRecords('');
      setItemFields('');
      setItemSources('');
    }
  }

  function runCalc() {
    setCalcError(null);
    const run = runCalculation(definition.id, calcInputs, { corpusVersion });
    setCalcRun(run);
    if (run.status !== 'ok') {
      setCalcError(run.errors.join(' '));
      return;
    }
    setCalcError(null);
  }

  function saveCalculation() {
    if (!active || !calcRun || calcRun.status !== 'ok') return;
    const result = addNotebookItem(document, active.id, {
      type: 'derived_calculation',
      text: `${calcRun.name}: ${calcRun.result?.display} ${calcRun.output_unit}. ${calcRun.formula}.`,
      record_ids: [],
      source_ids: [],
      calculation: calcRun,
    });
    if (result.error) {
      setNotice(result.error);
      return;
    }
    if (persist(result.document, 'Derived calculation recorded. It is not a source-backed observation.')) {
      setCalcRun(null);
      setCalcInputs({});
    }
  }

  async function exportBundle() {
    if (!active) return;
    const bundle = await buildNotebookBundle(active, { appVersion: '0.1.0' });
    await downloadZip(
      `firertrace-notebook-${active.id}.zip`,
      bundle.files.map((file) => ({ path: file.path, content: file.content })),
      { generatedAt: bundle.manifest.generated_at },
    );
    setNotice(`Exported notebook bundle with ${bundle.manifest.file_count} hashed files.`);
  }

  function deleteActive() {
    if (!active) return;
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }
    const next = deleteInvestigation(document, active.id);
    persist(next, `Deleted investigation “${active.title}”.`);
    setConfirmDelete(false);
    setActiveId(next.investigations[0]?.id ?? null);
  }

  return (
    <div className="page page--notebook">
      <PageHeader
        index="09"
        eyebrow="Research Notebook"
        title={
          <>
            Keep the question <em>next to the evidence.</em>
          </>
        }
        lede="Investigations, observations, calculations, and hypotheses are stored locally with explicit types. A hypothesis or an AI interpretation can never become a source-backed observation by accident."
        actions={
          active && (
            <>
              <button type="button" className="button button--ghost button--small" onClick={exportBundle}>
                Export bundle (ZIP)
              </button>
              <button
                type="button"
                className="button button--ghost button--small"
                onClick={() =>
                  downloadText(`firertrace-notebook-${active.id}.md`, notebookToMarkdown(active), 'text/markdown')
                }
              >
                Markdown
              </button>
            </>
          )
        }
      />

      {storageWarning && (
        <p role="alert" className="wb-alert">
          Local workspace storage is unavailable or rejected the stored notebook: {storageWarning} Changes will not
          survive a reload.
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

      <div className="wb-notebook-layout">
        <aside className="wb-notebook-sidebar">
          <Panel kicker="Investigations" title={`${document.investigations.length} local`}>
            {document.investigations.length === 0 ? (
              <p className="muted">No investigations yet. Create one below, or add a record from the Evidence Atlas.</p>
            ) : (
              <ul className="wb-investigation-list">
                {document.investigations.map((investigation) => (
                  <li key={investigation.id}>
                    <button
                      type="button"
                      className={`wb-investigation ${activeId === investigation.id ? 'is-active' : ''}`}
                      onClick={() => {
                        setActiveId(investigation.id);
                        setConfirmDelete(false);
                      }}
                      aria-current={activeId === investigation.id ? 'true' : undefined}
                    >
                      <span className="wb-investigation__title">{investigation.title}</span>
                      <span className="wb-investigation__meta">
                        {statusLabels[investigation.status]} · {investigation.items.length} item(s) ·{' '}
                        {investigation.record_ids.length} record(s)
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </Panel>

          <Panel kicker="New investigation" title="Start a question">
            <div className="wb-form">
              <label className="field">
                <span>Title</span>
                <input
                  type="text"
                  value={newTitle}
                  maxLength={160}
                  placeholder="PMMA at low flow"
                  onChange={(event) => setNewTitle(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Research question</span>
                <textarea
                  value={newQuestion}
                  maxLength={4000}
                  rows={3}
                  placeholder="What does the corpus actually report?"
                  onChange={(event) => setNewQuestion(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Hypothesis or working assumption (optional)</span>
                <textarea
                  value={newHypothesis}
                  maxLength={8000}
                  rows={3}
                  placeholder="A hypothesis is labelled as a hypothesis, never as evidence."
                  onChange={(event) => setNewHypothesis(event.target.value)}
                />
              </label>
              <button type="button" className="button button--ember button--small" onClick={createNew}>
                Create investigation
              </button>
            </div>
          </Panel>
        </aside>

        <div className="wb-notebook-main">
          {!active ? (
            <Panel kicker="Workspace" title="Select or create an investigation">
              <EmptyState title="No investigation is open">
                A notebook item belongs to a question. Create an investigation, then attach records and record typed
                observations. Nothing is uploaded and nothing leaves this browser.
              </EmptyState>
            </Panel>
          ) : (
            <>
              <Panel
                kicker="Investigation"
                title={active.title}
                actions={
                  <button
                    type="button"
                    className={`button button--small ${confirmDelete ? 'button--ember' : 'button--ghost'}`}
                    onClick={deleteActive}
                    onBlur={() => setConfirmDelete(false)}
                  >
                    {confirmDelete ? 'Confirm delete' : 'Delete'}
                  </button>
                }
              >
                <div className="wb-form wb-form--grid">
                  <label className="field">
                    <span>Title</span>
                    <input
                      type="text"
                      value={active.title}
                      maxLength={160}
                      onChange={(event) => patchActive({ title: event.target.value })}
                    />
                  </label>
                  <label className="field">
                    <span>Workflow status</span>
                    <select
                      value={active.status}
                      onChange={(event) => patchActive({ status: event.target.value as Investigation['status'] })}
                    >
                      {INVESTIGATION_STATUSES.map((status) => (
                        <option key={status} value={status}>
                          {statusLabels[status]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field--wide">
                    <span>Research question</span>
                    <textarea
                      value={active.question}
                      maxLength={4000}
                      rows={2}
                      onChange={(event) => patchActive({ question: event.target.value })}
                    />
                  </label>
                  <label className="field field--wide">
                    <span>Hypothesis or working assumption</span>
                    <textarea
                      value={active.hypothesis}
                      maxLength={8000}
                      rows={3}
                      onChange={(event) => patchActive({ hypothesis: event.target.value })}
                    />
                  </label>
                </div>
                <p className="panel-caption">
                  Workflow status is not scientific validity. It records where the investigation is in your own review
                  process.
                </p>
                <div className="wb-stat-grid wb-stat-grid--compact">
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).records}</strong>
                    <span>records</span>
                  </div>
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).observations}</strong>
                    <span>observations</span>
                  </div>
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).calculations}</strong>
                    <span>calculations</span>
                  </div>
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).hypotheses}</strong>
                    <span>hypotheses</span>
                  </div>
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).openQuestions}</strong>
                    <span>open questions</span>
                  </div>
                  <div className="wb-mini-stat">
                    <strong>{notebookStats(active).unresolvedRecordIds.length}</strong>
                    <span>unresolved refs</span>
                  </div>
                </div>
              </Panel>

              <Panel kicker="Referenced evidence" title={`${records.length} record(s) attached`}>
                <div className="wb-inline-form">
                  <label className="field">
                    <span>Attach record IDs</span>
                    <input
                      type="text"
                      value={recordInput}
                      placeholder="BASS2-B1, BASS2-B2"
                      onChange={(event) => setRecordInput(event.target.value)}
                    />
                  </label>
                  <button type="button" className="button button--ghost button--small" onClick={attachRecords}>
                    Attach
                  </button>
                  <a className="button button--ghost button--small" href="#/atlas">
                    Find records in Atlas
                  </a>
                </div>
                {records.length === 0 ? (
                  <p className="muted">No records attached. An observation needs a real record and a reported field.</p>
                ) : (
                  <div className="table-wrap">
                    <table className="data-table">
                      <thead>
                        <tr>
                          <th>Record</th>
                          <th>Material</th>
                          <th>Initial O2</th>
                          <th>Validation</th>
                          <th />
                        </tr>
                      </thead>
                      <tbody>
                        {records.map((record) => (
                          <tr key={record.experiment_id}>
                            <th>
                              <button
                                type="button"
                                className="text-link mono"
                                onClick={() => setOpenRecordId(record.experiment_id)}
                              >
                                {record.experiment_id}
                              </button>
                            </th>
                            <td>{record.material_family}</td>
                            <td className="mono">{formatCompact(record.oxygen_initial_pct)}</td>
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
                            <td>
                              <button
                                type="button"
                                className="text-link"
                                onClick={() => {
                                  const updated = removeRecordFromInvestigation(document, active.id, record.experiment_id);
                                  if (updated.error) setNotice(updated.error);
                                  else persist(updated.document, `Removed ${record.experiment_id} from the investigation.`);
                                }}
                              >
                                Remove
                              </button>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </Panel>

              <Panel kicker="Record an item" title="Typed notebook entry">
                <div className="wb-form wb-form--grid">
                  <label className="field">
                    <span>Item type</span>
                    <select value={itemType} onChange={(event) => setItemType(event.target.value as NotebookItemType)}>
                      {ITEM_TYPES.map((type) => (
                        <option key={type} value={type}>
                          {itemTypeLabels[type]}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="field field--wide">
                    <span>Text</span>
                    <textarea
                      value={itemText}
                      rows={4}
                      maxLength={8000}
                      placeholder={
                        itemType === 'observation'
                          ? 'Initial oxygen was 22.2%.'
                          : itemType === 'hypothesis'
                            ? 'A working assumption. This is not evidence.'
                            : 'Write the item exactly as it should be read later.'
                      }
                      onChange={(event) => setItemText(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Record IDs (comma separated)</span>
                    <input
                      type="text"
                      value={itemRecords}
                      placeholder="BASS2-B1"
                      onChange={(event) => setItemRecords(event.target.value)}
                    />
                  </label>
                  <label className="field">
                    <span>Field keys (observations)</span>
                    <input
                      type="text"
                      value={itemFields}
                      list="notebook-field-keys"
                      placeholder="oxygen_initial_pct"
                      onChange={(event) => setItemFields(event.target.value)}
                    />
                    <datalist id="notebook-field-keys">
                      {FIELD_KEYS.map((key) => (
                        <option key={key} value={key} />
                      ))}
                    </datalist>
                  </label>
                  <label className="field">
                    <span>Source IDs</span>
                    <input
                      type="text"
                      value={itemSources}
                      list="notebook-source-ids"
                      placeholder="PSI-25"
                      onChange={(event) => setItemSources(event.target.value)}
                    />
                    <datalist id="notebook-source-ids">
                      {SOURCE_IDS.map((key) => (
                        <option key={key} value={key} />
                      ))}
                    </datalist>
                  </label>
                </div>
                {itemError && (
                  <p role="alert" className="wb-alert">
                    {itemError}
                  </p>
                )}
                <p className="panel-caption">
                  An observation is rejected if the cited field is not reported by the record. Use a coverage finding or
                  a hypothesis instead of asserting a value the corpus does not contain.
                </p>
                <button type="button" className="button button--ember button--small" onClick={addItem}>
                  Add {itemTypeLabels[itemType].toLowerCase()}
                </button>
              </Panel>

              <Panel kicker="Calculation" title="Composition and unit operations">
                <div className="wb-form wb-form--grid">
                  <label className="field">
                    <span>Definition</span>
                    <select
                      value={calcId}
                      onChange={(event) => {
                        setCalcId(event.target.value as CalculationId);
                        setCalcRun(null);
                        setCalcInputs({});
                        setCalcError(null);
                      }}
                    >
                      {CALCULATIONS.map((item) => (
                        <option key={item.id} value={item.id}>
                          {item.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  {definition.inputs.map((input) => (
                    <label className="field" key={input.key}>
                      <span>
                        {input.label} ({input.unit})
                      </span>
                      <input
                        type="number"
                        min={input.min}
                        max={input.max}
                        step={input.step ?? 0.1}
                        value={calcInputs[input.key] ?? ''}
                        onChange={(event) => {
                          setCalcInputs((current) => ({ ...current, [input.key]: event.target.value }));
                          setCalcRun(null);
                        }}
                      />
                      <span className="field__hint">{input.description}</span>
                    </label>
                  ))}
                </div>
                <p className="panel-caption">{definition.formula}</p>
                <div className="wb-inline-form">
                  <button type="button" className="button button--ghost button--small" onClick={runCalc}>
                    Run calculation
                  </button>
                  {calcRun?.status === 'ok' && (
                    <button type="button" className="button button--ember button--small" onClick={saveCalculation}>
                      Record in notebook
                    </button>
                  )}
                  {calcRun && (
                    <button
                      type="button"
                      className="text-link"
                      onClick={() =>
                        downloadText(
                          `calculation-${calcRun.calculation_id}.md`,
                          calculationToMarkdown(calcRun),
                          'text/markdown',
                        )
                      }
                    >
                      Download derivation
                    </button>
                  )}
                </div>
                {calcError && (
                  <p role="alert" className="wb-alert">
                    {calcError}
                  </p>
                )}
                {calcRun && (
                  <div className="wb-calculation-result">
                    <div className="wb-calculation-result__value">
                      {calcRun.result ? `${calcRun.result.display} ${calcRun.output_unit}` : 'Invalid'}
                    </div>
                    <p>{calcRun.formula}</p>
                    <ol>
                      {calcRun.steps.map((step) => (
                        <li key={step}>{step}</li>
                      ))}
                    </ol>
                    <p className="panel-caption">
                      {calcRun.rounding_policy} Provenance: {calcRun.source}. Limitations:{' '}
                      {calcRun.limitations.join(' ')}
                    </p>
                  </div>
                )}
              </Panel>

              <Panel kicker="Notebook items" title={`${active.items.length} item(s)`}>
                {active.items.length === 0 ? (
                  <p className="muted">No items yet. Every item is typed; nothing is silently promoted to evidence.</p>
                ) : (
                  <ul className="wb-item-list">
                    {active.items.map((item) => {
                      const verification = verifyNotebookItem(item);
                      return (
                        <li key={item.id} className="wb-item">
                          <div className="wb-item__head">
                            <Badge tone={itemTypeTones[item.type]}>{itemTypeLabels[item.type]}</Badge>
                            <Badge tone={verdictTones[verification.verdict]}>{verdictLabels[verification.verdict]}</Badge>
                            <span className="mono muted">{item.created_at.slice(0, 16).replace('T', ' ')}</span>
                            <button
                              type="button"
                              className="text-link"
                              onClick={() => {
                                const updated = removeNotebookItem(document, active.id, item.id);
                                if (updated.error) setNotice(updated.error);
                                else persist(updated.document, 'Notebook item removed.');
                              }}
                            >
                              Remove
                            </button>
                          </div>
                          <p className="wb-item__text">{item.text || <span className="muted">(calculation only)</span>}</p>
                          <div className="wb-item__meta">
                            {item.record_ids.length > 0 && <span>Records: {item.record_ids.join(', ')}</span>}
                            {item.source_ids.length > 0 && <span>Sources: {item.source_ids.join(', ')}</span>}
                            {item.field_keys.length > 0 && <span>Fields: {item.field_keys.join(', ')}</span>}
                          </div>
                          {item.calculation && (
                            <div className="wb-item__calc mono">
                              {item.calculation.formula} →{' '}
                              {item.calculation.result
                                ? `${item.calculation.result.display} ${item.calculation.output_unit}`
                                : 'invalid'}
                            </div>
                          )}
                          <details className="wb-item__verify">
                            <summary>Verification detail</summary>
                            <p>{verification.summary}</p>
                            <ul>
                              {verification.checks.map((check) => (
                                <li key={check.id}>
                                  <Badge
                                    tone={
                                      check.status === 'pass'
                                        ? 'mint'
                                        : check.status === 'warn'
                                          ? 'amber'
                                          : check.status === 'fail'
                                            ? 'red'
                                            : 'muted'
                                    }
                                  >
                                    {check.status}
                                  </Badge>{' '}
                                  <strong>{check.label}</strong> — {check.detail}
                                </li>
                              ))}
                            </ul>
                          </details>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </Panel>

              <Panel kicker="Timeline" title="Local change log">
                <ol className="wb-timeline">
                  {[...active.timeline].reverse().map((event) => (
                    <li key={event.id}>
                      <span className="mono muted">{event.at.slice(0, 16).replace('T', ' ')}</span>
                      <strong>{event.action}</strong>
                      <span>{event.detail}</span>
                    </li>
                  ))}
                </ol>
              </Panel>
            </>
          )}
        </div>
      </div>

      <RecordDrawer
        record={openRecord}
        onClose={() => setOpenRecordId(null)}
        onNavigate={(record: ExperimentRecord) => setOpenRecordId(record.experiment_id)}
        onAddToNotebook={(record: ExperimentRecord) => {
          const target = active;
          if (!target) return 'Open an investigation before adding a record.';
          const result = addRecordToDefaultInvestigation(document, record.experiment_id, { corpusVersion });
          if (result.error) return result.error;
          if (!saveNotebook(result.document).ok) return 'The record could not be saved locally.';
          setDocument(result.document);
          return `${record.experiment_id} added to “${result.investigation?.title ?? target.title}”.`;
        }}
      />
    </div>
  );
}
